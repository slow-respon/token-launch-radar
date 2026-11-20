# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/slow-respon/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/slow-respon/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks pre-token protocols by implied launch value and shows how to farm each one. It reads a sealed DefiLlama snapshot (758 protocols, 40 on the watchlist), prices every pre-token protocol from live-token comparables in the same snapshot, and writes a static offline dashboard: a Top 10 spotlight, a sortable and filterable board, a detail view per protocol with the full model breakdown, and a 7-step farm plan per protocol. Wrapped, staked and bridged products are set aside with the live tokens — a receipt for a token that already trades is not a launch candidate — so the board holds only protocols whose token does not exist yet.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node.js 22.18 or later, standard library only, no network. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Run it twice and the outputs are byte-identical.

## The model (radar-3)

Implied value is computed from the snapshot's own figures only — no protocol is ever special-cased by name:

```
multiple(category) = median(mcap / TVL) of live-token peers in the same category,
                     clamped to [0.02, 1.00]; fewer than 3 live peers falls back
                     to the global median over all live-token protocols.
growthMult         = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
maturityMult       = 0.6 + min(age_days, 1095) / 1095 * 0.4   (unknown age: 365 days)
implied            = round(tvl_usd * multiple(category) * growthMult * maturityMult)
```

On this snapshot the global median is 0.246x; 13 categories are priced from their own live peers (for example Dexs 0.34x, Lending 0.13x, RWA 0.27x, Liquid Staking 0.04x) and the rest inherit the global median, flagged as a fallback in the dashboard. Medians, not means: a few live tokens trade at extreme mcap/TVL ratios, and a mean would let one outlier price a whole category. The clamp keeps a launch from being valued above the value locked in the protocol.

The board covers all 40 watchlist protocols plus 138 pre-token protocols below the $50M floor, ranked by implied value (178 rows). Wrapped, staked and bridged products are excluded from the early radar by the watchlist's own rule — no Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking or Restaked BTC category, no whole word wrapped, staked or staking in the name, no exchange's name at the start — because their value is the token that already trades. Live-token protocols are set aside with their market caps — they are the comparables, not the candidates. "No token" always means "no token on record".

## Farm plans

Each protocol gets 7 steps derived from its own record — category family, chains, TVL and age — with a cost and a time per step: a fresh-wallet setup, the family's main action (supply + borrow for Lending, LP + swap for Dexs, margin + trade for Perps, bridge + use funds for Bridges, stake + restake for Staking, and so on), a second qualifying action, a weekly recurring action, a governance/points check, a hold period, and a safe-claim plus farm-log exit.

## Layout

- `main.ts` — the entrypoint: reads the snapshot, writes the board, data and dossier
- `lib/model.ts` — the model: comparable multiples, implied value, farm plans
- `dashboard/` — the offline page (`index.html`, `app.css`, `app.js`); the page recomputes each row's implied value and checks it against `board.json`
- `screenshots/` — the board, a protocol detail view and a filtered view
- `vendor/makefun-board.ts` — the make.fun dossier library, as shipped in the kit

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
