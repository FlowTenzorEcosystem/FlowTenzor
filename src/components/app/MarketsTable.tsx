"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PriceChart } from "./PriceChart";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { usePrefs } from "./AppShell";

export type MarketRow = { symbol: string; name: string; kind: "stock" | "etf"; last: number | null; changePct: number | null; change?: number | null; prevClose?: number | null; asOf?: string; volume: number | null; feed: number | null; spark: { t: number; p: number }[] };

export function useStars() {
  return useLocalStore<string[]>("flowtenzor:stars", []);
}

const fmtVol = (v: number | null, compact: boolean) => (v == null ? "–" : compact ? (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v)) : Math.round(v).toLocaleString("en-US"));

function Spark({ pts, w = 90 }: { pts: { t: number; p: number }[]; w?: number }) {
  if (pts.length < 2) return <span className="inline-block h-5" style={{ width: w }} />;
  const lo = Math.min(...pts.map((p) => p.p));
  const hi = Math.max(...pts.map((p) => p.p));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * w).toFixed(1)} ${(19 - ((p.p - lo) / (hi - lo || 1)) * 18).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height="20" viewBox={`0 0 ${w} 20`} aria-hidden="true">
      <path d={d} fill="none" stroke={pts[pts.length - 1].p >= pts[0].p ? "var(--color-up)" : "var(--color-down)"} strokeWidth="1.2" />
    </svg>
  );
}

const pctTxt = (v: number | null | undefined) => (v == null ? "–" : `${v >= 0 ? "▲ +" : "▼ −"}${Math.abs(v).toFixed(2)}%`);
const tone = (v: number | null | undefined) => (v == null ? "text-faint" : v >= 0 ? "text-up" : "text-down");
const usd = (v: number | null | undefined) => (v == null ? "–" : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/**
 * Markets terminal: the listing list on the left (filter by class or stars, type to search, arrow keys to
 * move, Enter to open), the selected symbol's chart and statistics on the right.
 */
export function MarketsTable({ rows }: { rows: MarketRow[] }) {
  const router = useRouter();
  const [prefs] = usePrefs();
  const [stars, setStars] = useStars();
  const [tab, setTab] = useState<"all" | "stock" | "etf" | "star">("all");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string>(rows.find((r) => r.symbol === "NVDA")?.symbol ?? rows[0]?.symbol ?? "");
  const list = useMemo(() => {
    const n = q.trim().toUpperCase();
    return rows.filter((r) => (tab === "all" || (tab === "star" ? stars.includes(r.symbol) : r.kind === tab)) && (!n || r.symbol.includes(n) || r.name.toUpperCase().includes(n)));
  }, [rows, tab, q, stars]);
  const sel = Math.max(0, list.findIndex((r) => r.symbol === pick));
  const cur = rows.find((r) => r.symbol === pick) ?? list[0] ?? null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list[sel + 1]) setPick(list[sel + 1].symbol);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (list[sel - 1]) setPick(list[sel - 1].symbol);
    }
    if (e.key === "Enter" && cur) router.push(`/markets/${cur.symbol.toLowerCase()}`);
  };
  const toggle = (s: string) => setStars(stars.includes(s) ? stars.filter((x) => x !== s) : [...stars, s]);
  const lo = cur?.spark.length ? Math.min(...cur.spark.map((p) => p.p)) : null;
  const hi = cur?.spark.length ? Math.max(...cur.spark.map((p) => p.p)) : null;
  const prem = cur?.feed != null && cur.last ? (cur.feed / cur.last - 1) * 100 : null;
  return (
    <div className="grid min-w-0 grid-cols-1 border-line lg:grid-cols-[358px_minmax(0,1fr)]" onKeyDown={onKey} data-testid="markets-table">
      <section className="min-w-0 border-line lg:border-r">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <div className="seg" role="group" aria-label="Class">
            {(
              [
                ["all", "All"],
                ["stock", "Stocks"],
                ["etf", "ETFs"],
                ["star", "★"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className="!font-sans">
                {l}
              </button>
            ))}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" aria-label="Filter symbols" className="field !min-h-[28px] min-w-0 flex-1 !py-0.5 !text-[12.5px]" />
          <span className="label shrink-0 max-sm:hidden">{list.length}</span>
        </div>
        <div className="scroll-x lg:max-h-[calc(100dvh-230px)] lg:overflow-y-auto">
          <table className="tbl min-w-[340px] !text-[12.5px] [&_td]:!py-2 [&_th]:!py-2.5">
            <thead>
              <tr>
                <th className="w-6 !pr-0" aria-label="Star" />
                <th className="!pl-1">Symbol ↑</th>
                <th className="text-right">Last</th>
                <th className="text-right">1D</th>
                <th className="text-right max-[400px]:hidden">Vol</th>
                {prefs.sparklines ? <th className="max-sm:hidden">Intraday</th> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.symbol}
                  className={`cursor-pointer ${r.symbol === cur?.symbol ? "bg-white/[0.04] shadow-[inset_2px_0_0_#fff]" : ""}`}
                  onClick={() => setPick(r.symbol)}
                  onDoubleClick={() => router.push(`/markets/${r.symbol.toLowerCase()}`)}
                >
                  <td className="!pr-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(r.symbol);
                      }}
                      aria-label={`${stars.includes(r.symbol) ? "Unstar" : "Star"} ${r.symbol}`}
                      className={`cursor-pointer ${stars.includes(r.symbol) ? "text-ink" : "text-[#333]"}`}
                    >
                      ★
                    </button>
                  </td>
                  <td className="max-w-[120px] truncate !pl-1">
                    <Link href={`/markets/${r.symbol.toLowerCase()}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:underline">
                      {r.symbol}
                    </Link>{" "}
                    <span className="font-sans text-[11.5px] text-faint">{r.name}</span>
                  </td>
                  <td className="text-right text-ink">{usd(r.last)}</td>
                  <td className={`text-right text-[11.5px] whitespace-nowrap ${tone(r.changePct)}`}>{pctTxt(r.changePct)}</td>
                  <td className="text-right text-ink-3 max-[400px]:hidden">{fmtVol(r.volume, prefs.compact)}</td>
                  {prefs.sparklines ? (
                    <td className="max-sm:hidden">
                      <Spark pts={r.spark} w={54} />
                    </td>
                  ) : null}
                </tr>
              ))}
              {!list.length ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center font-sans text-ink-3">
                    {tab === "star" ? "Star a token with ★ to pin it here." : "Nothing matches."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="label border-t border-line px-3 py-2.5">↑↓ select · ↵ open · listing: Nasdaq · feed: Chainlink</p>
      </section>
      {cur ? (
        <section className="min-w-0 space-y-3 p-3" data-testid="market-detail">
          <div className="flex flex-wrap items-start justify-between gap-3 px-1 pt-1">
            <div className="min-w-0">
              <p className="flex items-center gap-2">
                <span className="text-[19px] font-medium tracking-[-0.02em] text-ink">{cur.symbol}</span>
                <span className="chip !py-0 before:hidden">{cur.kind === "etf" ? "ETF" : "Stock"}</span>
                <span className="chip !py-0 before:hidden">Nasdaq</span>
              </p>
              <p className="mt-1 truncate text-[13px] text-ink-3">{cur.name}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-right">
                <p className="num text-[24px] leading-none text-ink">{usd(cur.last)}</p>
                <p className={`num mt-1.5 text-[12px] ${tone(cur.changePct)}`}>
                  {cur.change != null ? `${cur.change >= 0 ? "+" : "−"}${Math.abs(cur.change).toFixed(2)} ` : ""}
                  {pctTxt(cur.changePct)}
                </p>
              </div>
              <Link href={`/markets/${cur.symbol.toLowerCase()}`} className="abtn !text-ink">
                Open ↗
              </Link>
            </div>
          </div>
          <PriceChart symbol={cur.symbol} />
          <section className="panel overflow-hidden">
            <h2 className="label flex gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-3 !text-ink/85">
              Statistics <span className="!text-faint">Listing and feed</span>
            </h2>
            <dl className="grid grid-cols-1 text-[13px] sm:grid-cols-2">
              {(
                [
                  ["Previous close", usd(cur.prevClose)],
                  ["Day range", lo != null && hi != null ? `${lo.toFixed(2)} – ${hi.toFixed(2)}` : "–"],
                  ["Chainlink feed", usd(cur.feed)],
                  ["Feed vs listing", prem == null ? "–" : `${prem >= 0 ? "+" : "−"}${Math.abs(prem).toFixed(2)}%`],
                  ["Volume", fmtVol(cur.volume, prefs.compact)],
                  ["Currency", "USD"],
                  ["Last print", cur.asOf?.replace(/^.*?(\d{1,2}:\d{2} [AP]M ET)$/, "$1") || "–"],
                  ["Token", `${cur.symbol} on Robinhood Chain`],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line px-3 py-2.5 sm:odd:border-r">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="num text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </section>
      ) : null}
    </div>
  );
}
