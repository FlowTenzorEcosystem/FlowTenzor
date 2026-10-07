import { NextResponse } from "next/server";
import { ticker } from "@/lib/feeds/okx";

export const dynamic = "force-dynamic";

/** TAO/USDT spot from OKX. Off-chain: TAO does not exist on Robinhood Chain. */
export async function GET() {
  const t = await ticker("TAO-USDT").catch(() => null);
  // An unreachable source is a normal state for the page, not an HTTP error.
  return NextResponse.json(t ? { source: "OKX spot TAO-USDT", ...t } : { available: false }, { headers: { "cache-control": t ? "public, max-age=30" : "no-store" } });
}
