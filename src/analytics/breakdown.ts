type TradeLite = { league?: string; team?: string; pnl: number };

export function breakdownByKey<T extends TradeLite>(trades: T[], key: 'league' | 'team'): Record<string, { count: number; pnl: number }> {
  return trades.reduce((acc, t) => {
    const k = t[key] ?? 'UNKNOWN';
    const row = acc[k] ?? { count: 0, pnl: 0 };
    row.count += 1;
    row.pnl += t.pnl;
    acc[k] = row;
    return acc;
  }, {} as Record<string, { count: number; pnl: number }>);
}
