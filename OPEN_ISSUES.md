# OPEN ISSUES (Operator-Facing)

Last updated: 2026-03-07

## RESOLVED

### ~~1) Polymarket price feed not populating~~ ✅ FIXED
- **Fix:** Now fetches active market token IDs from CLOB REST API before subscribing.
  Subscribes to specific assets in batches of 50. Auto-refreshes every 5min for new markets.
- **Previous:** Empty `assets_ids: []` produced no events.

### ~~2) Feed health partially degraded~~ ✅ FIXED
- **Fix:** Feed watchdog monitors both feeds with 120s grace period.
  Fires risk:alert + Telegram notification when a feed goes stale. /health returns 503 when degraded.

### ~~3) Analytics P&L off by 100x~~ ✅ FIXED
- **Fix:** Bootstrap now uses `edge * size` (decimal) consistent with live path. Was `edge / 100 * size`.

### ~~4) Bankroll hardcoded to $1000~~ ✅ FIXED
- **Fix:** EdgeEngine now pulls live USDC wallet balance (cached 60s) for Kelly sizing.

### ~~5) No exposure limit check~~ ✅ FIXED
- **Fix:** TradeExecutor checks total portfolio exposure before executing. Rejects + alerts if exceeding maxExposureUsd.

### ~~6) Circuit breaker unused~~ ✅ FIXED
- **Fix:** Wired into TradeExecutor (5 failures / 30s cooldown) and PredictionData REST poller (10 failures / 60s cooldown).

## REMAINING

### 1) Frontend bundle size warning (P2)
- Build warning: JS chunk ~740kB (gzip ~221kB).
- **Impact:** Performance/maintainability risk, not blocking trading logic.

### 2) Local port 8080 collision risk (P2)
- A local process has occupied 8080 at times.
- **Impact:** Can break components that assume 8080 availability.

### 3) Chain monitor disabled (P2)
- Alchemy WSS kills process. Needs investigation into alternative WebSocket provider or polling approach.
