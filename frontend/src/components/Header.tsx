import type { ConnectionStatus } from '../lib/types'
import { formatMoney, truncateAddress } from '../lib/utils'

interface HeaderProps {
  status: ConnectionStatus
  wallet?: string
  usdc: number
}

const statusTone: Record<ConnectionStatus, string> = {
  connected: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  connecting: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  disconnected: 'text-red-300 border-red-500/30 bg-red-500/10',
}

export function Header({ status, wallet, usdc }: HeaderProps) {
  return (
    <header className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#1e293b] bg-[#111827] p-4 shadow-lg">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-100">Poly Edge v2</h1>
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusTone[status]}`}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : 'Disconnected'}
        </div>
      </div>

      <div className="flex items-center gap-6 text-right">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Wallet</p>
          <p className="text-sm font-medium text-slate-200">{truncateAddress(wallet || '0x00000000000000000000000000000000')}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">USDC Balance</p>
          <p className="text-base font-semibold text-emerald-400">{formatMoney(usdc)}</p>
        </div>
      </div>
    </header>
  )
}
