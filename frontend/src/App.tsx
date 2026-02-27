import { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────
interface OnChainData {
  walletUsdc: number; pol: number; totalDeposited: number; totalRedeemed: number;
  totalClobReturns: number; totalSpentOnTrades: number; totalTokenValue: number;
  equity: number; netPnl: number;
  deposits: { hash: string; amount: number; from: string }[];
  redemptions: { hash: string; amount: number }[];
  ts: number;
}
interface TradeStats { matched: number; failed: number; total: number; }
interface DashboardData { positions: any[]; trades: any[]; equityCurve: any[]; drawdownSeries: any[]; edgeObservations: any[]; onChain: OnChainData | null; tradeStats: TradeStats; }

// ─── EST Formatters ─────────────────────────────────────────────
const estOpts: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York' };
const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUsd = (n: number) => (n >= 0 ? '+' : '-') + '$' + fmt(Math.abs(n));
const fmtTimeEST = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { ...estOpts, hour: '2-digit', minute: '2-digit', hour12: true });

// Smart date: "Today 2:30 PM", "Yesterday 9:15 PM", "Feb 25 4:00 PM"
const fmtSmartDate = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', estOpts));
  const estD = new Date(d.toLocaleString('en-US', estOpts));
  const diffDays = Math.floor((estNow.setHours(0,0,0,0) - estD.setHours(0,0,0,0)) / 86400000);
  const time = fmtTimeEST(ts);
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString('en-US', { ...estOpts, month: 'short', day: 'numeric' })} ${time}`;
};

const truncAddr = (a: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
const pnlColor = (v: number) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
const WALLET = '0xA74C6d8B96acba2372E85967Fb82EAa948A7AdFe';
const CTF = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const isRealTxHash = (h: string | null) => h && h.length >= 64; // real tx hashes are 66 chars (0x + 64 hex)
// Server-side slug resolver → redirects to polymarket.com/event/<slug>
const pmLink = (tokenId: string) => `/pm/${tokenId}`;

const parseMeta = (m: any) => {
  if (!m) return {};
  if (typeof m === 'string') try { return JSON.parse(m); } catch { return {}; }
  return m;
};

// ─── Animated Number ────────────────────────────────────────────
function AnimNum({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  return (
    <motion.span key={Math.round(value * 100)} initial={{ opacity: 0.5, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {prefix}{fmt(value)}{suffix}
    </motion.span>
  );
}

// ─── Clickable Metric Card ──────────────────────────────────────
function MetricCard({ label, value, prefix = '', suffix = '', colorize = false, onClick, detail }: {
  label: string; value: number; prefix?: string; suffix?: string; colorize?: boolean; onClick?: () => void; detail?: string;
}) {
  const color = colorize ? pnlColor(value) : 'text-white';
  return (
    <div onClick={onClick}
      className={`bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5 transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5' : 'hover:border-[#334155]'}`}>
      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">{label}</div>
      <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${color} tabular-nums`}>
        <AnimNum value={value} prefix={prefix} suffix={suffix} />
      </div>
      {detail && <div className="text-[10px] text-gray-500 mt-1">{detail}</div>}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────
function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium">
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
      <span className={connected ? 'text-emerald-400' : 'text-red-400'}>{connected ? 'LIVE' : 'OFFLINE'}</span>
    </div>
  );
}

// ─── Equity Chart ───────────────────────────────────────────────
function EquityChart({ data }: { data: any[] }) {
  const chartData = data.slice().reverse().map((d: any) => ({ ts: d.ts, time: fmtTimeEST(d.ts), equity: d.value }));
  if (!chartData.length) return <div className="text-gray-600 text-sm p-8 text-center italic">No equity data yet — trades will populate this</div>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <defs><linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} domain={['auto', 'auto']} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`$${fmt(v ?? 0)}`, 'Equity']} labelStyle={{ color: '#9ca3af' }} />
        <Area type="monotone" dataKey="equity" stroke="#10b981" fill="url(#eqG)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Edge Distribution ──────────────────────────────────────────
function EdgeChart({ trades }: { trades: any[] }) {
  const buckets: Record<number, number> = {};
  for (const t of trades) { const e = Math.round(t.edge || 0); buckets[e] = (buckets[e] || 0) + 1; }
  const data = Object.entries(buckets).map(([k, v]) => ({ edge: `${k}%`, count: v })).sort((a, b) => parseFloat(a.edge) - parseFloat(b.edge)).slice(0, 20);
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="edge" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} /><YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#3b82f6' : '#6366f1'} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Equity Breakdown Modal ─────────────────────────────────────
function EquityBreakdown({ data, onClose }: { data: DashboardData; onClose: () => void }) {
  const positions = data.positions || [];
  const oc = data.onChain;
  const tStats = data.tradeStats || { matched: 0, failed: 0, total: 0 };
  const walletUsdc = oc?.walletUsdc ?? 0;
  const onChainTokenValue = oc?.totalTokenValue ?? 0;
  const equity = oc?.equity ?? 0;
  const totalDeposited = oc?.totalDeposited ?? 0;
  const totalRedeemed = oc?.totalRedeemed ?? 0;
  const totalSpent = oc?.totalSpentOnTrades ?? 0;
  const clobReturns = oc?.totalClobReturns ?? 0;
  const netPnl = oc?.netPnl ?? 0;

  const verifiedPositions = positions.filter((p: any) => p.on_chain_tokens != null && p.on_chain_tokens > 0);
  const dbOnlyPositions = positions.filter((p: any) => p.on_chain_tokens != null && p.on_chain_tokens === 0 && p.size > 0);

  const pieData = [
    { name: 'Wallet USDC', value: walletUsdc, fill: '#10b981' },
    { name: 'Token Value', value: onChainTokenValue, fill: '#3b82f6' },
    { name: 'Redeemed', value: totalRedeemed, fill: '#a78bfa' },
  ].filter(d => d.value > 0.01);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-[#111827] border border-[#1e293b] rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">💰 On-Chain Equity Breakdown</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mb-4 text-[11px] text-emerald-400">
          🔗 Every number below verified via Polygon RPC + Alchemy transfer history — zero DB financial data
        </div>

        {pieData.length > 0 && (
          <div className="flex justify-center mb-4">
            <PieChart width={180} height={180}><Pie data={pieData} cx={90} cy={90} innerRadius={45} outerRadius={70} dataKey="value" /></PieChart>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold pt-1">Current Holdings</div>
          <a href={`https://polygonscan.com/address/${WALLET}`} target="_blank" rel="noreferrer" className="flex justify-between py-2 border-b border-[#1e293b] hover:bg-[#1a2332] rounded px-1 -mx-1 cursor-pointer"><span className="text-gray-400">Wallet USDC.e ↗</span><span className="font-mono">${fmt(walletUsdc)}</span></a>
          <a href={`https://polygonscan.com/token/${CTF}?a=${WALLET}`} target="_blank" rel="noreferrer" className="flex justify-between py-2 border-b border-[#1e293b] hover:bg-[#1a2332] rounded px-1 -mx-1 cursor-pointer"><span className="text-gray-400">On-Chain Token Value ↗</span><span className="font-mono text-blue-400">${fmt(onChainTokenValue)}</span></a>
          <a href={`https://polygonscan.com/address/${WALLET}`} target="_blank" rel="noreferrer" className="flex justify-between py-2 border-b border-[#1e293b] hover:bg-[#1a2332] rounded px-1 -mx-1 cursor-pointer font-bold text-base"><span>Verified Equity ↗</span><span className="text-emerald-400">${fmt(equity)}</span></a>

          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold pt-3">On-Chain Flow (All Time)</div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Deposited ({oc?.deposits?.length ?? 0} TXs)</span><span className="font-mono">${fmt(totalDeposited)}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Spent on Trades</span><span className="font-mono text-red-400">${fmt(totalSpent)}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">CTF Redemptions ({oc?.redemptions?.length ?? 0} TXs)</span><span className="font-mono text-purple-400">${fmt(totalRedeemed)}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">CLOB Returns</span><span className="font-mono">${fmt(clobReturns)}</span></div>

          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold pt-3">P&L</div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Formula</span><span className="font-mono text-[10px] text-gray-500">(equity + redeemed + returns) − deposited</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b] font-bold text-base"><span>Net P&L</span><span className={`font-mono ${pnlColor(netPnl)}`}>{fmtUsd(netPnl)}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">ROI</span><span className={`font-mono ${pnlColor(netPnl)}`}>{totalDeposited > 0 ? fmt((netPnl / totalDeposited) * 100) : '0.00'}%</span></div>

          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold pt-3">Trade Stats (DB)</div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Matched/Filled</span><span className="font-mono text-emerald-400">{tStats.matched}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Failed</span><span className="font-mono text-red-400">{tStats.failed}</span></div>

          {verifiedPositions.length > 0 && (<>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold pt-3">Verified Positions ({verifiedPositions.length})</div>
            {verifiedPositions.map((p: any, i: number) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-[#1e293b]/50 text-xs">
                <a href={pmLink(p.market_id)} target="_blank" rel="noreferrer" className="hover:text-purple-400 underline decoration-gray-700">{p.outcome}</a>
                <span className="font-mono text-blue-400">{fmt(p.on_chain_tokens)} tokens (${fmt(p.on_chain_tokens * p.avg_price)})</span>
              </div>
            ))}
          </>)}

          {dbOnlyPositions.length > 0 && (<>
            <div className="text-[10px] uppercase tracking-wider text-yellow-500 font-semibold pt-3">⚠️ DB Only — Not On-Chain ({dbOnlyPositions.length})</div>
            <div className="text-[10px] text-gray-600 mb-1">These were likely redeemed or settled but DB wasn't updated</div>
            {dbOnlyPositions.map((p: any, i: number) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-[#1e293b]/50 text-xs text-gray-600">
                <span>{p.outcome}</span>
                <span className="font-mono">DB: {p.size} (chain: 0)</span>
              </div>
            ))}
          </>)}

          {oc?.deposits && oc.deposits.length > 0 && (<>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold pt-3">Deposit History</div>
            {oc.deposits.map((d: any, i: number) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-[#1e293b]/50 text-xs">
                <a href={`https://polygonscan.com/tx/${d.hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">{d.hash.slice(0, 14)}…</a>
                <span className="font-mono">${fmt(d.amount)} from {d.from.slice(0, 8)}…</span>
              </div>
            ))}
          </>)}

          {oc?.redemptions && oc.redemptions.length > 0 && (<>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold pt-3">Redemption History (On-Chain)</div>
            {oc.redemptions.map((r: any, i: number) => (
              <div key={i} className="flex justify-between py-1.5 border-b border-[#1e293b]/50 text-xs">
                <a href={`https://polygonscan.com/tx/${r.hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">{r.hash.slice(0, 14)}…</a>
                <span className="font-mono text-purple-400">${fmt(r.amount)}</span>
              </div>
            ))}
          </>)}
        </div>

        <div className="mt-4 flex justify-center gap-4">
          <a href={`https://polygonscan.com/address/${WALLET}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs underline">Wallet ↗</a>
          <a href={`https://polygonscan.com/token/${CTF}?a=${WALLET}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs underline">CTF Tokens ↗</a>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main App ───────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [tab, setTab] = useState<'dashboard' | 'positions' | 'trades' | 'failed-trades' | 'redemptions'>('dashboard');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = useCallback(async () => {
    try { const res = await fetch('/dashboard'); setData(await res.json()); setLastUpdate(new Date()); } catch {}
  }, []);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 15000); return () => clearInterval(iv); }, [fetchData]);

  useEffect(() => {
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    let timer: any;
    function connect() {
      const ws = new WebSocket(url); wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); timer = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = () => fetchData();
    }
    connect();
    return () => { wsRef.current?.close(); clearTimeout(timer); };
  }, [fetchData]);

  if (!data) return <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center"><div className="text-gray-500 text-lg animate-pulse">Loading Poly Edge v2…</div></div>;

  const positions = data.positions || [];
  const trades = data.trades || [];
  const oc = data.onChain;
  const ts = data.tradeStats || { matched: 0, failed: 0, total: 0 };
  // ALL financial numbers from on-chain Polygon RPC
  const equity = oc?.equity ?? 0;
  const walletUsdc = oc?.walletUsdc ?? 0;
  const onChainValue = oc?.totalTokenValue ?? 0;
  const totalRedeemed = oc?.totalRedeemed ?? 0;
  const totalDeposited = oc?.totalDeposited ?? 0;
  const netPnl = oc?.netPnl ?? 0;
  const totalSpent = oc?.totalSpentOnTrades ?? 0;
  const clobReturns = oc?.totalClobReturns ?? 0;

  const successTrades = trades.filter((t: any) => t.status === 'matched' || t.status === 'filled');
  const failedTrades = trades.filter((t: any) => t.status !== 'matched' && t.status !== 'filled');
  const tabs = [
    { id: 'dashboard' as const, label: '📊 Dashboard' },
    { id: 'positions' as const, label: `📈 Positions (${positions.length})` },
    { id: 'trades' as const, label: `✅ Trades (${successTrades.length})` },
    { id: 'failed-trades' as const, label: `❌ Failed (${failedTrades.length})` },
    { id: 'redemptions' as const, label: `💰 Redemptions (${oc?.redemptions?.length ?? 0})` },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      {/* Equity Breakdown Modal */}
      <AnimatePresence>{showBreakdown && <EquityBreakdown data={data} onClose={() => setShowBreakdown(false)} />}</AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0e17]/95 backdrop-blur-md border-b border-[#1e293b] px-4 sm:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">⚡ Poly Edge <span className="text-emerald-400">v2</span></h1>
            <StatusBadge connected={connected} />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>{lastUpdate.toLocaleTimeString('en-US', estOpts)} EST</span>
            <a href={`https://polygonscan.com/address/${WALLET}`} target="_blank" rel="noreferrer"
              className="font-mono bg-[#111827] px-2 py-1 rounded text-gray-400 hover:text-blue-400 transition-colors hidden sm:inline">
              {truncAddr(WALLET)}
            </a>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-[#1e293b] px-4 sm:px-6 overflow-x-auto scrollbar-none">
        <div className="max-w-[1600px] mx-auto flex gap-0.5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                tab === t.id ? 'text-emerald-400 border-emerald-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <AnimatePresence mode="wait">
          {/* ═══ DASHBOARD TAB ═══ */}
          {tab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 sm:space-y-6">
              {/* Portfolio Cards — clickable */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                <MetricCard label="Verified Equity" value={equity} prefix="$" onClick={() => setShowBreakdown(true)} detail="🔗 On-chain verified — click for breakdown" />
                <MetricCard label="Net P&L" value={netPnl} prefix={netPnl >= 0 ? '+$' : '-$'} colorize onClick={() => setShowBreakdown(true)} detail={`Deposited: $${fmt(totalDeposited)}`} />
                <MetricCard label="Token Value" value={onChainValue} prefix="$" onClick={() => setTab('positions')} detail="CTF positions on Polygon" />
                <MetricCard label="Redeemed" value={totalRedeemed} prefix="$" onClick={() => setShowBreakdown(true)} detail={`${oc?.redemptions?.length ?? 0} on-chain TXs`} />
                <MetricCard label="Wallet USDC" value={walletUsdc} prefix="$" detail="On-chain balance" onClick={() => window.open(`https://polygonscan.com/address/${WALLET}`, '_blank')} />
                <MetricCard label="Matched Trades" value={ts.matched} onClick={() => setTab('trades')} detail={`${ts.failed} failed of ${ts.total}`} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">📈 Equity Curve</h3>
                  <EquityChart data={data.equityCurve || []} />
                </div>
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">📊 Edge Distribution</h3>
                  <EdgeChart trades={trades} />
                </div>
              </div>

              {/* On-Chain Flow */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                <MetricCard label="Total Deposited" value={totalDeposited} prefix="$" onClick={() => setShowBreakdown(true)} detail={`${oc?.deposits?.length ?? 0} deposits`} />
                <MetricCard label="Spent on Trades" value={totalSpent} prefix="$" onClick={() => setTab('trades')} />
                <MetricCard label="CLOB Returns" value={clobReturns} prefix="$" detail="Cancelled/returned orders" />
                <MetricCard label="ROI" value={totalDeposited > 0 ? (netPnl / totalDeposited) * 100 : 0} suffix="%" colorize />
                <MetricCard label="Open Positions" value={positions.filter((p: any) => p.on_chain_tokens > 0).length} onClick={() => setTab('positions')} detail={`${positions.length} in DB`} />
                <MetricCard label="On-Chain TXs" value={(oc?.deposits?.length ?? 0) + (oc?.redemptions?.length ?? 0)} detail="Deposits + redemptions verified" onClick={() => window.open(`https://polygonscan.com/address/${WALLET}`, '_blank')} />
              </div>

              {/* Recent Trades Preview */}
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-300">🔄 Recent Trades</h3>
                  <button onClick={() => setTab('trades')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead><tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left py-2 px-2 sm:px-3">When</th><th className="text-left py-2 px-2 sm:px-3">Team</th>
                      <th className="text-right py-2 px-2 sm:px-3 hidden sm:table-cell">Side</th><th className="text-right py-2 px-2 sm:px-3">Price</th>
                      <th className="text-right py-2 px-2 sm:px-3">Size</th><th className="text-right py-2 px-2 sm:px-3">Edge</th>
                      <th className="text-right py-2 px-2 sm:px-3">Status</th><th className="text-right py-2 px-2 sm:px-3">TX</th>
                    </tr></thead>
                    <tbody>{trades.slice(0, 10).map((t: any, i: number) => (
                      <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                        <td className="py-2 px-2 sm:px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">{fmtSmartDate(t.ts)}</td>
                        <td className="py-2 px-2 sm:px-3 font-medium text-xs sm:text-sm">{t.outcome || 'N/A'}</td>
                        <td className={`py-2 px-2 sm:px-3 text-right font-semibold hidden sm:table-cell ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</td>
                        <td className="py-2 px-2 sm:px-3 text-right font-mono">{fmt(t.price)}</td>
                        <td className="py-2 px-2 sm:px-3 text-right font-mono">{fmt(t.size)}</td>
                        <td className="py-2 px-2 sm:px-3 text-right font-mono text-blue-400">{fmt(t.edge)}%</td>
                        <td className="py-2 px-2 sm:px-3 text-right"><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.status === 'matched' || t.status === 'filled' ? 'bg-emerald-500/20 text-emerald-400' : t.status === 'FAILED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{t.status}</span></td>
                        <td className="py-2 px-2 sm:px-3 text-right">{isRealTxHash(t.tx_hash) ? <a href={`https://polygonscan.com/tx/${t.tx_hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] underline">↗</a> : ''}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ POSITIONS TAB ═══ */}
          {tab === 'positions' && (
            <motion.div key="pos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">📈 Open Positions ({positions.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead><tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left py-2 px-2 sm:px-3">Team</th><th className="text-left py-2 px-2 sm:px-3 hidden md:table-cell">Game</th>
                      <th className="text-right py-2 px-2 sm:px-3">Tokens (On-Chain)</th><th className="text-right py-2 px-2 sm:px-3">Avg Price</th>
                      <th className="text-right py-2 px-2 sm:px-3">Value</th>
                      <th className="text-right py-2 px-2 sm:px-3">Status</th><th className="text-right py-2 px-2 sm:px-3">Links</th>
                    </tr></thead>
                    <tbody>{positions.map((p: any, i: number) => {
                      const meta = parseMeta(p.meta);
                      const tokens = p.on_chain_tokens ?? 0;
                      const value = tokens * p.avg_price;
                      return (
                        <tr key={i} className={`border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors ${tokens === 0 ? 'opacity-40' : ''}`}>
                          <td className="py-2.5 px-2 sm:px-3 font-medium">
                            <a href={pmLink(p.market_id)} target="_blank" rel="noreferrer" className="hover:text-purple-400 transition-colors underline decoration-gray-700 hover:decoration-purple-400">{p.outcome || 'N/A'}</a>
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-gray-500 text-[11px] max-w-[200px] truncate hidden md:table-cell">{meta.game || ''}</td>
                          <td className="py-2.5 px-2 sm:px-3 text-right font-mono">
                            <span className={tokens > 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(tokens, 2)}</span>
                            {tokens !== p.size && <span className="text-gray-600 text-[9px] ml-1">(DB: {p.size})</span>}
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-right font-mono">${fmt(p.avg_price)}</td>
                          <td className="py-2.5 px-2 sm:px-3 text-right font-mono">${fmt(value)}</td>
                          <td className="py-2.5 px-2 sm:px-3 text-right">
                            {tokens > 0
                              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">✓ On-chain</span>
                              : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">✗ Settled/Redeemed</span>
                            }
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-right space-x-1.5">
                            <a href={pmLink(p.market_id)} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-[10px] underline">Market ↗</a>
                            <a href={`https://polygonscan.com/token/${CTF}?a=${WALLET}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] underline">Wallet ↗</a>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                  {!positions.length && <div className="text-gray-600 text-center py-8 italic">No open positions</div>}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ TRADES TAB ═══ */}
          {tab === 'trades' && (
            <motion.div key="trades" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">✅ Successful Trades ({successTrades.length})</h3>
                <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-[#111827] z-10"><tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left py-2 px-2 sm:px-3">When (EST)</th><th className="text-left py-2 px-2 sm:px-3">Team</th>
                      <th className="text-left py-2 px-2 sm:px-3 hidden lg:table-cell">Game</th>
                      <th className="text-right py-2 px-2 sm:px-3">Side</th><th className="text-right py-2 px-2 sm:px-3">Price</th>
                      <th className="text-right py-2 px-2 sm:px-3">Size</th><th className="text-right py-2 px-2 sm:px-3">Edge</th>
                      <th className="text-right py-2 px-2 sm:px-3">Status</th><th className="text-right py-2 px-2 sm:px-3">Links</th>
                    </tr></thead>
                    <tbody>{successTrades.map((t: any, i: number) => {
                      const meta = parseMeta(t.meta);
                      return (
                        <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                          <td className="py-2 px-2 sm:px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">{fmtSmartDate(t.ts)}</td>
                          <td className="py-2 px-2 sm:px-3 font-medium whitespace-nowrap">
                            <a href={pmLink(t.market_id)} target="_blank" rel="noreferrer" className="hover:text-purple-400 transition-colors underline decoration-gray-700 hover:decoration-purple-400">{t.outcome || 'N/A'}</a>
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-gray-500 text-[11px] max-w-[200px] truncate hidden lg:table-cell">{meta.game || ''}</td>
                          <td className={`py-2 px-2 sm:px-3 text-right font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</td>
                          <td className="py-2 px-2 sm:px-3 text-right font-mono">{fmt(t.price)}</td>
                          <td className="py-2 px-2 sm:px-3 text-right font-mono">{fmt(t.size)}</td>
                          <td className="py-2 px-2 sm:px-3 text-right font-mono text-blue-400">{fmt(t.edge)}%</td>
                          <td className="py-2 px-2 sm:px-3 text-right"><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.status === 'matched' || t.status === 'filled' ? 'bg-emerald-500/20 text-emerald-400' : t.status === 'FAILED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{t.status}</span></td>
                          <td className="py-2 px-2 sm:px-3 text-right space-x-1">
                            {isRealTxHash(t.tx_hash) && <a href={`https://polygonscan.com/tx/${t.tx_hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] underline">TX ↗</a>}
                            <a href={pmLink(t.market_id)} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-[10px] underline">Market ↗</a>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ FAILED TRADES TAB ═══ */}
          {tab === 'failed-trades' && (
            <motion.div key="failed-trades" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-300">❌ Failed / Delayed Trades ({failedTrades.length})</h3>
                  <span className="text-xs text-red-400 font-mono">{failedTrades.filter((t: any) => t.status === 'FAILED').length} failed · {failedTrades.filter((t: any) => t.status === 'delayed').length} delayed · {failedTrades.filter((t: any) => t.status !== 'FAILED' && t.status !== 'delayed').length} other</span>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-[11px] text-red-400">
                  ⚠️ These trades were attempted but did not fill successfully — FAILED (rejected/error), delayed (not confirmed), or other non-success statuses.
                </div>
                <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-[#111827] z-10"><tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left py-2 px-2 sm:px-3">When (EST)</th><th className="text-left py-2 px-2 sm:px-3">Team</th>
                      <th className="text-left py-2 px-2 sm:px-3 hidden lg:table-cell">Game</th>
                      <th className="text-right py-2 px-2 sm:px-3">Side</th><th className="text-right py-2 px-2 sm:px-3">Price</th>
                      <th className="text-right py-2 px-2 sm:px-3">Size</th><th className="text-right py-2 px-2 sm:px-3">Edge</th>
                      <th className="text-right py-2 px-2 sm:px-3">Status</th><th className="text-right py-2 px-2 sm:px-3">Links</th>
                    </tr></thead>
                    <tbody>{failedTrades.map((t: any, i: number) => {
                      const meta = parseMeta(t.meta);
                      return (
                        <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors opacity-75">
                          <td className="py-2 px-2 sm:px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">{fmtSmartDate(t.ts)}</td>
                          <td className="py-2 px-2 sm:px-3 font-medium whitespace-nowrap">
                            <a href={pmLink(t.market_id)} target="_blank" rel="noreferrer" className="hover:text-purple-400 transition-colors underline decoration-gray-700 hover:decoration-purple-400">{t.outcome || 'N/A'}</a>
                          </td>
                          <td className="py-2 px-2 sm:px-3 text-gray-500 text-[11px] max-w-[200px] truncate hidden lg:table-cell">{meta.game || ''}</td>
                          <td className={`py-2 px-2 sm:px-3 text-right font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</td>
                          <td className="py-2 px-2 sm:px-3 text-right font-mono">{fmt(t.price)}</td>
                          <td className="py-2 px-2 sm:px-3 text-right font-mono">{fmt(t.size)}</td>
                          <td className="py-2 px-2 sm:px-3 text-right font-mono text-blue-400">{fmt(t.edge)}%</td>
                          <td className="py-2 px-2 sm:px-3 text-right"><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.status === 'FAILED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{t.status}</span></td>
                          <td className="py-2 px-2 sm:px-3 text-right space-x-1">
                            {isRealTxHash(t.tx_hash) && <a href={`https://polygonscan.com/tx/${t.tx_hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] underline">TX ↗</a>}
                            <a href={pmLink(t.market_id)} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-[10px] underline">Market ↗</a>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ REDEMPTIONS TAB (ON-CHAIN ONLY) ═══ */}
          {tab === 'redemptions' && (
            <motion.div key="redeem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-300">💰 On-Chain Redemptions ({oc?.redemptions?.length ?? 0})</h3>
                  <span className="text-xs text-emerald-400 font-mono">${fmt(totalRedeemed)} total</span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mb-3 text-[11px] text-emerald-400">
                  🔗 Only showing verified on-chain CTF redemptions from contract {CTF.slice(0,8)}…
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead><tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left py-2 px-2 sm:px-3">TX Hash</th>
                      <th className="text-right py-2 px-2 sm:px-3">Amount</th>
                      <th className="text-right py-2 px-2 sm:px-3">Verify</th>
                    </tr></thead>
                    <tbody>{(oc?.redemptions || []).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                        <td className="py-2.5 px-2 sm:px-3 font-mono text-[11px] text-gray-400">{r.hash.slice(0, 20)}…</td>
                        <td className="py-2.5 px-2 sm:px-3 text-right font-mono text-emerald-400 font-bold">${fmt(r.amount)}</td>
                        <td className="py-2.5 px-2 sm:px-3 text-right">
                          <a href={`https://polygonscan.com/tx/${r.hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] underline">Polygonscan ↗</a>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {(!oc?.redemptions || oc.redemptions.length === 0) && <div className="text-gray-600 text-center py-8 italic">No on-chain redemptions found</div>}
                </div>
              </div>

              {/* Deposits section */}
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5 mt-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">📥 Deposits ({oc?.deposits?.length ?? 0})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead><tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left py-2 px-2 sm:px-3">TX Hash</th>
                      <th className="text-left py-2 px-2 sm:px-3">From</th>
                      <th className="text-right py-2 px-2 sm:px-3">Amount</th>
                      <th className="text-right py-2 px-2 sm:px-3">Verify</th>
                    </tr></thead>
                    <tbody>{(oc?.deposits || []).map((d: any, i: number) => (
                      <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                        <td className="py-2.5 px-2 sm:px-3 font-mono text-[11px] text-gray-400">{d.hash.slice(0, 20)}…</td>
                        <td className="py-2.5 px-2 sm:px-3 font-mono text-[11px] text-gray-500">{d.from.slice(0, 10)}…</td>
                        <td className="py-2.5 px-2 sm:px-3 text-right font-mono font-bold">${fmt(d.amount)}</td>
                        <td className="py-2.5 px-2 sm:px-3 text-right">
                          <a href={`https://polygonscan.com/tx/${d.hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] underline">Polygonscan ↗</a>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
