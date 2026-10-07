import type { Store } from "@/lib/auth/store";

/*
 * Paid-call accounting (see apikeys.ts for the rules). Kept free of server-only
 * imports so it can be unit-tested with a fake store and a fake chain.
 *
 * One record per wallet, { base, used }, stored as a single value with no
 * expiry, so the two can only ever disappear together. Every change happens
 * under a short per-wallet lock and only after a successful read of the
 * on-chain total; `boughtOf` throws when the chain cannot be read, and then
 * nothing is opened, changed or spent.
 */

/** Lifetime calls bought on chain. Must throw when the chain cannot be read; never fall back to 0. */
export type BoughtOf = (wallet: string) => Promise<number>;
export type Account = { base: number; used: number };

const norm = (wallet: string) => wallet.toLowerCase();
export const accountKey = (w: string) => `apiacct:${w}`;
const lockKey = (w: string) => `apiacct:lock:${w}`;

export class ChainUnavailable extends Error {}

function parse(raw: string | null): Account | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as Account;
    return Number.isSafeInteger(v.base) && Number.isSafeInteger(v.used) && v.base >= 0 && v.used >= 0 ? v : null;
  } catch {
    return null;
  }
}

async function bought(boughtOf: BoughtOf, w: string) {
  try {
    const n = await boughtOf(w);
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("bad total");
    return n;
  } catch (e) {
    throw new ChainUnavailable(`The purchase record on chain could not be read (${e instanceof Error ? e.message : String(e)}). Try again.`);
  }
}

async function withLock<T>(store: Store, w: string, fn: () => Promise<T>): Promise<T> {
  const token = Math.random().toString(36).slice(2);
  for (let i = 0; i < 40; i++) {
    if (await store.setNx(lockKey(w), token, 5)) {
      try {
        return await fn();
      } finally {
        await store.delIf(lockKey(w), token).catch(() => false);
      }
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new ChainUnavailable("The account is busy. Try again.");
}

const view = (total: number, a: Account) => ({ bought: total, base: a.base, used: a.used, available: Math.max(0, total - a.base - a.used) });

/** The account, opened at the current on-chain total if it does not exist (or was lost). */
export async function accountOf(store: Store, wallet: string, boughtOf: BoughtOf) {
  const w = norm(wallet);
  const total = await bought(boughtOf, w);
  return withLock(store, w, async () => {
    let a = parse(await store.get(accountKey(w)));
    if (!a) {
      a = { base: total, used: 0 };
      await store.set(accountKey(w), JSON.stringify(a));
    }
    return view(total, a);
  });
}

/** Spends one paid call; refuses without counting once nothing is left. Throws ChainUnavailable when the chain cannot be read. */
export async function spendPaidCall(store: Store, wallet: string, boughtOf: BoughtOf, freshBoughtOf?: BoughtOf) {
  const w = norm(wallet);
  let total = await bought(boughtOf, w);
  // A cached total can be behind a purchase made a moment ago: before refusing, read the chain again.
  if (freshBoughtOf) {
    const a = parse(await store.get(accountKey(w)));
    if (a && total - a.base - a.used <= 0) total = await bought(freshBoughtOf, w);
  }
  return withLock(store, w, async () => {
    let a = parse(await store.get(accountKey(w)));
    if (!a) {
      a = { base: total, used: 0 };
      await store.set(accountKey(w), JSON.stringify(a));
    }
    const left = total - a.base - a.used;
    if (left <= 0) return { ok: false as const, ...view(total, a) };
    const next = { base: a.base, used: a.used + 1 };
    await store.set(accountKey(w), JSON.stringify(next));
    return { ok: true as const, ...view(total, next) };
  });
}

/** Seconds between forced chain re-reads for one wallet. */
export const FRESH_READ_EVERY_S = 20;

/**
 * The reader used just before a paid call is refused. The chain is read again at most
 * once per wallet every FRESH_READ_EVERY_S seconds, and each forced read is charged to
 * the caller's network (`chargeNetwork`); otherwise the cached total answers. Spamming
 * the endpoint with an unfunded key therefore costs no extra RPC reads.
 */
export function freshReader(
  store: Store,
  network: string,
  read: (w: string, fresh: boolean) => Promise<number>,
  chargeNetwork: (network: string) => Promise<boolean>,
): BoughtOf {
  return async (wallet) => {
    const w = norm(wallet);
    const allowed = (await store.setNx(`apiacct:fresh:${w}`, "1", FRESH_READ_EVERY_S)) && (await chargeNetwork(network));
    return read(w, allowed);
  };
}
