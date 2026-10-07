import { NextResponse } from "next/server";
import { stockBySymbol } from "@/config/stocks";
import { getStore } from "@/lib/auth/store";
import { pad, rpc, rpcBatchRaw, uint, words } from "@/lib/feeds/rpc";
import { clientIp } from "@/lib/guard";
import { MAX_UPSTREAM_CALLS, cachedHint, roundAtTime } from "@/lib/onchain/hint";
import { spend } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const LATEST = "0xfeaf968c";
const ROUND = "0x9a6fc8f5";
/** Upstream eth_calls a network may cause through this route per ten minutes. */
export const HINT_BUDGET = 1000;

/** updatedAt per round; a revert (round does not exist) is 0; any other failure throws, so nothing wrong is cached. */
const readRounds = async (feed: string, ids: bigint[]) => {
  const res = await rpcBatchRaw<string>(ids.map((id) => ({ method: "eth_call", params: [{ to: feed, data: ROUND + pad(id) }, "latest"] })));
  return res.map((e) => {
    if (e.error) {
      if (e.error.code === 3 || /revert|No data present/i.test(e.error.message ?? "")) return 0;
      throw new Error(e.error.message ?? "read failed");
    }
    const w = typeof e.result === "string" ? words(e.result) : [];
    if (w.length < 5) throw new Error("malformed round");
    return Number(uint(w[3]));
  });
};

/**
 * The Chainlink round that was current at time t for a stock token, to pass to
 * ForecastOracle.score. Only a suggestion: the contract checks it against the
 * feed itself and refuses a wrong round. Charged by upstream calls, and only
 * served where rate limits can be kept (a configured store).
 */
export async function GET(request: Request) {
  const store = getStore();
  if (!store) return NextResponse.json({ error: "Round hints need the site's storage, which is not configured here." }, { status: 503 });
  const net = clientIp(request);
  const url = new URL(request.url);
  const stock = stockBySymbol(url.searchParams.get("symbol") ?? "");
  const t = Number(url.searchParams.get("t"));
  if (!stock || !Number.isInteger(t) || t <= 0) return NextResponse.json({ error: "Give a listed symbol and a time t (unix seconds)." }, { status: 400 });

  const tooMany = () => NextResponse.json({ error: "Too many round lookups from your network. Try again in a few minutes." }, { status: 429 });
  // Every lookup reads the latest block and the feed's latest round: two upstream calls, charged first.
  if (!(await spend(store, "hint-calls", net, 2, HINT_BUDGET, 600, { aggregate: true }))) return tooMany();
  // Chain time decides what is in the past (the contract checks against block.timestamp, not this server's clock).
  const [head, latest] = await Promise.all([
    rpc<{ timestamp: string }>("eth_getBlockByNumber", ["latest", false]).catch(() => null),
    rpc<string>("eth_call", [{ to: stock.feed, data: LATEST }, "latest"]).catch(() => null),
  ]);
  if (!head || !latest) return NextResponse.json({ error: "The chain could not be read. Try again." }, { status: 503 });
  if (t > Number(BigInt(head.timestamp)) - 5) return NextResponse.json({ error: "The chain has not passed that time yet." }, { status: 400 });
  const w = words(latest);
  const headRound = { id: uint(w[0]), updatedAt: Number(uint(w[3])) };
  const cached = cachedHint(stock.feed, headRound, t);
  if (cached !== undefined) {
    return cached === null ? NextResponse.json({ error: "No round of the current phase was published by then." }, { status: 404 }) : NextResponse.json({ round: cached.toString(), cached: true });
  }
  // A search is charged its worst case up front.
  if (!(await spend(store, "hint-calls", net, MAX_UPSTREAM_CALLS, HINT_BUDGET, 600, { aggregate: true }))) return tooMany();
  try {
    const r = await roundAtTime(stock.feed, headRound, t, readRounds);
    if (r.round === null) return NextResponse.json({ error: "No round of the current phase was published by then." }, { status: 404 });
    return NextResponse.json({ round: r.round.toString(), upstreamCalls: r.calls + 2 }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The feed could not be searched right now. Try again." }, { status: 503 });
  }
}
