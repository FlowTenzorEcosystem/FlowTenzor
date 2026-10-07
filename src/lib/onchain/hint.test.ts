import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_UPSTREAM_CALLS, answerCacheSize, cachedHint, resetHintCaches, roundAtTime, type ReadRounds } from "./hint";

// A feed with rounds 1..n of phase 1, published every 600 s from t0.
function feed(n: number, t0 = 1_000_000) {
  const at = (i: bigint) => t0 + Number(i) * 600;
  let calls = 0;
  const read: ReadRounds = async (_f, ids) => {
    calls += ids.length;
    return ids.map((id) => {
      const i = id & 0xffff_ffff_ffff_ffffn;
      return i >= 1n && i <= BigInt(n) ? at(i) : 0;
    });
  };
  const head = { id: (1n << 64n) | BigInt(n), updatedAt: at(BigInt(n)) };
  return { read, head, at, calls: () => calls };
}

test("finds the round current at t with a bounded number of reads", async () => {
  resetHintCaches();
  const f = feed(5000);
  for (const i of [1n, 7n, 2500n, 4999n]) {
    const t = f.at(i) + 300; // between round i and i+1
    const r = await roundAtTime("0xfeed", f.head, t, f.read);
    assert.equal(r.round, (1n << 64n) | i);
    assert.ok(r.calls <= MAX_UPSTREAM_CALLS, `calls ${r.calls}`);
  }
});

test("the same (feed, t) twice: the second answer makes no upstream call", async () => {
  resetHintCaches();
  const f = feed(3000);
  const t = f.at(1234n) + 1;
  const first = await roundAtTime("0xfeed", f.head, t, f.read);
  const before = f.calls();
  const second = await roundAtTime("0xfeed", f.head, t, f.read);
  assert.equal(second.calls, 0);
  assert.equal(f.calls(), before);
  assert.equal(second.round, first.round);
  assert.equal(cachedHint("0xfeed", f.head, t), first.round);
});

test("reads are counted so the caller can be charged by upstream calls", async () => {
  resetHintCaches();
  const f = feed(4000);
  const r = await roundAtTime("0xfeed", f.head, f.at(100n) + 5, f.read);
  assert.equal(r.calls, f.calls());
  assert.ok(r.calls > 0);
  // A nearby moment reuses memoised rounds: fewer new reads.
  const r2 = await roundAtTime("0xfeed", f.head, f.at(101n) + 5, f.read);
  assert.ok(r2.calls < r.calls, `${r2.calls} vs ${r.calls}`);
});

test("before the first round: no answer; after the head: the head", async () => {
  resetHintCaches();
  const f = feed(50);
  assert.equal((await roundAtTime("0xfeed", f.head, f.at(1n) - 10, f.read)).round, null);
  assert.equal((await roundAtTime("0xfeed", f.head, f.at(50n) + 10, f.read)).round, f.head.id);
});

test("a failed read caches nothing: the next lookup finds the right round", async () => {
  resetHintCaches();
  const f = feed(2000);
  let fail = true;
  const flaky: ReadRounds = async (feedAddr, ids) => {
    if (fail) throw new Error("rpc timeout");
    return f.read(feedAddr, ids);
  };
  const t = f.at(777n) + 10;
  await assert.rejects(roundAtTime("0xfeed", f.head, t, flaky));
  assert.equal(cachedHint("0xfeed", f.head, t), undefined);
  fail = false;
  assert.equal((await roundAtTime("0xfeed", f.head, t, flaky)).round, (1n << 64n) | 777n);
});

test("other moments in the same minute reuse the proven answer", async () => {
  resetHintCaches();
  const f = feed(2000);
  const base = f.at(900n) + 120; // rounds every 600 s: the next minute is still round 900
  await roundAtTime("0xfeed", f.head, base, f.read);
  const r = await roundAtTime("0xfeed", f.head, base + 30, f.read);
  assert.equal(r.round, (1n << 64n) | 900n);
  assert.equal(r.calls, 0);
});

test("the answer cache is capped", async () => {
  resetHintCaches();
  const f = feed(6000);
  for (let i = 1; i <= 5200; i++) await roundAtTime("0xfeed", f.head, f.at(1n) + i * 60 * 2, f.read).catch(() => null);
  assert.ok(answerCacheSize() <= 5000 && answerCacheSize() > 4000, String(answerCacheSize()));
});
