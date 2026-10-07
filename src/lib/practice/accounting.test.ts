import { test } from "node:test";
import assert from "node:assert/strict";
import type { Store } from "@/lib/auth/store";
import { ChainUnavailable, accountKey, accountOf, freshReader, spendPaidCall } from "./accounting";

function fakeStore(): Store & { kv: Map<string, string> } {
  const kv = new Map<string, string>();
  const num = (k: string) => Number(kv.get(k) ?? 0);
  return {
    kv,
    get: async (k) => kv.get(k) ?? null,
    setEx: async (k, v) => void kv.set(k, v),
    setNx: async (k, v) => (kv.has(k) ? false : (kv.set(k, v), true)),
    del: async (k) => void kv.delete(k),
    take: async (k) => {
      const v = kv.get(k) ?? null;
      kv.delete(k);
      return v;
    },
    delIf: async (k, v) => (kv.get(k) === v ? (kv.delete(k), true) : false),
    incr: async (k) => (kv.set(k, String(num(k) + 1)), num(k)),
    incrEx: async (k) => (kv.set(k, String(num(k) + 1)), num(k)),
    incrByEx: async (k, by) => (kv.set(k, String(num(k) + by)), num(k)),
    incrBy: async (k, by) => (kv.set(k, String(num(k) + by)), num(k)),
    mget: async (keys) => keys.map((k) => kv.get(k) ?? null),
    set: async (k, v) => void kv.set(k, v),
    pushCapped: async () => {},
    range: async () => [],
  };
}

const W = "0xAbCdEf0000000000000000000000000000000001";
const w = W.toLowerCase();
const chainOf = (state: { bought: number; down?: boolean }) => async () => {
  if (state.down) throw new Error("rpc down");
  return state.bought;
};

test("calls bought after the account opens are spendable, then refused without counting", async () => {
  const store = fakeStore();
  const st = { bought: 0 };
  await accountOf(store, W, chainOf(st));
  st.bought = 3;
  for (let i = 0; i < 3; i++) assert.equal((await spendPaidCall(store, W, chainOf(st))).ok, true);
  assert.equal((await spendPaidCall(store, W, chainOf(st))).ok, false);
  assert.deepEqual(JSON.parse(store.kv.get(accountKey(w))!), { base: 0, used: 3 });
});

test("a lost record never hands out calls again", async () => {
  const store = fakeStore();
  const st = { bought: 0 };
  await accountOf(store, W, chainOf(st));
  st.bought = 5;
  for (let i = 0; i < 5; i++) await spendPaidCall(store, W, chainOf(st));
  store.kv.delete(accountKey(w));
  const again = await spendPaidCall(store, W, chainOf(st));
  assert.equal(again.ok, false);
  assert.equal(again.available, 0);
  st.bought = 6;
  assert.equal((await spendPaidCall(store, W, chainOf(st))).ok, true);
  assert.equal((await spendPaidCall(store, W, chainOf(st))).ok, false);
});

test("base and used live in one record: there is no separate used key to lose", async () => {
  const store = fakeStore();
  const st = { bought: 0 };
  await accountOf(store, W, chainOf(st));
  st.bought = 2;
  await spendPaidCall(store, W, chainOf(st));
  assert.deepEqual([...store.kv.keys()].filter((k) => !k.includes(":lock:")), [accountKey(w)]);
});

test("an RPC failure on a fresh account refuses and writes nothing; recovery grants nothing for past purchases", async () => {
  const store = fakeStore();
  const st = { bought: 7, down: true };
  await assert.rejects(spendPaidCall(store, W, chainOf(st)), ChainUnavailable);
  await assert.rejects(accountOf(store, W, chainOf(st)), ChainUnavailable);
  assert.equal(store.kv.has(accountKey(w)), false);
  st.down = false;
  const r = await spendPaidCall(store, W, chainOf(st));
  assert.equal(r.ok, false);
  assert.equal(r.available, 0);
  assert.equal(JSON.parse(store.kv.get(accountKey(w))!).base, 7);
});

test("an RPC failure on an existing account changes nothing", async () => {
  const store = fakeStore();
  const st = { bought: 0, down: false };
  await accountOf(store, W, chainOf(st));
  st.bought = 2;
  await spendPaidCall(store, W, chainOf(st));
  const before = store.kv.get(accountKey(w));
  st.down = true;
  await assert.rejects(spendPaidCall(store, W, chainOf(st)), ChainUnavailable);
  assert.equal(store.kv.get(accountKey(w)), before);
});

test("mixed-case and lowercase addresses share one account", async () => {
  const store = fakeStore();
  const st = { bought: 0 };
  await accountOf(store, W, chainOf(st));
  st.bought = 1;
  assert.equal((await spendPaidCall(store, W, chainOf(st))).ok, true);
  assert.equal((await spendPaidCall(store, w, chainOf(st))).ok, false);
});

test("parallel spends never exceed what was bought", async () => {
  const store = fakeStore();
  const st = { bought: 0 };
  await accountOf(store, W, chainOf(st));
  st.bought = 4;
  const results = await Promise.all(Array.from({ length: 10 }, () => spendPaidCall(store, W, chainOf(st))));
  assert.equal(results.filter((r) => r.ok).length, 4);
  assert.equal(JSON.parse(store.kv.get(accountKey(w))!).used, 4);
});

test("a stale cached total is re-read before a call is refused", async () => {
  const store = fakeStore();
  const st = { bought: 0 };
  await accountOf(store, W, chainOf(st));
  st.bought = 2;
  const stale = async () => 0;
  const r = await spendPaidCall(store, W, stale, chainOf(st));
  assert.equal(r.ok, true);
});

test("forced re-reads are limited per wallet and charged to the network", async () => {
  const store = fakeStore();
  const st = { bought: 0 };
  await accountOf(store, W, chainOf(st));
  let fresh = 0;
  let charged = 0;
  const read = async (_w: string, isFresh: boolean) => {
    if (isFresh) fresh++;
    return 0;
  };
  const reader = freshReader(store, "net-1", read, async () => (charged++, true));
  for (let i = 0; i < 20; i++) await spendPaidCall(store, W, async () => 0, reader);
  assert.equal(fresh, 1);
  assert.equal(charged, 1);
  // A network out of budget gets no forced read at all.
  const store2 = fakeStore();
  await accountOf(store2, W, chainOf(st));
  let fresh2 = 0;
  const reader2 = freshReader(store2, "net-2", async (_w, f) => (f && fresh2++, 0), async () => false);
  await spendPaidCall(store2, W, async () => 0, reader2);
  assert.equal(fresh2, 0);
});
