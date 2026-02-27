import { AlertTriangle, CircleAlert, X } from 'lucide-react'
import type { AlertItem } from '../../lib/types'

export function AlertsPanel({ alerts, onDismiss }: { alerts: AlertItem[]; onDismiss: (index: number) => void }) {
  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl">
      <h2 className="mb-3 text-lg font-semibold">Alerts</h2>
      <div className="max-h-[360px] space-y-2 overflow-auto">
        {alerts.length === 0 && <div className="rounded-lg border border-[#1e293b] bg-[#0f172a] p-3 text-sm text-slate-400">No active risk alerts</div>}
        {alerts.map((a, idx) => {
          const isHigh = String(a.type).toLowerCase().includes('drawdown') || a.severity === 'high'
          const tone = isHigh
            ? 'border-red-500/40 bg-red-500/10 text-red-200'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          return (
            <div key={`${a.ts}-${idx}`} className={`rounded-lg border p-3 ${tone}`}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1 font-medium">{isHigh ? <AlertTriangle size={14} /> : <CircleAlert size={14} />} {a.type}</div>
                <button onClick={() => onDismiss(idx)} className="text-slate-300 hover:text-white"><X size={14} /></button>
              </div>
              <div className="text-sm">{a.message}</div>
              <div className="mt-1 text-xs text-slate-300/80">{new Date(a.ts).toLocaleTimeString()}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
