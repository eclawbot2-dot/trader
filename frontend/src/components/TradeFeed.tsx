import type { Trade } from '../lib/types'
import { asMeta, formatNum } from '../lib/utils'

interface TradeFeedProps {
  trades: Trade[]
}

export function TradeFeed({ trades }: TradeFeedProps) {
  const rows = trades.slice().sort((a, b) => b.ts - a.ts).slice(0, 120)

  return (
    <section className="rounded-xl border border-[#1e293b] bg-[#111827] p-6 shadow-lg xl:col-span-1">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Live Trade Feed</h2>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {rows.map((trade, idx) => {
          const meta = asMeta(trade.meta)
          return (
            <div key={`${trade.ts}-${idx}`} className="rounded-lg border border-[#1e293b] bg-[#0f172a] p-3 hover:bg-[#1a2332]">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{new Date(trade.ts).toLocaleTimeString()}</span>
                <span className={trade.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{trade.side}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-200">{trade.outcome}</p>
              <p className="mt-1 text-xs text-slate-400">{meta.game || meta.sport || 'Unknown Market'}</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-300">@ {formatNum(trade.price, 3)}</span>
                <span className="text-slate-300">{formatNum(trade.size, 2)} sh</span>
                <span className={trade.edge >= 0 ? 'text-emerald-400' : 'text-red-400'}>{(trade.edge * 100).toFixed(2)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
