import { useEffect } from 'react'
import { AlertsPanel } from './components/AlertsPanel'
import { AnalyticsPanel } from './components/AnalyticsPanel'
import { EquityCurve } from './components/EquityCurve'
import { Header } from './components/Header'
import { Layout } from './components/Layout'
import { PortfolioCards } from './components/PortfolioCards'
import { PositionsTable } from './components/PositionsTable'
import { RedemptionsTable } from './components/RedemptionsTable'
import { TradeFeed } from './components/TradeFeed'
import { useDashboard } from './hooks/useDashboard'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  const { loading, dashboard, balance, alerts, setAlerts, loadSnapshot, onSocketMessage } = useDashboard()
  const status = useWebSocket(onSocketMessage)

  useEffect(() => {
    void loadSnapshot()
    const timer = setInterval(() => void loadSnapshot(), 15000)
    return () => clearInterval(timer)
  }, [loadSnapshot])

  const pnl = dashboard.analytics.pnl || { realized: 0, unrealized: 0, total: 0 }
  const roi = dashboard.analytics.roi ?? 0
  const equity = balance.equity || pnl.total + balance.usdc

  return (
    <Layout>
      <Header status={status} wallet={undefined} usdc={balance.usdc} />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-[#1e293b] bg-[#111827]" />
          ))}
        </div>
      ) : (
        <>
          <PortfolioCards
            equity={equity}
            usdc={balance.usdc}
            roi={roi}
            realized={pnl.realized}
            unrealized={pnl.unrealized}
            trades={dashboard.trades.length}
          />

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <EquityCurve data={dashboard.equityCurve} />
            <AnalyticsPanel analytics={dashboard.analytics} />

            <PositionsTable positions={dashboard.positions} />
            <TradeFeed trades={dashboard.trades} />
            <AlertsPanel alerts={alerts} onDismiss={(index) => setAlerts((prev) => prev.filter((_, i) => i !== index))} />

            <RedemptionsTable rows={dashboard.redemptions} />
          </section>
        </>
      )}
    </Layout>
  )
}
