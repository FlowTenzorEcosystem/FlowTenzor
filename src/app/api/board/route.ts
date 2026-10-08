import { NextResponse } from "next/server";
import { getStore, type Store } from "@/lib/auth/store";
import { getBoard } from "@/lib/forecast/board";
import { allowPublic, tooMany } from "@/lib/guard";

export const dynamic = "force-dynamic";

/**
 * The live forecast board as JSON for the app screens: Chainlink price per token,
 * the house baselines' live ranges, and their scored backtest lines (newest 400).
 */
export async function GET(request: Request) {
  const store = getStore();
  if (!(await allowPublic(store as Store, request, "board", 60, 3000))) return tooMany();
  const b = await getBoard();
  const url = new URL(request.url);
  const model = url.searchParams.get("model");
  const h = url.searchParams.get("h");
  if (url.searchParams.get("strip")) {
    // Price strip for the app ticker: price and 24 h change only.
    return NextResponse.json(
      { at: b.at, rows: b.rows.map((r) => ({ symbol: r.stock.symbol, price: r.price, change24h: r.change24h })) },
      { headers: { "cache-control": "public, max-age=30" } },
    );
  }
  if (model) {
    // One baseline's scored record at one horizon, for paper follow.
    const lines = b.recent.filter((l) => l.model === model && (h === null || String(l.horizon) === h)).slice(0, 3000);
    return NextResponse.json({ at: b.at, lines }, { headers: { "cache-control": "public, max-age=30" } });
  }
  const units = (v: bigint) => Number(v) / 1e8;
  return NextResponse.json(
    {
      at: b.at,
      rows: b.rows.map((r) => ({
        symbol: r.stock.symbol,
        name: r.stock.name,
        price: r.price,
        updatedAt: r.updatedAt,
        change24h: r.change24h,
        forecasts: Object.fromEntries(
          Object.entries(r.forecasts).map(([h, list]) => [h, list.map((f) => ({ model: f.model, low: units(f.low), high: units(f.high), reference: units(f.reference), confidenceBps: f.confidenceBps }))]),
        ),
      })),
      recent: b.recent.slice(0, 400),
      tallies: b.tallies,
    },
    { headers: { "cache-control": "public, max-age=30" } },
  );
}
