import { NextResponse } from "next/server";
import { getStore, type Store } from "@/lib/auth/store";
import { allQuotes } from "@/lib/feeds/nasdaq";
import { allowPublic, tooMany } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Listing quotes (last, change, volume, intraday points thinned to 60) for every token. */
export async function GET(request: Request) {
  if (!(await allowPublic(getStore() as Store, request, "quotes", 60, 3000))) return tooMany();
  const all = await allQuotes();
  const rows = [...all.entries()].map(([symbol, q]) => ({
    symbol,
    company: q?.company ?? null,
    last: q?.last ?? null,
    changePct: q?.changePct ?? null,
    volume: q?.volume ?? null,
    asOf: q?.asOf ?? null,
    spark: q ? q.points.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 60)) === 0) : [],
  }));
  return NextResponse.json({ at: Date.now(), source: "Nasdaq", rows }, { headers: { "cache-control": "public, max-age=60" } });
}
