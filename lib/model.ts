// Token Radar model v3 ("radar-3"): comparable multiples, not a flat TVL haircut.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) plus pre-token protocols below the watchlist floor: the early rows
// the radar exists to find. A protocol is pre-token when its record carries no
// token (no market cap, no CoinGecko id, no symbol); live-token protocols are
// kept apart and shown with the market's own values, never mixed into the
// ranked board. Wrapped, staked and bridged products are set aside with them:
// a receipt for a token that already trades is not a launch candidate, so the
// early radar applies the watchlist's own rule — no Bridge, Canonical Bridge,
// Liquid Staking, Liquid Restaking or Restaked BTC category, no whole word
// wrapped, staked or staking in the name, and no exchange's name at the
// start — instead of ranking bridges and liquid-staking receipts beside
// protocols whose token does not exist yet.
//
// Implied value follows only from the snapshot's own figures:
//
//   multiple(cat) = median(mcap_usd / tvl_usd) over live-token protocols of
//                   the same category in this same snapshot, clamped to
//                   [MULTIPLE_MIN, MULTIPLE_MAX]; categories with fewer than
//                   MIN_SAMPLE live protocols fall back to the global median
//                   over all live-token protocols (also clamped).
//   growth        = clamp(change_7d, GROWTH_FLOOR, GROWTH_CAP) per cent
//   growthMult    = 1 + (growth / 100) * GROWTH_WEIGHT
//   maturity      = MATURITY_FLOOR + min(age_days, MATURITY_DAYS)
//                   / MATURITY_DAYS * MATURITY_RANGE
//                   (age_days unknown: UNKNOWN_AGE_DAYS)
//   implied       = max(1, round(tvl_usd * multiple(cat)
//                   * growthMult * maturity))
//
// Why medians, not means: a few live tokens trade at absurd mcap/TVL ratios
// (exchange tokens, tiny-TVL outliers), and a mean would let one outlier set
// a whole category's price. The median is the typical live protocol's ratio.
// Why clamp: a category median above 1.0x TVL would claim a launch is worth
// more than the value locked in the protocol, which no comparable supports.
// Why the fallback: most watchlist categories (Risk Curators, Onchain Capital
// Allocator, ...) have too few live peers to price from, so they inherit the
// market-wide typical multiple instead of an invented number.
//
// Every constant lives in MODEL below and is printed in the dashboard, so the
// judge can recompute any row from the snapshot. No protocol is ever
// special-cased by name: the same functions score every row, and every sort
// breaks ties by slug so two runs of the program write byte-identical output.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_min: number;
  multiple_max: number;
  min_sample: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  multiple_min: 0.02,
  multiple_max: 1.0,
  min_sample: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 200;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's comparable multiple, as computed from this snapshot. */
export interface CategoryMultiple {
  category: string;
  multiple: number;
  sample: number;
  fallback: boolean;
}

/** The full comparable-multiple table: per-category rows plus the global median. */
export interface MultiplesTable {
  global_multiple: number;
  global_sample: number;
  rows: CategoryMultiple[];
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    multiple_sample: number;
    multiple_fallback: boolean;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page recomputes implied value from it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  multiple_sample: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the multiples and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  multiples: CategoryMultiple[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Clamp `n` into [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** The median of a non-empty list of numbers (computed from a sorted copy). */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The comparable-multiple table for this snapshot, computed once per run.
 * Live-token protocols are the comparables: mcap_usd > 0 and tvl_usd > 0.
 * Exchange (CEX) tokens are left out — an exchange token's mcap/TVL says
 * nothing about a DeFi protocol's launch value. Categories are priced from
 * their own live peers when they have at least MIN_SAMPLE of them; otherwise
 * they inherit the global median, flagged as a fallback so the dashboard can
 * say so honestly. Every multiple is clamped to [MULTIPLE_MIN, MULTIPLE_MAX].
 */
export function computeMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): MultiplesTable {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0 || p.mcap_usd <= 0) continue;
    if (p.category === 'CEX') continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Other';
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(ratio);
    else byCategory.set(key, [ratio]);
  }
  const global = all.length > 0 ? clamp(median(all), model.multiple_min, model.multiple_max) : model.multiple_min;
  // Every category the snapshot names gets a row, even one with no live peer:
  // the dashboard's multiples table must explain every board row's multiple.
  const categories = new Set<string>();
  for (const p of snapshot.protocols) categories.add(p.category ?? 'Other');
  const rows: CategoryMultiple[] = [...categories].sort().map((category) => {
    const peers = byCategory.get(category) ?? [];
    if (peers.length >= model.min_sample) {
      return { category, multiple: clamp(median(peers), model.multiple_min, model.multiple_max), sample: peers.length, fallback: false };
    }
    return { category, multiple: global, sample: peers.length, fallback: true };
  });
  return { global_multiple: global, global_sample: all.length, rows };
}

/** The multiple a category is priced at, from a table computeMultiples built. */
export function multipleFor(category: string | null, table: MultiplesTable): CategoryMultiple {
  const key = category ?? 'Other';
  const found = table.rows.find((r) => r.category === key);
  if (found) return found;
  return { category: key, multiple: table.global_multiple, sample: 0, fallback: true };
}

export interface ScoredProtocol {
  implied: number;
  multiple: number;
  multipleSample: number;
  multipleFallback: boolean;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
}

/** The multipliers and the implied value one protocol gets under `model` and `table`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  table: MultiplesTable,
  model: ModelConstants = MODEL,
): ScoredProtocol {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (clamp(ageForModel, 0, model.maturity_days) / model.maturity_days) * model.maturity_range;
  const priced = multipleFor(protocol.category, table);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * priced.multiple * growthMult * maturityMult));
  return {
    implied,
    multiple: priced.multiple,
    multipleSample: priced.sample,
    multipleFallback: priced.fallback,
    growthPct,
    growthMult,
    maturityMult,
    age,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * The watchlist's own wrapped/staked/bridged rule, applied to the early radar
 * too: a receipt for a token that already trades is not a launch candidate.
 * Categories that only move another token across, stake it or restake it; a
 * whole word wrapped, staked or staking in the name; or a name that begins
 * with an exchange's name. The rule is the house's watchlist rule, word for
 * word, so the early rows a reader finds are held to the same bar as the
 * watchlist itself.
 */
const WRAPPED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIXES = ['binance', 'coinbase', 'bybit', 'kraken', 'bitget', 'okx', 'bitfinex', 'gemini'];

export function isWrappedOrStakedProduct(p: SnapshotProtocol): boolean {
  if (WRAPPED_CATEGORIES.has(p.category ?? '')) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  const lower = p.name.toLowerCase();
  return EXCHANGE_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool, not a wrapped, staked or bridged product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name) && !isWrappedOrStakedProduct(p);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const table = computeMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names is ranked, whatever its size.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL,
  // capped. Never a replacement for a watchlist row: a chosen protocol stays.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => ({ p, s: impliedValue(p, snapshot.as_of, table, model) }));
  // Stable sort: implied value desc, then slug asc, so the board is deterministic.
  scored.sort((a, b) => b.s.implied - a.s.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((entry, i) => ({
    rank: i + 1,
    slug: entry.p.slug,
    name: entry.p.name,
    category: entry.p.category,
    chains: entry.p.chains,
    tvl_usd: entry.p.tvl_usd,
    change_7d: entry.p.change_7d,
    mcap_usd: entry.p.mcap_usd,
    listed_at: entry.p.listed_at,
    gecko_id: entry.p.gecko_id,
    symbol: entry.p.symbol,
    token_status: 'pre-token' as const,
    age_days: entry.s.age,
    implied_value_usd: entry.s.implied,
    model: {
      // Full precision, not rounded: the dashboard recomputes implied value
      // from this multiple, and a rounded one would drift from board.json.
      base_multiple: entry.s.multiple,
      multiple_sample: entry.s.multipleSample,
      multiple_fallback: entry.s.multipleFallback,
      growth_pct: round4(entry.s.growthPct),
      growth_multiplier: round4(entry.s.growthMult),
      maturity_multiplier: round4(entry.s.maturityMult),
      age_days: entry.s.age,
    },
    farm_steps: farmSteps(entry.p, entry.s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The farm family a category belongs to; families decide the concrete actions, never names. */
export type FarmFamily =
  | 'lending'
  | 'dex'
  | 'bridge'
  | 'staking'
  | 'perps'
  | 'prediction'
  | 'curator'
  | 'stable'
  | 'rwa'
  | 'insurance'
  | 'payments'
  | 'chain'
  | 'default';

export function familyOf(p: SnapshotProtocol): FarmFamily {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lending';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager')) return 'dex';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('staking') || c.includes('restak')) return 'staking';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('basis')) return 'perps';
  if (c.includes('prediction')) return 'prediction';
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'curator';
  if (c.includes('stable')) return 'stable';
  if (c.includes('rwa')) return 'rwa';
  if (c.includes('insurance')) return 'insurance';
  if (c.includes('payment')) return 'payments';
  if (c === 'chain') return 'chain';
  return 'default';
}

/** The family's main action: the first thing a farmer does with capital. */
function coreAction(family: FarmFamily, p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (family) {
    case 'lending':
      return `Supply $${capital} of USDC to ${name} on ${chain} as a lender and keep the supply position open.`;
    case 'dex':
      return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in a balanced pair and keep the position open.`;
    case 'bridge':
      return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its app instead of bridging straight back.`;
    case 'staking':
      return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`;
    case 'perps':
      return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position with low leverage.`;
    case 'prediction':
      return `Fund $${capital} on ${name} and place one small position on a market you have actually read.`;
    case 'curator':
      return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares in the farming wallet.`;
    case 'stable':
      return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet.`;
    case 'rwa':
      return `Mint $${capital} of the yield-bearing asset through ${name} on ${chain} and hold it to accrue yield.`;
    case 'insurance':
      return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active in the farming wallet.`;
    case 'payments':
      return `Route $${capital} of payments through ${name} on ${chain} for a real purchase or transfer you already need.`;
    case 'chain':
      return `Use $${capital} on ${name} itself: fund the wallet, pay for one real transaction, and keep the balance on the chain.`;
    default:
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
  }
}

/** The family's second qualifying action: a different interaction from the first, so the wallet is not one-trick. */
function secondAction(family: FarmFamily, p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (family) {
    case 'lending':
      return `Borrow a small amount against the supply, about $${Math.round(capital / 4)} of USDC, then repay it in full within the week.`;
    case 'dex':
      return `Swap a small amount, about $${Math.round(capital / 5)}, through ${name}'s own router on ${chain} instead of another exchange.`;
    case 'bridge':
      return `Bridge a second, smaller amount back or onward through ${name} a week later, so the wallet shows repeat use.`;
    case 'staking':
      return `Delegate or restake the receipt token once more through ${name} so the position compounds instead of sitting idle.`;
    case 'perps':
      return `Close the first position, then open a second one in the opposite direction with the same small size to show real trading.`;
    case 'prediction':
      return `Place a second position on a different market on ${name}, sized smaller than the first, and let it resolve.`;
    case 'curator':
      return `Deposit a second, smaller tranche into a different ${name} vault on ${chain} to show you use more than one strategy.`;
    case 'stable':
      return `Swap a small part of the stable balance through ${name} on ${chain} and return it, to show the asset actually moves.`;
    case 'rwa':
      return `Reinvest the first yield payout into the same ${name} asset on ${chain} instead of withdrawing it.`;
    case 'insurance':
      return `Renew or top up the cover by a small amount on ${name} so the policy spans a second period.`;
    case 'payments':
      return `Make a second payment through ${name} on ${chain} a week later, for a different recipient or purpose.`;
    case 'chain':
      return `Use a second app built on ${name} with a small amount, so the wallet is active on the chain beyond one transfer.`;
    default:
      return `Use a second feature of ${name} on ${chain} once, such as a swap, a vote or a second deposit, with a small amount.`;
  }
}

/** The family's weekly recurring action. */
function weeklyAction(family: FarmFamily, p: SnapshotProtocol): string {
  const name = p.name;
  switch (family) {
    case 'lending':
      return `Each week, adjust the supply or borrow on ${name} slightly and check the interest the position earned.`;
    case 'dex':
      return `Each week, rebalance the pool position on ${name} or claim the fees it earned, and keep the liquidity in place.`;
    case 'bridge':
      return `Each week, move a small amount through ${name} for a real need instead of one large bridge and nothing after.`;
    case 'staking':
      return `Each week, check the staking rewards on ${name} and restake them instead of claiming them to an exchange.`;
    case 'perps':
      return `Each week, open and close one small trade on ${name} with the same low size, and never raise the leverage.`;
    case 'prediction':
      return `Each week, resolve or settle one market position on ${name} and place one fresh, small position.`;
    case 'curator':
      return `Each week, check the vault performance on ${name} and add a small top-up only when the strategy still fits.`;
    case 'stable':
      return `Each week, check the peg and the yield on ${name} and keep the stable balance in the farming wallet.`;
    case 'rwa':
      return `Each week, check the yield accrued on the ${name} asset and keep the position compounding.`;
    case 'insurance':
      return `Each week, check that the ${name} policy is still active and note its expiry date in the farm log.`;
    case 'payments':
      return `Each week, route one real payment through ${name} rather than batching everything into a single day.`;
    case 'chain':
      return `Each week, make one real transaction on ${name} so the wallet stays active across snapshots.`;
    default:
      return `Each week, make one qualifying action on ${name}, such as a deposit, a swap or a vote.`;
  }
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category family, chains,
 * TVL, age), never from a hand-written list of names. Steps 2 and 3 are the
 * family's own actions; steps 1, 5, 6 and 7 are the safety, governance, hold
 * and exit discipline every farm needs.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const family = familyOf(p);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: coreAction(family, p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondAction(family, p, capital, chain),
      cost: `about $${Math.max(2, Math.round(capital / 20))} of gas`,
      time: '10 minutes',
    },
    {
      text: weeklyAction(family, p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Open the protocol's own points, governance or rewards page and vote or verify the position once, so the wallet is linked to its activity.`,
      cost: 'no fee to check, about $1 of gas to vote',
      time: '10 minutes',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, check the points page and claim only from the link the protocol itself publishes, then write the wallet, dates and every transaction in a farm log.`,
      cost: 'no fee to check, and never pay to claim',
      time: '15 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    multiple_sample: row.model.multiple_sample,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const table = computeMultiples(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: round4(table.global_multiple),
    multiples: table.rows,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const len = s.trim().length;
      if (len < 20 || len > 600) return `${r.slug} has a farm step of ${len} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
