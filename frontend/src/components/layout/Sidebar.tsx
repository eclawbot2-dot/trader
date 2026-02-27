import { BarChart3, Bell, CandlestickChart, LayoutDashboard, Settings2, WalletCards } from 'lucide-react'

const nav = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Positions', icon: WalletCards },
  { label: 'Trades', icon: CandlestickChart },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Alerts', icon: Bell },
  { label: 'Settings', icon: Settings2 },
]

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={`fixed left-0 top-0 z-20 h-screen border-r border-[#1e293b] bg-[#0f172a]/80 p-3 backdrop-blur-xl transition-all ${collapsed ? 'w-[76px]' : 'w-64'}`}>
      <button onClick={onToggle} className="mb-4 w-full rounded-lg border border-[#1e293b] bg-[#111827] px-3 py-2 text-left text-xs text-slate-300 hover:bg-[#1f2937]">
        {collapsed ? '>>' : 'Collapse'}
      </button>
      <div className="space-y-2">
        {nav.map((item, idx) => {
          const Icon = item.icon
          const active = idx === 0
          return (
            <button key={item.label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active ? 'bg-blue-500/15 text-blue-300' : 'text-slate-300 hover:bg-slate-800/60'}`}>
              <Icon size={16} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
