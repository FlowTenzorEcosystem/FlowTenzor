import { sessionHours } from "./calendar";
import { HORIZONS, toUnits, zFor, type HorizonId } from "./scoring";

/*
 * House baselines: three plain statistical forecasters that run on the
 * Chainlink rounds alone. They are not AI and they are not trying to win.
 * They are the bar: a model that cannot beat a random walk over enough
 * scored forecasts has not shown any skill. Every forecast they make uses
 * only rounds published at or before the moment it is made.
 */

export type Point = { t: number; p: number };

export type HouseModel = {
  id: "still-water" | "eddy" | "undertow" | "current";
  name: string;
  style: string;
  about: string;
};

export const HOUSE: HouseModel[] = [
  {
    id: "still-water",
    name: "Still Water",
    style: "Random walk",
    about: "Puts every range around the last Chainlink price, as wide as the last five days of swings suggest. It never leans either way.",
  },
  {
    id: "eddy",
    name: "Eddy",
    style: "Fast volatility",
    about: "Takes no side. Its range widens fast after a sharp move and tightens as markets settle, because recent swings count most (decay 0.94).",
  },
  {
    id: "undertow",
    name: "Undertow",
    style: "Mean reversion",
    about: "Leans the range back toward the three-day average price, assuming stretched moves partly unwind.",
  },
  {
    id: "current",
    name: "Current",
    style: "Momentum",
    about: "Leans the range in the direction of the last 24 hours, assuming a move keeps some of its pace.",
  },
];

export const HOUSE_CONFIDENCE_BPS = 8000;

/** Volatility per square-root session hour, from log returns between rounds over the last five days. */
export function hourlyVol(points: Point[], t: number) {
  const from = t - 5 * 86_400;
  const window = points.filter((x) => x.t > from && x.t <= t);
  if (window.length < 3) return 0.004;
  let sum = 0;
  for (let i = 1; i < window.length; i++) {
    const r = Math.log(window[i].p / window[i - 1].p);
    sum += r * r;
  }
  const hours = Math.max(6, sessionHours(window[0].t, t));
  // Feeds publish on a 0.5 % move, so realised volatility from rounds is a floor-heavy estimate; keep a sane floor.
  return Math.max(0.0015, Math.sqrt(sum / hours));
}

/** Exponentially weighted volatility per square-root session hour (decay 0.94 per round). */
export function ewmaVol(points: Point[], t: number) {
  const window = points.filter((x) => x.t > t - 10 * 86_400 && x.t <= t);
  if (window.length < 3) return hourlyVol(points, t);
  let v = 0;
  let seeded = false;
  for (let i = 1; i < window.length; i++) {
    const hours = Math.max(0.25, sessionHours(window[i - 1].t, window[i].t));
    const x = Math.log(window[i].p / window[i - 1].p) / Math.sqrt(hours);
    v = seeded ? 0.94 * v + 0.06 * x * x : x * x;
    seeded = true;
  }
  return Math.max(0.0015, Math.sqrt(v));
}

function priceAt(points: Point[], t: number) {
  let found: Point | null = null;
  for (const x of points) {
    if (x.t <= t) found = x;
    else break;
  }
  return found;
}

export type HouseForecast = { model: HouseModel["id"]; low: bigint; high: bigint; confidenceBps: number; reference: bigint; mid: number };

/** The house model's forecast at time t for one horizon, or null when there is no price yet. */
export function houseForecast(model: HouseModel["id"], points: Point[], t: number, horizon: HorizonId): HouseForecast | null {
  const now = priceAt(points, t);
  if (!now) return null;
  const p = now.p;
  const ref = toUnits(p);
  const hEff = Math.max(1, sessionHours(t, t + HORIZONS[horizon].seconds));
  const sigma = (model === "eddy" ? ewmaVol(points, t) : hourlyVol(points, t)) * Math.sqrt(hEff);
  const z = zFor(HOUSE_CONFIDENCE_BPS);
  let centre = 0;
  let width = z * sigma;
  if (model === "undertow") {
    const recent = points.filter((x) => x.t > t - 3 * 86_400 && x.t <= t);
    const mean = recent.length ? recent.reduce((a, x) => a + x.p, 0) / recent.length : p;
    centre = 0.35 * Math.log(mean / p) * Math.min(1, hEff / 24);
  } else if (model === "current") {
    const dayAgo = priceAt(points, t - 86_400);
    const drift = dayAgo ? Math.log(p / dayAgo.p) : 0;
    centre = 0.5 * drift * Math.min(1, hEff / 24);
    width *= 1.15;
  }
  // Symmetric in price around the centre, so a range with no lean has its midpoint exactly on the price.
  const centreUnits = toUnits(p * Math.exp(centre));
  const half = BigInt(Math.max(1, Math.round(Number(centreUnits) * width)));
  const low = centreUnits - half;
  const high = centreUnits + half;
  const lowP = Number(low) / 1e8;
  const highP = Number(high) / 1e8;
  return { model, low, high, confidenceBps: HOUSE_CONFIDENCE_BPS, reference: ref, mid: (lowP + highP) / 2 };
}
