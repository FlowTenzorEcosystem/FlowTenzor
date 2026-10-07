import { BRAND, PONS, USDG, WETH, isAddress } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { CONTRACTS } from "@/config/contracts";

/*
 * Rules for the read-only JSON-RPC relay, kept apart from the route so they
 * can be tested. Every request is priced in units; each network has a budget.
 */

export const MAX_CALLS = 20;
export const MAX_LOGS_PER_BATCH = 3;
export const MAX_LOG_SPAN = 20_000;
export const MAX_LOG_ADDRESSES = 5;
/** Largest upstream JSON-RPC answer the server reads before giving up. */
export const MAX_RESPONSE_BYTES = 2_000_000;
export const MAX_GAS = 5_000_000;
export const MAX_BODY = 32_768;
export const BUDGET = { units: 600, windowSec: 600, siteUnits: 20_000 };

export const COST: Record<string, number> = {
  eth_getLogs: 10,
  eth_call: 2,
  eth_getTransactionReceipt: 1,
  eth_blockNumber: 1,
  eth_getBalance: 1,
  eth_chainId: 1,
  eth_gasPrice: 1,
  eth_getBlockByNumber: 1,
};

/** Contracts the site itself reads. Anything else goes to the public RPC directly from the browser. */
export function readTargets() {
  const list = [USDG.address, WETH, PONS.factory, PONS.v4Quoter, PONS.memeHook, ...STOCKS.map((s) => s.token), ...STOCKS.map((s) => s.feed)];
  if (isAddress(BRAND.ca)) list.push(BRAND.ca);
  for (const c of Object.values(CONTRACTS)) if (c.address) list.push(c.address);
  return new Set(list.map((a) => a.toLowerCase()));
}

export type Call = { jsonrpc?: string; id?: unknown; method: string; params?: unknown[] };

const hexBlock = (v: unknown) => (typeof v === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(v) ? Number(BigInt(v)) : null);

/** Checks a batch and returns its cost in units, or the reason it is refused. */
export function checkBatch(calls: Call[], targets = readTargets()): { units: number } | { error: string } {
  if (calls.length === 0 || calls.length > MAX_CALLS) return { error: `Between 1 and ${MAX_CALLS} calls per request.` };
  let units = 0;
  let logs = 0;
  let span = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    if (!c || typeof c.method !== "string" || !(c.method in COST)) return { error: `Method not allowed: ${String(c?.method)}` };
    if (c.params !== undefined && !Array.isArray(c.params)) return { error: "params must be an array." };
    const params = c.params ?? [];
    units += COST[c.method];
    if (c.method === "eth_getLogs") {
      logs += 1;
      if (logs > MAX_LOGS_PER_BATCH) return { error: `At most ${MAX_LOGS_PER_BATCH} log queries per request.` };
      const filter = (params[0] ?? {}) as { fromBlock?: unknown; toBlock?: unknown; blockHash?: unknown; address?: unknown };
      if (filter.blockHash !== undefined) return { error: "blockHash filters are not relayed." };
      // Logs only from contracts the relay serves: a topic-only query would scan every contract on the chain.
      const addrs = typeof filter.address === "string" ? [filter.address] : Array.isArray(filter.address) ? filter.address : null;
      if (!addrs || addrs.length === 0 || addrs.length > MAX_LOG_ADDRESSES) return { error: "eth_getLogs needs an address (or up to 5)." };
      if (!addrs.every((a) => typeof a === "string" && targets.has(a.toLowerCase()))) return { error: "eth_getLogs address not served by this relay." };
      // Both ends must be hex numbers: "latest" or a missing bound would let one request scan the whole chain.
      const from = hexBlock(filter.fromBlock);
      const to = hexBlock(filter.toBlock);
      if (from === null || to === null) return { error: "eth_getLogs needs numeric fromBlock and toBlock." };
      if (to < from) return { error: "toBlock is before fromBlock." };
      span += to - from + 1;
      if (span > MAX_LOG_SPAN) return { error: "Log range too wide." };
      // Wider ranges cost more: one extra unit per 1,000 blocks.
      units += Math.ceil((to - from + 1) / 1000);
    }
    if (c.method === "eth_call") {
      if (params.length > 2) return { error: "State overrides are not relayed." };
      const tx = params[0] as { to?: unknown; gas?: unknown; data?: unknown } | undefined;
      if (!tx || typeof tx.to !== "string" || !targets.has(tx.to.toLowerCase())) return { error: "eth_call target not served by this relay." };
      if (tx.gas !== undefined) {
        const gas = typeof tx.gas === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(tx.gas) ? Number(BigInt(tx.gas)) : Infinity;
        if (gas > MAX_GAS) return { error: "Gas above the relay cap." };
      }
      if (typeof tx.data === "string" && tx.data.length > 20_000) return { error: "Call data too large." };
    }
    if (c.method === "eth_getBlockByNumber" && params[1] !== false) return { error: "eth_getBlockByNumber is relayed only with the full-transactions flag false." };
  }
  return { units };
}
