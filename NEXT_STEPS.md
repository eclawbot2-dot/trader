# NEXT STEPS (Dev-Facing)

Last updated: 2026-02-28

## A. Fix Polymarket subscription/data mapping (P0)
1. Confirm exact subscription payload required by current CLOB WS endpoint.
2. Subscribe using explicit token/asset IDs (empty lists may not produce events).
3. Add parser coverage for actual event variants received in production (`book`, `price_change`, `best_bid_ask`, `last_trade_price`).
4. Emit normalized `market:price` events only when marketId + price are valid.

**Definition of done:**
- `feedStats.priceFeed > 0`
- `feedStats.intersected > 0` under normal traffic

## B. Add strict runtime self-heal + alerting (P0)
1. Add feed liveness watchdog with grace period (e.g., 60-120s after boot).
2. If no price events in window:
   - mark health RED in API
   - auto retry alt subscription strategy
   - send operator alert to chat with root cause
3. Record last event timestamps per feed in dashboard payload.

## C. Improve AI handoff quality (P1)
1. Keep `HANDOFF_FOR_NEXT_AI.md` updated per major fix.
2. Include:
   - what changed
   - what is still broken
   - exact verification command snippets

## D. Bundle optimization (P2)
1. Split large monitoring/dashboard code paths with dynamic imports.
2. Configure `manualChunks` for vendor-heavy dependencies.
3. Re-check build size and startup latency.

## E. Ops hygiene (P2)
1. Reserve/standardize local service ports.
2. Add startup check that logs port conflicts clearly before full boot.

---

## Quick verification commands

```bash
# Dashboard feed stats
curl -s http://127.0.0.1:3100/dashboard | jq '.monitoring.feedStats'

# Health
curl -s http://127.0.0.1:3100/health

# Tail runtime log
tail -f /tmp/pe2.log
```
