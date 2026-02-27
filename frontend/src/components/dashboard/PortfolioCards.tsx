import { MetricCard } from '../common/MetricCard'
import { formatMoney, formatNum, formatPct } from '../../lib/utils'

export function PortfolioCards({
  equity,
  usdc,
  realized,
  unrealized,
  roi,
  trades,
}: {
  equity: number
  usdc: number
  realized: number
  unrealized: number
  roi: number
  trades: number
}) {
  const sparkUp = [2, 2.4, 2.1, 2.8, 3, 3.3, 3.1]
  const sparkDn = [2.7, 2.5, 2.4, 2.2, 2.1, 2, 1.8]

  return (
    <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <MetricCard label="Total Equity" value={equity} formatter={(n) => formatMoney(n)} delta={roi * 100} sparkline={equity >= 0 ? sparkUp : sparkDn} hero />
      <MetricCard label="USDC Balance" value={usdc} formatter={(n) => formatMoney(n)} delta={2.3} sparkline={sparkUp} hero />
      <MetricCard label="Portfolio ROI" value={roi} formatter={(n) => formatPct(n)} delta={roi * 100} sparkline={roi >= 0 ? sparkUp : sparkDn} hero />

      <MetricCard label="Realized P&L" value={realized} formatter={(n) => formatMoney(n)} delta={1.8} sparkline={realized >= 0 ? sparkUp : sparkDn} />
      <MetricCard label="Unrealized P&L" value={unrealized} formatter={(n) => formatMoney(n)} delta={unrealized} sparkline={unrealized >= 0 ? sparkUp : sparkDn} />
      <MetricCard label="Executed Trades" value={trades} formatter={(n) => formatNum(n, 0)} delta={5.2} sparkline={sparkUp} />
    </section>
  )
}
