import "server-only";
import { USDG } from "@/config/brand";
import { STOCKS, type StockLine } from "@/config/stocks";
import { pad, rpcBatch } from "@/lib/feeds/rpc";

/*
 * What a stock token costs on Robinhood Chain right now: quotes from the
 * Uniswap v3 QuoterV2 against the token's USDG pools. Addresses checked with
 * eth_getCode on 8 Oct 2026; pools are found through the factory, never typed in.
 *
 *   bid = USDG received for selling one token
 *   ask = effective price when buying with 1,000 USDG
 */

export const UNISWAP_V3 = {
  factory: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
  quoterV2: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
} as const;

const FEES = [100, 500, 3000, 10000];
const GET_POOL = "0x1698ee82";
const QUOTE_SINGLE = "0xc6a5026a"; // quoteExactInputSingle((address,address,uint256,uint24,uint160))
const addr = (a: string) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");

function quoteData(tokenIn: string, tokenOut: string, amountIn: bigint, fee: number) {
  return QUOTE_SINGLE + addr(tokenIn) + addr(tokenOut) + pad(amountIn) + pad(fee) + pad(0);
}

const poolCache = new Map<string, { fee: number; pool: string }[]>();

async function pools(token: string) {
  const hit = poolCache.get(token);
  if (hit) return hit;
  const res = await rpcBatch<string>(
    FEES.map((fee) => ({ method: "eth_call", params: [{ to: UNISWAP_V3.factory, data: GET_POOL + addr(USDG.address) + addr(token) + pad(fee) }, "latest"] })),
  );
  const out = FEES.map((fee, i) => ({ fee, pool: res[i] ? `0x${res[i]!.slice(26)}` : "" })).filter((p) => p.pool && !/^0x0+$/.test(p.pool));
  poolCache.set(token, out);
  return out;
}

export type TokenQuote = {
  symbol: string;
  token: string;
  fee: number | null;
  pool: string | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  /** Extra cost of a 10,000 USDG buy over a 1,000 USDG buy, as a fraction. */
  slip10k: number | null;
};

const ONE_TOKEN = 10n ** 18n;
const USDG_1K = 1000n * 10n ** 6n;
const USDG_10K = 10_000n * 10n ** 6n;

async function quoteOne(s: StockLine): Promise<TokenQuote> {
  const list = await pools(s.token).catch(() => []);
  const empty: TokenQuote = { symbol: s.symbol, token: s.token, fee: null, pool: null, bid: null, ask: null, spread: null, slip10k: null };
  if (!list.length) return empty;
  const res = await rpcBatch<string>(
    list.flatMap((p) => [
      { method: "eth_call", params: [{ to: UNISWAP_V3.quoterV2, data: quoteData(s.token, USDG.address, ONE_TOKEN, p.fee) }, "latest"] },
      { method: "eth_call", params: [{ to: UNISWAP_V3.quoterV2, data: quoteData(USDG.address, s.token, USDG_1K, p.fee) }, "latest"] },
      { method: "eth_call", params: [{ to: UNISWAP_V3.quoterV2, data: quoteData(USDG.address, s.token, USDG_10K, p.fee) }, "latest"] },
    ]),
  ).catch(() => []);
  let best: TokenQuote = empty;
  list.forEach((p, i) => {
    const sell = res[i * 3];
    const buy = res[i * 3 + 1];
    const buy10 = res[i * 3 + 2];
    if (!sell || !buy || sell.length < 66 || buy.length < 66) return;
    const bid = Number(BigInt(sell.slice(0, 66))) / 1e6;
    const got = Number(BigInt(buy.slice(0, 66))) / 1e18;
    if (bid <= 0 || got <= 0) return;
    const ask = 1000 / got;
    // The pool that fills $1,000 at the best price wins.
    const got10 = buy10 && buy10.length >= 66 ? Number(BigInt(buy10.slice(0, 66))) / 1e18 : 0;
    const slip10k = got10 > 0 ? 10_000 / got10 / ask - 1 : null;
    if (best.ask === null || ask < best.ask) best = { symbol: s.symbol, token: s.token, fee: p.fee, pool: p.pool, bid, ask, spread: (ask - bid) / ((ask + bid) / 2), slip10k };
  });
  return best;
}

let cache: { at: number; value: TokenQuote[] } | null = null;
let running: Promise<TokenQuote[]> | null = null;

/** Quotes for every listed token, cached 30 s. */
export async function allTokenQuotes(): Promise<TokenQuote[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  running ??= (async () => {
    const out: TokenQuote[] = [];
    for (let i = 0; i < STOCKS.length; i += 6) out.push(...(await Promise.all(STOCKS.slice(i, i + 6).map(quoteOne))));
    if (out.some((q) => q.bid !== null) || !cache) cache = { at: Date.now(), value: out };
    return cache.value;
  })().finally(() => {
    running = null;
  });
  return cache ? cache.value : running;
}

/** Price impact against the mid for several sizes, on the token's best pool. */
export async function depth(s: StockLine, fee: number) {
  const buys = [1000, 5000, 10_000, 25_000, 50_000];
  const sells = [1, 10, 50, 100];
  const res = await rpcBatch<string>([
    ...buys.map((usd) => ({ method: "eth_call", params: [{ to: UNISWAP_V3.quoterV2, data: quoteData(USDG.address, s.token, BigInt(usd) * 10n ** 6n, fee) }, "latest"] })),
    ...sells.map((n) => ({ method: "eth_call", params: [{ to: UNISWAP_V3.quoterV2, data: quoteData(s.token, USDG.address, BigInt(n) * ONE_TOKEN, fee) }, "latest"] })),
  ]).catch(() => []);
  const first = (h: string | null | undefined) => (h && h.length >= 66 ? BigInt(h.slice(0, 66)) : null);
  return {
    buys: buys.map((usd, i) => {
      const got = first(res[i]);
      return { size: usd, price: got ? usd / (Number(got) / 1e18) : null };
    }),
    sells: sells.map((n, i) => {
      const got = first(res[buys.length + i]);
      return { size: n, price: got ? Number(got) / 1e6 / n : null };
    }),
  };
}
