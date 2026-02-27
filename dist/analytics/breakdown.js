export function breakdownByKey(trades, key) {
    return trades.reduce((acc, t) => {
        const k = t[key] ?? 'UNKNOWN';
        const row = acc[k] ?? { count: 0, pnl: 0 };
        row.count += 1;
        row.pnl += t.pnl;
        acc[k] = row;
        return acc;
    }, {});
}
