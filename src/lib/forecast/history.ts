import "server-only";
import { STOCKS, type StockLine } from "@/config/stocks";
import { CHAIN } from "@/config/brand";
import { getStore } from "@/lib/auth/store";
import { jsonCapped } from "@/lib/capped";
import { MAX_RESPONSE_BYTES } from "@/lib/relay";
import { pad, signed, uint, words } from "@/lib/feeds/rpc";

/*
 * Chainlink round history for the stock-token feeds, read straight from the
 * feed proxies on Robinhood Chain (eth_call getRoundData, no indexer). A round
 * id is phase << 64 | index; walking back stays inside the current phase.
 */

export type Round = { id: bigint; t: number; p: number; units: bigint };

const LATEST = "0xfeaf968c";

/*
 * History reads are large batches of eth_call. The chain's own endpoint
 * rate-limits big batches, so a private RPC (ROBINHOOD_RPC_URL) goes first
 * when set, then the public fallback, then the chain's endpoint. A batch
 * whose answers are mostly errors counts as failed and the next endpoint is tried.
 */
function historyEndpoints() {
  // CHAINLINK_HISTORY_RPC_URL (optional) sends these heavy reads to a separate endpoint.
  const own = process.env.CHAINLINK_HISTORY_RPC_URL || process.env.ROBINHOOD_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL;
  return [own, CHAIN.fallbackRpc, CHAIN.publicRpc].filter((u, i, all): u is string => Boolean(u) && all.indexOf(u) === i);
}

async function rpcBatch<T>(calls: { method: string; params: unknown[] }[]): Promise<(T | null)[]> {
  let last: unknown = new Error("no endpoint");
  for (const url of historyEndpoints()) {
    for (let attempt = 0; attempt < 4; attempt++) {
      // Public endpoints rate-limit bursts of large batches: back off and try again.
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * 2 ** (attempt - 1) + Math.random() * 400));
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))),
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) throw new Error(`RPC ${res.status}`);
        const body = await jsonCapped<{ id: number; result?: T; error?: unknown }[]>(res, MAX_RESPONSE_BYTES);
        if (!Array.isArray(body)) throw new Error("batch refused");
        const out: (T | null)[] = calls.map(() => null);
        let ok = 0;
        for (const e of body) {
          if (!e.error && e.result !== undefined && typeof e.id === "number") {
            out[e.id] = e.result;
            ok++;
          }
        }
        if (ok < Math.ceil(calls.length / 2)) throw new Error("batch mostly failed");
        return out;
      } catch (e) {
        last = e;
      }
    }
  }
  throw last;
}
const ROUND = "0x9a6fc8f5";
const BATCH = 100;
/** Rounds read per feed on a first read and per backfill step (about four to six days of a typical feed). */
const FIRST_READ = 50;
/** Feeds that may backfill older rounds in one refresh; the rest wait for the next one. */
const BACKFILL_PER_REFRESH = 12;

function decode(hex: string | null | undefined): Round | null {
  if (!hex || hex.length < 2 + 64 * 5) return null;
  const w = words(hex);
  const answer = signed(w[1]);
  const t = Number(uint(w[3]));
  if (!t || answer <= 0n) return null;
  return { id: uint(w[0]), t, p: Number(answer) / 1e8, units: answer };
}

const latestCache = new Map<string, { at: number; value: Round | null }>();

/** Latest round of every feed in one batch. Cached 20 s; a failed read keeps the last good value. */
export async function latestAll(): Promise<Map<string, Round | null>> {
  const now = Date.now();
  const stale = STOCKS.filter((s) => (latestCache.get(s.feed)?.at ?? 0) < now - 20_000);
  if (stale.length) {
    const res = await rpcBatch<string>(stale.map((s) => ({ method: "eth_call", params: [{ to: s.feed, data: LATEST }, "latest"] }))).catch(
      () => stale.map(() => null),
    );
    stale.forEach((s, i) => {
      const r = decode(res[i]);
      if (r || !latestCache.has(s.feed)) latestCache.set(s.feed, { at: now, value: r ?? latestCache.get(s.feed)?.value ?? null });
    });
  }
  return new Map(STOCKS.map((s) => [s.symbol, latestCache.get(s.feed)?.value ?? null]));
}

type Hist = { at: number; rounds: Round[] };
const histCache = new Map<string, Hist>();
const inflight = new Map<string, Promise<Round[]>>();
export const HISTORY_DAYS = 12;
const MAX_ROUNDS = 260;

const sortRounds = (rounds: Round[]) => [...rounds].sort((a, b) => (a.t === b.t ? Number(a.id - b.id) : a.t - b.t));

function trim(rounds: Round[], since: number) {
  const sorted = sortRounds(rounds);
  // Keep one round from before the window so the price at its start is known.
  const firstIn = sorted.findIndex((r) => r.t >= since);
  return firstIn <= 0 ? sorted : sorted.slice(firstIn - 1);
}

/*
 * Past rounds never change, so a refresh only reads what is new: the feed's
 * latest round and, when it moved on, the rounds between the last one known
 * and it. Known rounds are kept in memory and in the store (Redis on Vercel),
 * so a cold server does not reread its whole window.
 */
async function roundsBefore(feed: string, oldest: Round, count: number): Promise<Round[]> {
  const phase = oldest.id >> 64n;
  const index = oldest.id & 0xffff_ffff_ffff_ffffn;
  const ids: bigint[] = [];
  for (let k = 1n; k <= BigInt(count) && index - k >= 1n; k++) ids.push((phase << 64n) | (index - k));
  if (!ids.length) return [];
  const res = await rpcBatch<string>(ids.map((id) => ({ method: "eth_call", params: [{ to: feed, data: ROUND + pad(id) }, "latest"] })));
  return res.map(decode).filter((r): r is Round => r !== null);
}

/*
 * Past rounds never change, so a refresh reads little: the feed's latest
 * round, the rounds between the last one known and it, and one batch of older
 * rounds while the window is not yet filled. The first read of a feed gets
 * the most recent hundred rounds; the rest of the window fills in over the
 * next refreshes instead of in one burst that public endpoints rate-limit.
 * Known rounds are kept in memory and in the store (Redis on Vercel), so a
 * cold server does not start over.
 */
async function readHistory(feed: string, since: number, prev: Round[], knownHead: Round | null, backfill: boolean): Promise<Round[]> {
  const head = knownHead ?? decode((await rpcBatch<string>([{ method: "eth_call", params: [{ to: feed, data: LATEST }, "latest"] }]).catch(() => [null]))[0]);
  if (!head) return prev;
  let rounds = prev;
  const last = rounds[rounds.length - 1];
  if (!last || head.id >> 64n !== last.id >> 64n) {
    // Nothing known yet, or the feed moved to a new phase: start from the head.
    rounds = [...(await roundsBefore(feed, head, FIRST_READ)), head];
  } else if (head.id !== last.id) {
    const gap = (head.id & 0xffff_ffff_ffff_ffffn) - (last.id & 0xffff_ffff_ffff_ffffn);
    if (gap > BigInt(BATCH)) rounds = [...(await roundsBefore(feed, head, BATCH)), head];
    else {
      const ids: bigint[] = [];
      for (let k = 1n; k < gap; k++) ids.push(last.id + k);
      const res = ids.length ? await rpcBatch<string>(ids.map((id) => ({ method: "eth_call", params: [{ to: feed, data: ROUND + pad(id) }, "latest"] }))) : [];
      const got = res.map(decode).filter((r): r is Round => r !== null);
      if (got.length !== ids.length) return trim(rounds, since);
      rounds = [...rounds, ...got, head];
    }
  }
  const sorted = sortRounds(rounds);
  const oldest = sorted[0];
  if (backfill && oldest && oldest.t > since && (oldest.id & 0xffff_ffff_ffff_ffffn) > 1n && sorted.length < MAX_ROUNDS) {
    const older = await roundsBefore(feed, oldest, FIRST_READ).catch(() => []);
    rounds = [...older, ...sorted];
  }
  return trim(rounds, since);
}

/** How far back a feed's known rounds reach (unix seconds), for labelling a partial window. */
export const historyFrom = (stock: StockLine) => histCache.get(stock.feed)?.rounds[0]?.t ?? null;

const STORE_TTL = 15 * 86_400;
const storeKey = (feed: string) => `hist:v1:${feed.toLowerCase()}`;

async function loadStored(feed: string): Promise<Round[]> {
  try {
    const raw = await getStore()?.get(storeKey(feed));
    if (!raw) return [];
    return (JSON.parse(raw) as [string, number, string][]).map(([id, t, u]) => ({ id: BigInt(id), t, units: BigInt(u), p: Number(BigInt(u)) / 1e8 }));
  } catch {
    return [];
  }
}

async function saveStored(feed: string, rounds: Round[]) {
  try {
    await getStore()?.setEx(storeKey(feed), JSON.stringify(rounds.map((r) => [r.id.toString(), r.t, r.units.toString()])), STORE_TTL);
  } catch {
    // The store is a speed-up only; the next refresh reads the chain again.
  }
}

/** Rounds of the last HISTORY_DAYS days, oldest first. Refreshed after two minutes; parallel callers share one read. */
export async function history(stock: StockLine, minReadAt = 0, head: Round | null = null, backfill = true): Promise<Round[]> {
  const hit = histCache.get(stock.feed);
  if (hit && Date.now() - hit.at < 2 * 60_000 && hit.at > minReadAt) return hit.rounds;
  const running = inflight.get(stock.feed);
  if (running) return running;
  const since = Math.floor(Date.now() / 1000) - HISTORY_DAYS * 86_400;
  const job = (async () => {
    const prev = hit?.rounds ?? (await loadStored(stock.feed));
    const rounds = await readHistory(stock.feed, since, prev, head, backfill);
    if (rounds.length) {
      histCache.set(stock.feed, { at: Date.now(), rounds });
      if (rounds !== prev) await saveStored(stock.feed, rounds);
    }
    return rounds.length ? rounds : prev;
  })()
    .catch((e) => {
      console.error(`history ${stock.symbol}: ${e instanceof Error ? e.message : String(e)}`);
      return hit?.rounds ?? [];
    })
    .finally(() => inflight.delete(stock.feed));
  inflight.set(stock.feed, job);
  return job;
}

/** When the cached history of a feed was read (ms), or 0. A round at time t is final only in a read made after t. */
export const historyReadAt = (stock: StockLine) => histCache.get(stock.feed)?.at ?? 0;

/** History for many stocks with a small concurrency limit, so a cold start does not flood the RPC. */
export async function histories(stocks: StockLine[] = STOCKS, concurrency = 3) {
  const out = new Map<string, Round[]>();
  // One batch for every head, then per-feed reads only where something is missing.
  const heads = await latestAll().catch(() => new Map<string, Round | null>());
  let next = 0;
  let budget = BACKFILL_PER_REFRESH;
  // Rotate which feeds backfill first, so every feed's window fills over a few refreshes.
  const start = Math.floor(Date.now() / 120_000) % Math.max(1, stocks.length);
  const order = [...stocks.slice(start), ...stocks.slice(0, start)];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < order.length) {
        const s = order[next++];
        const may = budget > 0;
        if (may) budget--;
        out.set(s.symbol, await history(s, 0, heads.get(s.symbol) ?? null, may));
      }
    }),
  );
  return out;
}

/** The round that was current at time t (last one published at or before t). */
export function roundAt(rounds: Round[], t: number): Round | null {
  let lo = 0;
  let hi = rounds.length - 1;
  let found: Round | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rounds[mid].t <= t) {
      found = rounds[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}
