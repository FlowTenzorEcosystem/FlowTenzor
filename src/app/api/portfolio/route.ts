import { NextResponse } from "next/server";
import { USDG, isAddress } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { getStore, type Store } from "@/lib/auth/store";
import { rpcBatch } from "@/lib/feeds/rpc";
import { ticker } from "@/lib/feeds/okx";
import { allTokenQuotes } from "@/lib/feeds/uniswap";
import { getBoard } from "@/lib/forecast/board";
import { allowPublic, tooMany } from "@/lib/guard";

export const dynamic = "force-dynamic";

/**
 * Read-only valuation of any Robinhood Chain address: balances of the listed
 * stock tokens, USDG and ETH (balanceOf / eth_getBalance), stock tokens at the
 * on-chain bid (Chainlink when a token has no pool), USDG at par, ETH at spot.
 */
export async function GET(request: Request) {
  if (!(await allowPublic(getStore() as Store, request, "portfolio", 20, 600))) return tooMany();
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) return NextResponse.json({ error: "Enter a 0x address." }, { status: 400 });
  const pad = address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const calls = [
    ...STOCKS.map((s) => ({ method: "eth_call", params: [{ to: s.token, data: `0x70a08231${pad}` }, "latest"] })),
    { method: "eth_call", params: [{ to: USDG.address, data: `0x70a08231${pad}` }, "latest"] },
    { method: "eth_getBalance", params: [address, "latest"] },
  ];
  const [res, quotes, board, eth] = await Promise.all([rpcBatch<string>(calls).catch(() => null), allTokenQuotes(), getBoard(), ticker("ETH-USDT").catch(() => null)]);
  if (!res) return NextResponse.json({ error: "The chain could not be read right now." }, { status: 502 });
  const holdings = STOCKS.map((s, i) => {
    const raw = res[i] ? BigInt(res[i]!) : 0n;
    const amount = Number(raw) / 1e18;
    const q = quotes.find((x) => x.symbol === s.symbol);
    const row = board.rows.find((r) => r.stock.symbol === s.symbol);
    const price = q?.bid ?? row?.price ?? null;
    const day = row?.forecasts[1] ?? [];
    const low = day.length ? day.reduce((a, f) => a + Number(f.low) / 1e8, 0) / day.length : null;
    const high = day.length ? day.reduce((a, f) => a + Number(f.high) / 1e8, 0) / day.length : null;
    return { symbol: s.symbol, name: s.name, amount, price, priceSource: q?.bid != null ? "on-chain bid" : "Chainlink", value: price != null ? amount * price : null, range1d: low != null && high != null ? { low, high } : null };
  }).filter((h) => h.amount > 0);
  const usdg = res[STOCKS.length] ? Number(BigInt(res[STOCKS.length]!)) / 10 ** USDG.decimals : 0;
  const ethAmt = res[STOCKS.length + 1] ? Number(BigInt(res[STOCKS.length + 1]!)) / 1e18 : 0;
  const ethValue = eth ? ethAmt * eth.last : null;
  const total = holdings.reduce((a, h) => a + (h.value ?? 0), 0) + usdg + (ethValue ?? 0);
  return NextResponse.json({ address, holdings, usdg, eth: { amount: ethAmt, price: eth?.last ?? null, value: ethValue }, total }, { headers: { "cache-control": "no-store" } });
}
