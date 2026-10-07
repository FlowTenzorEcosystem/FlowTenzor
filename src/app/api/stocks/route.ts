import { NextResponse } from "next/server";
import { STOCKS } from "@/config/stocks";
import { inEquityHours, latest } from "@/lib/feeds/chainlink";

export const dynamic = "force-dynamic";

/** Live Chainlink prices for the tokenized equities on Robinhood Chain. */
export async function GET() {
  const rows = await Promise.all(
    STOCKS.map(async (s) => {
      const round = await latest(s.feed);
      return {
        symbol: s.symbol,
        name: s.name,
        token: s.token,
        feed: s.feed,
        price: round?.answer ?? null,
        updatedAt: round?.updatedAt ?? null,
      };
    }),
  );
  return NextResponse.json({ at: Date.now(), marketOpen: inEquityHours(), rows }, { headers: { "cache-control": "no-store" } });
}
