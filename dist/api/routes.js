import fs from 'node:fs';
import path from 'node:path';
import { getAddress } from 'ethers';
import { config } from '../config.js';
import { bus } from '../notifications/emitter.js';
import { loadApprovedDestinations } from '../security/wallet-guard.js';
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
const WALLET = config.chain.wallet;
const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CLOB_EXCHANGE = '0x4bfb41d5'; // Polymarket CLOB exchange (prefix)
const RPC = process.env.ALCHEMY_RPC || 'https://polygon-mainnet.g.alchemy.com/v2/qDVRktAwArPbVW_c3vVhg';
async function rpcCall(to, data) {
    const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }) });
    const j = await res.json();
    return j.result || '0x0';
}
async function alchemyTransfers(direction) {
    const params = { fromBlock: '0x0', toBlock: 'latest', category: ['erc20', 'erc1155'], maxCount: '0x1F4' };
    if (direction === 'to')
        params.toAddress = WALLET;
    else
        params.fromAddress = WALLET;
    const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers', params: [params] }) });
    const j = await res.json();
    return j.result?.transfers || [];
}
async function getFullOnChainData(dbPositions) {
    // 1. Wallet balances
    const balData = '0x70a08231' + WALLET.slice(2).padStart(64, '0');
    const [usdcHex, polRes, incoming, outgoing] = await Promise.all([
        rpcCall(USDC_E, balData),
        fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getBalance', params: [WALLET, 'latest'] }) }).then(r => r.json()),
        alchemyTransfers('to'),
        alchemyTransfers('from'),
    ]);
    const walletUsdc = parseInt(usdcHex, 16) / 1e6;
    const pol = parseInt(polRes.result || '0', 16) / 1e18;
    // 2. Classify incoming USDC.e
    const ctfLower = CTF_CONTRACT.slice(0, 10).toLowerCase();
    const clobLower = CLOB_EXCHANGE.toLowerCase();
    let totalDeposited = 0, totalRedeemed = 0, totalClobReturns = 0;
    const deposits = [];
    const redemptions = [];
    for (const tx of incoming.filter((t) => t.asset === 'USDCE')) {
        const from = (tx.from || '').toLowerCase();
        const val = tx.value || 0;
        if (from.startsWith(ctfLower)) {
            totalRedeemed += val;
            redemptions.push({ hash: tx.hash, amount: val });
        }
        else if (from.startsWith(clobLower)) {
            totalClobReturns += val;
        }
        else {
            totalDeposited += val;
            deposits.push({ hash: tx.hash, amount: val, from: tx.from });
        }
    }
    // 3. Outgoing transfers / withdrawals
    const approvedSet = new Set(loadApprovedDestinations().map((d) => d.address.toLowerCase()));
    const withdrawals = outgoing.map((tx) => ({
        hash: tx.hash,
        to: tx.to,
        asset: tx.asset || 'UNKNOWN',
        amount: Number(tx.value || 0),
        approved: approvedSet.has(String(tx.to || '').toLowerCase()),
    }));
    let totalSpentOnTrades = 0;
    for (const tx of outgoing.filter((t) => t.asset === 'USDCE')) {
        totalSpentOnTrades += tx.value || 0;
    }
    // 4. On-chain CTF token positions
    const positions = await Promise.all(dbPositions.map(async (p) => {
        const tokenData = '0x00fdd58e' + WALLET.slice(2).padStart(64, '0') + BigInt(p.market_id).toString(16).padStart(64, '0');
        const hex = await rpcCall(CTF_CONTRACT, tokenData);
        const onChainTokens = parseInt(hex, 16) / 1e6;
        return { ...p, on_chain_tokens: onChainTokens, on_chain_value: onChainTokens * (p.avg_price || 0) };
    }));
    const totalTokenValue = positions.reduce((s, p) => s + p.on_chain_value, 0);
    const equity = walletUsdc + totalTokenValue;
    const netPnl = (equity + totalRedeemed + totalClobReturns) - totalDeposited;
    return {
        wallet: WALLET,
        walletUsdc, pol, totalDeposited, deposits, totalRedeemed, redemptions, withdrawals,
        totalClobReturns, totalSpentOnTrades, positions, totalTokenValue,
        equity, netPnl, ts: Date.now(),
    };
}
export function registerRoutes(app, db, analytics) {
    // Live monitoring state from feed events
    const marketState = new Map();
    let listenersAttached = false;
    if (!listenersAttached) {
        listenersAttached = true;
        bus.on('market:price', (p) => {
            const key = `${p.marketId}:${p.outcome}`;
            const prev = marketState.get(key) ?? { marketId: String(p.marketId), outcome: String(p.outcome), hasPrice: false, hasModel: false, lastSeen: Date.now() };
            prev.price = Number(p.price);
            prev.hasPrice = true;
            prev.lastSeen = Date.now();
            marketState.set(key, prev);
        });
        bus.on('market:model', (m) => {
            const key = `${m.marketId}:${m.outcome}`;
            const prev = marketState.get(key) ?? { marketId: String(m.marketId), outcome: String(m.outcome), hasPrice: false, hasModel: false, lastSeen: Date.now() };
            prev.probability = Number(m.probability);
            prev.hasModel = true;
            prev.league = m.league;
            prev.team = m.team;
            prev.lastSeen = Date.now();
            marketState.set(key, prev);
        });
    }
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
    async function getCachedOnChain() {
        if (Date.now() - onChainCache.ts < 60000 && onChainCache.data)
            return onChainCache.data;
        try {
            const positions = db.listPositions();
            const data = await getFullOnChainData(positions);
            onChainCache = { ts: Date.now(), data };
            return data;
        }
        catch {
            return onChainCache.data;
        }
    }
    app.get('/on-chain', async (_req, res) => {
        const data = await getCachedOnChain();
        if (data)
            res.json(data);
        else
            res.status(500).json({ error: 'Failed to fetch on-chain data' });
    });
    app.post('/approve-destination', (req, res) => {
        try {
            const address = getAddress(String(req.body?.address || ''));
            const label = String(req.body?.label || 'manual');
            const approvedBy = String(req.body?.approvedBy || 'unknown');
            const ticket = String(req.body?.ticket || 'no-ticket');
            const confirmPhrase = String(req.body?.confirmPhrase || '');
            if (confirmPhrase !== 'I_AM_HUMAN')
                return res.status(400).json({ ok: false, error: 'human confirmation phrase required' });
            const file = path.resolve(process.cwd(), 'config/approved-destinations.json');
            const data = fs.existsSync(file)
                ? JSON.parse(fs.readFileSync(file, 'utf8'))
                : { version: 1, destinations: [] };
            const exists = (data.destinations || []).some((d) => String(d.address).toLowerCase() === address.toLowerCase());
            if (!exists) {
                data.destinations.push({
                    address,
                    label,
                    approvedBy,
                    approvedAt: new Date().toISOString(),
                    ticket,
                });
                fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
            }
            res.json({ ok: true, address, exists });
        }
        catch (e) {
            res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
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
        // ALL financial data from on-chain — DB only used for trade history metadata
        const onChain = await getCachedOnChain();
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
        // Deduplicated trade stats — migration duplicated all v1 trades
        const matchedCount = db.db.prepare("SELECT COUNT(*) as c FROM (SELECT DISTINCT ts, market_id, outcome, side FROM trades WHERE status IN ('matched','filled','delayed'))").get()?.c || 0;
        const failedCount = db.db.prepare("SELECT COUNT(*) as c FROM (SELECT DISTINCT ts, market_id, outcome, side FROM trades WHERE status = 'FAILED')").get()?.c || 0;
        const totalUniqueCount = db.db.prepare("SELECT COUNT(*) as c FROM (SELECT DISTINCT ts, market_id, outcome, side, price, size, edge, status FROM trades)").get()?.c || 0;
        const now = Date.now();
        const activeGames = [...marketState.values()]
            .filter((m) => now - m.lastSeen < 30 * 60 * 1000)
            .map((m) => ({
            marketId: m.marketId,
            outcome: m.outcome,
            league: m.league ?? null,
            team: m.team ?? null,
            price: m.price ?? null,
            probability: m.probability ?? null,
            hasPrice: m.hasPrice,
            hasModel: m.hasModel,
            edge: m.price != null && m.probability != null ? (m.probability - m.price) : null,
            eligible: m.price != null && m.probability != null && (m.probability - m.price) >= config.risk.edgeThreshold,
            lastSeen: m.lastSeen,
        }))
            .sort((a, b) => b.lastSeen - a.lastSeen)
            .slice(0, 200);
        res.json({
            positions: enrichedPositions,
            trades,
            // On-chain verified financial data
            onChain: onChain ? {
                wallet: onChain.wallet,
                walletUsdc: onChain.walletUsdc,
                pol: onChain.pol,
                totalDeposited: onChain.totalDeposited,
                totalRedeemed: onChain.totalRedeemed,
                totalClobReturns: onChain.totalClobReturns,
                totalSpentOnTrades: onChain.totalSpentOnTrades,
                totalTokenValue: onChain.totalTokenValue,
                equity: onChain.equity,
                netPnl: onChain.netPnl,
                deposits: onChain.deposits,
                redemptions: onChain.redemptions,
                withdrawals: onChain.withdrawals,
                ts: onChain.ts,
            } : null,
            tradeStats: { matched: matchedCount, failed: failedCount, total: totalUniqueCount },
            monitoring: {
                criteria: {
                    mode: config.risk.mode,
                    edgeThreshold: config.risk.edgeThreshold,
                    kellyFraction: config.risk.kellyFraction,
                    maxTradeUsd: config.risk.maxTradeUsd,
                    maxExposureUsd: config.risk.maxExposureUsd,
                    drawdownAlert: config.risk.drawdownAlert,
                },
                feedStats: {
                    total: activeGames.length,
                    priceFeed: activeGames.filter((g) => g.hasPrice).length,
                    modelFeed: activeGames.filter((g) => g.hasModel).length,
                    intersected: activeGames.filter((g) => g.hasPrice && g.hasModel).length,
                },
                activeGames,
            },
            equityCurve: db.getTimeSeries('equity', 1000),
            drawdownSeries: db.getTimeSeries('drawdown', 1000),
            edgeObservations,
        });
    });
}
