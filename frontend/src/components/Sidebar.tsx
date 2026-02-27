import { AlertTriangle, BarChart3, CandlestickChart, LayoutDashboard, ShieldAlert } from 'lucide-react'

const items = [
  { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'positions', icon: CandlestickChart, label: 'Positions' },
  { key: 'trades', icon: BarChart3, label: 'Trades' },
  { key: 'analytics', icon: ShieldAlert, label: 'Analytics' },
  { key: 'alerts', icon: AlertTriangle, label: 'Alerts' },
]

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-16 flex-col items-center border-r border-[#1e293b] bg-[#0b1220] py-4">
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-[#1e293b] bg-[#111827] text-xs font-bold text-emerald-400">
        PE
      </div>

      <nav className="flex w-full flex-1 flex-col items-center gap-2 px-2">
        {items.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            title={label}
            className="group flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-[#1e293b] hover:bg-[#111827] hover:text-emerald-300"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </nav>
    </aside>
  )
}
