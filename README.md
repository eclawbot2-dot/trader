# Poly-Edge v2

Enterprise-grade, real-time Polymarket trading stack in TypeScript.

## Features
- Real-time on-chain monitor (Polygon via ethers v6 WebSocket)
- Real-time market ingestion:
  - PredictionData SSE (`X-API-KEY`, supports self-signed cert)
  - Polymarket CLOB WebSocket orderbook/price stream
- Event-driven architecture via in-memory EventEmitter bus (no cron, no polling loops, no file queues)
- SQLite persistence with `better-sqlite3`
- Real-time analytics engine:
  - live realized/unrealized P&L
  - win rate, ROI, Sharpe, max drawdown
  - exposure, edge/signal observations, slippage metrics
  - time-series for charting
  - risk alerts (drawdown threshold)
- API + dashboard feed:
  - REST: `/positions`, `/trades`, `/balance`, `/pnl`, `/analytics`, `/health`, `/dashboard`
  - WS: `/ws`
- Auto-redemption workflow on market resolution events
- Telegram notifications via direct webhook (trade/risk/error)
- Resilience:
  - retry with exponential backoff
  - circuit breaker for chain monitor failures
  - graceful shutdown handlers

## Setup
```bash
cp .env .env
npm install
npm run start
```

## Environment
Required:
- `PRIVATE_KEY`
- `ALCHEMY_RPC`
- `PREDICTIONDATA_API_KEY`

Optional:
- `PORT` (default `8080`)
- `DB_PATH` (default `polyedge.db`)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `EDGE_THRESHOLD`
- `KELLY_FRACTION`
- `MAX_TRADE_USD`
- `MAX_EXPOSURE_USD`
- `DRAWDOWN_ALERT`

If PredictionData SSE is using self-signed TLS, runtime sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for stream compatibility.

## Run
```bash
npm run start
```

## Notes
- Contract addresses, wallet, and chain config are in `src/config.ts` per legacy references.
- Outgoing fund destinations are locked by human-approved allowlist in `config/approved-destinations.json`.
- To add a destination, run (human approval required):
  `npm run destination:approve -- --address <0x...> --label <name> --approved-by <human> --ticket <id> --confirm I_AM_HUMAN`
