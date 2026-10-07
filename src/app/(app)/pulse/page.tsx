import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { AppHead, Panel, money } from "@/components/app/ui";
import { JsonLd } from "@/components/JsonLd";
import { headlines } from "@/lib/feeds/nasdaq";
import { pulseRows } from "@/lib/forecast/pulse";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/pulse",
  title: `Pulse: momentum of every stock token | ${BRAND.name}`,
  description: `${BRAND.name} Pulse ranks every stock token on ${CHAIN.name} by volatility-adjusted momentum over one and five sessions, read from the Chainlink feeds.`,
});

const pc = (v: number | null) => (v == null ? "–" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`);

export default async function PulsePage({ searchParams }: { searchParams: Promise<{ by?: string }> }) {
  const { by = "momentum" } = await searchParams;
  const { at, rows } = await pulseRows();
  const key = (r: (typeof rows)[number]) => (by === "1d" ? (r.r1 ?? -9) : by === "5d" ? (r.r5 ?? -9) : (r.score ?? -1));
  const sorted = [...rows].sort((a, b) => key(b) - key(a));
  const scored = rows.filter((r) => r.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : null;
  const strongest = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const live = rows.filter((r) => r.updatedAt && at - r.updatedAt < 4 * 86_400).length;
  const movers = [...scored].sort((a, b) => Math.abs(b.r1 ?? 0) - Math.abs(a.r1 ?? 0)).slice(0, 3);
  const news = await Promise.all(movers.map(async (m) => ({ m, items: (await headlines(m.symbol, 3)).slice(0, 3) })));
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Pulse", path: "/pulse" }])} />
      <AppHead
        chips={
          <>
            <span className="chip chip-live">Live</span>
            <span className="kicker">
              {STOCKS.length} Chainlink feeds · {CHAIN.name}
            </span>
          </>
        }
        title="Pulse"
        desc="All the stock tokens side by side, strongest momentum first. A tile's brightness is its score: the last one and five sessions of return, each divided by the token's own volatility. 50 means no momentum either way."
        stats={[
          { k: "Pulse (average)", v: avg ?? "–", note: avg == null ? "" : avg > 55 ? "leaning up" : avg < 45 ? "leaning down" : "mixed" },
          { k: "Strongest", v: strongest ? `${strongest.symbol} · ${strongest.score}` : "–" },
          { k: "Feeds live", v: `${live} / ${STOCKS.length}` },
          { k: "Ordered by", v: by === "1d" ? "1 session" : by === "5d" ? "5 sessions" : "momentum" },
        ]}
      />
      <div className="mt-5 flex gap-1 text-[13px]" role="group" aria-label="Order by">
        {[
          ["momentum", "Momentum"],
          ["1d", "1D"],
          ["5d", "5D"],
        ].map(([k, l]) => (
          <Link key={k} href={`/pulse?by=${k}`} scroll={false} aria-current={by === k ? "page" : undefined} className={`rounded-[6px] px-3 py-1.5 ${by === k ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"}`}>
            {l}
          </Link>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-6" data-testid="pulse-grid">
        {sorted.map((r) => {
          const s = r.score ?? 50;
          const tone = s >= 50 ? `rgba(79, 214, 154, ${((s - 50) / 50) * 0.55 + 0.04})` : `rgba(242, 130, 106, ${((50 - s) / 50) * 0.55 + 0.04})`;
          return (
            <li key={r.symbol}>
              <Link href={`/markets/${r.symbol.toLowerCase()}`} className="block min-w-0 rounded-[10px] border border-line p-3 transition-colors hover:border-line-2" style={{ background: tone }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">{r.symbol}</span>
                  <span className="num text-[18px] text-ink">{r.score ?? "–"}</span>
                </div>
                <p className={`num mt-1 text-[12.5px] ${r.r1 == null ? "text-ink-3" : r.r1 >= 0 ? "text-up" : "text-down"}`}>{pc(r.r1)} 1D</p>
                <p className="num truncate text-[12px] text-ink-2">
                  {money(r.price)} · 5D {pc(r.r5)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Why it may be moving" note="headlines for the three biggest 1-session movers">
          <div className="space-y-4">
            {news.map(({ m, items }) => (
              <div key={m.symbol}>
                <p className="text-[14px] font-semibold text-ink">
                  {m.symbol} <span className={`num font-normal ${(m.r1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{pc(m.r1)}</span>
                </p>
                {items.length ? (
                  <ul className="mt-1 space-y-1">
                    {items.map((n) => (
                      <li key={n.url} className="text-[13px] leading-snug">
                        <a href={n.url} target="_blank" rel="noreferrer nofollow" className="text-ink-2 hover:text-stamp">
                          {n.title}
                        </a>{" "}
                        <span className="text-ink-3">· {n.publisher}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-ink-3">No headlines found.</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-ink-3">Headlines are listed as published, not summarised or scored. A headline next to a move is not proof of its cause.</p>
        </Panel>
        <Panel title="Turn a hunch into a record">
          <p className="text-[14px] leading-relaxed text-ink-2">Expect a big mover to keep running, or to turn? Give it a range in the Arena and the Chainlink price will grade it.</p>
          <Link href="/arena" className="btn btn-accent btn-sm mt-4">
            Open the Arena
          </Link>
          <p className="mt-4 text-[12px] text-ink-3">Prices come from each token&apos;s newest Chainlink answer on {CHAIN.name}. Momentum describes the past; it is not a forecast.</p>
        </Panel>
      </div>
    </>
  );
}
