import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'
import { formatNum, formatPct } from '../../lib/utils'

export function AnalyticsPanel({ analytics, kellyAvg, kellyMax }: { analytics: any; kellyAvg: number; kellyMax: number }) {
  const winRate = Number(analytics.winRate || 0) * 100

  const stats = [
    { label: 'Sharpe', value: formatNum(analytics.sharpe || 0), tone: 'text-blue-300' },
    { label: 'Max DD', value: formatPct(analytics.maxDrawdown || 0), tone: 'text-red-300' },
    { label: 'ROI', value: formatPct(analytics.roi || 0), tone: 'text-emerald-300' },
    { label: 'Edge Accuracy', value: formatPct(analytics.edgeAccuracy || 0), tone: 'text-amber-300' },
    { label: 'Kelly Avg', value: formatPct(kellyAvg), tone: 'text-slate-200' },
    { label: 'Kelly Max', value: formatPct(kellyMax), tone: 'text-slate-200' },
  ]

  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl">
      <h2 className="mb-3 text-lg font-semibold">Analytics</h2>
      <div className="mb-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="55%" outerRadius="95%" data={[{ value: winRate }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" fill="#10b981" cornerRadius={8} background />
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-100 text-xl font-semibold">{winRate.toFixed(1)}%</text>
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-[#1e293b] bg-[#0f172a] p-2">
            <div className="text-xs text-slate-400">{s.label}</div>
            <div className={`font-semibold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
