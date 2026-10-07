"use client";

import { useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import type { HorizonId } from "@/lib/forecast/scoring";
import { ChainList, ForecastDesk, PracticeList } from "./ForecastDesk";

/** Token grid on top, the forecast form and the lists below. */
export function ArenaBoard({ tokens, initialSymbol, initialHorizon }: { tokens: { symbol: string; price: number | null }[]; initialSymbol: string; initialHorizon: HorizonId }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [n, setN] = useState(0);
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const wallet = useWallet();
  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-9" aria-label="Pick a token" data-testid="arena-tokens">
        {tokens.map((t) => (
          <li key={t.symbol}>
            <button
              type="button"
              aria-pressed={symbol === t.symbol}
              onClick={() => setSymbol(t.symbol)}
              className={`w-full cursor-pointer rounded-[8px] border px-2 py-1.5 text-left ${symbol === t.symbol ? "border-accent bg-accent-soft" : "border-line hover:border-line-2"}`}
            >
              <span className="block text-[12.5px] font-semibold text-ink">{t.symbol}</span>
              <span className="num block truncate text-[11.5px] text-ink-3">{t.price != null ? `$${t.price >= 1000 ? t.price.toFixed(0) : t.price.toFixed(2)}` : "–"}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <ForecastDesk key={symbol} initialSymbol={symbol} initialHorizon={initialHorizon} onSaved={() => setN((x) => x + 1)} />
        <div className="min-w-0 space-y-3">
          <div className="flex gap-1 text-[13px]" role="tablist">
            {(
              [
                ["mine", "My forecasts"],
                ["all", "Everyone, this token"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`cursor-pointer rounded-[6px] px-3 py-1.5 ${tab === k ? "bg-paper-3 text-ink" : "text-ink-3"}`}>
                {l}
              </button>
            ))}
          </div>
          {tab === "mine" ? (
            wallet.address ? (
              <PracticeList wallet={wallet.address} refresh={n} title="My practice forecasts" />
            ) : (
              <p className="rounded-[10px] border border-dashed border-line-2 p-6 text-center text-[14px] text-ink-3">Your forecasts belong to the wallet that signed them. Connect it to list them; signing costs nothing.</p>
            )
          ) : (
            <PracticeList symbol={symbol} refresh={n} title={`Practice forecasts on ${symbol}`} />
          )}
          <ChainList symbol={tab === "all" ? symbol : undefined} refresh={n} />
        </div>
      </div>
    </div>
  );
}
