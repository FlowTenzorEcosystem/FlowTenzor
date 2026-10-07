"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BRAND, CHAIN, TOKEN, shortAddress } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { CopyCaTag } from "@/components/CopyCa";
import { Wordmark } from "@/components/Mark";
import { useChain } from "@/components/providers/ChainProvider";
import { NavWallet } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { ALL_APP_LINKS, APP_NAV } from "./nav";

/* ------------------------------------------------------------------ prefs */

export type Prefs = { chartRange: "1D" | "5D" | "1M" | "6M" | "1Y"; refresh: 0 | 30 | 60 | 300; compact: boolean; sparklines: boolean };
export const DEFAULT_PREFS: Prefs = { chartRange: "1M", refresh: 30, compact: true, sparklines: true };
export function usePrefs() {
  const [p, set] = useLocalStore<Prefs>("flowtenzor:prefs", DEFAULT_PREFS);
  return [{ ...DEFAULT_PREFS, ...p }, set] as const;
}

/* ------------------------------------------------------------------ palette */

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const items = useMemo(() => {
    const pages = ALL_APP_LINKS.map((l) => ({ href: l.href, label: l.label, hint: l.hint, kind: "Page" }));
    const docs = [{ href: "/docs", label: "Docs", hint: "How everything works", kind: "Page" }];
    const syms = STOCKS.map((s) => ({ href: `/markets/${s.symbol.toLowerCase()}`, label: s.symbol, hint: s.name, kind: "Token" }));
    const all = [...syms, ...pages, ...docs];
    const n = q.trim().toLowerCase();
    return (n ? all.filter((x) => x.label.toLowerCase().includes(n) || x.hint.toLowerCase().includes(n)) : all).slice(0, 12);
  }, [q]);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[12px] border border-line-2 bg-paper-2 shadow-2xl">
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") setI((x) => Math.min(items.length - 1, x + 1));
            if (e.key === "ArrowUp") setI((x) => Math.max(0, x - 1));
            if (e.key === "Enter" && items[i]) go(items[i].href);
          }}
          placeholder="Search tokens and pages"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-[15px] text-ink outline-none"
          aria-label="Search tokens and pages"
        />
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {items.map((it, k) => (
            <li key={it.href} role="option" aria-selected={k === i}>
              <button
                type="button"
                onMouseEnter={() => setI(k)}
                onClick={() => go(it.href)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-left ${k === i ? "bg-paper-3" : ""}`}
              >
                <span className="min-w-0">
                  <span className="font-medium text-ink">{it.label}</span> <span className="text-[13px] text-ink-3">{it.hint}</span>
                </span>
                <span className="kicker shrink-0">{it.kind}</span>
              </button>
            </li>
          ))}
          {!items.length ? <li className="px-3 py-4 text-[14px] text-ink-3">Nothing matches.</li> : null}
        </ul>
        <p className="kicker border-t border-line px-4 py-2">↑↓ choose · ↵ open · esc close</p>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ header */

function useStockStrip() {
  const [rows, setRows] = useState<{ symbol: string; price: number | null }[]>([]);
  useEffect(() => {
    let off = false;
    const load = () =>
      fetch("/api/stocks", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { rows: { symbol: string; price: number | null }[] } | null) => b && !off && setRows(b.rows))
        .catch(() => {});
    load();
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => {
      off = true;
      window.clearInterval(t);
    };
  }, []);
  return rows;
}

function Ticker() {
  const rows = useStockStrip();
  if (!rows.length) return <div className="h-9 border-t border-line" />;
  const list = [...rows, ...rows];
  return (
    <div className="overflow-hidden border-t border-line bg-paper" aria-label="Chainlink prices of stock tokens">
      <ul className="marquee flex w-max">
        {list.map((r, i) => (
          <li key={`${r.symbol}-${i}`} aria-hidden={i >= rows.length ? true : undefined} className="border-r border-line px-4 py-2 text-[12.5px] whitespace-nowrap">
            <Link href={`/markets/${r.symbol.toLowerCase()}`} className="num text-ink-2 hover:text-stamp">
              <span className="text-ink">{r.symbol}</span> {r.price != null ? `$${r.price >= 1000 ? r.price.toFixed(0) : r.price.toFixed(2)}` : "–"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const { address } = useWallet();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const group = APP_NAV.find((g) => g.items.some((i) => active(i.href))) ?? APP_NAV[0];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="mx-auto flex h-[60px] max-w-[1560px] items-center gap-3 px-4 sm:px-6" data-testid="navrow">
        <Link href="/" aria-label={`${BRAND.name} home`} className="shrink-0 text-ink">
          <Wordmark size={19} className={address ? "max-[460px]:[&>span:last-child]:hidden" : ""} />
        </Link>
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="ml-2 hidden h-9 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-[8px] border border-line-2 px-3 text-[13.5px] text-ink-3 md:flex md:max-w-[360px]"
          aria-label="Search tokens and pages"
        >
          <span>Search tokens, pages…</span>
          <span className="kicker rounded border border-line-2 px-1.5">⌘K</span>
        </button>
        <div className="ml-auto flex min-w-0 items-center gap-2 max-[560px]:gap-1.5">
          <button type="button" onClick={() => setPalette(true)} aria-label="Search" className="grid size-9 cursor-pointer place-items-center rounded-[8px] border border-line-2 text-ink-2 md:hidden">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <CopyCaTag compact />
          <Link href="/docs" className="btn btn-ghost btn-sm hidden lg:inline-flex">
            Docs
          </Link>
          <span className="hidden sm:block">
            <NavWallet />
          </span>
          <span className="sm:hidden">
            <NavWallet compact />
          </span>
          <button type="button" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="grid size-9 cursor-pointer place-items-center text-ink lg:hidden">
            <svg width="20" height="14" viewBox="0 0 24 18" aria-hidden="true">
              <path d="M0 1h24M0 9h24M0 17h24" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      </div>
      {/* Desktop: group tabs on one row, the active group's pages on the next. */}
      <nav aria-label="App" className="mx-auto hidden max-w-[1560px] items-center gap-6 px-6 lg:flex">
        <ul className="flex items-center gap-1 border-r border-line pr-5">
          {APP_NAV.map((g) => (
            <li key={g.label}>
              <Link
                href={g.items[0].href}
                aria-current={g === group ? "true" : undefined}
                className={`kicker block rounded px-2.5 py-1.5 ${g === group ? "!text-ink bg-paper-3" : "hover:!text-ink"}`}
              >
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {group.items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active(it.href) ? "page" : undefined}
                className={`block border-b-2 px-2.5 py-3 text-[14px] whitespace-nowrap ${active(it.href) ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {menu ? (
        <nav aria-label="App menu" className="max-h-[75vh] overflow-y-auto border-t border-line bg-paper-2 px-4 pb-6 lg:hidden">
          {APP_NAV.map((g) => (
            <div key={g.label} className="pt-4">
              <p className="kicker">{g.label}</p>
              <ul className="mt-2 grid grid-cols-2 gap-1">
                {g.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} onClick={() => setMenu(false)} className={`block rounded-[8px] px-3 py-2.5 text-[15px] ${active(it.href) ? "bg-paper-3 text-ink" : "text-ink-2"}`}>
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link href="/docs" onClick={() => setMenu(false)} className="btn btn-ghost btn-sm mt-5 w-full">
            Docs
          </Link>
        </nav>
      ) : null}
      {palette ? <Palette onClose={() => setPalette(false)} /> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ rail */

function RailCard({ title, children, testid }: { title: string; children: React.ReactNode; testid?: string }) {
  return (
    <section className="rounded-[10px] border border-line bg-card p-4" data-testid={testid}>
      <h2 className="kicker">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <span className="text-ink-3">{k}</span>
      <span className="num min-w-0 truncate text-right text-ink">{v}</span>
    </div>
  );
}

function useTao() {
  const [tao, setTao] = useState<{ last: number; change24h: number | null } | null>(null);
  useEffect(() => {
    fetch("/api/tao")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b?.last && setTao(b))
      .catch(() => {});
  }, []);
  return tao;
}

/** Right-hand rail on wide screens, a block under the page on smaller ones: chain status, the token, TAO. */
export function AppRail() {
  const { facts, failed } = useChain();
  const tao = useTao();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1" data-testid="app-rail">
      <RailCard title={`${CHAIN.name} · ${CHAIN.id}`} testid="rail-chain">
        <Row k="Status" v={facts?.block ? <span className="text-up">● connected</span> : failed ? <span className="text-down">● unreachable</span> : "reading…"} />
        <Row k="Block" v={facts?.block ? `#${facts.block.toLocaleString("en-US")}` : "–"} />
        <Row k="Gas" v={facts?.gasGwei != null ? `${facts.gasGwei.toFixed(3)} gwei` : "–"} />
        <Row k="ETH" v={facts?.ethUsd != null ? `$${facts.ethUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "–"} />
      </RailCard>
      <RailCard title={BRAND.symbol} testid="rail-token">
        {TOKEN.isLive ? (
          <Row k="CA" v={shortAddress(BRAND.ca, 6, 4)} />
        ) : (
          <p className="text-[13px] text-ink-3">The contract address is published here at launch. Trust no other source.</p>
        )}
        <div className="mt-3 flex gap-2">
          <Link href="/token" className="btn btn-ghost btn-sm flex-1">
            Token
          </Link>
          <Link href="/swap" className={`btn btn-accent btn-sm flex-1 ${TOKEN.isLive ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!TOKEN.isLive}>
            Buy
          </Link>
        </div>
      </RailCard>
      <RailCard title="Bittensor (off-chain market)">
        <Row k="TAO / USD" v={tao ? `$${tao.last.toFixed(2)}` : "–"} />
        <Row k="24h" v={tao?.change24h != null ? `${tao.change24h >= 0 ? "+" : ""}${tao.change24h.toFixed(2)}%` : "–"} />
        <p className="mt-2 text-[12px] leading-snug text-ink-3">OKX spot. TAO is not on {CHAIN.name}; subnet scoring is an integration target.</p>
      </RailCard>
    </div>
  );
}

export function AppTicker() {
  return <Ticker />;
}
