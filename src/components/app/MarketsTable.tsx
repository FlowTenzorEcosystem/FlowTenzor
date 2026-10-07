"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { usePrefs } from "./AppShell";

export type MarketRow = { symbol: string; name: string; kind: "stock" | "etf"; last: number | null; changePct: number | null; volume: number | null; feed: number | null; spark: { t: number; p: number }[] };

export function useStars() {
  return useLocalStore<string[]>("flowtenzor:stars", []);
}

const fmtVol = (v: number | null, compact: boolean) => (v == null ? "–" : compact ? (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v)) : Math.round(v).toLocaleString("en-US"));

function Spark({ pts }: { pts: { t: number; p: number }[] }) {
  if (pts.length < 2) return <span className="inline-block h-5 w-[90px]" />;
  const lo = Math.min(...pts.map((p) => p.p));
  const hi = Math.max(...pts.map((p) => p.p));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * 90).toFixed(1)} ${(19 - ((p.p - lo) / (hi - lo || 1)) * 18).toFixed(1)}`).join(" ");
  return (
    <svg width="90" height="20" viewBox="0 0 90 20" aria-hidden="true">
      <path d={d} fill="none" stroke={pts[pts.length - 1].p >= pts[0].p ? "var(--color-up)" : "var(--color-down)"} strokeWidth="1.3" />
    </svg>
  );
}

/** Listing table: filter by class or stars, type to search, arrow keys to move, Enter to open. */
export function MarketsTable({ rows }: { rows: MarketRow[] }) {
  const router = useRouter();
  const [prefs] = usePrefs();
  const [stars, setStars] = useStars();
  const [tab, setTab] = useState<"all" | "stock" | "etf" | "star">("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const list = useMemo(() => {
    const n = q.trim().toUpperCase();
    return rows.filter((r) => (tab === "all" || (tab === "star" ? stars.includes(r.symbol) : r.kind === tab)) && (!n || r.symbol.includes(n) || r.name.toUpperCase().includes(n)));
  }, [rows, tab, q, stars]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(list.length - 1, s + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    }
    if (e.key === "Enter" && list[sel]) router.push(`/markets/${list[sel].symbol.toLowerCase()}`);
  };
  const toggle = (s: string) => setStars(stars.includes(s) ? stars.filter((x) => x !== s) : [...stars, s]);
  return (
    <section className="min-w-0 rounded-[10px] border border-line bg-card" onKeyDown={onKey} data-testid="markets-table">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        {(
          [
            ["all", "All"],
            ["stock", "Stocks"],
            ["etf", "ETFs"],
            ["star", "★ Starred"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => {
              setTab(k);
              setSel(0);
            }} className={`cursor-pointer rounded-[6px] px-2.5 py-1 text-[13px] ${tab === k ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"}`}>
            {l}
          </button>
        ))}
        <input value={q} onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }} placeholder="Filter symbols" aria-label="Filter symbols" className="field !min-h-[34px] ml-auto max-w-[200px] !py-1 text-[13.5px]" />
      </div>
      <div className="scroll-x">
        <table className="tbl min-w-[700px] text-[13px]">
          <thead>
            <tr>
              <th className="w-8" aria-label="Star" />
              <th>Symbol</th>
              <th className="text-right">Listing</th>
              <th className="text-right">1D</th>
              <th className="text-right">Chainlink feed</th>
              <th className="text-right">Volume</th>
              {prefs.sparklines ? <th>Intraday</th> : null}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.symbol} className={i === sel ? "bg-paper-2" : ""} onMouseEnter={() => setSel(i)}>
                <td>
                  <button type="button" onClick={() => toggle(r.symbol)} aria-label={`${stars.includes(r.symbol) ? "Unstar" : "Star"} ${r.symbol}`} className={`cursor-pointer ${stars.includes(r.symbol) ? "text-rise" : "text-ink-3"}`}>
                    ★
                  </button>
                </td>
                <td>
                  <Link href={`/markets/${r.symbol.toLowerCase()}`} className="font-semibold text-ink hover:text-stamp">
                    {r.symbol}
                  </Link>
                  <span className="ml-2 text-[12px] text-ink-3">{r.name}</span>
                </td>
                <td className="num text-right text-ink">{r.last != null ? `$${r.last.toFixed(2)}` : "–"}</td>
                <td className={`num text-right ${r.changePct == null ? "text-ink-3" : r.changePct >= 0 ? "text-up" : "text-down"}`}>{r.changePct == null ? "–" : `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`}</td>
                <td className="num text-right text-ink-2">{r.feed != null ? `$${r.feed.toFixed(2)}` : "–"}</td>
                <td className="num text-right text-ink-2">{fmtVol(r.volume, prefs.compact)}</td>
                {prefs.sparklines ? (
                  <td>
                    <Spark pts={r.spark} />
                  </td>
                ) : null}
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-ink-3">
                  {tab === "star" ? "Star a token with ★ to pin it here." : "Nothing matches."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="kicker border-t border-line px-4 py-2">↑↓ select · ↵ open · listing: Nasdaq · feed: Chainlink on Robinhood Chain</p>
    </section>
  );
}
