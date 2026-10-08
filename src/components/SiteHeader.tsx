"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND, PONS, TOKEN } from "@/config/brand";
import { CaConsole } from "@/components/CopyCa";
import { Wordmark } from "@/components/Mark";
import { NAV, isGroup, type NavGroup } from "@/components/site";
import { NavWallet } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";

export function XGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function DocsGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 4.5h6a2 2 0 0 1 2 2V20a1.5 1.5 0 0 0-1.5-1.5H4zM20 4.5h-6a2 2 0 0 0-2 2V20a1.5 1.5 0 0 1 1.5-1.5H20z" strokeLinejoin="round" />
    </svg>
  );
}

export function Arrow({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function Caret() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3.5 4.75 6 7.25l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

/** Where "Buy" goes: the launch page once the CA is real, the in-site swap screen before that. */
export const buyHref = () => (TOKEN.isLive ? PONS.page(BRAND.ca) : "/swap");

/** Thin bar fixed above everything: ticker, the CA console, buy and explorer links. */
export function CaBar() {
  const buy = buyHref();
  const external = buy.startsWith("http");
  return (
    <div className="fixed inset-x-0 top-0 z-[62] flex h-10 items-center justify-center gap-3 border-b border-line bg-card px-3" data-testid="ca-bar">
      <span className="font-mono text-[12px] tracking-[0.02em] text-ink uppercase max-[359px]:hidden">{BRAND.symbol}</span>
      <CaConsole fit="auto" explorer={false} className="!rounded-full !border-line !bg-transparent max-w-[360px] !py-[2px] !pl-2.5" testid="ca-console-bar" />
      <a
        href={buy}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className="flex shrink-0 items-center gap-0.5 text-[12px] whitespace-nowrap text-ink hover:underline"
      >
        {TOKEN.isLive ? "Buy on Pons" : "Buy"} <Arrow />
      </a>
      {TOKEN.explorerUrl ? (
        <a href={TOKEN.explorerUrl} target="_blank" rel="noreferrer" className="hidden shrink-0 items-center gap-0.5 text-[12px] text-ink-3 hover:text-ink sm:flex">
          Explorer <Arrow />
        </a>
      ) : (
        <span className="hidden shrink-0 items-center gap-0.5 text-[12px] text-faint sm:flex" title="Published with the contract address">
          Explorer <Arrow />
        </span>
      )}
    </div>
  );
}

function Dropdown({ group, isActive }: { group: NavGroup; isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const here = group.items.some((i) => isActive(i.href));
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => window.matchMedia("(hover: hover)").matches && setOpen(true)}
        className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors hover:text-ink ${here || open ? "text-ink" : "text-ink-3"}`}
      >
        {group.label}
        <Caret />
      </button>
      {open ? <span className="absolute top-full right-0 left-0 h-3" /> : null}
      {open ? (
        <div className="absolute top-[calc(100%+12px)] left-1/2 z-40 w-[280px] -translate-x-1/2 rounded-[10px] border border-line bg-card p-1.5 shadow-[0_24px_48px_rgba(0,0,0,0.6)]">
          <ul>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="block rounded-[6px] px-3 py-2 transition-colors hover:bg-paper-2"
                >
                  <span className="block text-[13.5px] text-ink">{item.label}</span>
                  {item.note ? <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{item.note}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MobileMenu({ isActive, onClose }: { isActive: (href: string) => boolean; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[60] overflow-y-auto bg-black px-4 pt-[116px] pb-10">
      <nav aria-label="Mobile">
        {NAV.map((entry) =>
          isGroup(entry) ? (
            <div key={entry.label} className="border-b border-line py-4">
              <p className="kicker !text-faint">{entry.label}</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {entry.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} onClick={onClose} className={`text-[15px] ${isActive(it.href) ? "text-ink" : "text-ink-3"}`}>
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onClose}
              aria-current={isActive(entry.href) ? "page" : undefined}
              className="flex items-center justify-between border-b border-line py-4 font-display text-[30px] leading-none tracking-[-0.04em] text-ink"
            >
              {entry.label}
              <span className="text-[16px] text-ink-3">→</span>
            </Link>
          ),
        )}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href={buyHref()} onClick={onClose} className="btn btn-ghost">
            Buy {BRAND.symbol}
          </Link>
          <Link href="/ask" onClick={onClose} className="btn btn-accent">
            Launch app
          </Link>
        </div>
      </nav>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so navigating closes it without an effect.
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const menu = menuAt === pathname;
  const setMenu = (v: boolean | ((x: boolean) => boolean)) => setMenuAt((typeof v === "function" ? v(menu) : v) ? pathname : null);
  const { address } = useWallet();
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuAt(null);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menu]);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const buy = buyHref();
  const icon = "grid size-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink";
  return (
    <>
      <CaBar />
      {/* No backdrop-filter on the pill: it would trap fixed dialogs inside the header. */}
      <header className="pointer-events-none fixed inset-x-0 top-[60px] z-[61] flex justify-center px-4 max-[767px]:top-[48px] max-[767px]:px-3">
        <nav
          aria-label="Main"
          data-testid="navrow"
          className="pointer-events-auto flex h-[46px] w-full max-w-[1120px] items-center justify-between gap-2 rounded-full border border-line bg-[rgba(17,17,17,0.86)] pr-1.5 pl-4 md:w-auto"
        >
          <Link href="/" aria-label={`${BRAND.name} home`} className="shrink-0 text-ink">
            <Wordmark size={15} />
          </Link>
          <div className="hidden items-center gap-0.5 xl:flex">
            {NAV.map((entry) =>
              isGroup(entry) ? (
                <Dropdown key={entry.label} group={entry} isActive={isActive} />
              ) : (
                <Link
                  key={entry.href}
                  href={entry.href}
                  aria-current={isActive(entry.href) ? "page" : undefined}
                  className={`rounded-full px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors hover:text-ink ${isActive(entry.href) ? "text-ink" : "text-ink-3"}`}
                >
                  {entry.label}
                </Link>
              ),
            )}
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`} className={`${icon} ${address ? "max-[439px]:hidden" : ""}`}>
              <XGlyph />
            </a>
            <Link href="/docs" aria-label="Documentation" className={`${icon} ${address ? "max-[479px]:hidden" : "max-[359px]:hidden"}`}>
              <DocsGlyph />
            </Link>
            {address ? (
              <NavWallet compact />
            ) : (
              <a
                href={buy}
                {...(buy.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                className="flex h-[34px] shrink-0 items-center gap-1 rounded-full border border-line-2 px-3 text-[13px] whitespace-nowrap text-ink transition-colors hover:border-[#555]"
              >
                Buy <span className="hidden sm:inline">{BRAND.symbol}</span> <Arrow size={14} />
              </a>
            )}
            <Link href="/ask" className="hidden h-8 shrink-0 items-center rounded-full bg-white px-3.5 text-[13px] whitespace-nowrap text-[#0a0a0a] transition-colors hover:bg-[#dedede] xl:flex">
              Launch app
            </Link>
            <button
              type="button"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className="flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-white px-3.5 text-[13px] text-[#0a0a0a] xl:hidden"
            >
              {menu ? "Close" : "Menu"}
            </button>
          </div>
        </nav>
      </header>
      {menu ? <MobileMenu isActive={isActive} onClose={() => setMenu(false)} /> : null}
    </>
  );
}
