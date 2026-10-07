/*
 * The scoring rule, written to give exactly the numbers ForecastOracle.scoreOf
 * gives on chain (same integer math, prices in 8-decimal units). The practice
 * board, the house baselines and the on-chain oracle all use this one rule.
 *
 *   interval = (high - low) + 2 / (1 - confidence) * distance outside the range
 *   relative = interval / reference price, in parts per million
 *   score    = 10000 * (1 - relative / budget), floored at 0
 *
 * Budgets: 1 hour 2 %, 1 day 6 %, 1 week 15 % of the reference price.
 */

export type HorizonId = 0 | 1 | 2;

export const HORIZONS = [
  { id: 0, key: "1h", label: "1 hour", short: "1H", seconds: 3600, budgetPpm: 20_000n },
  { id: 1, key: "1d", label: "1 day", short: "1D", seconds: 86_400, budgetPpm: 60_000n },
  { id: 2, key: "1w", label: "1 week", short: "1W", seconds: 604_800, budgetPpm: 150_000n },
] as const;

export const horizonByKey = (key: string) => HORIZONS.find((h) => h.key === key) ?? null;

export const MIN_CONFIDENCE_BPS = 5000;
export const MAX_CONFIDENCE_BPS = 9900;
export const MAX_SCORE = 10_000;

/** Price as 8-decimal integer units, the way Chainlink feeds and the oracle store it. */
export const toUnits = (price: number) => BigInt(Math.round(price * 1e8));
export const fromUnits = (units: bigint) => Number(units) / 1e8;

export function scoreOf(low: bigint, high: bigint, confidenceBps: number, reference: bigint, price: bigint, horizon: HorizonId) {
  const alpha = BigInt(10_000 - confidenceBps);
  let interval = high - low;
  let inRange = false;
  if (price < low) interval += ((low - price) * 20_000n) / alpha;
  else if (price > high) interval += ((price - high) * 20_000n) / alpha;
  else inRange = true;
  const rel = (interval * 1_000_000n) / reference;
  const budget = HORIZONS[horizon].budgetPpm;
  const score = rel >= budget ? 0 : Number(10_000n - (rel * 10_000n) / budget);
  return { score, inRange };
}

/** 1 up, -1 down, 0 flat: the range's midpoint against the reference, as the oracle computes it. */
export function directionOf(low: bigint, high: bigint, reference: bigint): -1 | 0 | 1 {
  const mid = (low + high) / 2n;
  return mid > reference ? 1 : mid < reference ? -1 : 0;
}

export function outcomeDirection(reference: bigint, price: bigint): -1 | 0 | 1 {
  return price > reference ? 1 : price < reference ? -1 : 0;
}

/** Validation shared by the practice form and the on-chain commit (the oracle enforces the same limits). */
export function checkRange(low: bigint, high: bigint, confidenceBps: number, reference: bigint): string | null {
  if (!Number.isInteger(confidenceBps) || confidenceBps < MIN_CONFIDENCE_BPS || confidenceBps > MAX_CONFIDENCE_BPS) {
    return "Confidence must be between 50 % and 99 %.";
  }
  if (low <= 0n || low >= high) return "The low end must be above zero and below the high end.";
  if (low * 4n < reference || high > reference * 4n) return "Both ends must sit within a factor of four of the current price.";
  return null;
}

/** z for a central interval with the given coverage (Acklam's rational approximation of the normal quantile). */
export function zFor(confidenceBps: number) {
  const p = 0.5 + confidenceBps / 20_000;
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const q = Math.min(p, 1 - p);
  let x: number;
  if (q < 0.02425) {
    const r = Math.sqrt(-2 * Math.log(q));
    x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  } else {
    const r = q - 0.5;
    const s = r * r;
    x = ((((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r) / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
  }
  return Math.abs(x);
}

/** Running totals per model and horizon, the same counters the oracle keeps on chain. */
export type Tally = {
  committed: number;
  scored: number;
  voided: number;
  inRange: number;
  directionCalls: number;
  directionHits: number;
  scoreSum: number;
};

export const emptyTally = (): Tally => ({ committed: 0, scored: 0, voided: 0, inRange: 0, directionCalls: 0, directionHits: 0, scoreSum: 0 });

export const average = (t: Tally) => (t.scored ? t.scoreSum / t.scored : 0);

/** Fewest scored forecasts before a forecaster is ranked; below this a lucky streak says little. */
export const MIN_RANKED = 5;
