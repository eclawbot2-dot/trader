import { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────
interface DashboardData {
  positions: any[];
  trades: any[];
  analytics: any;
  equityCurve: any[];
  drawdownSeries: any[];
  edgeObservations: any[];
  redemptions: any[];
}

// ─── Formatters ─────────────────────────────────────────────────
const fmt = (n: number, decimals = 2) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const fmtUsd = (n: number) => `$${fmt(Math.abs(n))}`;
const _fmtPct = (n: number) => `${fmt(n * 100, 1)}%`; void _fmtPct;
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const truncAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '';

// ─── Color helpers ──────────────────────────────────────────────
const pnlColor = (v: number) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-400';

// ─── Animated Number ────────────────────────────────────────────
function AnimNum({ value, prefix = '', suffix = '', className = '' }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.5, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {prefix}{typeof value === 'number' ? fmt(value) : value}{suffix}
    </motion.span>
  );
}

// ─── Metric Card ────────────────────────────────────────────────
function MetricCard({ label, value, prefix = '', suffix = '', colorize = false }: { label: string; value: number; prefix?: string; suffix?: string; colorize?: boolean }) {
  const color = colorize ? pnlColor(value) : 'text-white';
  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 hover:border-[#334155] transition-all duration-200">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">{label}</div>
      <div className={`text-2xl sm:text-3xl font-bold ${color} tabular-nums`}>
        <AnimNum value={value} prefix={prefix} suffix={suffix} />
      </div>
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────
function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
      <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
        {connected ? 'LIVE' : 'DISCONNECTED'}
      </span>
    </div>
  );
}

// ─── Equity Chart ───────────────────────────────────────────────
function EquityChart({ data }: { data: any[] }) {
  const chartData = data.slice().reverse().map((d: any) => ({
    ts: d.ts,
    time: fmtTime(d.ts),
    date: fmtDate(d.ts),
    equity: d.value,
  }));

  if (!chartData.length) return <div className="text-gray-600 text-sm p-8 text-center">No equity data yet</div>;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#9ca3af' }}
          formatter={(v: any) => [`$${fmt(v ?? 0)}`, 'Equity']}
        />
        <Area type="monotone" dataKey="equity" stroke="#10b981" fill="url(#eqGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Edge Distribution Chart ────────────────────────────────────
function EdgeChart({ trades }: { trades: any[] }) {
  const buckets: Record<string, number> = {};
  for (const t of trades) {
    const e = Math.round((t.edge || 0));
    const key = `${e}%`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  const data = Object.entries(buckets).map(([k, v]) => ({ edge: k, count: v })).sort((a, b) => parseFloat(a.edge) - parseFloat(b.edge)).slice(0, 20);

  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="edge" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} />
        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#3b82f6' : '#6366f1'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main App ───────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [tab, setTab] = useState<'dashboard' | 'positions' | 'trades' | 'redemptions'>('dashboard');
  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/dashboard');
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}/ws`;
    let reconnectTimer: any;

    function connect() {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = () => fetchData();
    }
    connect();
    return () => { wsRef.current?.close(); clearTimeout(reconnectTimer); };
  }, [fetchData]);

  if (!data) return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
      <div className="text-gray-500 text-lg animate-pulse">Loading Poly Edge v2...</div>
    </div>
  );

  const a = data.analytics || {};
  const pnl = a.pnl || { realized: 0, unrealized: 0, total: 0 };
  const positions = data.positions || [];
  const trades = data.trades || [];
  const redemptions = data.redemptions || [];
  const equity = 1000 + pnl.total;

  const parseMeta = (m: any) => {
    if (!m) return {};
    if (typeof m === 'string') try { return JSON.parse(m); } catch { return {}; }
    return m;
  };

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'positions', label: `📈 Positions (${positions.length})` },
    { id: 'trades', label: `🔄 Trades (${trades.length})` },
    { id: 'redemptions', label: `💰 Redemptions (${redemptions.length})` },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0a0e17]/95 backdrop-blur-md border-b border-[#1e293b] px-4 sm:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-tight">⚡ Poly Edge <span className="text-emerald-400">v2</span></h1>
            <StatusBadge connected={connected} />
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Updated {lastUpdate.toLocaleTimeString()}</span>
            <span className="hidden sm:inline font-mono bg-[#111827] px-2 py-1 rounded text-gray-400">
              {truncAddr('0xA74C6d8B96acba2372E85967Fb82EAa948A7AdFe')}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Tabs ───────────────────────────────────────────── */}
      <nav className="border-b border-[#1e293b] px-4 sm:px-6 overflow-x-auto">
        <div className="max-w-[1600px] mx-auto flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 ${
                tab === t.id
                  ? 'text-emerald-400 border-emerald-400'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ─── Content ────────────────────────────────────────── */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <AnimatePresence mode="wait">
          {tab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Portfolio Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard label="Total Equity" value={equity} prefix="$" />
                <MetricCard label="Realized P&L" value={pnl.realized} prefix={pnl.realized >= 0 ? '+$' : '-$'} colorize />
                <MetricCard label="Unrealized P&L" value={pnl.unrealized} prefix={pnl.unrealized >= 0 ? '+$' : '-$'} colorize />
                <MetricCard label="ROI" value={a.roi * 100} suffix="%" colorize />
                <MetricCard label="Win Rate" value={a.winRate * 100} suffix="%" />
                <MetricCard label="Total Trades" value={trades.length} />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4">Equity Curve</h3>
                  <EquityChart data={data.equityCurve || []} />
                </div>
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-300 mb-4">Edge Distribution</h3>
                  <EdgeChart trades={trades} />
                </div>
              </div>

              {/* Analytics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard label="Sharpe Ratio" value={a.sharpe || 0} />
                <MetricCard label="Max Drawdown" value={(a.maxDrawdown || 0) * 100} suffix="%" colorize />
                <MetricCard label="Edge Accuracy" value={(a.edgeAccuracy || 0) * 100} suffix="%" />
                <MetricCard label="Exposure" value={a.exposure?.v || 0} prefix="$" />
                <MetricCard label="Avg Slippage" value={(a.efficiency?.avgSlippage?.v || 0) * 100} suffix="%" />
                <MetricCard label="Open Positions" value={positions.length} />
              </div>

              {/* Recent Trades */}
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Recent Trades</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                        <th className="text-left py-2 px-3">Time</th>
                        <th className="text-left py-2 px-3">Team</th>
                        <th className="text-left py-2 px-3">Sport</th>
                        <th className="text-right py-2 px-3">Side</th>
                        <th className="text-right py-2 px-3">Price</th>
                        <th className="text-right py-2 px-3">Size</th>
                        <th className="text-right py-2 px-3">Edge</th>
                        <th className="text-right py-2 px-3">Status</th>
                        <th className="text-right py-2 px-3">On-Chain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 15).map((t: any, i: number) => {
                        const meta = parseMeta(t.meta);
                        return (
                          <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                            <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{fmtTime(t.ts)}</td>
                            <td className="py-2.5 px-3 font-medium">{t.outcome || 'N/A'}</td>
                            <td className="py-2.5 px-3 text-gray-500 text-xs uppercase">{meta.sport || ''}</td>
                            <td className={`py-2.5 px-3 text-right font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{fmt(t.price)}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{fmt(t.size)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-blue-400">{fmt(t.edge)}%</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                t.status === 'matched' || t.status === 'filled' ? 'bg-emerald-500/20 text-emerald-400' :
                                t.status === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>{t.status}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {t.tx_hash && (
                                <a href={`https://polygonscan.com/tx/${t.tx_hash}`} target="_blank" rel="noreferrer"
                                  className="text-blue-400 hover:text-blue-300 text-xs underline">Verify ↗</a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'positions' && (
            <motion.div key="pos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Open Positions ({positions.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                        <th className="text-left py-2 px-3">Team</th>
                        <th className="text-left py-2 px-3">Game</th>
                        <th className="text-left py-2 px-3">Sport</th>
                        <th className="text-right py-2 px-3">Shares</th>
                        <th className="text-right py-2 px-3">Avg Price</th>
                        <th className="text-right py-2 px-3">Last Price</th>
                        <th className="text-right py-2 px-3">Cost</th>
                        <th className="text-right py-2 px-3">P&L</th>
                        <th className="text-right py-2 px-3">Verify</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p: any, i: number) => {
                        const meta = parseMeta(p.meta);
                        const cost = p.size * p.avg_price;
                        const current = p.size * p.last_price;
                        const upnl = current - cost;
                        return (
                          <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                            <td className="py-3 px-3 font-medium">{p.outcome || 'N/A'}</td>
                            <td className="py-3 px-3 text-gray-400 text-xs max-w-[200px] truncate">{meta.game || ''}</td>
                            <td className="py-3 px-3 text-gray-500 text-xs uppercase">{meta.sport || ''}</td>
                            <td className="py-3 px-3 text-right font-mono">{fmt(p.size)}</td>
                            <td className="py-3 px-3 text-right font-mono">${fmt(p.avg_price)}</td>
                            <td className="py-3 px-3 text-right font-mono">${fmt(p.last_price)}</td>
                            <td className="py-3 px-3 text-right font-mono">${fmt(cost)}</td>
                            <td className={`py-3 px-3 text-right font-bold font-mono ${pnlColor(upnl)}`}>
                              {upnl >= 0 ? '+' : ''}{fmtUsd(upnl)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <a href={`https://polygonscan.com/token/0x4D97DCd97eC945f40cF65F87097ACe5EA0476045?a=0xA74C6d8B96acba2372E85967Fb82EAa948A7AdFe`}
                                target="_blank" rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-xs underline">CTF ↗</a>
                              {' '}
                              <a href={`https://polymarket.com`}
                                target="_blank" rel="noreferrer"
                                className="text-purple-400 hover:text-purple-300 text-xs underline">Market ↗</a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!positions.length && <div className="text-gray-600 text-center py-8">No open positions</div>}
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'trades' && (
            <motion.div key="trades" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Trade History ({trades.length})</h3>
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#111827]">
                      <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                        <th className="text-left py-2 px-3">Time</th>
                        <th className="text-left py-2 px-3">Team</th>
                        <th className="text-left py-2 px-3">Game</th>
                        <th className="text-right py-2 px-3">Side</th>
                        <th className="text-right py-2 px-3">Price</th>
                        <th className="text-right py-2 px-3">Size</th>
                        <th className="text-right py-2 px-3">Edge</th>
                        <th className="text-right py-2 px-3">Status</th>
                        <th className="text-right py-2 px-3">On-Chain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t: any, i: number) => {
                        const meta = parseMeta(t.meta);
                        return (
                          <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                            <td className="py-2 px-3 text-gray-400 font-mono text-xs whitespace-nowrap">{fmtDate(t.ts)} {fmtTime(t.ts)}</td>
                            <td className="py-2 px-3 font-medium whitespace-nowrap">{t.outcome || 'N/A'}</td>
                            <td className="py-2 px-3 text-gray-500 text-xs max-w-[250px] truncate">{meta.game || ''}</td>
                            <td className={`py-2 px-3 text-right font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{t.side}</td>
                            <td className="py-2 px-3 text-right font-mono">{fmt(t.price)}</td>
                            <td className="py-2 px-3 text-right font-mono">{fmt(t.size)}</td>
                            <td className="py-2 px-3 text-right font-mono text-blue-400">{fmt(t.edge)}%</td>
                            <td className="py-2 px-3 text-right">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                t.status === 'matched' || t.status === 'filled' ? 'bg-emerald-500/20 text-emerald-400' :
                                t.status === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>{t.status}</span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {t.tx_hash && (
                                <a href={`https://polygonscan.com/tx/${t.tx_hash}`} target="_blank" rel="noreferrer"
                                  className="text-blue-400 hover:text-blue-300 text-xs underline">Verify ↗</a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'redemptions' && (
            <motion.div key="redeem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Redemptions ({redemptions.length})</h3>
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#111827]">
                      <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1e293b]">
                        <th className="text-left py-2 px-3">Time</th>
                        <th className="text-left py-2 px-3">Market</th>
                        <th className="text-right py-2 px-3">Amount</th>
                        <th className="text-right py-2 px-3">TX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redemptions.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-[#1e293b]/50 hover:bg-[#1a2332] transition-colors">
                          <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{fmtDate(r.ts)} {fmtTime(r.ts)}</td>
                          <td className="py-2.5 px-3 font-medium">{r.market_id}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">${fmt(r.amount)}</td>
                          <td className="py-2.5 px-3 text-right">
                            <a
                              href={`https://polygonscan.com/tx/${r.tx_hash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                            >
                              {r.tx_hash ? `${r.tx_hash.slice(0, 10)}...` : ''}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!redemptions.length && <div className="text-gray-600 text-center py-8">No redemptions yet</div>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
