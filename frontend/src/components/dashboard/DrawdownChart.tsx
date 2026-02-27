import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPct } from '../../lib/utils'

export function DrawdownChart({ data }: { data: Array<{ ts: number; value: number }> }) {
  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl">
      <h2 className="mb-3 text-lg font-semibold">Drawdown</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.slice(-240)}>
            <defs>
              <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="ts" tickFormatter={(v) => new Date(v).toLocaleTimeString()} stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(v) => formatPct(Number(v))} stroke="#64748b" tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatPct(Number(v || 0))} />
            <Area type="monotone" dataKey="value" stroke="#ef4444" fill="url(#dd)" strokeWidth={2} isAnimationActive animationDuration={600} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
