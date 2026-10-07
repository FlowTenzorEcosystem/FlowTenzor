import { NextResponse } from "next/server";
import { CONTRACTS, creditsLive, oracleLive } from "@/config/contracts";
import { STOCKS, stockBySymbol } from "@/config/stocks";
import { getStore, type Store } from "@/lib/auth/store";
import { HOUSE } from "@/lib/forecast/baselines";
import { getBoard } from "@/lib/forecast/board";
import { signalOf } from "@/lib/forecast/consensus";
import { HORIZONS, horizonByKey, type HorizonId } from "@/lib/forecast/scoring";
import { allow, allowPublic, clientIp, tooMany } from "@/lib/guard";
import { spendPaidCall, walletOfKey } from "@/lib/practice/apikeys";
import { allForecasts } from "@/lib/practice/forecasts";

export const dynamic = "force-dynamic";

/*
 * Forecast API, version 1.
 *   GET /api/v1/forecasts?symbol=NVDA&horizon=1d
 * Without a key: free, 30 requests a minute per network.
 * With x-api-key (from /developers): counted against the calls the key's wallet
 * bought through CallCredits, once that contract is deployed.
 */
export async function GET(request: Request) {
  const store = getStore();
  const key = request.headers.get("x-api-key");
  let plan: "free" | "paid" = "free";
  if (key && store) {
    const wallet = await walletOfKey(store, key);
    if (!wallet) return NextResponse.json({ error: "Unknown or expired API key." }, { status: 401 });
    if (!creditsLive()) return NextResponse.json({ error: "Paid calls open when the CallCredits contract is deployed. Drop the key to use the free tier." }, { status: 402 });
    if (!(await allow(store, "api-paid", [wallet], 600, 60))) return tooMany();
    let spent;
    try {
      spent = await spendPaidCall(store, wallet, clientIp(request));
    } catch {
      return NextResponse.json({ error: "Paid calls cannot be checked right now. Try again in a moment." }, { status: 503 });
    }
    if (!spent.ok) return NextResponse.json({ error: "No paid calls left for this wallet. Calls bought before its first API key are not counted; see the API docs.", used: spent.used, available: spent.available }, { status: 402 });
    plan = "paid";
  } else if (!(await allowPublic(store as Store, request, "api-free", 30, 1200))) {
    return tooMany();
  }

  const url = new URL(request.url);
  const h = horizonByKey(url.searchParams.get("horizon") ?? "1d");
  if (!h) return NextResponse.json({ error: "horizon must be 1h, 1d or 1w" }, { status: 400 });
  const symbolParam = url.searchParams.get("symbol");
  const stocks = symbolParam ? [stockBySymbol(symbolParam)].filter((s) => s !== null) : STOCKS;
  if (symbolParam && !stocks.length) return NextResponse.json({ error: "Unknown symbol." }, { status: 404 });

  const board = await getBoard();
  const practice = store ? await allForecasts(store) : [];
  const now = Math.floor(Date.now() / 1000);
  const horizon = h.id as HorizonId;
  const data = stocks.map((s) => {
    const row = board.rows.find((r) => r.stock.symbol === s.symbol)!;
    const house = row.forecasts[horizon].map((f) => ({
      model: HOUSE.find((m) => m.id === f.model)!.name,
      kind: "house-baseline",
      low: Number(f.low) / 1e8,
      high: Number(f.high) / 1e8,
      confidence: f.confidenceBps / 100,
    }));
    const live = practice
      .filter((p) => p.symbol === s.symbol && p.horizon === horizon && p.status === "open" && p.resolvesAt > now)
      .map((p) => ({ low: Number(BigInt(p.low)) / 1e8, high: Number(BigInt(p.high)) / 1e8, reference: Number(BigInt(p.reference)) / 1e8 }));
    const signal = signalOf([...house.map((x) => ({ low: x.low, high: x.high, reference: row.price ?? 0 })), ...live]);
    return {
      symbol: s.symbol,
      name: s.name,
      token: s.token,
      chainlinkFeed: s.feed,
      price: row.price,
      priceUpdatedAt: row.updatedAt,
      horizon: h.key,
      house,
      practiceLive: live.length,
      signal: { label: signal.label, forecasters: signal.count, up: signal.up, down: signal.down, spread: signal.spread },
    };
  });
  return NextResponse.json(
    {
      plan,
      at: board.at,
      horizons: HORIZONS.map((x) => x.key),
      oracle: oracleLive() ? CONTRACTS.oracle.address : null,
      note: "House baselines are statistical, not AI. Practice forecasts are signed by wallets and scored by the site until the oracle is deployed. Not investment advice.",
      data,
    },
    { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } },
  );
}
