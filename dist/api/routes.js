function parseJson(input) {
    if (!input)
        return {};
    if (typeof input === 'object')
        return input;
    try {
        return JSON.parse(String(input));
    }
    catch {
        return {};
    }
}
const WALLET = '0xA74C6d8B96acba2372E85967Fb82EAa948A7AdFe';
const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const RPC = process.env.ALCHEMY_RPC || 'https://polygon-mainnet.g.alchemy.com/v2/qDVRktAwArPbVW_c3vVhg';
async function rpcCall(to, data) {
    const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }) });
    const j = await res.json();
    return j.result || '0x0';
}
async function getOnChainBalance() {
    const balData = '0x70a08231' + WALLET.slice(2).padStart(64, '0');
    const [usdcHex, polRes] = await Promise.all([
        rpcCall(USDC_E, balData),
        fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getBalance', params: [WALLET, 'latest'] }) }).then(r => r.json()),
    ]);
    return { usdc: parseInt(usdcHex, 16) / 1e6, pol: parseInt(polRes.result || '0', 16) / 1e18 };
}
async function getOnChainPositions(positions) {
    const results = await Promise.all(positions.map(async (p) => {
        const tokenData = '0x00fdd58e' + WALLET.slice(2).padStart(64, '0') + BigInt(p.market_id).toString(16).padStart(64, '0');
        const hex = await rpcCall(CTF_CONTRACT, tokenData);
        const onChainTokens = parseInt(hex, 16) / 1e6;
        return { ...p, on_chain_tokens: onChainTokens, on_chain_value: onChainTokens * (p.avg_price || 0) };
    }));
    return results;
}
export function registerRoutes(app, db, analytics) {
    app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
    app.get('/positions', (_req, res) => res.json(db.listPositions()));
    app.get('/trades', (req, res) => res.json(db.listTrades(Number(req.query.limit ?? 200))));
    app.get('/balance', (_req, res) => res.json(db.latestBalance() ?? { usdc: 0, exposure: 0, equity: 0 }));
    app.get('/pnl', (_req, res) => res.json(analytics.snapshot().pnl));
    app.get('/analytics', (_req, res) => res.json(analytics.snapshot()));
    // Resolve Polymarket condition/token ID → slug redirect
    const slugCache = new Map();
    app.get('/pm/:tokenId', async (req, res) => {
        const tid = req.params.tokenId;
        if (slugCache.has(tid))
            return res.redirect(`https://polymarket.com/event/${slugCache.get(tid)}`);
        try {
            const resp = await fetch(`https://gamma-api.polymarket.com/markets?clob_token_ids=${tid}&limit=1`);
            const data = await resp.json();
            if (data?.[0]?.slug) {
                slugCache.set(tid, data[0].slug);
                return res.redirect(`https://polymarket.com/event/${data[0].slug}`);
            }
        }
        catch { }
        // Fallback: search by the token ID
        res.redirect(`https://polymarket.com/markets?tid=${tid}`);
    });
    // On-chain verified wallet data (cached 60s)
    let onChainCache = { ts: 0, data: null };
    app.get('/on-chain', async (_req, res) => {
        try {
            if (Date.now() - onChainCache.ts < 60000 && onChainCache.data)
                return res.json(onChainCache.data);
            const positions = db.listPositions();
            const [wallet, verifiedPositions] = await Promise.all([getOnChainBalance(), getOnChainPositions(positions)]);
            const totalOnChainValue = verifiedPositions.reduce((s, p) => s + p.on_chain_value, 0);
            const totalRedeemed = db.db.prepare('SELECT SUM(amount) as t FROM redemptions').get()?.t || 0;
            const data = { wallet, positions: verifiedPositions, totalOnChainValue, totalRedeemed, equity: wallet.usdc + totalOnChainValue, ts: Date.now() };
            onChainCache = { ts: Date.now(), data };
            res.json(data);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/dashboard', async (_req, res) => {
        const positions = db.listPositions();
        const trades = db.listTrades(250);
        const tradeMetaByPosition = new Map();
        for (const trade of trades) {
            const key = `${trade.market_id}::${trade.outcome}`;
            if (!tradeMetaByPosition.has(key))
                tradeMetaByPosition.set(key, parseJson(trade.meta));
        }
        // Get on-chain data (use cache if fresh)
        let onChain = null;
        try {
            if (Date.now() - onChainCache.ts < 60000 && onChainCache.data) {
                onChain = onChainCache.data;
            }
            else {
                const [wallet, verifiedPositions] = await Promise.all([getOnChainBalance(), getOnChainPositions(positions)]);
                const totalOnChainValue = verifiedPositions.reduce((s, p) => s + p.on_chain_value, 0);
                const totalRedeemed = db.db.prepare('SELECT SUM(amount) as t FROM redemptions').get()?.t || 0;
                onChain = { wallet, positions: verifiedPositions, totalOnChainValue, totalRedeemed, equity: wallet.usdc + totalOnChainValue, ts: Date.now() };
                onChainCache = { ts: Date.now(), data: onChain };
            }
        }
        catch { }
        const onChainMap = new Map();
        if (onChain?.positions) {
            for (const p of onChain.positions)
                onChainMap.set(p.market_id, p.on_chain_tokens);
        }
        const enrichedPositions = positions.map((p) => {
            const key = `${p.market_id}::${p.outcome}`;
            const meta = tradeMetaByPosition.get(key) ?? {};
            return { ...p, meta, on_chain_tokens: onChainMap.get(p.market_id) ?? null };
        });
        const edgeObservations = db.db
            .prepare('SELECT ts, market_id, outcome, edge, settled, correct FROM edge_observations ORDER BY ts DESC LIMIT 800')
            .all();
        const redemptions = db.db
            .prepare('SELECT id, ts, market_id, amount, tx_hash FROM redemptions ORDER BY ts DESC LIMIT 100')
            .all();
        const totalRedeemed = db.db.prepare('SELECT SUM(amount) as t FROM redemptions').get()?.t || 0;
        res.json({
            positions: enrichedPositions,
            trades,
            analytics: analytics.snapshot(),
            equityCurve: db.getTimeSeries('equity', 1000),
            drawdownSeries: db.getTimeSeries('drawdown', 1000),
            edgeObservations,
            redemptions,
            onChain: onChain ? { usdc: onChain.wallet.usdc, pol: onChain.wallet.pol, totalOnChainValue: onChain.totalOnChainValue, equity: onChain.equity, totalRedeemed } : null,
        });
    });
}
