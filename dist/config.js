import dotenv from 'dotenv';
dotenv.config();
export const config = {
    app: {
        port: Number(process.env.PORT ?? 8080),
        wsPath: '/ws',
    },
    chain: {
        id: 137,
        rpc: process.env.ALCHEMY_RPC ?? '',
        privateKey: process.env.PRIVATE_KEY ?? '',
        wallet: '0xb23093047d9a95fAF117e333F82624317EBfd433',
        contracts: {
            USDC_E: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            CTF: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
            CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
            NEG_RISK_CTF: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
            NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
        },
    },
    market: {
        clobWs: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
        clobRest: 'https://clob.polymarket.com',
        predictionSse: 'https://stream.predictiondata.io/v1/markets',
        predictionRest: 'https://api.predictiondata.io/api/markets',
        predictionApiKey: process.env.PREDICTIONDATA_API_KEY ?? '',
    },
    risk: {
        mode: (process.env.TRADING_MODE ?? 'edge').toLowerCase(),
        edgeThreshold: Number(process.env.EDGE_THRESHOLD ?? 0.02),
        kellyFraction: Number(process.env.KELLY_FRACTION ?? 0.5),
        maxTradeUsd: Number(process.env.MAX_TRADE_USD ?? 50),
        maxExposureUsd: Number(process.env.MAX_EXPOSURE_USD ?? 2000),
        drawdownAlert: Number(process.env.DRAWDOWN_ALERT ?? 0.1),
    },
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
        chatId: process.env.TELEGRAM_CHAT_ID ?? '',
    },
    db: {
        path: process.env.DB_PATH ?? 'polyedge.db',
    },
};
if (!config.chain.rpc)
    throw new Error('Missing ALCHEMY_RPC');
if (!config.market.predictionApiKey)
    throw new Error('Missing PREDICTIONDATA_API_KEY');
