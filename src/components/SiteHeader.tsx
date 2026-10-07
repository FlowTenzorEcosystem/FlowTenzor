"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/config/brand";
import { CopyCaTag } from "@/components/CopyCa";
import { Wordmark } from "@/components/Mark";
import { NAV, isGroup, type NavGroup } from "@/components/site";
import { NavWallet } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";

function Caret({ open = false }: { open?: boolean }) {
  return (
    <svg width="10" height="7" viewBox="0 0 10 7" aria-hidden="true" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
      <path d="M1 1.5L5 5.5L9 1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
        className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[15px] font-medium whitespace-nowrap transition-colors hover:text-accent ${here ? "text-accent" : "text-chalk"}`}
      >
        {group.label}
        <Caret open={open} />
      </button>
      {open ? <span className="absolute top-full right-0 left-0 h-3" /> : null}
      {open ? (
        <div className="absolute top-[calc(100%+10px)] right-0 z-40 w-[300px] rounded-[12px] border border-line bg-card p-2 text-ink shadow-[0_18px_40px_rgba(15,27,35,0.18)]">
          <ul>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="block rounded-[8px] px-3 py-2.5 transition-colors hover:bg-paper-2"
                >
                  <span className="block text-[15px] font-semibold text-ink">{item.label}</span>
                  {item.note ? <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{item.note}</span> : null}
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
  const row = "flex w-full items-center justify-between border-b border-line py-4 text-left text-[21px] font-semibold font-display text-ink";
  return (
    <div role="dialog" aria-modal="true" aria-label="Menu" className="night fixed inset-0 z-[60] overflow-y-auto">
      <div className="ctn flex h-[var(--header-h)] items-center justify-between">
        <Link href="/" onClick={onClose} aria-label={`${BRAND.name} home`} className="text-chalk">
          <Wordmark size={20} />
        </Link>
        <button type="button" aria-label="Close menu" onClick={onClose} className="grid size-10 cursor-pointer place-items-center text-chalk">
          <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden="true">
            <path d="M2 2l18 18M20 2L2 20" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </div>
      <nav aria-label="Mobile" className="ctn pb-12">
        <ul className="border-t border-line">
          {NAV.flatMap((entry) => (isGroup(entry) ? entry.items : [entry])).map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={onClose} aria-current={isActive(item.href) ? "page" : undefined} className={row}>
                <span className={isActive(item.href) ? "text-accent" : ""}>{item.label}</span>
                <span aria-hidden="true" className="text-ink-3">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/forecasts" onClick={onClose} className="btn btn-accent w-full">
            Launch the app
          </Link>
        </div>
      </nav>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const { address } = useWallet();
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menu]);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    // No backdrop-filter here: it would trap fixed-position dialogs inside the header.
    <header className="sticky top-0 z-30 border-b border-line bg-paper text-chalk">
      <div data-testid="navrow" className="ctn flex h-[var(--header-h)] items-center gap-3 max-[560px]:gap-2">
        <Link href="/" aria-label={`${BRAND.name} home`} className="shrink-0 text-chalk">
          <Wordmark size={20} className={`max-[400px]:!text-[18px] ${address ? "max-[460px]:[&>span:last-child]:hidden" : ""}`} />
        </Link>
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 min-[1500px]:flex">
          {NAV.map((entry) =>
            isGroup(entry) ? (
              <Dropdown key={entry.label} group={entry} isActive={isActive} />
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={isActive(entry.href) ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-[15px] font-medium whitespace-nowrap transition-colors hover:text-accent ${isActive(entry.href) ? "text-accent" : "text-chalk"}`}
              >
                {entry.label}
              </Link>
            ),
          )}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2 max-[560px]:gap-1.5">
          <CopyCaTag compact />
          <Link href="/forecasts" className="btn btn-accent btn-sm hidden min-[1600px]:inline-flex">
            Launch app
          </Link>
          <span className="hidden sm:block">
            <NavWallet />
          </span>
          <span className="sm:hidden">
            <NavWallet compact />
          </span>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
            className="grid size-10 shrink-0 cursor-pointer place-items-center text-chalk min-[1500px]:hidden max-[400px]:w-8"
          >
            <svg width="22" height="16" viewBox="0 0 24 18" aria-hidden="true">
              <path d="M0 1h24M0 9h24M0 17h24" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      </div>
      {menu ? <MobileMenu isActive={isActive} onClose={() => setMenu(false)} /> : null}
    </header>
  );
}
