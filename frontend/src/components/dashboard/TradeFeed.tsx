import type { Trade } from '../../lib/types'
import { asMeta, formatNum, formatPct } from '../../lib/utils'

export function TradeFeed({ trades }: { trades: Trade[] }) {
  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl">
      <h2 className="mb-3 text-lg font-semibold">Trade Feed</h2>
      <div className="max-h-[360px] overflow-auto rounded-xl border border-[#1e293b]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0f172a] text-slate-400">
            <tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Market</th><th className="p-2 text-left">Side</th><th className="p-2 text-left">Price</th><th className="p-2 text-left">Size</th><th className="p-2 text-left">Edge</th></tr>
          </thead>
          <tbody>
            {trades.slice(0, 80).map((t, idx) => {
              const m = asMeta(t.meta)
              return (
                <tr key={t.id || `${t.ts}-${t.market_id}-${idx}`} className={`border-t border-[#1e293b] transition hover:bg-slate-800/50 ${idx < 3 ? 'animate-pulse bg-blue-500/5' : ''}`}>
                  <td className="p-2">{new Date(t.ts).toLocaleTimeString()}</td>
                  <td className="p-2">{m.team || t.outcome}</td>
                  <td className={`p-2 font-medium ${t.side === 'BUY' ? 'text-emerald-300' : 'text-red-300'}`}>{t.side}</td>
                  <td className="p-2">{formatNum(t.price)}</td>
                  <td className="p-2">{formatNum(t.size)}</td>
                  <td className={`p-2 ${t.edge >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatPct(t.edge)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
