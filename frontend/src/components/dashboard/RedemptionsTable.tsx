import type { Redemption } from '../../lib/types'
import { formatMoney } from '../../lib/utils'

export function RedemptionsTable({ rows }: { rows: Redemption[] }) {
  return (
    <section className="rounded-2xl border border-[#1e293b] bg-[#111827]/80 p-4 backdrop-blur-xl xl:col-span-3">
      <h2 className="mb-3 text-lg font-semibold">Redemptions</h2>
      <div className="overflow-auto rounded-xl border border-[#1e293b]">
        <table className="w-full text-sm">
          <thead className="bg-[#0f172a] text-slate-400">
            <tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Market</th><th className="p-2 text-left">Amount</th><th className="p-2 text-left">TX</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((r, idx) => (
              <tr key={`${r.tx_hash}-${idx}`} className="border-t border-[#1e293b] hover:bg-slate-800/50">
                <td className="p-2">{new Date(r.ts).toLocaleString()}</td>
                <td className="p-2">{r.market_id}</td>
                <td className="p-2">{formatMoney(r.amount)}</td>
                <td className="p-2">
                  <a className="inline-flex rounded-md border border-blue-400/40 bg-blue-500/10 px-2 py-1 text-xs text-blue-200 hover:bg-blue-500/20" href={`https://polygonscan.com/tx/${r.tx_hash}`} target="_blank" rel="noreferrer">View TX</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
