import type { DashboardAnalytics } from '../lib/types'

interface AnalyticsPanelProps {
  analytics: DashboardAnalytics
}

export function AnalyticsPanel({ analytics }: AnalyticsPanelProps) {
  const exposure = Number((analytics as DashboardAnalytics & { exposure?: { v?: number } }).exposure?.v || 0)
  const efficiency = Number(analytics.efficiency?.avgSlippage?.v || 0)

  const stats = [
    { label: 'Sharpe', value: Number(analytics.sharpe || 0).toFixed(2), positive: Number(analytics.sharpe || 0) >= 0 },
    { label: 'Max DD', value: `${(Number(analytics.maxDrawdown || 0) * 100).toFixed(2)}%`, positive: Number(analytics.maxDrawdown || 0) <= 0.1 },
    { label: 'Win Rate', value: `${(Number(analytics.winRate || 0) * 100).toFixed(2)}%`, positive: Number(analytics.winRate || 0) >= 0.5 },
    { label: 'ROI', value: `${(Number(analytics.roi || 0) * 100).toFixed(2)}%`, positive: Number(analytics.roi || 0) >= 0 },
    { label: 'Edge Accuracy', value: `${(Number(analytics.edgeAccuracy || efficiency || 0) * 100).toFixed(2)}%`, positive: Number(analytics.edgeAccuracy || efficiency || 0) >= 0.5 },
    { label: 'Exposure', value: exposure.toLocaleString(undefined, { maximumFractionDigits: 2 }), positive: exposure >= 0 },
  ]

  return (
    <section className="rounded-xl border border-[#1e293b] bg-[#111827] p-6 shadow-lg xl:col-span-1">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Analytics</h2>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((item) => (
          <article key={item.label} className="rounded-lg border border-[#1e293b] bg-[#0f172a] p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
            <p className={`mt-2 text-lg font-semibold ${item.positive ? 'text-emerald-400' : 'text-red-400'}`}>{item.value}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
