import type { Store } from "@/lib/auth/store";
import { spend } from "@/lib/ratelimit";

/*
 * Rate limits for practice requests. Nothing is ever charged to an address
 * on its own before a signature proves the caller owns it: a pre-signature
 * limit is keyed on the caller's network (IPv4, or the IPv6 /64) together
 * with the address it claims, so one network cannot spend another person's
 * quota.
 */

/** Before the signature: per network (and its /24 or /48), and per (network, claimed address). */
export async function allowTicket(store: Store, network: string, claimed: string) {
  if (!(await spend(store, "ticket-net", network, 1, 40, 600, { aggregate: true }))) return false;
  // The claimed address is untrusted text: it only ever appears inside a key that starts with the network.
  return spend(store, "ticket-net-wallet", `t:${network}|${claimed.toLowerCase().slice(0, 42)}`, 1, 30, 600);
}

/** New forecasts after the signature: per network and per proven wallet, each a day. */
export async function allowCreate(store: Store, network: string, wallet: string) {
  if (!(await spend(store, "create-net", network, 1, 120, 86_400, { aggregate: true }))) return false;
  return spend(store, "create-wallet", wallet.toLowerCase(), 1, 60, 86_400);
}

/** API keys: a few per proven wallet and per network a day. */
export async function allowApiKey(store: Store, network: string, wallet: string) {
  if (!(await spend(store, "apikey-net", network, 1, 10, 86_400, { aggregate: true }))) return false;
  return spend(store, "apikey-wallet", wallet.toLowerCase(), 1, 3, 86_400);
}
