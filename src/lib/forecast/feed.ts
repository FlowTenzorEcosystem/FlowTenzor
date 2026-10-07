import "server-only";
import { getStore } from "@/lib/auth/store";
import { allForecasts } from "@/lib/practice/forecasts";
import { hourlyVol } from "./baselines";
import { getBoard } from "./board";
import { signalOf, type Signal } from "./consensus";
import { HORIZONS, type HorizonId } from "./scoring";

/* Serialisable rows for the forecast feed: house ranges, live practice views and the signal per horizon. */

export type FeedCell = { low: number; high: number; width: number; practice: number; up: number; down: number; signal: Signal["label"]; forecasters: number };
export type FeedRow = {
  symbol: string;
  name: string;
  kind: "stock" | "etf";
  price: number | null;
  updatedAt: number | null;
  change24h: number | null;
  vol30: number | null; // annualised, from the Chainlink rounds
  spark: { t: number; p: number }[];
  cells: Record<HorizonId, FeedCell | null>;
};

export async function feedRows(): Promise<{ at: number; rows: FeedRow[]; practiceLive: number }> {
  const board = await getBoard();
  const store = getStore();
  const now = Math.floor(Date.now() / 1000);
  const practice = store ? (await allForecasts(store)).filter((p) => p.status === "open" && p.resolvesAt > now) : [];
  const rows = board.rows.map((r) => {
    const pts = board.points.get(r.stock.symbol) ?? [];
    const cells = {} as Record<HorizonId, FeedCell | null>;
    for (const h of HORIZONS) {
      const hid = h.id as HorizonId;
      const house = r.forecasts[hid].map((f) => ({ low: Number(f.low) / 1e8, high: Number(f.high) / 1e8, reference: Number(f.reference) / 1e8 }));
      const mine = practice.filter((p) => p.symbol === r.stock.symbol && p.horizon === hid).map((p) => ({ low: Number(BigInt(p.low)) / 1e8, high: Number(BigInt(p.high)) / 1e8, reference: Number(BigInt(p.reference)) / 1e8 }));
      if (!house.length || r.price == null) {
        cells[hid] = null;
        continue;
      }
      const base = signalOf(house);
      const all = signalOf([...house, ...mine]);
      const pv = signalOf(mine);
      cells[hid] = { low: base.low, high: base.high, width: (base.high - base.low) / 2 / r.price, practice: mine.length, up: pv.up, down: pv.down, signal: all.label, forecasters: all.count };
    }
    // Hourly vol to annual: 24 session hours a day, 252 sessions a year (24/5 feeds).
    const vol = pts.length > 3 ? hourlyVol(pts, board.at) * Math.sqrt(24 * 252) : null;
    return {
      symbol: r.stock.symbol,
      name: r.stock.name,
      kind: r.stock.kind,
      price: r.price,
      updatedAt: r.updatedAt,
      change24h: r.change24h,
      vol30: vol,
      spark: pts.filter((p) => p.t >= board.at - 5 * 86_400),
      cells,
    };
  });
  return { at: board.at, rows, practiceLive: practice.length };
}
