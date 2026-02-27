import { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────
interface DashboardData { positions: any[]; trades: any[]; analytics: any; equityCurve: any[]; drawdownSeries: any[]; edgeObservations: any[]; redemptions: any[]; }

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
  const a = data.analytics || {};
  const pnl = a.pnl || { realized: 0, unrealized: 0, total: 0 };
  const positions = data.positions || [];
  const trades = data.trades || [];
  const redemptions = data.redemptions || [];
  const totalRedeemed = redemptions.reduce((s: number, r: any) => s + (r.amount || 0), 0);
  const totalCost = positions.reduce((s: number, p: any) => s + (p.size * p.avg_price), 0);
  const matchedTrades = trades.filter((t: any) => t.status === 'matched' || t.status === 'filled' || t.status === 'delayed');
  const failedTrades = trades.filter((t: any) => t.status === 'FAILED');

  const pieData = [
    { name: 'Realized P&L', value: Math.abs(pnl.realized), fill: pnl.realized >= 0 ? '#10b981' : '#ef4444' },
    { name: 'Unrealized P&L', value: Math.abs(pnl.unrealized), fill: pnl.unrealized >= 0 ? '#34d399' : '#f87171' },
    { name: 'Open Exposure', value: totalCost, fill: '#3b82f6' },
    { name: 'Redeemed', value: totalRedeemed, fill: '#a78bfa' },
  ].filter(d => d.value > 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-[#111827] border border-[#1e293b] rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold">💰 Equity Breakdown</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>
        {pieData.length > 0 && (
          <div className="flex justify-center mb-5">
            <PieChart width={200} height={200}><Pie data={pieData} cx={100} cy={100} innerRadius={50} outerRadius={80} dataKey="value" /></PieChart>
          </div>
        )}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Starting Capital</span><span className="font-mono">$1,000.00</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Realized P&L</span><span className={`font-mono font-bold ${pnlColor(pnl.realized)}`}>{fmtUsd(pnl.realized)}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Unrealized P&L</span><span className={`font-mono font-bold ${pnlColor(pnl.unrealized)}`}>{fmtUsd(pnl.unrealized)}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Total Redeemed</span><span className="font-mono text-purple-400">${fmt(totalRedeemed)}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Open Exposure</span><span className="font-mono text-blue-400">${fmt(totalCost)}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Open Positions</span><span className="font-mono">{positions.length}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Matched Trades</span><span className="font-mono text-emerald-400">{matchedTrades.length}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Failed Trades</span><span className="font-mono text-red-400">{failedTrades.length}</span></div>
          <div className="flex justify-between py-2 border-b border-[#1e293b]"><span className="text-gray-400">Redemptions</span><span className="font-mono">{redemptions.length}</span></div>
          <div className="flex justify-between py-2 font-bold text-base"><span>Total Equity</span><span className="text-emerald-400">${fmt(1000 + pnl.total)}</span></div>
        </div>
        <div className="mt-4 text-center">
          <a href={`https://polygonscan.com/address/${WALLET}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs underline">
            View wallet on Polygonscan ↗
          </a>
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
  const [tab, setTab] = useState<'dashboard' | 'positions' | 'trades' | 'redemptions'>('dashboard');
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

  const a = data.analytics || {};
  const pnl = a.pnl || { realized: 0, unrealized: 0, total: 0 };
  const positions = data.positions || [];
  const trades = data.trades || [];
  const redemptions = data.redemptions || [];
  const equity = 1000 + pnl.total;

  const tabs = [
    { id: 'dashboard' as const, label: '📊 Dashboard' },
    { id: 'positions' as const, label: `📈 Positions (${positions.length})` },
    { id: 'trades' as const, label: `🔄 Trades (${trades.length})` },
    { id: 'redemptions' as const, label: `💰 Redemptions (${redemptions.length})` },
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
                <MetricCard label="Total Equity" value={equity} prefix="$" onClick={() => setShowBreakdown(true)} detail="Click for breakdown" />
                <MetricCard label="Realized P&L" value={pnl.realized} prefix={pnl.realized >= 0 ? '+$' : '-$'} colorize onClick={() => setTab('trades')} detail="Click to see trades" />
                <MetricCard label="Unrealized P&L" value={pnl.unrealized} prefix={pnl.unrealized >= 0 ? '+$' : '-$'} colorize onClick={() => setTab('positions')} detail="Click to see positions" />
                <MetricCard label="ROI" value={a.roi * 100} suffix="%" colorize />
                <MetricCard label="Win Rate" value={a.winRate * 100} suffix="%" />
                <MetricCard label="Total Trades" value={trades.length} onClick={() => setTab('trades')} detail="Click to browse" />
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

              {/* Analytics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                <MetricCard label="Sharpe Ratio" value={a.sharpe || 0} />
                <MetricCard label="Max Drawdown" value={(a.maxDrawdown || 0) * 100} suffix="%" colorize />
                <MetricCard label="Edge Accuracy" value={(a.edgeAccuracy || 0) * 100} suffix="%" />
                <MetricCard label="Exposure" value={a.exposure?.v || 0} prefix="$" onClick={() => setTab('positions')} detail="Click to see positions" />
                <MetricCard label="Avg Slippage" value={(a.efficiency?.avgSlippage?.v || 0) * 100} suffix="%" />
                <MetricCard label="Redemptions" value={redemptions.length} onClick={() => setTab('redemptions')} detail="Click to see all" />
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
                      <th className="text-right py-2 px-2 sm:px-3">Shares</th><th className="text-right py-2 px-2 sm:px-3">Avg</th>
                      <th className="text-right py-2 px-2 sm:px-3">Cost</th><th className="text-right py-2 px-2 sm:px-3">P&L</th>
                      <th className="text-right py-2 px-2 sm:px-3">Links</th>
                    </tr></thead>
                    <tbody>{positions.map((p: any, i: number) => {
                      const meta = parseMeta(p.meta);
                      const cost = p.size * p.avg_price;
                      const upnl = (p.size * p.last_price) - cost;
                      return (
                        <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                          <td className="py-2.5 px-2 sm:px-3 font-medium">
                            <a href={pmLink(p.market_id)} target="_blank" rel="noreferrer" className="hover:text-purple-400 transition-colors underline decoration-gray-700 hover:decoration-purple-400">{p.outcome || 'N/A'}</a>
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-gray-500 text-[11px] max-w-[200px] truncate hidden md:table-cell">{meta.game || ''}</td>
                          <td className="py-2.5 px-2 sm:px-3 text-right font-mono">{fmt(p.size, 0)}</td>
                          <td className="py-2.5 px-2 sm:px-3 text-right font-mono">${fmt(p.avg_price)}</td>
                          <td className="py-2.5 px-2 sm:px-3 text-right font-mono">${fmt(cost)}</td>
                          <td className={`py-2.5 px-2 sm:px-3 text-right font-bold font-mono ${pnlColor(upnl)}`}>{fmtUsd(upnl)}</td>
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
                <h3 className="text-sm font-semibold text-gray-300 mb-3">🔄 Trade History ({trades.length})</h3>
                <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-[#111827] z-10"><tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left py-2 px-2 sm:px-3">When (EST)</th><th className="text-left py-2 px-2 sm:px-3">Team</th>
                      <th className="text-left py-2 px-2 sm:px-3 hidden lg:table-cell">Game</th>
                      <th className="text-right py-2 px-2 sm:px-3">Side</th><th className="text-right py-2 px-2 sm:px-3">Price</th>
                      <th className="text-right py-2 px-2 sm:px-3">Size</th><th className="text-right py-2 px-2 sm:px-3">Edge</th>
                      <th className="text-right py-2 px-2 sm:px-3">Status</th><th className="text-right py-2 px-2 sm:px-3">Links</th>
                    </tr></thead>
                    <tbody>{trades.map((t: any, i: number) => {
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

          {/* ═══ REDEMPTIONS TAB ═══ */}
          {tab === 'redemptions' && (
            <motion.div key="redeem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-300">💰 Redemptions ({redemptions.length})</h3>
                  <span className="text-xs text-emerald-400 font-mono">${fmt(redemptions.reduce((s: number, r: any) => s + (r.amount || 0), 0))} total</span>
                </div>
                <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="sticky top-0 bg-[#111827] z-10"><tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                      <th className="text-left py-2 px-2 sm:px-3">When (EST)</th><th className="text-left py-2 px-2 sm:px-3">Market</th>
                      <th className="text-right py-2 px-2 sm:px-3">Amount</th><th className="text-right py-2 px-2 sm:px-3">TX</th>
                    </tr></thead>
                    <tbody>{redemptions.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                        <td className="py-2 px-2 sm:px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">{fmtSmartDate(r.ts)}</td>
                        <td className="py-2 px-2 sm:px-3 font-medium text-xs">{r.market_id}</td>
                        <td className="py-2 px-2 sm:px-3 text-right font-mono text-emerald-400 font-bold">${fmt(r.amount)}</td>
                        <td className="py-2 px-2 sm:px-3 text-right">
                          {isRealTxHash(r.tx_hash) ? <a href={`https://polygonscan.com/tx/${r.tx_hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 font-mono text-[10px] underline">{r.tx_hash.slice(0, 10)}… ↗</a> : r.tx_hash ? <span className="text-gray-600 font-mono text-[10px]">{r.tx_hash.slice(0, 10)}…</span> : ''}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {!redemptions.length && <div className="text-gray-600 text-center py-8 italic">No redemptions yet</div>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
