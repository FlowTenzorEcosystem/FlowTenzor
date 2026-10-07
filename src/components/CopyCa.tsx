"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { BRAND, CHAIN, TOKEN, shortAddress } from "@/config/brand";

export function useCopyCa() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Until the contract is published there is nothing worth copying.
  const live = TOKEN.isLive;
  const copy = async () => {
    if (!live) return;
    try {
      await navigator.clipboard.writeText(BRAND.ca);
    } catch {
      // Older browsers and some embedded views refuse the async clipboard.
      const area = document.createElement("textarea");
      area.value = BRAND.ca;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return { copied, copy, live };
}

/**
 * Navbar copy button: a compact ticket with "CA" and the short address. One
 * tap copies the full address. Disabled ("at launch") until a real CA is set.
 */
export function CopyCaTag({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { copied, copy, live } = useCopyCa();
  return (
    <button
      type="button"
      onClick={copy}
      disabled={!live}
      title={live ? `Copy ${BRAND.ca}` : "The contract address is published at launch"}
      aria-label={live ? "Copy contract address" : "Contract address not published yet"}
      data-testid="ca-tag"
      className={`flex h-[41px] shrink-0 cursor-pointer items-center gap-2 rounded-full border border-ink/70 bg-transparent pr-3.5 pl-[5px] text-[14px] font-medium text-ink transition-colors enabled:hover:border-ink enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-default disabled:border-line-2 disabled:text-ink-3 max-[560px]:pr-[5px] ${className}`}
    >
      <span className="rounded-full bg-stamp px-[9px] py-[7px] text-[11px] leading-none font-semibold tracking-[0.04em] text-paper uppercase">
        <span className="hidden sm:inline">{BRAND.symbol}</span>
        <span className="sm:hidden">CA</span>
      </span>
      <span className={`whitespace-nowrap ${compact ? "hidden min-[1500px]:inline" : ""}`}>
        {!live ? "At launch" : copied ? "Copied" : shortAddress(BRAND.ca, 5, 4)}
      </span>
      {!live ? null : copied ? <Check className="size-3.5 text-up" strokeWidth={3} /> : <Copy className="size-3.5 text-ink-3" />}
    </button>
  );
}

/**
 * Full contract block: ticker, the whole address, a full-width copy bar and an
 * explorer link. Disabled ("Not live yet") until a real CA is set in brand.ts.
 */
export function CopyCaBlock({ className = "" }: { className?: string; tone?: "paper" | "board" }) {
  const { copied, copy, live } = useCopyCa();
  return (
    <div
      className={`grid max-w-[640px] grid-cols-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[16px] border border-line-2 bg-paper-2 text-ink [grid-template-areas:'k_a_a'_'c_c_x'] ${className}`}
    >
      <span className="border-r border-line-2 px-3.5 py-[13px] text-[14px] whitespace-nowrap text-ink-2 [grid-area:k] max-[900px]:px-2.5 max-[900px]:py-3 max-[900px]:text-[13px]">
        {BRAND.symbol}
      </span>
      <code
        className={`min-w-0 p-3.5 font-mono text-[13px] leading-[1.4] text-ink [grid-area:a] max-[900px]:p-3 max-[900px]:text-[12px] ${live ? "break-all select-all" : "font-sans text-ink-2"}`}
        data-testid="ca-full"
      >
        {live ? BRAND.ca : `Published at launch on ${CHAIN.name}. Trust only the address shown here.`}
      </code>
      <button
        type="button"
        onClick={copy}
        disabled={!live}
        className="flex cursor-pointer items-center justify-center gap-2 border-t border-line-2 bg-accent px-[18px] py-[13px] text-[14px] font-medium text-black transition-colors [grid-area:c] enabled:hover:bg-accent-2 disabled:cursor-not-allowed disabled:bg-paper-3 disabled:text-ink-3"
        data-testid="ca-copy"
      >
        {copied ? <Check className="size-4" strokeWidth={2.5} /> : null}
        {!live ? "Not live yet" : copied ? "Copied" : "Copy"}
      </button>
      {TOKEN.explorerUrl ? (
        <a
          href={TOKEN.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center border-t border-l border-line-2 px-[18px] py-[13px] text-[14px] whitespace-nowrap text-ink-2 [grid-area:x] hover:text-stamp"
        >
          Explorer ↗
        </a>
      ) : (
        <span className="flex items-center justify-center border-t border-l border-line-2 px-[18px] py-[13px] text-[14px] whitespace-nowrap text-ink-3 [grid-area:x]">
          Explorer ↗
        </span>
      )}
    </div>
  );
}
