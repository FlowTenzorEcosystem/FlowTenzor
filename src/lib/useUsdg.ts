"use client";

import { useEffect, useState } from "react";
import { USDG } from "@/config/brand";
import { formatUsdg } from "@/lib/format";
import { rpc } from "@/lib/rpc";

/** Reads `balanceOf(address)` on the USDG contract. Raw micro-units. */
export async function readUsdg(address: string): Promise<bigint> {
  const data = `0x70a08231${address.slice(2).toLowerCase().padStart(64, "0")}`;
  const hex = await rpc<string>("eth_call", [{ to: USDG.address, data }, "latest"]);
  if (!hex || hex === "0x") throw new Error("empty read");
  return BigInt(hex);
}

/** The wallet's real USDG balance on Robinhood Chain, formatted; null while unknown. */
export function useUsdgBalance(address: string | null, every = 30_000) {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const load = () =>
      readUsdg(address)
        .then((v) => !cancelled && setValue(formatUsdg(v)))
        .catch(() => !cancelled && setValue(null));
    load();
    const t = window.setInterval(load, every);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      setValue(null);
    };
  }, [address, every]);
  return address ? value : null;
}
