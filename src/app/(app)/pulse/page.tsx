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
  const ups = scored.filter((r) => (r.r1 ?? 0) > 0).length;
  const downs = scored.filter((r) => (r.r1 ?? 0) < 0).length;
  const live = rows.filter((r) => r.updatedAt && at - r.updatedAt < 4 * 86_400).length;
  const movers = [...scored].sort((a, b) => Math.abs(b.r1 ?? 0) - Math.abs(a.r1 ?? 0)).slice(0, 5);
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
        title="Flow Pulse"
        desc="Every stock token on one screen, strongest momentum first. A tile's brightness is its score: the last one and five sessions of return, each scaled by the token's own volatility. 50 means no lean either way."
        actions={
          <div className="seg" role="group" aria-label="Order by">
            {[
              ["momentum", "Momentum"],
              ["1d", "1D"],
              ["5d", "5D"],
            ].map(([k, l]) => (
              <Link key={k} href={`/pulse?by=${k}`} scroll={false} aria-current={by === k ? "page" : undefined} className="min-w-[72px] text-center !font-sans">
                {l}
              </Link>
            ))}
          </div>
        }
      />
      <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-[8px] border border-white/[0.08] bg-card md:grid-cols-4">
        <div className="px-3 py-2.5">
          <dt className="label">Pulse</dt>
          <dd className="mt-1.5 flex items-baseline gap-2">
            <span className="num text-[20px] leading-none text-ink">{avg ?? "–"}</span>
            <span className="text-[11.5px] text-ink-3">{avg == null ? "" : avg > 55 ? "leaning up" : avg < 45 ? "leaning down" : "mixed"}</span>
          </dd>
        </div>
        <div className="border-l border-line px-3 py-2.5">
          <dt className="label">Breadth</dt>
          <dd className="num mt-1.5 text-[13px] text-ink">
            ▲ {ups} <span className="text-down">▼ {downs}</span>
          </dd>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper-3">
            <div className="h-full bg-ink" style={{ width: `${scored.length ? (ups / scored.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="border-line px-3 py-2.5 max-md:border-t md:border-l">
          <dt className="label">Strongest</dt>
          <dd className="num mt-1.5 text-[13px] text-ink">{strongest ? `${strongest.symbol} · ${strongest.score}` : "–"}</dd>
        </div>
        <div className="border-l border-line px-3 py-2.5 max-md:border-t">
          <dt className="label">Feeds live</dt>
          <dd className="num mt-1.5 text-[13px] text-ink">
            {live} / {STOCKS.length}
          </dd>
        </div>
      </dl>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_264px]">
        <ul className="grid grid-cols-3 content-start gap-1.5 sm:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-7" data-testid="pulse-grid">
          {sorted.map((r) => {
            const s = r.score ?? 50;
            const a = 0.05 + (s / 100) * 0.72;
            const dark = a > 0.42;
            return (
              <li key={r.symbol}>
                <Link
                  href={`/markets/${r.symbol.toLowerCase()}`}
                  className={`block min-w-0 rounded-[5px] border px-2 py-1.5 transition-[filter] hover:brightness-110 ${dark ? "border-white/30 text-[#0a0a0a]" : "border-line-2 text-ink"}`}
                  style={{ background: `rgba(255,255,255,${a.toFixed(3)})` }}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="num text-[11.5px] font-semibold">{r.symbol}</span>
                    <span className="num text-[9.5px] opacity-60">{r.score ?? "–"}</span>
                  </div>
                  <p className="num text-[15px] leading-tight">{pc(r.r1)}</p>
                  <p className="num truncate text-[10px] opacity-55">
                    {money(r.price)} · 5d {pc(r.r5)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="min-w-0 space-y-3">
          <Panel title="Why it may be moving" note="headlines" pad={false}>
            <ul className="divide-y divide-line">
              {news.map(({ m, items }) => (
                <li key={m.symbol} className="px-3 py-3">
                  <p className="flex justify-between text-[13px] font-medium text-ink">
                    {m.symbol} <span className={`num font-normal ${(m.r1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{pc(m.r1)}</span>
                  </p>
                  {items.length ? (
                    <ul className="mt-1.5 space-y-1">
                      {items.map((n) => (
                        <li key={n.url} className="min-w-0 text-[11.5px] leading-snug">
                          <a href={n.url} target="_blank" rel="noreferrer nofollow" className="block truncate text-ink-3 hover:text-ink">
                            {n.publisher}: {n.title} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[12.5px] text-ink-3">No headline found for today.</p>
                  )}
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-3 py-2.5 text-[11.5px] text-faint">Headlines as published, not summarised. A headline beside a move does not prove its cause.</p>
          </Panel>
          <Panel title="Turn a hunch into a record">
            <p className="text-[13px] leading-relaxed text-ink-2">Think a big mover keeps running, or turns? Give it a range in the Arena and the Chainlink price grades it.</p>
            <Link href="/arena" className="abtn abtn-face mt-3">
              Open the Arena
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
