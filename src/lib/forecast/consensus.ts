/*
 * Consensus and divergence over a set of live forecasts for one token and
 * horizon (the same quantities ForecastOracle.consensus returns on chain).
 *
 *   consensus:  at least three forecasters, and three quarters of them lean
 *               the same way (range midpoint above or below the price).
 *   divergence: the forecasters' midpoints sit further apart than half of
 *               their average range width. They disagree by more than they
 *               say they are unsure: a flag for high uncertainty.
 */

export type Vote = { low: number; high: number; reference: number };

export type Signal = {
  count: number;
  up: number;
  down: number;
  flat: number;
  low: number;
  high: number;
  spread: number; // (max mid - min mid) / reference
  avgWidth: number; // average (high - low) / reference
  label: "consensus-up" | "consensus-down" | "divergent" | "mixed" | "thin";
};

export function signalOf(votes: Vote[]): Signal {
  const n = votes.length;
  if (n === 0) return { count: 0, up: 0, down: 0, flat: 0, low: 0, high: 0, spread: 0, avgWidth: 0, label: "thin" };
  let up = 0;
  let down = 0;
  let flat = 0;
  let lowSum = 0;
  let highSum = 0;
  let widthSum = 0;
  let minMid = Infinity;
  let maxMid = -Infinity;
  const ref = votes[votes.length - 1].reference;
  for (const v of votes) {
    const mid = (v.low + v.high) / 2;
    if (mid > v.reference) up++;
    else if (mid < v.reference) down++;
    else flat++;
    lowSum += v.low;
    highSum += v.high;
    widthSum += (v.high - v.low) / v.reference;
    minMid = Math.min(minMid, mid);
    maxMid = Math.max(maxMid, mid);
  }
  const spread = (maxMid - minMid) / ref;
  const avgWidth = widthSum / n;
  let label: Signal["label"] = "mixed";
  if (n < 3) label = "thin";
  else if (n >= 2 && spread > avgWidth / 2) label = "divergent";
  else if (up / n >= 0.75) label = "consensus-up";
  else if (down / n >= 0.75) label = "consensus-down";
  return { count: n, up, down, flat, low: lowSum / n, high: highSum / n, spread, avgWidth, label };
}

export const SIGNAL_TEXT: Record<Signal["label"], string> = {
  "consensus-up": "Consensus: up",
  "consensus-down": "Consensus: down",
  divergent: "Divergence",
  mixed: "Mixed",
  thin: "Too few forecasts",
};
