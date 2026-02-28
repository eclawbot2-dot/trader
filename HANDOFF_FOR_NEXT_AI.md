# Handoff for Next AI

## Current Status (2026-02-28)

This repo was updated to improve dashboard observability and feed diagnostics.

### ✅ Implemented

1. **Monitoring UI now conditionally shows criteria in arb mode**
   - In `arb` mode, display only:
     - Mode
     - Max Trade USD
     - Max Exposure USD
   - Edge/Kelly/Drawdown are hidden in arb mode.

2. **Feed health visibility added**
   - Added `feedStats` to dashboard payload:
     - `total`
     - `priceFeed`
     - `modelFeed`
     - `intersected`
   - Added per-row flags in Monitoring table:
     - `hasPrice`
     - `hasModel`

3. **Model feed self-heal + schema parsing**
   - PredictionData parser now handles current API shape (`markets[]` with decimal odds).
   - Converts decimal odds to implied probability (`1 / odds`).
   - Keeps fallback handling for legacy stream shape with `outcomes[]`.
   - Added periodic REST fallback poll to keep model feed populated when SSE is quiet.

### ⚠️ Remaining blocker

**Polymarket price feed still not populated.**

- WebSocket opens, but subscription/payload behavior still not producing usable `market:price` events.
- Result: `priceFeed = 0`, `intersected = 0` while `modelFeed` is populated.

### Repro/verification

- API:
  - `GET /dashboard` → check `monitoring.feedStats`
- Expected current behavior after this commit:
  - `modelFeed > 0`
  - `priceFeed = 0` (until Polymarket WS mapping/subscription is corrected)

### Suggested next steps

1. Verify exact **Polymarket market channel subscription contract** with active token IDs/asset IDs.
2. Ensure subscription sends valid IDs (empty arrays likely not sufficient for stream data).
3. Add strict startup health checks:
   - fail if `market:price` events remain 0 after grace period
   - expose this in dashboard as RED health state
4. Add alerting to group when feed health degraded.

## Key files touched

- `src/api/routes.ts`
- `frontend/src/App.tsx`
- `src/market/polymarket.ts`
- `src/market/predictiondata.ts`

(Compiled artifacts in `dist/` were also updated.)
