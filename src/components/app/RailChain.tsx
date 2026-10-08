"use client";

import { useChain } from "@/components/providers/ChainProvider";

/** Engine rows for the console rail: how answers are made, the chain head, where prices come from. */
export function RailChain({ forecasts }: { forecasts: string }) {
  const { facts, failed } = useChain();
  const rows: [string, React.ReactNode][] = [
    [
      "Answer engine",
      <>
        <span className="size-1.5 rounded-full bg-ink" /> Rule-based
      </>,
    ],
    [
      "Chain",
      <>
        <span className={`size-1.5 rounded-full ${failed ? "bg-faint" : "bg-ink"}`} /> RHC #{facts?.block ? facts.block.toLocaleString("en-US") : "–"}
      </>,
    ],
    ["Model network", "Open to any wallet"],
    ["Price data", "Chainlink · Nasdaq"],
    ["Forecasts", forecasts],
    ["Models ranked", "4 house + practice"],
  ];
  return (
    <dl className="text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5 last:border-0">
          <dt className="text-ink-3">{k}</dt>
          <dd className="num flex items-center gap-1.5 text-right text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
