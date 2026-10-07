import { NextResponse } from "next/server";
import { isAddress } from "@/config/brand";
import { stockBySymbol } from "@/config/stocks";
import { getStore } from "@/lib/auth/store";
import { allowPublic, tooMany } from "@/lib/guard";
import { allForecasts, toPublic, walletForecasts } from "@/lib/practice/forecasts";

export const dynamic = "force-dynamic";

/** Practice forecasts: ?wallet=0x… for one wallet, ?symbol=NVDA for one token, nothing for the latest across the board. */
export async function GET(request: Request) {
  const store = getStore();
  if (!store) return NextResponse.json({ configured: false, forecasts: [] });
  if (!(await allowPublic(store, request, "pf-read", 120, 3000))) return tooMany();
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet") ?? "";
  const symbol = url.searchParams.get("symbol") ?? "";
  let list;
  if (wallet) {
    if (!isAddress(wallet)) return NextResponse.json({ error: "Bad wallet address." }, { status: 400 });
    list = await walletForecasts(store, wallet);
  } else {
    list = await allForecasts(store);
    if (symbol) {
      const s = stockBySymbol(symbol);
      list = s ? list.filter((r) => r.symbol === s.symbol) : [];
    }
  }
  return NextResponse.json({ configured: true, forecasts: list.slice(0, 200).map(toPublic) }, { headers: { "cache-control": "no-store" } });
}
