import "server-only";
import { getBoard } from "./board";
import { hourlyVol } from "./baselines";
import { roundAt } from "./history";

/*
 * Pulse: a momentum reading for every token from its Chainlink rounds. The
 * 1-session and 5-session returns are divided by the token's own volatility
 * over the same span, so a 2 % move in a quiet ETF counts for more than a 2 %
 * move in a volatile small cap. Score 0 to 100, 50 = no momentum.
 */

export type PulseRow = { symbol: string; name: string; price: number | null; r1: number | null; r5: number | null; score: number | null; updatedAt: number | null };

export async function pulseRows(): Promise<{ at: number; rows: PulseRow[] }> {
  const board = await getBoard();
  const now = board.at;
  const rows = board.rows.map((r) => {
    const pts = board.points.get(r.stock.symbol) ?? [];
    const head = pts[pts.length - 1];
    if (!head || pts.length < 4) return { symbol: r.stock.symbol, name: r.stock.name, price: r.price, r1: null, r5: null, score: null, updatedAt: r.updatedAt };
    const asRounds = pts.map((p) => ({ t: p.t, p: p.p, id: 0n, units: 0n }));
    const d1 = roundAt(asRounds, now - 86_400);
    const d5 = roundAt(asRounds, now - 5 * 86_400);
    const r1 = d1 ? head.p / d1.p - 1 : null;
    const r5 = d5 ? head.p / d5.p - 1 : null;
    const vol = hourlyVol(pts, now);
    const z1 = r1 != null ? r1 / (vol * Math.sqrt(24)) : 0;
    const z5 = r5 != null ? r5 / (vol * Math.sqrt(24 * 5)) : 0;
    const score = Math.round(50 + 50 * Math.tanh((0.6 * z1 + 0.4 * z5) / 1.5));
    return { symbol: r.stock.symbol, name: r.stock.name, price: r.price, r1, r5, score, updatedAt: r.updatedAt };
  });
  return { at: now, rows };
}
