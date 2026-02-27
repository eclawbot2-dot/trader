export function sharpe(returns) {
    if (returns.length < 2)
        return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance) || 1;
    return (mean / std) * Math.sqrt(365);
}
export function maxDrawdown(equityCurve) {
    let peak = equityCurve[0] ?? 0;
    let maxDd = 0;
    for (const e of equityCurve) {
        if (e > peak)
            peak = e;
        if (peak > 0)
            maxDd = Math.max(maxDd, (peak - e) / peak);
    }
    return maxDd;
}
