# NEXT STEPS (Dev-Facing)

Last updated: 2026-03-07

## Completed (2026-03-07 code review fixes)

1. ✅ **Polymarket WS subscription** — fetches active token IDs from CLOB REST, subscribes in batches, auto-refreshes 5min
2. ✅ **EdgeEngine live bankroll** — pulls wallet USDC balance (60s cache) instead of hardcoded $1000
3. ✅ **Analytics edge scaling** — fixed `edge / 100 * size` → `edge * size` (decimal, matches live path)
4. ✅ **Unrealized P&L drift** — recomputes from DB on each tick instead of additive delta
5. ✅ **Trade deduplication** — one-time migration at startup removes dupes, simplified listTrades query
6. ✅ **Circuit breaker wired** — TradeExecutor (5/30s) + PredictionData REST (10/60s)
7. ✅ **Exposure limit** — TradeExecutor checks maxExposureUsd before executing, alerts on rejection
8. ✅ **Feed watchdog** — 120s grace, 30s check interval, fires risk:alert + Telegram on stale feeds
9. ✅ **Destination cache** — loadApprovedDestinations cached 30s, invalidated on new approvals
10. ✅ **/health endpoint** — returns feed liveness, uptime, 503 when degraded
11. ✅ **console.log → logger.info** in analytics bootstrap
12. ✅ **TLS scope** — removed module-level process.env override from predictiondata.ts (handled by start script)

## Remaining

### A. Bundle optimization (P2)
1. Split large monitoring/dashboard code paths with dynamic imports.
2. Configure `manualChunks` for vendor-heavy dependencies.

### B. Ops hygiene (P2)
1. Reserve/standardize local service ports.
2. Add startup check that logs port conflicts clearly before full boot.

### C. Chain monitor investigation (P2)
1. Investigate why Alchemy WSS kills process.
2. Consider polling-based alternative or different WebSocket provider.

---

## Quick verification commands

```bash
# Health with feed status
curl -s http://127.0.0.1:8080/health | jq .

# Dashboard feed stats
curl -s http://127.0.0.1:8080/dashboard | jq '.monitoring.feedStats'

# Standalone health server
curl -s http://127.0.0.1:8081 | jq .
```
