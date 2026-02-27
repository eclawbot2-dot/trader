import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-35 [background-image:radial-gradient(#334155_1px,transparent_1px)] [background-size:22px_22px]" />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((s) => !s)} />
      <main className={`relative min-h-screen p-5 transition-all md:p-6 ${collapsed ? 'ml-[76px]' : 'ml-64'}`}>{children}</main>
    </div>
  )
}
