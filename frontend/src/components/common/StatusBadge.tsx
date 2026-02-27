import { Wifi, WifiOff } from 'lucide-react'
import type { ConnectionStatus } from '../../lib/types'

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  const isConnected = status === 'connected'
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${isConnected ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : status === 'connecting' ? 'border-amber-400/40 bg-amber-500/10 text-amber-300' : 'border-red-400/40 bg-red-500/10 text-red-300'}`}>
      <span className={`h-2 w-2 rounded-full ${isConnected ? 'animate-pulse bg-emerald-400' : status === 'connecting' ? 'animate-pulse bg-amber-400' : 'bg-red-400'}`} />
      {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
      {status}
    </div>
  )
}
