import { useMemo, useState } from 'react'
import type { Position } from '../../lib/types'
import { asMeta, formatMoney, formatNum, formatPct } from '../../lib/utils'

const pageSize = 8

export function PositionsTable({ positions }: { positions: Position[] }) {
  const [sortBy, setSortBy] = useState<'unrealized_pnl' | 'size' | 'avg_price'>('unrealized_pnl')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    const filtered = positions
      .filter((p) => Number(p.size) > 0 && Number(p.resolved || 0) === 0)
      .filter((p) => {
        const m = asMeta(p.meta)
        return `${m.team || p.outcome} ${m.sport || ''} ${m.league || ''}`.toLowerCase().includes(filter.toLowerCase())
      })
      .sort((a, b) => Number((b as any)[sortBy] || 0) - Number((a as any)[sortBy] || 0))

    return filtered
  }, [positions, filter, sortBy])

  const paged = rows.slice((page - 1) * pageSize, page * pageSize)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))

  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl xl:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Open Positions</h2>
        <div className="flex gap-2">
          <input value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1) }} placeholder="Filter positions..." className="rounded-md border border-[#1e293b] bg-[#0b1220] px-2 py-1 text-sm" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-md border border-[#1e293b] bg-[#0b1220] px-2 py-1 text-sm">
            <option value="unrealized_pnl">Sort by P&L</option>
            <option value="size">Sort by Size</option>
            <option value="avg_price">Sort by Price</option>
          </select>
        </div>
      </div>
      <div className="max-h-[360px] overflow-auto rounded-xl border border-[#1e293b]">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#0f172a] text-slate-400">
            <tr>
              <th className="p-2">Team</th><th className="p-2">Sport</th><th className="p-2">League</th><th className="p-2">Shares</th><th className="p-2">Price</th><th className="p-2">Edge</th><th className="p-2">P&L</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p, i) => {
              const m = asMeta(p.meta)
              return (
                <tr key={`${p.market_id}-${p.outcome}`} className={`border-t border-[#1e293b] transition hover:bg-slate-800/50 ${i % 2 ? 'bg-slate-900/20' : ''}`}>
                  <td className="p-2">{m.team || p.outcome}</td>
                  <td className="p-2">{m.sport || '—'}</td>
                  <td className="p-2">{m.league || '—'}</td>
                  <td className="p-2">{formatNum(p.size)}</td>
                  <td className="p-2">{formatNum(p.last_price)}</td>
                  <td className={`p-2 ${Number(m.edge || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatPct(Number(m.edge || 0))}</td>
                  <td className={`p-2 font-medium ${Number(p.unrealized_pnl || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatMoney(Number(p.unrealized_pnl || 0))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-xs">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-[#1e293b] px-2 py-1 disabled:opacity-40">Prev</button>
        <span className="text-slate-400">{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-[#1e293b] px-2 py-1 disabled:opacity-40">Next</button>
      </div>
    </section>
  )
}
