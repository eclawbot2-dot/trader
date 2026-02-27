import type { AlertItem } from '../lib/types'

interface AlertsPanelProps {
  alerts: AlertItem[]
  onDismiss: (index: number) => void
}

const severityStyles: Record<string, string> = {
  high: 'border-red-500/30 bg-red-500/10 text-red-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  low: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
}

export function AlertsPanel({ alerts, onDismiss }: AlertsPanelProps) {
  const list = alerts.slice(0, 8)

  return (
    <section className="rounded-xl border border-[#1e293b] bg-[#111827] p-6 shadow-lg xl:col-span-1">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Risk Alerts</h2>
      <div className="space-y-3">
        {list.length === 0 && <p className="text-sm text-slate-500">No active alerts.</p>}
        {list.map((alert, idx) => {
          const sev = alert.severity || 'low'
          return (
            <article key={`${alert.ts}-${idx}`} className={`rounded-lg border p-3 ${severityStyles[sev] || severityStyles.low}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide">{sev} severity</p>
                <button type="button" onClick={() => onDismiss(idx)} className="text-xs text-slate-400 hover:text-slate-200">
                  Dismiss
                </button>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-100">{alert.type || 'Risk Alert'}</p>
              <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
