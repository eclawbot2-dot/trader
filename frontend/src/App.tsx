import { useEffect, useMemo } from 'react'
import { Layout } from './components/layout/Layout'
import { Header } from './components/layout/Header'
import { PortfolioCards } from './components/dashboard/PortfolioCards'
import { EquityCurve } from './components/dashboard/EquityCurve'
import { PositionsTable } from './components/dashboard/PositionsTable'
import { TradeFeed } from './components/dashboard/TradeFeed'
import { AnalyticsPanel } from './components/dashboard/AnalyticsPanel'
import { PnlBreakdown } from './components/dashboard/PnlBreakdown'
import { EdgeDistribution } from './components/dashboard/EdgeDistribution'
import { DrawdownChart } from './components/dashboard/DrawdownChart'
import { AlertsPanel } from './components/dashboard/AlertsPanel'
import { RedemptionsTable } from './components/dashboard/RedemptionsTable'
import { SkeletonLoader } from './components/common/SkeletonLoader'
import { useDashboard } from './hooks/useDashboard'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  const { loading, lastUpdate, dashboard, balance, alerts, setAlerts, loadSnapshot, onSocketMessage, pnlBreakdown, edgeHistogram } = useDashboard()
  const status = useWebSocket(onSocketMessage)

  useEffect(() => {
    void loadSnapshot()
    const timer = setInterval(() => void loadSnapshot(), 15000)
    return () => clearInterval(timer)
  }, [loadSnapshot])

  const pnl = dashboard.analytics.pnl || { realized: 0, unrealized: 0, total: 0 }
  const roi = dashboard.analytics.roi ?? 0

  const kellyStats = useMemo(() => {
    const kelly = dashboard.trades.map((t) => Number(t.kelly || 0))
    const avg = kelly.length ? kelly.reduce((a, b) => a + b, 0) / kelly.length : 0
    const max = kelly.length ? Math.max(...kelly) : 0
    return { avg, max }
  }, [dashboard.trades])

  return (
    <Layout>
      <Header status={status} wallet={undefined} usdc={balance.usdc} lastUpdate={lastUpdate} />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonLoader key={i} className="h-32" />)}
          </div>
          <SkeletonLoader className="h-96" />
        </div>
      ) : (
        <>
          <PortfolioCards
            equity={balance.equity || 1000 + pnl.total}
            usdc={balance.usdc}
            realized={pnl.realized}
            unrealized={pnl.unrealized}
            roi={roi}
            trades={dashboard.trades.length}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <EquityCurve data={dashboard.equityCurve} />
            <AnalyticsPanel analytics={dashboard.analytics} kellyAvg={kellyStats.avg} kellyMax={kellyStats.max} />

            <PositionsTable positions={dashboard.positions} />
            <AlertsPanel alerts={alerts} onDismiss={(index) => setAlerts((prev) => prev.filter((_, i) => i !== index))} />

            <TradeFeed trades={dashboard.trades} />
            <PnlBreakdown title="P&L by Sport" data={pnlBreakdown.sport} />
            <PnlBreakdown title="P&L by League" data={pnlBreakdown.league} />
            <EdgeDistribution data={edgeHistogram} />
            <DrawdownChart data={dashboard.drawdownSeries} />

            <RedemptionsTable rows={dashboard.redemptions} />
          </div>
        </>
      )}
    </Layout>
  )
}
