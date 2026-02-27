import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function EdgeDistribution({ data }: { data: Array<{ name: string; count: number }> }) {
  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl">
      <h2 className="mb-3 text-lg font-semibold">Edge Distribution</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <defs>
              <linearGradient id="edgeBars" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" fill="url(#edgeBars)" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={600} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
