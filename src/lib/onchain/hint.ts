/*
 * Finds the Chainlink round that was current at time t, for ForecastOracle.score.
 *
 * Rounds are immutable once published, so every (feed, round) -> updatedAt read
 * is memoised (bounded LRU), and answers are cached per (feed, t). The search
 * reads in JSON-RPC batches: one batch walks back from the latest round in
 * doubling steps to bracket t, then up to two batches of 16 evenly spaced
 * rounds narrow the bracket, and a last batch reads the few left. Every read is
 * counted so the route can charge the caller's budget by upstream calls.
 * Free of server-only imports so it can be tested with a fake feed.
 */

/** updatedAt per id (0 = the round does not exist). Must throw when the chain cannot be read. */
export type ReadRounds = (feed: string, ids: bigint[]) => Promise<number[]>;
export type Head = { id: bigint; updatedAt: number };

export const MAX_UPSTREAM_CALLS = 64;
const MEMO_CAP = 20_000;
const memo = new Map<string, number>(); // `${feed}:${id}` -> updatedAt, only for rounds that exist
const ANSWER_CAP = 5_000;
const BUCKET_S = 60;
const NOT_FOUND_TTL_MS = 60_000;
// `${feed}:${bucket}` -> the round found for a moment in that minute, or a short-lived "none before this".
const answers = new Map<string, { round: bigint | null; until: number }>();

const key = (feed: string, id: bigint) => `${feed.toLowerCase()}:${id}`;
function remember(feed: string, id: bigint, u: number) {
  if (!(u > 0)) return; // never memoise a missing round or a failed read
  const k = key(feed, id);
  memo.delete(k);
  memo.set(k, u);
  if (memo.size > MEMO_CAP) memo.delete(memo.keys().next().value as string);
}

export function resetHintCaches() {
  memo.clear();
  answers.clear();
}

function setAnswer(k: string, round: bigint | null, ttl = Infinity) {
  answers.delete(k);
  answers.set(k, { round, until: Date.now() + ttl });
  if (answers.size > ANSWER_CAP) answers.delete(answers.keys().next().value as string);
}

/**
 * A cached answer that is proven for exactly this t by memoised timestamps:
 * the round was published at or before t and the next one after t (or the
 * candidate is the head). Costs no upstream call.
 */
function provenFromCache(feed: string, head: Head, t: number): bigint | null | undefined {
  const hit = answers.get(`${feed.toLowerCase()}:${Math.floor(t / BUCKET_S)}`);
  if (!hit || hit.until < Date.now()) return undefined;
  if (hit.round === null) return null;
  const u = memo.get(key(feed, hit.round));
  if (u === undefined || u > t) return undefined;
  if (hit.round === head.id) return hit.round;
  const next = memo.get(key(feed, hit.round + 1n));
  return next !== undefined && next > t ? hit.round : undefined;
}

export async function roundAtTime(feed: string, head: Head, t: number, read: ReadRounds): Promise<{ round: bigint | null; calls: number }> {
  const ak = `${feed.toLowerCase()}:${Math.floor(t / BUCKET_S)}`;
  remember(feed, head.id, head.updatedAt);
  if (head.updatedAt <= t) return { round: head.id, calls: 0 };
  const cached = provenFromCache(feed, head, t);
  if (cached !== undefined) return { round: cached, calls: 0 };

  let calls = 0;
  const missing = new Map<string, number>(); // reads in this search that found no round (not memoised)
  const get = async (ids: bigint[]) => {
    const need = ids.filter((id) => !memo.has(key(feed, id)) && !missing.has(key(feed, id)));
    if (need.length) {
      if (calls + need.length > MAX_UPSTREAM_CALLS) throw new Error("search too long");
      calls += need.length;
      const res = await read(feed, need); // throws on failure: nothing is cached from a failed read
      need.forEach((id, i) => remember(feed, id, res[i] ?? 0));
      need.forEach((id, i) => {
        if (!((res[i] ?? 0) > 0)) missing.set(key(feed, id), 1);
      });
    }
    return ids.map((id) => memo.get(key(feed, id)) ?? 0);
  };

  const phase = head.id >> 64n;
  const top = head.id & 0xffff_ffff_ffff_ffffn;
  const idOf = (i: bigint) => (phase << 64n) | i;
  // 1. Bracket: walk back 1, 2, 4, ... rounds in one batch until a round at or before t.
  const steps: bigint[] = [];
  for (let d = 1n; d < top && steps.length < 24; d *= 2n) steps.push(top - d);
  if (top > 1n && steps[steps.length - 1] !== 1n) steps.push(1n);
  const times = await get(steps.map(idOf));
  let lo = 0n; // highest index known to be <= t
  let hi = top; // lowest index known to be > t
  for (let i = 0; i < steps.length; i++) {
    const u = times[i];
    if (u > 0 && u <= t) {
      lo = steps[i];
      break;
    }
    if (u > t) hi = steps[i];
  }
  if (lo === 0n) {
    // Every read succeeded (a failure throws), so "none" is real; still keep it only briefly.
    setAnswer(ak, null, NOT_FOUND_TTL_MS);
    return { round: null, calls };
  }
  // 2. Narrow with batches of evenly spaced probes, then read what is left.
  while (hi - lo > 1n) {
    const span = hi - lo - 1n;
    const probes: bigint[] = [];
    if (span <= 16n) for (let i = lo + 1n; i < hi; i++) probes.push(i);
    else for (let k = 1n; k <= 16n; k++) probes.push(lo + (span * k) / 17n);
    const us = await get(probes.map(idOf));
    let moved = false;
    probes.forEach((p, i) => {
      const u = us[i];
      if (u > 0 && u <= t && p > lo) {
        lo = p;
        moved = true;
      }
    });
    for (let i = probes.length - 1; i >= 0; i--) {
      const u = us[i];
      if (u > t && probes[i] < hi && probes[i] > lo) {
        hi = probes[i];
        moved = true;
      }
    }
    if (!moved) break; // missing rounds in the gap: lo stays the best proven answer
  }
  const round = idOf(lo);
  setAnswer(ak, round);
  return { round, calls };
}

/** A cached answer proven for (feed, t) without any upstream call, if there is one. */
export function cachedHint(feed: string, head: Head, t: number): bigint | null | undefined {
  if (head.updatedAt <= t) return head.id;
  return provenFromCache(feed, head, t);
}

export const answerCacheSize = () => answers.size;
