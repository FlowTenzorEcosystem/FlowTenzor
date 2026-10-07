"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ChainFacts = {
  at: number;
  block: number | null;
  blockTime: number | null;
  gasGwei: number | null;
  ethUsd: number | null;
  usdg: { address: string; symbol: string; name: string; decimals: number; supply: string | null; verified: boolean };
};

const Ctx = createContext<{ facts: ChainFacts | null; failed: boolean }>({ facts: null, failed: false });

/** Polls the server's live chain snapshot (block, gas, ETH/USD, USDG facts) for the whole site. */
export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [facts, setFacts] = useState<ChainFacts | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/chain", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((v: ChainFacts) => {
          if (cancelled) return;
          setFacts(v);
          setFailed(v.block === null);
        })
        .catch(() => !cancelled && setFailed(true));
    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);
  return <Ctx.Provider value={{ facts, failed }}>{children}</Ctx.Provider>;
}

export const useChain = () => useContext(Ctx);
