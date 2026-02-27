const state = {
  positions: [],
  trades: [],
  analytics: {},
  balance: { usdc: 0, equity: 0 },
  equityCurve: [],
  edgeObservations: [],
  redemptions: [],
  alerts: [],
};

const charts = {
  equity: null,
  breakdown: null,
  edge: null,
};

const fmtMoney = (v) => `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtPct = (v) => `${(Number(v || 0) * 100).toFixed(2)}%`;
const fmtNum = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
const clsPnL = (v) => (Number(v || 0) >= 0 ? 'positive' : 'negative');

function parseMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try { return JSON.parse(meta); } catch { return {}; }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

async function bootstrap() {
  const [dashboard, balance] = await Promise.all([
    fetchJson('/dashboard'),
    fetchJson('/balance'),
  ]);

  state.positions = dashboard.positions || [];
  state.trades = dashboard.trades || [];
  state.analytics = dashboard.analytics || {};
  state.equityCurve = (dashboard.equityCurve || []).slice().reverse();
  state.edgeObservations = dashboard.edgeObservations || [];
  state.redemptions = dashboard.redemptions || [];
  state.balance = balance || { usdc: 0, equity: 0 };

  renderAll();
  setupWs();
}

function renderKpis() {
  const pnl = state.analytics.pnl || { realized: 0, unrealized: 0, total: 0 };
  const total = state.balance.equity || (1000 + Number(pnl.total || 0));
  const roi = state.analytics.roi ?? (Number(pnl.total || 0) / 1000);

  document.getElementById('overviewKpis').innerHTML = [
    ['Total Equity', fmtMoney(total), ''],
    ['USDC Balance', fmtMoney(state.balance.usdc || 0), ''],
    ['Unrealized P&L', fmtMoney(pnl.unrealized), clsPnL(pnl.unrealized)],
    ['Realized P&L', fmtMoney(pnl.realized), clsPnL(pnl.realized)],
    ['ROI', fmtPct(roi), clsPnL(roi)],
  ].map(([label, value, klass]) => `<div class="kpi"><div class="label">${label}</div><div class="value ${klass}">${value}</div></div>`).join('');

  document.getElementById('analyticsKpis').innerHTML = [
    ['Win Rate', fmtPct(state.analytics.winRate)],
    ['Sharpe', fmtNum(state.analytics.sharpe)],
    ['Max Drawdown', fmtPct(state.analytics.maxDrawdown), 'negative'],
    ['Total Trades', fmtNum((state.trades || []).length)],
    ['Edge Accuracy', fmtPct(state.analytics.edgeAccuracy)],
  ].map(([label, value, klass]) => `<div class="kpi"><div class="label">${label}</div><div class="value ${klass || ''}">${value}</div></div>`).join('');
}

function renderPositions() {
  const body = document.getElementById('positionsBody');
  const rows = (state.positions || []).filter((p) => Number(p.size) > 0 && Number(p.resolved) === 0).map((p) => {
    const meta = parseMeta(p.meta);
    const team = meta.team || p.outcome || p.market_id;
    const sport = meta.sport || meta.category || 'N/A';
    const league = meta.league || 'N/A';
    const edge = meta.edge ?? 0;
    return `<tr>
      <td>${team}</td>
      <td class="muted">${sport}</td>
      <td class="muted">${league}</td>
      <td>${fmtNum(p.size)}</td>
      <td>${fmtNum(p.avg_price)}</td>
      <td>${fmtNum(p.last_price)}</td>
      <td class="${clsPnL(p.unrealized_pnl)}">${fmtMoney(p.unrealized_pnl)}</td>
      <td class="${clsPnL(edge)}">${fmtPct(edge)}</td>
    </tr>`;
  });
  body.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="8" class="muted">No open positions</td></tr>';
}

function renderTrades() {
  const root = document.getElementById('tradeFeed');
  root.innerHTML = (state.trades || []).slice(0, 80).map((t) => {
    const meta = parseMeta(t.meta);
    const team = meta.team || t.outcome || t.market_id;
    const sideClass = t.side === 'BUY' ? 'positive' : 'negative';
    return `<div class="trade-item">
      <div><strong>${team}</strong> <span class="${sideClass}">${t.side}</span> @ ${fmtNum(t.price)} • ${fmtNum(t.size)} shares</div>
      <div class="meta">Edge ${fmtPct(t.edge)} • Kelly ${fmtPct(t.kelly)} • ${new Date(t.ts).toLocaleTimeString()}</div>
    </div>`;
  }).join('');
}

function buildBreakdown() {
  const bySport = new Map();
  const byLeague = new Map();

  for (const t of state.trades || []) {
    const meta = parseMeta(t.meta);
    const sport = meta.sport || 'Unknown Sport';
    const league = meta.league || 'Unknown League';
    const pnl = Number(t.expected_value ?? (Number(t.edge || 0) * Number(t.size || 0)));
    bySport.set(sport, (bySport.get(sport) || 0) + pnl);
    byLeague.set(league, (byLeague.get(league) || 0) + pnl);
  }

  const sportEntries = Array.from(bySport.entries()).slice(0, 6);
  const leagueEntries = Array.from(byLeague.entries()).slice(0, 6);
  return {
    labels: [...sportEntries.map(([k]) => `S: ${k}`), ...leagueEntries.map(([k]) => `L: ${k}`)],
    values: [...sportEntries.map(([, v]) => v), ...leagueEntries.map(([, v]) => v)],
  };
}

function buildEdgeHistogram() {
  const bins = Array.from({ length: 12 }, (_, i) => ({ min: -0.12 + i * 0.02, max: -0.1 + i * 0.02, count: 0 }));
  const obs = state.edgeObservations.length ? state.edgeObservations : state.trades.map((t) => ({ edge: t.edge, correct: null }));
  for (const o of obs) {
    const e = Number(o.edge || 0);
    const idx = Math.max(0, Math.min(bins.length - 1, Math.floor((e + 0.12) / 0.02)));
    bins[idx].count += 1;
  }
  return {
    labels: bins.map((b) => `${(b.min * 100).toFixed(0)}%..${(b.max * 100).toFixed(0)}%`),
    values: bins.map((b) => b.count),
  };
}

function renderCharts() {
  const eqCtx = document.getElementById('equityChart');
  const eq = (state.equityCurve || []).slice(-180);
  const eqLabels = eq.map((p) => new Date(p.ts).toLocaleTimeString());
  const eqVals = eq.map((p) => Number(p.value || 0));
  if (!charts.equity) {
    charts.equity = new Chart(eqCtx, {
      type: 'line',
      data: { labels: eqLabels, datasets: [{ data: eqVals, borderColor: '#61dafb', borderWidth: 2, pointRadius: 0, tension: 0.2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8fa2c2' } }, y: { ticks: { color: '#8fa2c2' } } } },
    });
  } else {
    charts.equity.data.labels = eqLabels;
    charts.equity.data.datasets[0].data = eqVals;
    charts.equity.update('none');
  }

  const b = buildBreakdown();
  const bCtx = document.getElementById('breakdownChart');
  if (!charts.breakdown) {
    charts.breakdown = new Chart(bCtx, {
      type: 'bar',
      data: { labels: b.labels, datasets: [{ data: b.values, backgroundColor: b.values.map((v) => v >= 0 ? 'rgba(32,201,151,0.65)' : 'rgba(255,93,108,0.7)') }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8fa2c2' } }, y: { ticks: { color: '#8fa2c2' } } } },
    });
  } else {
    charts.breakdown.data.labels = b.labels;
    charts.breakdown.data.datasets[0].data = b.values;
    charts.breakdown.data.datasets[0].backgroundColor = b.values.map((v) => v >= 0 ? 'rgba(32,201,151,0.65)' : 'rgba(255,93,108,0.7)');
    charts.breakdown.update('none');
  }

  const h = buildEdgeHistogram();
  const hCtx = document.getElementById('edgeChart');
  if (!charts.edge) {
    charts.edge = new Chart(hCtx, {
      type: 'bar',
      data: { labels: h.labels, datasets: [{ label: 'Entries', data: h.values, backgroundColor: 'rgba(97,218,251,0.65)' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8fa2c2' } } }, scales: { x: { ticks: { color: '#8fa2c2', maxRotation: 75, minRotation: 75 } }, y: { ticks: { color: '#8fa2c2' } } } },
    });
  } else {
    charts.edge.data.labels = h.labels;
    charts.edge.data.datasets[0].data = h.values;
    charts.edge.update('none');
  }
}

function renderAlerts() {
  const root = document.getElementById('alertsList');
  const items = (state.alerts || []).slice(0, 20).map((a) => {
    const severity = a.type?.toLowerCase().includes('drawdown') ? 'danger' : 'warn';
    return `<li class="${severity}"><strong>${a.type}</strong> — ${a.message}<br><span class="muted">${new Date(a.ts).toLocaleTimeString()} • ${fmtNum(a.value)} / ${fmtNum(a.threshold)}</span></li>`;
  });
  root.innerHTML = items.length ? items.join('') : '<li class="warn">No active risk alerts</li>';
}

function renderRedemptions() {
  const root = document.getElementById('redemptionsList');
  const items = (state.redemptions || []).slice(0, 25).map((r) => {
    const link = `https://polygonscan.com/tx/${r.tx_hash}`;
    return `<li><strong>${r.market_id}</strong> • ${fmtMoney(r.amount)}<br><a href="${link}" target="_blank" rel="noreferrer">${r.tx_hash}</a> <span class="muted">${new Date(r.ts).toLocaleString()}</span></li>`;
  });
  root.innerHTML = items.length ? items.join('') : '<li>No recent redemptions</li>';
}

function renderAll() {
  renderKpis();
  renderPositions();
  renderTrades();
  renderCharts();
  renderAlerts();
  renderRedemptions();
}

let refreshTimer;
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    try {
      const [dashboard, balance] = await Promise.all([fetchJson('/dashboard'), fetchJson('/balance')]);
      state.positions = dashboard.positions || [];
      state.trades = dashboard.trades || state.trades;
      state.analytics = dashboard.analytics || state.analytics;
      state.equityCurve = (dashboard.equityCurve || []).slice().reverse();
      state.edgeObservations = dashboard.edgeObservations || state.edgeObservations;
      state.redemptions = dashboard.redemptions || state.redemptions;
      state.balance = balance || state.balance;
      renderAll();
    } catch (err) {
      console.error('refresh failed', err);
    }
  }, 180);
}

function setStatus(text, cls) {
  const el = document.getElementById('connectionStatus');
  el.textContent = text;
  el.className = `status ${cls}`;
}

function setupWs() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${location.host}/ws`;
  let retries = 0;

  const connect = () => {
    setStatus('Connecting…', 'connecting');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      retries = 0;
      setStatus('Connected', 'connected');
      scheduleRefresh();
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'trade:executed') {
          state.trades.unshift(msg.payload);
          state.trades = state.trades.slice(0, 100);
        } else if (msg.type === 'risk:alert') {
          state.alerts.unshift(msg.payload);
          state.alerts = state.alerts.slice(0, 100);
        }
        scheduleRefresh();
      } catch (e) {
        console.error('ws parse error', e);
      }
    };

    ws.onclose = () => {
      setStatus('Disconnected', 'disconnected');
      const delay = Math.min(10000, 1000 * (2 ** retries));
      retries += 1;
      setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  };

  connect();
}

bootstrap().catch((err) => {
  console.error(err);
  setStatus('Disconnected', 'disconnected');
});
