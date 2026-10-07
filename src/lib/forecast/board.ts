import "server-only";
import { STOCKS, type StockLine } from "@/config/stocks";
import { HOUSE, houseForecast, type HouseForecast, type HouseModel } from "./baselines";
import { inSession } from "./calendar";
import { histories, latestAll, roundAt, type Round } from "./history";
import { HORIZONS, directionOf, emptyTally, outcomeDirection, scoreOf, type HorizonId, type Tally } from "./scoring";

/*
 * The forecast board, computed from Chainlink rounds:
 *   - live house forecasts for every token and horizon,
 *   - the house baselines' track record, replayed over up to the last 12 days of
 *     rounds with the exact on-chain scoring and void rules (a backtest: these
 *     forecasts were computed after the fact, from data that existed at the time).
 */

export type ScoredLine = {
  symbol: string;
  model: HouseModel["id"];
  horizon: HorizonId;
  madeAt: number;
  resolvesAt: number;
  low: number;
  high: number;
  reference: number;
  price: number | null;
  status: "scored" | "void";
  score: number;
  inRange: boolean;
};

export type LiveRow = {
  stock: StockLine;
  price: number | null;
  updatedAt: number | null;
  change24h: number | null;
  forecasts: Record<HorizonId, HouseForecast[]>;
};

export type Board = {
  at: number;
  rows: LiveRow[];
  tallies: Record<HouseModel["id"], Record<HorizonId, Tally>>;
  recent: ScoredLine[];
  points: Map<string, { t: number; p: number }[]>;
  roundsRead: number;
};

const STEP: Record<HorizonId, number> = { 0: 2 * 3600, 1: 12 * 3600, 2: 24 * 3600 };

function replay(stock: StockLine, rounds: Round[], now: number, tallies: Board["tallies"], recent: ScoredLine[]) {
  if (rounds.length < 4) return;
  const points = rounds.map((r) => ({ t: r.t, p: r.p }));
  const start = rounds[0].t + 4 * 86_400; // leave four days of history for the volatility estimate
  for (const h of HORIZONS) {
    const horizon = h.id as HorizonId;
    // Align to the step so every refresh replays the same moments.
    for (let t = Math.ceil(start / STEP[horizon]) * STEP[horizon]; t + h.seconds < now; t += STEP[horizon]) {
      if (!inSession(t)) continue;
      const ref = roundAt(rounds, t);
      const end = roundAt(rounds, t + h.seconds);
      if (!ref || !end) continue;
      for (const m of HOUSE) {
        const f = houseForecast(m.id, points, t, horizon);
        if (!f) continue;
        const tally = tallies[m.id][horizon];
        tally.committed += 1;
        const line: ScoredLine = {
          symbol: stock.symbol,
          model: m.id,
          horizon,
          madeAt: t,
          resolvesAt: t + h.seconds,
          low: Number(f.low) / 1e8,
          high: Number(f.high) / 1e8,
          reference: Number(f.reference) / 1e8,
          price: null,
          status: "void",
          score: 0,
          inRange: false,
        };
        if (end.id === ref.id) {
          tally.voided += 1;
        } else {
          const { score, inRange } = scoreOf(f.low, f.high, f.confidenceBps, f.reference, end.units, horizon);
          const dir = directionOf(f.low, f.high, f.reference);
          tally.scored += 1;
          tally.scoreSum += score;
          if (inRange) tally.inRange += 1;
          if (dir !== 0) {
            tally.directionCalls += 1;
            if (dir === outcomeDirection(f.reference, end.units)) tally.directionHits += 1;
          }
          Object.assign(line, { price: end.p, status: "scored", score, inRange });
        }
        recent.push(line);
      }
    }
  }
}

let cache: { at: number; value: Board } | null = null;
let running: Promise<Board> | null = null;

async function compute(): Promise<Board> {
  const now = Math.floor(Date.now() / 1000);
  const [all, latest] = await Promise.all([histories(STOCKS), latestAll()]);
  const tallies = Object.fromEntries(HOUSE.map((m) => [m.id, { 0: emptyTally(), 1: emptyTally(), 2: emptyTally() }])) as Board["tallies"];
  const recent: ScoredLine[] = [];
  const points = new Map<string, { t: number; p: number }[]>();
  let roundsRead = 0;
  const rows: LiveRow[] = STOCKS.map((stock) => {
    const rounds = all.get(stock.symbol) ?? [];
    roundsRead += rounds.length;
    const head = latest.get(stock.symbol) ?? rounds[rounds.length - 1] ?? null;
    // The live head may be newer than the cached history; append it so live forecasts use it.
    const series = rounds.map((r) => ({ t: r.t, p: r.p }));
    if (head && (!series.length || head.t > series[series.length - 1].t)) series.push({ t: head.t, p: head.p });
    points.set(stock.symbol, series);
    replay(stock, rounds, now, tallies, recent);
    const dayAgo = roundAt(rounds, now - 86_400);
    const forecasts = { 0: [], 1: [], 2: [] } as Record<HorizonId, HouseForecast[]>;
    for (const h of HORIZONS) {
      for (const m of HOUSE) {
        const f = houseForecast(m.id, series, now, h.id as HorizonId);
        if (f) forecasts[h.id as HorizonId].push(f);
      }
    }
    return {
      stock,
      price: head?.p ?? null,
      updatedAt: head?.t ?? null,
      change24h: head && dayAgo ? head.p / dayAgo.p - 1 : null,
      forecasts,
    };
  });
  recent.sort((a, b) => b.resolvesAt - a.resolvesAt);
  return { at: now, rows, tallies, recent, points, roundsRead };
}

/** The board, recomputed at most every five minutes; callers during a refresh share one computation. */
export async function getBoard(): Promise<Board> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  if (!running) {
    running = compute()
      .then((value) => {
        // Keep the last good board if this read came back empty (RPC outage).
        if (value.roundsRead > 0 || !cache) cache = { at: Date.now(), value };
        return cache.value;
      })
      .finally(() => {
        running = null;
      });
  }
  // While a refresh runs, serve the previous board instead of waiting.
  return cache ? cache.value : running;
}

export const rowFor = (board: Board, symbol: string) => board.rows.find((r) => r.stock.symbol === symbol) ?? null;
