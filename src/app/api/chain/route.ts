import { NextResponse } from "next/server";
import { USDG } from "@/config/brand";
import { rpcBatch, uint, words } from "@/lib/feeds/rpc";
import { ticker } from "@/lib/feeds/okx";

export const dynamic = "force-dynamic";

/*
 * Live Robinhood Chain facts the site shows whatever the FlowTenzor contracts do:
 * the latest block, gas price, ETH/USD (OKX spot) and the USDG token
 * itself (symbol, name, decimals and supply, read from its contract).
 */

type Snapshot = {
  at: number;
  block: number | null;
  blockTime: number | null;
  gasGwei: number | null;
  ethUsd: number | null;
  usdg: { address: string; symbol: string; name: string; decimals: number; supply: string | null; verified: boolean };
};

let cache: { at: number; value: Snapshot } | null = null;
const TTL = 12_000;

function abiString(hex: string | null) {
  if (!hex || hex.length < 130) return null;
  const w = words(hex);
  const len = Number(uint(w[1]));
  const bytes = hex.slice(2 + 128, 2 + 128 + len * 2);
  return Buffer.from(bytes, "hex").toString("utf8");
}

async function read(): Promise<Snapshot> {
  const [results, eth] = await Promise.all([
    rpcBatch<string | { number: string; timestamp: string }>([
      { method: "eth_getBlockByNumber", params: ["latest", false] },
      { method: "eth_gasPrice", params: [] },
      { method: "eth_call", params: [{ to: USDG.address, data: "0x95d89b41" }, "latest"] },
      { method: "eth_call", params: [{ to: USDG.address, data: "0x06fdde03" }, "latest"] },
      { method: "eth_call", params: [{ to: USDG.address, data: "0x313ce567" }, "latest"] },
      { method: "eth_call", params: [{ to: USDG.address, data: "0x18160ddd" }, "latest"] },
    ]).catch(() => [null, null, null, null, null, null]),
    ticker("ETH-USDT").catch(() => null),
  ]);
  const [block, gas, symbol, name, decimals, supply] = results;
  const b = block && typeof block === "object" ? block : null;
  const sym = abiString(typeof symbol === "string" ? symbol : null);
  const nm = abiString(typeof name === "string" ? name : null);
  const dec = typeof decimals === "string" && decimals.length > 2 ? Number(BigInt(decimals)) : null;
  return {
    at: Date.now(),
    block: b ? Number(BigInt(b.number)) : null,
    blockTime: b ? Number(BigInt(b.timestamp)) : null,
    gasGwei: typeof gas === "string" ? Number(BigInt(gas)) / 1e9 : null,
    ethUsd: eth?.last ?? null,
    usdg: {
      address: USDG.address,
      symbol: sym ?? USDG.symbol,
      name: nm ?? USDG.name,
      decimals: dec ?? USDG.decimals,
      supply: typeof supply === "string" && supply.length > 2 ? BigInt(supply).toString() : null,
      // True only when this read returned the same facts the site is built on.
      verified: sym === USDG.symbol && dec === USDG.decimals,
    },
  };
}

export async function GET() {
  if (!cache || Date.now() - cache.at > TTL) {
    const value = await read();
    // A failed read does not replace a good one that is still recent.
    if (value.block !== null || !cache || Date.now() - cache.at > 120_000) cache = { at: Date.now(), value };
  }
  return NextResponse.json(cache.value, { headers: { "cache-control": "no-store" } });
}
