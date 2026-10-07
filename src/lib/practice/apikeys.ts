import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { CONTRACTS, creditsLive } from "@/config/contracts";
import type { Store } from "@/lib/auth/store";
import { ethCall } from "@/lib/feeds/rpc";
import { encodeCallsPurchased } from "@/lib/onchain/calls";
import { spend } from "@/lib/ratelimit";
import { accountOf as accountWith, freshReader, spendPaidCall as spendWith, type BoughtOf } from "./accounting";

/*
 * API keys and paid-call accounting.
 *
 * A key is created after a wallet signature, shown once, and stored only as
 * its SHA-256 hash, mapped to the wallet, for 30 days.
 *
 * Paid calls: CallCredits.callsPurchased(wallet) is a lifetime total kept on
 * chain forever. The site keeps, per wallet and without expiry,
 *   { base, used }: the on-chain total when the account opened here, and the
 *   calls spent since then, in one record (see accounting.ts)
 * and allows  callsPurchased - base - used  more calls. The accounting fails
 * closed: an account that is missing (first key, Redis eviction, a store
 * reset) is opened with base = the current on-chain total, so a lost counter
 * can never hand out calls a second time. The cost of that rule is that calls
 * bought before the first key, or before a lost account, are not counted
 * until the owner restores the account with scripts/api-account.mjs.
 * The Redis instance must not evict these keys (maxmemory-policy noeviction,
 * or a volatile-* policy, since they carry no TTL).
 */

export const KEY_TTL = 30 * 86_400;
const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const norm = (wallet: string) => wallet.toLowerCase();

const purchasedCache = new Map<string, { at: number; calls: number }>();

/** Lifetime calls bought on chain (successful reads cached one minute). Throws when the chain cannot be read. */
export async function purchasedCalls(wallet: string, fresh = false): Promise<number> {
  const w = norm(wallet);
  if (!creditsLive()) return 0;
  const hit = fresh ? undefined : purchasedCache.get(w);
  // A cached total can only be lower than the live one (purchases only add), so it never over-grants.
  if (hit && Date.now() - hit.at < 60_000) return hit.calls;
  const calls = Number(BigInt(await ethCall(CONTRACTS.credits.address, encodeCallsPurchased(w))));
  purchasedCache.set(w, { at: Date.now(), calls });
  if (purchasedCache.size > 5000) purchasedCache.clear();
  return calls;
}

export async function createKey(store: Store, wallet: string, boughtOf: BoughtOf = purchasedCalls) {
  const w = norm(wallet);
  // Opens the account at the current on-chain total; throws (no key) when the chain cannot be read.
  await accountWith(store, w, boughtOf);
  const key = `ftz_${randomBytes(24).toString("hex")}`;
  await store.setEx(`apikey:${hash(key)}`, w, KEY_TTL);
  return key;
}

export async function walletOfKey(store: Store, key: string) {
  if (!/^ftz_[0-9a-f]{48}$/.test(key)) return null;
  return store.get(`apikey:${hash(key)}`);
}


export const accountOf = (store: Store, wallet: string, boughtOf: BoughtOf = purchasedCalls) => accountWith(store, wallet, boughtOf);
export const spendPaidCall = (store: Store, wallet: string, network: string, boughtOf: BoughtOf = purchasedCalls) => spendWith(store, wallet, boughtOf, freshReader(store, network, purchasedCalls, (n) => spend(store, "api-fresh", n, 1, 60, 600, { aggregate: true })));
