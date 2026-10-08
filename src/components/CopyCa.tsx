"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND, TOKEN, explorerAddress, explorerToken, isAddress } from "@/config/brand";

/*
 * CA console: the contract address as a line of a data terminal.
 *
 *   CA  0x 48D3 67E8 A6cD … B1c0   [ COPY ]  ↗
 *
 * The address is printed in groups of four hex digits so it can be read back
 * aloud and compared by eye. The copy control is a keycap; pressing it flashes
 * the whole line once and turns the keycap into a check with COPIED for 1.5 s.
 * Until a real address is set in brand.ts the line reads "pending" and the
 * keycap is disabled.
 */

const COPIED_MS = 1500;

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Some embedded views refuse the async clipboard; fall back to a hidden field.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
}

/** Copy state for one value: `pulse` changes on every successful copy so the row can replay its flash. */
export function useCopyValue(value: string, enabled = true) {
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    if (!enabled) return;
    if (!(await writeClipboard(value))) return;
    setCopied(true);
    setPulse((n) => n + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };
  return { copied, copy, pulse };
}

/** Back-compat for callers that only need the project CA. */
export function useCopyCa() {
  const live = TOKEN.isLive;
  const s = useCopyValue(BRAND.ca, live);
  return { ...s, live };
}

/** "0x48D367E8…" -> ["0x", "48D3", "67E8", ...]. */
function groups(addr: string) {
  const hex = addr.slice(2);
  const out: string[] = [];
  for (let i = 0; i < hex.length; i += 4) out.push(hex.slice(i, i + 4));
  return out;
}

function Keycap({ copied, disabled, onPress, label }: { copied: boolean; disabled: boolean; onPress: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      data-testid="ca-copy"
      data-state={copied ? "copied" : "idle"}
      className={`group/key relative inline-flex h-[20px] shrink-0 cursor-pointer items-center gap-1 rounded-[3px] border border-b-[2px] px-1.5 font-mono text-[9.5px] leading-none tracking-[0.08em] uppercase transition-[transform,background-color,color,border-color] duration-100 enabled:active:translate-y-px enabled:active:border-b disabled:cursor-not-allowed ${
        copied
          ? "border-white bg-white text-black"
          : "border-[#3a3a3a] border-b-[#4a4a4a] bg-gradient-to-b from-[#1d1d1d] to-[#111] text-ink-2 enabled:hover:border-[#555] enabled:hover:text-ink disabled:text-faint"
      }`}
    >
      {copied ? (
        <>
          <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6.4 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
          </svg>
          Copied
        </>
      ) : disabled ? (
        "Soon"
      ) : (
        "Copy"
      )}
    </button>
  );
}

/**
 * The console line. `value` defaults to the project CA; pass any address to
 * reuse the same control (oracle, USDG, a feed). `fit="short"` prints the
 * first two and last group only, for narrow rails.
 */
export function CaConsole({
  value = BRAND.ca,
  label = "CA",
  fit = "full",
  explorer = true,
  kind = "token",
  className = "",
  testid = "ca-console",
}: {
  value?: string;
  label?: string;
  fit?: "full" | "short" | "auto";
  explorer?: boolean;
  kind?: "token" | "address";
  className?: string;
  testid?: string;
}) {
  const live = isAddress(value);
  const { copied, copy, pulse } = useCopyValue(value, live);
  const row = useRef<HTMLDivElement>(null);
  // Replay the flash on every copy without remounting the row (keeps keyboard focus on the keycap).
  useEffect(() => {
    const el = row.current;
    if (!el || !pulse) return;
    el.classList.remove("ca-flash");
    void el.offsetWidth;
    el.classList.add("ca-flash");
  }, [pulse]);
  const g = live ? groups(value) : [];
  const href = live ? (kind === "token" ? explorerToken(value) : explorerAddress(value)) : null;
  const seg = (s: string, i: number, last = false) => (
    <span key={`${i}-${s}`} className={`${i % 2 ? "text-ink" : "text-ink-2"} ${last ? "" : "mr-[0.42em]"}`}>
      {s}
    </span>
  );
  return (
    <div
      ref={row}
      data-testid={testid}
      data-value={live ? value : ""}
      className={`flex min-w-0 items-center gap-2 rounded-[4px] border border-line bg-[#070707] py-[3px] pr-[3px] pl-2 font-mono text-[11.5px] leading-[1.5] ${className}`}
    >
      <span className="shrink-0 text-[10px] tracking-[0.08em] text-faint uppercase">{label}</span>
      <span className="h-3 w-px shrink-0 bg-line-2" aria-hidden="true" />
      {live ? (
        <span className="min-w-0 truncate whitespace-nowrap" title={value} data-testid="ca-full">
          <span className="mr-[0.3em] text-faint">0x</span>
          {fit === "short" ? (
            <>
              {seg(g[0], 0)}
              {seg(g[1], 1)}
              <span className="mr-[0.42em] text-faint">…</span>
              {seg(g[g.length - 1], 1, true)}
            </>
          ) : fit === "auto" ? (
            <>
              {g.slice(0, 2).map((s, i) => seg(s, i))}
              <span className="hidden sm:inline">{g.slice(2, -1).map((s, i) => seg(s, i + 2))}</span>
              <span className="mr-[0.42em] text-faint sm:hidden">…</span>
              {seg(g[g.length - 1], g.length - 1, true)}
            </>
          ) : (
            g.map((s, i) => seg(s, i, i === g.length - 1))
          )}
        </span>
      ) : (
        <span className="min-w-0 truncate text-faint" data-testid="ca-full">
          pending<span className="pulse">_</span>
          <span className="max-sm:hidden"> published at launch</span>
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <Keycap copied={copied} disabled={!live} onPress={copy} label={live ? `Copy ${label} ${value}` : `${label} not published yet`} />
        {explorer ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${label} on the explorer`}
              title="Open in the explorer"
              className="grid h-[20px] w-[20px] place-items-center rounded-[3px] text-ink-3 hover:bg-paper-3 hover:text-ink"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M4 2h6v6M10 2 2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </a>
          ) : (
            <span className="grid h-[20px] w-[20px] place-items-center text-[#333]" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 12 12">
                <path d="M4 2h6v6M10 2 2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
          )
        ) : null}
      </span>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}

/** Large console for the token page: ticker on top, the full grouped address, keycap and explorer. */
export function CopyCaBlock({ className = "" }: { className?: string; tone?: "paper" | "board" }) {
  return (
    <div className={`max-w-[640px] ${className}`}>
      <p className="label mb-2 flex items-center gap-2">
        <span className="inline-block size-1.5 rounded-full bg-ink" /> {BRAND.symbol} contract
      </p>
      <CaConsole className="!py-1.5 !pl-3 text-[13px]" />
    </div>
  );
}
