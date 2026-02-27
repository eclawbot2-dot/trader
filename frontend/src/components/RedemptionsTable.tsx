import type { Redemption } from '../lib/types'
import { formatMoney } from '../lib/utils'

interface RedemptionsTableProps {
  rows: Redemption[]
}

export function RedemptionsTable({ rows }: RedemptionsTableProps) {
  return (
    <section className="rounded-xl border border-[#1e293b] bg-[#111827] p-6 shadow-lg xl:col-span-2">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Recent Redemptions</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="pb-3">Time</th>
              <th className="pb-3">Team / Market</th>
              <th className="pb-3">Amount</th>
              <th className="pb-3">Polygonscan</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((row, idx) => (
              <tr key={`${row.tx_hash}-${idx}`} className="border-t border-[#1e293b] even:bg-[#0f172a]/35 hover:bg-[#1a2332]">
                <td className="py-3 text-slate-300">{new Date(row.ts).toLocaleString()}</td>
                <td className="py-3 text-slate-200">{row.market_id}</td>
                <td className="py-3 font-semibold text-emerald-400">{formatMoney(row.amount)}</td>
                <td className="py-3">
                  <a
                    href={`https://polygonscan.com/tx/${row.tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline"
                  >
                    View Tx
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
