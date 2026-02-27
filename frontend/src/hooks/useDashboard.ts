import { useCallback, useMemo, useState } from 'react'
import type { AlertItem, BalancePayload, DashboardPayload } from '../lib/types'
import { asMeta } from '../lib/utils'

const emptyDashboard: DashboardPayload = {
  positions: [],
  trades: [],
  analytics: {},
  equityCurve: [],
  drawdownSeries: [],
  edgeObservations: [],
  redemptions: [],
}

export function useDashboard() {
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const [dashboard, setDashboard] = useState<DashboardPayload>(emptyDashboard)
  const [balance, setBalance] = useState<BalancePayload>({ usdc: 0, equity: 0 })
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  const loadSnapshot = useCallback(async () => {
    const [d, b] = await Promise.all([fetch('/dashboard').then((r) => r.json()), fetch('/balance').then((r) => r.json())])
    setDashboard({
      ...emptyDashboard,
      ...d,
      equityCurve: (d.equityCurve || []).slice().reverse(),
      drawdownSeries: (d.drawdownSeries || []).slice().reverse(),
    })
    setBalance(b || { usdc: 0, equity: 0 })
    setLastUpdate(Date.now())
    setLoading(false)
  }, [])

  const onSocketMessage = useCallback(
    (msg: any) => {
      if (msg.type === 'risk:alert') setAlerts((prev) => [msg.payload, ...prev].slice(0, 50))
      if (msg.type === 'trade:executed') {
        setDashboard((prev) => ({ ...prev, trades: [msg.payload, ...prev.trades].slice(0, 250) }))
      }
      void loadSnapshot()
    },
    [loadSnapshot],
  )

  const pnlBreakdown = useMemo(() => {
    const sport = new Map<string, number>()
    const league = new Map<string, number>()

    for (const t of dashboard.trades) {
      const m = asMeta(t.meta)
      const ev = Number(t.expected_value || t.edge * t.size || 0)
      sport.set(m.sport || 'Unknown', (sport.get(m.sport || 'Unknown') || 0) + ev)
      league.set(m.league || 'Unknown', (league.get(m.league || 'Unknown') || 0) + ev)
    }

    const toSorted = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)

    return { sport: toSorted(sport), league: toSorted(league) }
  }, [dashboard.trades])

  const edgeHistogram = useMemo(() => {
    const bins = Array.from({ length: 12 }, (_, i) => ({ name: `${-12 + i * 2}%..${-10 + i * 2}%`, count: 0 }))
    const src = dashboard.edgeObservations.length ? dashboard.edgeObservations : dashboard.trades
    for (const item of src as any[]) {
      const edge = Number(item.edge || 0)
      const idx = Math.max(0, Math.min(bins.length - 1, Math.floor((edge + 0.12) / 0.02)))
      bins[idx].count += 1
    }
    return bins
  }, [dashboard.edgeObservations, dashboard.trades])

  return {
    loading,
    lastUpdate,
    dashboard,
    balance,
    alerts,
    setAlerts,
    loadSnapshot,
    onSocketMessage,
    pnlBreakdown,
    edgeHistogram,
  }
}
