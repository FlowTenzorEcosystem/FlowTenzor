"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  Coins,
  Crosshair,
  LayoutGrid,
  LineChart,
  MessageSquareText,
  MoreHorizontal,
  Network,
  Newspaper,
  Search,
  Settings,
  Swords,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { oracleLive } from "@/config/contracts";
import { STOCKS } from "@/config/stocks";
import { CaConsole } from "@/components/CopyCa";
import { Mark } from "@/components/Mark";
import { useChain } from "@/components/providers/ChainProvider";
import { Arrow, DocsGlyph, XGlyph, buyHref } from "@/components/SiteHeader";
import { NavWallet } from "@/components/wallet/WalletButton";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { ALL_APP_LINKS, APP_NAV } from "./nav";

/* ------------------------------------------------------------------ prefs */

export type Prefs = { chartRange: "1D" | "5D" | "1M" | "6M" | "1Y"; refresh: 0 | 30 | 60 | 300; compact: boolean; sparklines: boolean };
export const DEFAULT_PREFS: Prefs = { chartRange: "1M", refresh: 30, compact: true, sparklines: true };
export function usePrefs() {
  const [p, set] = useLocalStore<Prefs>("flowtenzor:prefs", DEFAULT_PREFS);
  return [{ ...DEFAULT_PREFS, ...p }, set] as const;
}

const ICON: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "/ask": MessageSquareText,
  "/markets": LineChart,
  "/pulse": LayoutGrid,
  "/tokens": Coins,
  "/token": CircleDollarSign,
  "/news": Newspaper,
  "/analytics": BarChart3,
  "/calendar": CalendarDays,
  "/portfolio": Wallet,
  "/alerts": Bell,
  "/arena": Crosshair,
  "/battle": Swords,
  "/network": Network,
  "/forecasts": Activity,
  "/leaderboard": Trophy,
  "/follow": Users,
  "/settings": Settings,
};

/* ------------------------------------------------------------------ live strip data */

type StripRow = { symbol: string; price: number | null; change24h: number | null };
type Tao = { last: number; change24h: number | null } | null;
type Live = { rows: StripRow[]; tao: Tao; latency: number | null; updated: number | null };
const LiveCtx = createContext<Live>({ rows: [], tao: null, latency: null, updated: null });

/** One poller for the ticker, the sidebar card and the status bar. */
export function AppLiveProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<Live>({ rows: [], tao: null, latency: null, updated: null });
  useEffect(() => {
    let off = false;
    const load = async () => {
      const t0 = performance.now();
      const [b, t] = await Promise.all([
        fetch("/api/board?strip=1", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/tao")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      if (off) return;
      setLive((v) => ({
        rows: b?.rows ?? v.rows,
        tao: t?.last ? { last: t.last, change24h: t.change24h ?? null } : v.tao,
        latency: b ? Math.round(performance.now() - t0) : v.latency,
        updated: b ? Date.now() : v.updated,
      }));
    };
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => {
      off = true;
      window.clearInterval(id);
    };
  }, []);
  return <LiveCtx.Provider value={live}>{children}</LiveCtx.Provider>;
}
const useLive = () => useContext(LiveCtx);

/** "▲ +0.52%" in white or "▼ −0.92%" in grey. `v` is a fraction when `fraction`, else a percent. */
export function Delta({ v, fraction = true, className = "" }: { v: number | null | undefined; fraction?: boolean; className?: string }) {
  if (v == null || !Number.isFinite(v)) return <span className={`num text-faint ${className}`}>–</span>;
  const p = fraction ? v * 100 : v;
  const upv = p >= 0;
  return (
    <span className={`num whitespace-nowrap ${upv ? "text-up" : "text-down"} ${className}`}>
      <span className="text-[0.8em]">{upv ? "▲" : "▼"}</span>
      {upv ? "+" : "−"}
      {Math.abs(p).toFixed(2)}%
    </span>
  );
}

const price = (v: number | null) => (v == null ? "–" : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

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
      <div className="panel relative w-full max-w-[560px] overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-3.5 text-ink-3" />
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
            placeholder="Search symbols, pages…"
            className="w-full bg-transparent py-3 text-[14px] text-ink outline-none placeholder:text-faint"
            aria-label="Search symbols and pages"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {items.map((it, k) => (
            <li key={it.href} role="option" aria-selected={k === i}>
              <button
                type="button"
                onMouseEnter={() => setI(k)}
                onClick={() => go(it.href)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-[5px] px-3 py-2 text-left ${k === i ? "bg-paper-3" : ""}`}
              >
                <span className="min-w-0 truncate">
                  <span className="text-[13.5px] text-ink">{it.label}</span> <span className="text-[12.5px] text-ink-3">{it.hint}</span>
                </span>
                <span className="label shrink-0">{it.kind}</span>
              </button>
            </li>
          ))}
          {!items.length ? <li className="px-3 py-4 text-[13px] text-ink-3">Nothing matches.</li> : null}
        </ul>
        <p className="label border-t border-line px-4 py-2.5">↑↓ choose · ↵ open · esc close</p>
      </div>
    </div>,
    document.body,
  );
}

function usePalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return [open, setOpen] as const;
}

const useActive = () => {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
};

/* ------------------------------------------------------------------ sidebar */

function TokenCard() {
  const { facts } = useChain();
  const { tao } = useLive();
  const buy = buyHref();
  return (
    <div className="relative mx-2 overflow-hidden rounded-[8px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.09),rgba(255,255,255,0.01)_60%)]" data-testid="rail-token">
      <span className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <Link href="/token" className="relative block p-3">
        <div className="flex items-center gap-2">
          <span className="num text-[14px] font-medium tracking-[-0.03em] text-ink">{BRAND.symbol}</span>
          <span className="chip !px-1.5 !py-0 before:hidden">{TOKEN.isLive ? "Live on RHC" : "At launch"}</span>
        </div>
        <dl className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden rounded-[5px] border border-white/[0.07] bg-white/[0.07]">
          <div className="bg-black/60 px-2 py-1.5">
            <dt className="label">Price</dt>
            <dd className="num mt-1 text-[11.5px] text-ink">{TOKEN.isLive ? "on Pons" : "–"}</dd>
          </div>
          <div className="bg-black/60 px-2 py-1.5" data-testid="rail-chain">
            <dt className="label">Block</dt>
            <dd className="num mt-1 flex items-center gap-1 text-[11.5px] text-ink">
              <span className={`size-1.5 rounded-full ${facts?.block ? "bg-ink" : "bg-faint"}`} />
              {facts?.block ? facts.block.toLocaleString("en-US") : "–"}
            </dd>
          </div>
        </dl>
      </Link>
      <div className="relative grid gap-1.5 px-3 pb-3">
        <CaConsole fit="short" explorer={false} className="!bg-black/60 !text-[11px]" testid="ca-console-rail" />
        <div className="grid grid-cols-2 gap-1.5">
          <a href={buy} {...(buy.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})} className="abtn abtn-face !h-7 !text-[11.5px]">
            Buy {TOKEN.isLive ? "on Pons" : ""} <Arrow />
          </a>
          {TOKEN.explorerUrl ? (
            <a href={TOKEN.explorerUrl} target="_blank" rel="noreferrer" className="abtn !h-7 !border-white/10 !text-[11.5px]">
              Explorer <Arrow />
            </a>
          ) : (
            <span className="abtn !h-7 cursor-default !border-white/10 !text-[11.5px] opacity-50">
              Explorer <Arrow />
            </span>
          )}
        </div>
      </div>
      <Link href="/network" className="relative flex items-center gap-2 border-t border-white/[0.07] px-3 py-2 text-[11.5px]">
        <span className="grid size-4 place-items-center rounded-[5px] bg-gradient-to-b from-white to-[#cfcfcf] text-[11px] font-semibold text-black">τ</span>
        <span className="text-ink-3">Bittensor</span>
        <span className="num ml-auto text-ink/85">{tao ? price(tao.last) : "–"}</span>
        <Delta v={tao?.change24h ?? null} fraction={false} className="text-[10.5px]" />
      </Link>
    </div>
  );
}

function Sidebar() {
  const active = useActive();
  return (
    <aside className="hidden h-full w-[232px] shrink-0 flex-col border-r border-white/[0.07] bg-gradient-to-b from-[#0a0a0a] to-[#050505] lg:flex" aria-label="App">
      <Link href="/" className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] px-4 text-ink" aria-label={`${BRAND.name} home`}>
        <span className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.03em]">
          <Mark size={18} /> {BRAND.name}
        </span>
        <span className="chip !px-1.5 !py-0.5 before:hidden">Beta</span>
      </Link>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {APP_NAV.map((g) => (
          <div key={g.label} className="mb-2.5">
            <p className="label px-2 pb-1">{g.label}</p>
            <ul>
              {g.items.map((it) => {
                const I = ICON[it.href] ?? Activity;
                const on = active(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={on ? "page" : undefined}
                      title={it.hint}
                      className={`relative flex h-7 items-center gap-2.5 rounded-[5px] px-2 text-[13.5px] transition-colors ${on ? "bg-gradient-to-r from-white/10 to-white/[0.02] text-ink" : "text-ink-3 hover:bg-white/[0.04] hover:text-ink"}`}
                    >
                      {on ? <span className="absolute top-1.5 -left-2 h-4 w-[2px] rounded-r bg-white" /> : null}
                      <I className="size-[15px] shrink-0" strokeWidth={1.6} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 pb-1">
        <TokenCard />
        <div className="flex items-center gap-1 px-3 pt-2 pb-2.5">
          <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`} className="grid size-7 place-items-center rounded-[5px] text-ink-3 hover:bg-white/5 hover:text-ink">
            <XGlyph />
          </a>
          <Link href="/docs" aria-label="Documentation" className="grid size-7 place-items-center rounded-[5px] text-ink-3 hover:bg-white/5 hover:text-ink">
            <DocsGlyph />
          </Link>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ top bar */

function TopBar({ onSearch }: { onSearch: () => void }) {
  const active = useActive();
  const group = APP_NAV.find((g) => g.items.some((i) => active(i.href)));
  const page = group?.items.find((i) => active(i.href));
  const buy = buyHref();
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-black/60 px-4 max-lg:sticky max-lg:top-0 max-lg:z-30 max-lg:bg-black max-sm:px-3" data-testid="navrow">
      <Link href="/" className="text-ink lg:hidden" aria-label={`${BRAND.name} home`}>
        <Mark size={20} />
      </Link>
      <p className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <span className="text-faint max-lg:hidden">{group?.label ?? "App"}</span>
        <span className="text-faint max-lg:hidden">/</span>
        <span className="truncate text-ink">{page?.label ?? ""}</span>
      </p>
      <button
        type="button"
        onClick={onSearch}
        className="ml-2 hidden h-8 w-[200px] min-w-0 cursor-pointer xl:w-[340px] items-center gap-2 rounded-[5px] border border-line bg-card px-2.5 text-[12.5px] text-ink-3 md:flex"
        aria-label="Search symbols and pages"
      >
        <Search className="size-3.5" />
        <span>Search symbols, pages…</span>
        <kbd className="ml-auto rounded-[3px] border border-line-2 px-1 font-mono text-[10.5px]">⌘K</kbd>
      </button>
      <div className="ml-auto flex min-w-0 items-center gap-3 max-sm:gap-1.5">
        <button type="button" onClick={onSearch} aria-label="Search" className="abtn !size-8 !p-0 md:hidden">
          <Search className="size-3.5" />
        </button>
        <div className="hidden h-8 items-center rounded-[6px] border border-line bg-card xl:flex">
          <Link href="/token" className="flex h-full items-center gap-1.5 pr-1 pl-2.5">
            <span className="label !text-ink">{BRAND.symbol}</span>
            <span className="num text-[11.5px] text-ink-3">{TOKEN.isLive ? "live" : "at launch"}</span>
          </Link>
          <a href={buy} {...(buy.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})} className="flex h-full items-center gap-0.5 border-l border-line px-2.5 text-[12px] text-ink">
            Buy <Arrow />
          </a>
        </div>
        <a
          href={buy}
          {...(buy.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
          className="abtn abtn-face !h-[30px] !px-2.5 xl:hidden max-[359px]:hidden"
        >
          Buy <Arrow />
        </a>
        <div className="flex items-center gap-0.5 max-sm:hidden">
          <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`} className="grid size-7 place-items-center rounded-[5px] text-ink-3 hover:text-ink">
            <XGlyph />
          </a>
        </div>
        <NavWallet compact />
        <Link href="/docs" className="abtn abtn-face max-md:hidden">
          <BookOpen className="size-3.5" /> Docs
        </Link>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ ticker */

function Ticker() {
  const { rows, tao } = useLive();
  if (!rows.length) return <div className="h-8 shrink-0 border-b border-line bg-black" />;
  const one = (
    <>
      <Link href="/network" className="flex h-[31px] shrink-0 items-center gap-2 bg-white/[0.04] px-4">
        <span className="grid size-4 place-items-center rounded-[5px] bg-gradient-to-b from-white to-[#cfcfcf] text-[11px] font-semibold text-black">τ</span>
        <span className="num text-[12px] font-medium text-ink">TAO</span>
        <span className="num text-[12px] text-ink/80">{tao ? price(tao.last) : "–"}</span>
        <Delta v={tao?.change24h ?? null} fraction={false} className="text-[11.5px]" />
      </Link>
      {rows.map((r) => (
        <Link key={r.symbol} href={`/markets/${r.symbol.toLowerCase()}`} className="flex h-[31px] shrink-0 items-center gap-2 px-4 hover:bg-white/[0.03]">
          <span className="num text-[12px] font-medium text-ink">{r.symbol}</span>
          <span className="num text-[12px] text-ink/75">{price(r.price)}</span>
          <Delta v={r.change24h} className="text-[11.5px]" />
        </Link>
      ))}
    </>
  );
  return (
    <div className="h-8 shrink-0 overflow-hidden border-b border-line bg-black" aria-label="Chainlink prices of stock tokens">
      <div className="marquee flex w-max items-center" style={{ animationDuration: "90s" }}>
        {one}
        <div className="flex items-center" aria-hidden="true">
          {one}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ status bar */

function StatusBar() {
  const { facts, failed } = useChain();
  const { latency, updated, rows } = useLive();
  const cell = "flex h-full shrink-0 items-center gap-1.5 border-r border-line px-3 text-[11.5px] text-ink-3";
  const v = "num text-ink/80";
  return (
    <footer className="hidden h-7 shrink-0 items-center overflow-hidden border-t border-line bg-black lg:flex" aria-label="Status">
      <div className={cell}>
        <span className={`size-1.5 rounded-full ${failed ? "bg-faint" : "bg-ink"}`} />
        <span className="text-ink/85">{failed ? "Unreachable" : facts ? "Connected" : "Connecting"}</span>
      </div>
      <div className={cell}>
        <span className="size-1.5 rounded-full bg-ink" /> {CHAIN.name}
        <span className={v}># {facts?.block ? facts.block.toLocaleString("en-US") : "–"}</span>
        <span className="num text-faint max-xl:hidden">· {facts?.gasGwei != null ? facts.gasGwei.toFixed(3) : "–"} gwei</span>
      </div>
      <div className={cell}>
        Source · <span className="text-ink/80">Chainlink</span>
      </div>
      <div className={`${cell} max-xl:hidden`}>
        Latency <span className={v}>{latency != null ? `${latency}ms` : "–"}</span>
      </div>
      <div className={`${cell} max-xl:hidden`}>
        Updated <span className={v}>{updated ? new Date(updated).toISOString().slice(11, 19) + "Z" : "–"}</span>
      </div>
      <div className={cell}>
        Instruments <span className={v}>{rows.length || STOCKS.length}</span>
      </div>
      <div className="ml-auto flex h-full items-center">
        <div className={`${cell} border-l`}>
          <span className={`size-1.5 rounded-full ${oracleLive() ? "bg-ink" : "bg-faint"}`} /> Oracle · <span className="text-ink/80">{oracleLive() ? "on chain" : "practice"}</span>
        </div>
        <div className={`${cell} max-xl:hidden`}>
          <span className="size-1.5 rounded-full bg-faint" /> Subnet · <span className="text-ink/80">target</span>
        </div>
        <div className={`${cell} border-r-0 max-xl:hidden`}>v0.1 preview</div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ phone tab bar */

function TabBar() {
  const active = useActive();
  const pathname = usePathname();
  // "More" remembers the page it was opened on, so navigating closes it without an effect.
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const more = moreAt === pathname;
  const setMore = (f: (v: boolean) => boolean) => setMoreAt(f(more) ? pathname : null);
  const tabs = [
    { href: "/ask", label: "Ask", I: MessageSquareText },
    { href: "/markets", label: "Markets", I: LineChart },
    { href: "/tokens", label: "Stock tokens", I: Coins },
    { href: "/portfolio", label: "Portfolio", I: Wallet },
  ];
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[58px] grid-cols-5 border-t border-line bg-black pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="App tabs">
        {tabs.map(({ href, label, I }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-[11px] ${active(href) ? "text-ink" : "text-faint"}`}>
            <I className="size-[17px]" strokeWidth={1.6} />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className={`flex cursor-pointer flex-col items-center justify-center gap-1 text-[11px] ${more ? "text-ink" : "text-faint"}`}>
          <MoreHorizontal className="size-[17px]" strokeWidth={1.6} />
          More
        </button>
      </nav>
      {more ? (
        <div className="fixed inset-x-0 top-0 bottom-[58px] z-[39] overflow-y-auto bg-black/95 px-4 pt-16 pb-6 lg:hidden" role="dialog" aria-label="All pages">
          {APP_NAV.map((g) => (
            <div key={g.label} className="mb-5">
              <p className="label pb-2">{g.label}</p>
              <ul className="grid grid-cols-2 gap-1">
                {g.items.map((it) => {
                  const I = ICON[it.href] ?? Activity;
                  return (
                    <li key={it.href}>
                      <Link href={it.href} className={`flex h-10 items-center gap-2.5 rounded-[6px] border border-line px-3 text-[13.5px] ${active(it.href) ? "bg-paper-3 text-ink" : "text-ink-2"}`}>
                        <I className="size-4 shrink-0" strokeWidth={1.6} />
                        <span className="truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <TokenCard />
          <Link href="/docs" className="abtn abtn-face mt-4 w-full">
            <BookOpen className="size-3.5" /> Docs
          </Link>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ frame */

/** Desktop: sidebar, top bar, ticker, a scrolling main and a status bar, all inside the viewport. Phones: top bar, ticker, page, tab bar. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const [palette, setPalette] = usePalette();
  return (
    <AppLiveProvider>
      <div className="flex min-h-dvh flex-col bg-black lg:h-dvh lg:min-h-0">
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar onSearch={() => setPalette(true)} />
            <Ticker />
            <main
              id="main"
              className="min-h-0 flex-1 bg-[radial-gradient(1100px_380px_at_50%_-160px,rgba(255,255,255,0.075),transparent_70%)] pb-[76px] lg:overflow-y-auto lg:pb-0"
              data-scroll-root
            >
              {children}
            </main>
          </div>
        </div>
        <StatusBar />
      </div>
      <TabBar />
      {palette ? <Palette onClose={() => setPalette(false)} /> : null}
    </AppLiveProvider>
  );
}
