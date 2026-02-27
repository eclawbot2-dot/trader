import { Express } from 'express';
import { Db } from '../db/queries.js';
import { AnalyticsEngine } from '../analytics/engine.js';

function parseJson(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === 'object') return input as Record<string, unknown>;
  try {
    return JSON.parse(String(input)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function registerRoutes(app: Express, db: Db, analytics: AnalyticsEngine): void {
  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
  app.get('/positions', (_req, res) => res.json(db.listPositions()));
  app.get('/trades', (req, res) => res.json(db.listTrades(Number(req.query.limit ?? 200))));
  app.get('/balance', (_req, res) => res.json(db.latestBalance() ?? { usdc: 0, exposure: 0, equity: 0 }));
  app.get('/pnl', (_req, res) => res.json((analytics.snapshot() as any).pnl));
  app.get('/analytics', (_req, res) => res.json(analytics.snapshot()));

  // Resolve Polymarket condition/token ID → slug redirect
  const slugCache = new Map<string, string>();
  app.get('/pm/:tokenId', async (req, res) => {
    const tid = req.params.tokenId;
    if (slugCache.has(tid)) return res.redirect(`https://polymarket.com/event/${slugCache.get(tid)}`);
    try {
      const resp = await fetch(`https://gamma-api.polymarket.com/markets?clob_token_ids=${tid}&limit=1`);
      const data = await resp.json() as any[];
      if (data?.[0]?.slug) {
        slugCache.set(tid, data[0].slug);
        return res.redirect(`https://polymarket.com/event/${data[0].slug}`);
      }
    } catch {}
    // Fallback: search by the token ID
    res.redirect(`https://polymarket.com/markets?tid=${tid}`);
  });

  app.get('/dashboard', (_req, res) => {
    const positions = db.listPositions() as any[];
    const trades = db.listTrades(250) as any[];
    const tradeMetaByPosition = new Map<string, Record<string, unknown>>();

    for (const trade of trades) {
      const key = `${trade.market_id}::${trade.outcome}`;
      if (!tradeMetaByPosition.has(key)) tradeMetaByPosition.set(key, parseJson(trade.meta));
    }

    const enrichedPositions = positions.map((p) => {
      const key = `${p.market_id}::${p.outcome}`;
      const meta = tradeMetaByPosition.get(key) ?? {};
      return { ...p, meta };
    });

    const edgeObservations = db.db
      .prepare('SELECT ts, market_id, outcome, edge, settled, correct FROM edge_observations ORDER BY ts DESC LIMIT 800')
      .all();

    const redemptions = db.db
      .prepare('SELECT id, ts, market_id, amount, tx_hash FROM redemptions ORDER BY ts DESC LIMIT 100')
      .all();

    res.json({
      positions: enrichedPositions,
      trades,
      analytics: analytics.snapshot(),
      equityCurve: db.getTimeSeries('equity', 1000),
      drawdownSeries: db.getTimeSeries('drawdown', 1000),
      edgeObservations,
      redemptions,
    });
  });
}
