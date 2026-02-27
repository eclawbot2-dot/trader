import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney } from '../lib/utils'

interface EquityPoint {
  ts: number
  value: number
}

interface EquityCurveProps {
  data: EquityPoint[]
}

export function EquityCurve({ data }: EquityCurveProps) {
  return (
    <section className="rounded-xl border border-[#1e293b] bg-[#111827] p-6 shadow-lg xl:col-span-2">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Equity Curve</h2>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="ts" tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#64748b" />
            <YAxis stroke="#64748b" tickFormatter={(v) => `$${Number(v).toLocaleString()}`} width={90} />
            <Tooltip
              cursor={{ stroke: '#34d399', strokeWidth: 1 }}
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }}
              labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
              formatter={(value) => [formatMoney(Number(value)), 'Equity']}
            />
            <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#equityFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
