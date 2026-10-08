"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { BRAND } from "@/config/brand";
import { CaConsole } from "@/components/CopyCa";
import { Wordmark } from "@/components/Mark";
import { Arrow, XGlyph, buyHref } from "@/components/SiteHeader";
import { DOCS, DOC_SECTIONS } from "@/content/docs";

const hrefOf = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

export function DocsNav({ onPick }: { onPick?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="pt-5">
      {DOC_SECTIONS.map((s) => (
        <div key={s} className="mb-7">
          <p className="kicker !text-faint px-3">{s}</p>
          <ul className="mt-3 space-y-0.5">
            {DOCS.filter((d) => d.section === s).map((d) => {
              const on = pathname === hrefOf(d.slug);
              return (
                <li key={d.slug}>
                  <Link
                    href={hrefOf(d.slug)}
                    onClick={onPick}
                    aria-current={on ? "page" : undefined}
                    className={`relative block rounded-[6px] px-3 py-[7px] text-[14.5px] leading-[1.35] transition-colors ${on ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"}`}
                  >
                    {on ? <span className="absolute top-2 bottom-2 left-0 w-[2px] rounded bg-white" /> : null}
                    {d.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function DocsSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const items = useMemo(() => {
    const n = q.trim().toLowerCase();
    const all = DOCS.map((d) => ({ href: hrefOf(d.slug), title: d.title, section: d.section, text: `${d.title} ${d.summary} ${d.body.join(" ")}`.toLowerCase() }));
    return (n ? all.filter((x) => x.text.includes(n)) : all).slice(0, 10);
  }, [q]);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search docs">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="panel relative w-full max-w-[560px] overflow-hidden bg-black">
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
            placeholder="Search docs"
            aria-label="Search docs"
            className="w-full bg-transparent py-3 text-[14px] text-ink outline-none placeholder:text-faint"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.map((it, k) => (
            <li key={it.href}>
              <button
                type="button"
                onMouseEnter={() => setI(k)}
                onClick={() => go(it.href)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-[5px] px-3 py-2 text-left ${k === i ? "bg-paper-3" : ""}`}
              >
                <span className="text-[13.5px] text-ink">{it.title}</span>
                <span className="label">{it.section}</span>
              </button>
            </li>
          ))}
          {!items.length ? <li className="px-3 py-4 text-[13px] text-ink-3">No page mentions that.</li> : null}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export function DocsHeader() {
  const [search, setSearch] = useState(false);
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so navigating closes it without an effect.
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const menu = menuAt === pathname;
  const setMenu = (v: boolean | ((x: boolean) => boolean)) => setMenuAt((typeof v === "function" ? v(menu) : v) ? pathname : null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const buy = buyHref();
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[61] px-3 pt-3 sm:px-4">
        <div className="mx-auto flex h-[50px] max-w-[1408px] items-center gap-3 rounded-full border border-line bg-[rgba(10,10,10,0.92)] pr-1.5 pl-4" data-testid="navrow">
          <Link href="/" aria-label={`${BRAND.name} home`} className="flex shrink-0 items-center gap-2.5 text-ink">
            <Wordmark size={15} />
            <span className="chip !rounded-full !px-2 before:hidden">Docs</span>
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSearch(true)}
              className="flex h-[30px] w-[208px] cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-3 text-[13px] text-ink-3 max-md:w-auto max-md:px-2"
              aria-label="Search docs"
            >
              <Search className="size-3.5" />
              <span className="max-md:hidden">Search docs</span>
              <kbd className="ml-auto rounded-[3px] border border-line-2 px-1 font-mono text-[10px] max-md:hidden">⌘K</kbd>
            </button>
            <div className="hidden h-[30px] items-center rounded-full border border-line bg-card pl-3 xl:flex">
              <span className="font-mono text-[11.5px] text-ink uppercase">{BRAND.symbol}</span>
              <CaConsole fit="short" explorer={false} label="CA" className="!border-0 !bg-transparent" testid="ca-console-docs" />
              <a href={buy} {...(buy.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})} className="flex h-full items-center gap-0.5 border-l border-line px-2.5 text-[12px] text-ink">
                Buy <Arrow />
              </a>
            </div>
            <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`} className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink max-sm:hidden">
              <XGlyph />
            </a>
            <Link href="/ask" className="flex h-[34px] items-center rounded-full bg-white px-3.5 text-[13.5px] whitespace-nowrap text-[#0a0a0a] hover:bg-[#dedede] max-sm:hidden">
              Launch app
            </Link>
            <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} className="flex h-[34px] cursor-pointer items-center rounded-full bg-white px-3.5 text-[13px] text-[#0a0a0a] lg:hidden">
              {menu ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>
      {menu ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black px-4 pt-[76px] pb-10 lg:hidden" role="dialog" aria-label="Docs sections">
          <DocsNav onPick={() => setMenu(false)} />
          <Link href="/ask" className="btn btn-accent w-full">
            Launch app
          </Link>
        </div>
      ) : null}
      {search ? <DocsSearch onClose={() => setSearch(false)} /> : null}
    </>
  );
}

/** "On this page" outline with a scroll spy, plus the reading progress line under the header. */
export function DocsToc({ items }: { items: { id: string; text: string; depth: number }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      setProgress(Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)));
      let cur = items[0]?.id ?? "";
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top < 160) cur = it.id;
      }
      setActive(cur);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [items]);
  return (
    <>
      <div className="fixed top-[70px] left-0 z-[61] h-[2px] bg-white transition-[width] duration-150" style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      {items.length ? (
        <nav aria-label="On this page" className="sticky top-[132px]">
          <p className="kicker !text-faint">On this page</p>
          <ul className="mt-4 border-l border-line">
            {items.map((it) => (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  className={`-ml-px block border-l py-[5px] text-[13.5px] leading-[1.35] transition-colors ${it.depth > 2 ? "pl-6" : "pl-4"} ${active === it.id ? "border-white text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
                >
                  {it.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
