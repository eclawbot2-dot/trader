import type { Position } from '../lib/types'
import { asMeta, formatMoney, formatNum } from '../lib/utils'

interface PositionsTableProps {
  positions: Position[]
}

export function PositionsTable({ positions }: PositionsTableProps) {
  return (
    <section className="rounded-xl border border-[#1e293b] bg-[#111827] p-6 shadow-lg xl:col-span-2">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Open Positions</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="pb-3">Team</th>
              <th className="pb-3">Game</th>
              <th className="pb-3">Shares</th>
              <th className="pb-3">Avg Price</th>
              <th className="pb-3">Last Price</th>
              <th className="pb-3">Edge</th>
              <th className="pb-3 text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, idx) => {
              const meta = asMeta(pos.meta)
              const pnl = Number(pos.unrealized_pnl ?? (pos.last_price - pos.avg_price) * pos.size)
              const edge = Number(meta.edge ?? 0)
              return (
                <tr key={`${pos.market_id}-${idx}`} className="border-t border-[#1e293b] even:bg-[#0f172a]/35 hover:bg-[#1a2332]">
                  <td className="py-3 font-medium text-slate-200">{pos.outcome || '—'}</td>
                  <td className="py-3 text-slate-400">{meta.game || meta.sport || '—'}</td>
                  <td className="py-3 text-slate-200">{formatNum(pos.size, 2)}</td>
                  <td className="py-3 text-slate-200">{formatMoney(pos.avg_price, 3)}</td>
                  <td className="py-3 text-slate-200">{formatMoney(pos.last_price, 3)}</td>
                  <td className={`py-3 ${edge >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(edge * 100).toFixed(2)}%</td>
                  <td className={`py-3 text-right font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(pnl)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
