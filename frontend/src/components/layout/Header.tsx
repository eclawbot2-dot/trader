import { Activity } from 'lucide-react'
import { StatusBadge } from '../common/StatusBadge'
import { formatMoney, truncateAddress } from '../../lib/utils'
import type { ConnectionStatus } from '../../lib/types'

export function Header({ status, wallet, usdc, lastUpdate }: { status: ConnectionStatus; wallet?: string; usdc: number; lastUpdate: number }) {
  return (
    <header className="sticky top-0 z-10 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1e293b] bg-[#111827]/70 p-4 backdrop-blur-xl">
      <div>
        <div className="flex items-center gap-2 text-slate-300">
          <div className="rounded-lg bg-blue-500/20 p-1 text-blue-300"><Activity size={16} /></div>
          <span className="text-lg font-semibold tracking-tight text-white">Poly Edge v2 Terminal</span>
        </div>
        <div className="mt-1 text-xs text-slate-400">Last update {new Date(lastUpdate).toLocaleTimeString()}</div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
        <div className="rounded-full border border-[#1e293b] bg-[#0b1220] px-3 py-1.5 text-xs text-slate-300">{truncateAddress(wallet || '0x3A7B9e2658da77f6A322E4D7a4Bf5f18D31D4e2C')}</div>
        <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">USDC {formatMoney(usdc)}</div>
      </div>
    </header>
  )
}
