import { NextResponse } from "next/server";
import { stockBySymbol } from "@/config/stocks";
import { getStore, type Store } from "@/lib/auth/store";
import { daily, quote } from "@/lib/feeds/nasdaq";
import { history } from "@/lib/forecast/history";
import { allowPublic, tooMany } from "@/lib/guard";

export const dynamic = "force-dynamic";

/**
 * Chart data for one token. 1D: today's minute points of the listing (Nasdaq).
 * 5D: the Chainlink rounds of the token feed. 1M, 6M, 1Y: daily bars of the listing.
 */
export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  if (!(await allowPublic(getStore() as Store, request, "series", 90, 3000))) return tooMany();
  const { symbol } = await params;
  const s = stockBySymbol(symbol);
  if (!s) return NextResponse.json({ error: "Unknown symbol." }, { status: 404 });
  const range = new URL(request.url).searchParams.get("range") ?? "1M";
  const headers = { "cache-control": "public, max-age=60" };
  if (range === "1D") {
    const q = await quote(s.symbol);
    return NextResponse.json({ range, source: "Nasdaq listing, minute points", kind: "line", points: q?.points ?? [] }, { headers });
  }
  if (range === "5D") {
    const rounds = await history(s);
    const since = Math.floor(Date.now() / 1000) - 5 * 86_400;
    return NextResponse.json({ range, source: "the token's Chainlink feed", kind: "step", points: rounds.filter((r) => r.t >= since).map((r) => ({ t: r.t, p: r.p })) }, { headers });
  }
  const days = range === "1Y" ? 370 : range === "6M" ? 186 : 32;
  const bars = (await daily(s.symbol, 370)).filter((b) => b.t >= Date.now() / 1000 - days * 86_400);
  return NextResponse.json({ range, source: "Nasdaq listing, daily bars", kind: "candles", bars }, { headers });
}
