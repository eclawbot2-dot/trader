import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney } from '../../lib/utils'

export function PnlBreakdown({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 10 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" stroke="#64748b" width={80} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => formatMoney(Number(v || 0))} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
