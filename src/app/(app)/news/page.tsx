import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { HEADLINE, STOCKS, stockBySymbol } from "@/config/stocks";
import { AppHead, Panel } from "@/components/app/ui";
import { JsonLd } from "@/components/JsonLd";
import { headlines, type Headline } from "@/lib/feeds/nasdaq";
import { pulseRows } from "@/lib/forecast/pulse";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/news",
  title: `Stock token news | ${BRAND.name}`,
  description: `Headlines for the shares and ETFs behind the stock tokens on ${CHAIN.name}, per ticker, linked to the publisher. ${BRAND.name} never rewrites a story.`,
});

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ symbol?: string; q?: string }> }) {
  const { symbol, q = "" } = await searchParams;
  const pick = symbol ? stockBySymbol(symbol) : null;
  const tickers = pick ? [pick.symbol] : ["SPY", "QQQ"];
  const [lists, pulse] = await Promise.all([Promise.all(tickers.map((t) => headlines(t, 12))), pulseRows()]);
  const seen = new Set<string>();
  let items: (Headline & { tag: string })[] = [];
  lists.forEach((l, i) =>
    l.forEach((h) => {
      if (seen.has(h.url)) return;
      seen.add(h.url);
      items.push({ ...h, tag: tickers[i] });
    }),
  );
  const needle = q.trim().toLowerCase();
  if (needle) items = items.filter((h) => h.title.toLowerCase().includes(needle) || h.publisher.toLowerCase().includes(needle));
  const leading = [...pulse.rows].filter((r) => r.r1 != null).sort((a, b) => Math.abs(b.r1 ?? 0) - Math.abs(a.r1 ?? 0)).slice(0, 4);
  const mentioned = STOCKS.map((s) => ({ s: s.symbol, n: items.filter((h) => new RegExp(`\\b${s.symbol}\\b`).test(h.title)).length })).filter((x) => x.n > 0);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "News", path: "/news" }])} />
      <AppHead
        title="News"
        desc="Headlines for the listings behind the stock tokens, from Nasdaq's public news feed. Each one links to its publisher; nothing is rewritten or summarised here."
        actions={
          <Link href={`/news${pick ? `?symbol=${pick.symbol}` : ""}`} className="abtn !text-ink">
            ↻ Refresh
          </Link>
        }
      />
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[8px] border border-white/[0.08] bg-card px-3 py-2.5">
        <span className="label mr-2">Leading today</span>
        {leading.map((r) => (
          <Link key={r.symbol} href={`/news?symbol=${r.symbol}`} className="num rounded-[3px] border border-line px-1.5 py-0.5 text-[12px] text-ink hover:border-line-2">
            {r.symbol} <span className={(r.r1 ?? 0) >= 0 ? "text-up" : "text-down"}>{(r.r1 ?? 0) >= 0 ? "▲" : "▼"} {Math.abs((r.r1 ?? 0) * 100).toFixed(2)}%</span>
          </Link>
        ))}
        <span className="label ml-auto max-sm:hidden">
          {items.length} headlines · refresh 10 min
        </span>
      </div>
      <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
        <Link href="/news" aria-current={!pick ? "page" : undefined} className={`rounded-[4px] border px-2.5 py-1 text-[12.5px] ${!pick ? "border-white bg-white text-[#0a0a0a]" : "border-line text-ink-3 hover:text-ink"}`}>
          Markets
        </Link>
        {[...HEADLINE, ...STOCKS.map((s) => s.symbol).filter((s) => !HEADLINE.includes(s))].map((s) => (
          <Link
            key={s}
            href={`/news?symbol=${s}`}
            aria-current={pick?.symbol === s ? "page" : undefined}
            className={`num rounded-[4px] border px-2 py-1 text-[11.5px] ${pick?.symbol === s ? "border-white bg-white text-[#0a0a0a]" : "border-line text-ink-3 hover:text-ink"}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel min-w-0 overflow-hidden" data-testid="news-list">
          <div className="flex min-h-11 flex-wrap items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">{pick ? `${pick.symbol} · ${pick.name}` : "Markets"}</h2>
            <span className="label">{pick ? "Nasdaq" : "Shares and the economy"}</span>
            <form className="ml-auto flex gap-1.5" action="/news">
              {pick ? <input type="hidden" name="symbol" value={pick.symbol} /> : null}
              <input name="q" defaultValue={q} placeholder="Filter…" aria-label="Filter headlines" className="field !min-h-[28px] w-[180px] !py-0.5 !text-[12.5px]" />
              <button className="abtn !h-7" type="submit">
                Filter
              </button>
            </form>
          </div>
          {items.length ? (
            <ul className="divide-y divide-line">
              {items.map((h) => {
                const tags = STOCKS.filter((x) => new RegExp(`\\b${x.symbol}\\b`).test(h.title)).map((x) => x.symbol);
                return (
                  <li key={h.url} className="flex gap-3 px-3 py-3">
                    <span className="grid size-[38px] shrink-0 place-items-center rounded-[4px] border border-line bg-paper-2 text-ink-3" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <a href={h.url} target="_blank" rel="noreferrer nofollow" className="text-[14px] leading-snug text-ink hover:underline">
                        {h.title}
                      </a>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-3">
                        {h.publisher} · {h.ago}
                        {[h.tag, ...tags.filter((t) => t !== h.tag)].map((t) => (
                          <span key={t} className="num rounded-[3px] border border-line px-1 text-[10px] text-ink-2">
                            {t}
                          </span>
                        ))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-6 text-[13.5px] text-ink-3">No headlines right now. The source may be busy; try again in a few minutes.</p>
          )}
        </section>
        <div className="min-w-0 space-y-3">
          <Panel title="Mentioned in these headlines" pad={false}>
            {mentioned.length ? (
              <ul>
                {mentioned
                  .sort((x, y) => y.n - x.n)
                  .map((m) => {
                    const pr = pulse.rows.find((r) => r.symbol === m.s);
                    const max = Math.max(...mentioned.map((x) => x.n));
                    return (
                      <li key={m.s} className="grid grid-cols-[48px_minmax(0,1fr)_20px_64px] items-center gap-2 border-b border-line px-3 py-2 text-[12px] last:border-0">
                        <Link href={`/markets/${m.s.toLowerCase()}`} className="num font-medium text-ink hover:underline">
                          {m.s}
                        </Link>
                        <span className="h-[3px] rounded bg-paper-3">
                          <span className="block h-full rounded bg-ink-2" style={{ width: `${(m.n / max) * 100}%` }} />
                        </span>
                        <span className="num text-right text-ink-2">{m.n}</span>
                        <span className={`num text-right text-[11px] ${(pr?.r1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{pr?.r1 != null ? `${pr.r1 >= 0 ? "▲ +" : "▼ −"}${Math.abs(pr.r1 * 100).toFixed(2)}%` : "–"}</span>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="p-3 text-[13px] text-ink-3">No listed ticker named in the titles shown.</p>
            )}
          </Panel>
          <Panel title="Feeds" pad={false}>
            <dl className="text-[13px]">
              {[
                ["Source", "Nasdaq news by symbol"],
                ["Refresh", "every 10 minutes"],
                ["Rewritten", "never"],
                ["Effect on scores", "none: Chainlink only"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line px-3 py-2.5 last:border-0">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
