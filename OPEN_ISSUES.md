# OPEN ISSUES (Operator-Facing)

Last updated: 2026-02-28

## 1) Polymarket price feed not populating
- **Impact:** Dashboard `priceFeed` remains `0`; no feed intersection with model feed.
- **Current symptom:** WS connection opens, but no usable `market:price` emissions.
- **Severity:** High (blocks arb matching).

## 2) Feed health partially degraded
- **Current status:**
  - Model feed: healthy (rows flowing)
  - Price feed: degraded (empty)
- **Impact:** Monitoring tab shows markets from model source only.

## 3) Frontend bundle size warning
- Build warning: JS chunk ~740kB (gzip ~221kB).
- **Impact:** Performance/maintainability risk, not blocking trading logic.

## 4) Local port 8080 collision risk
- A local process has occupied 8080 at times.
- **Impact:** Can break components that assume 8080 availability.

## 5) SSE/REST resilience needs hard health policy
- We added fallback polling, but should enforce explicit alarming when feed flow stalls.
- **Impact:** Silent degradation risk if only connection-level checks are used.
