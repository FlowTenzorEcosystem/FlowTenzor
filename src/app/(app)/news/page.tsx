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
        desc="Headlines for the listings behind the stock tokens, from Nasdaq's public news feed. Each links to its publisher; nothing is rewritten or summarised here."
        stats={[
          { k: "Showing", v: pick ? pick.symbol : "US markets" },
          { k: "Headlines", v: items.length },
          { k: "Leading today", v: leading.map((r) => r.symbol).join(" · ") || "–", note: "largest 1-session moves" },
          { k: "Refresh", v: "10 min" },
        ]}
      />
      <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Topics">
        <Link href="/news" className={`chip ${!pick ? "chip-live" : ""}`}>
          Markets
        </Link>
        {[...HEADLINE, ...STOCKS.map((s) => s.symbol).filter((s) => !HEADLINE.includes(s))].map((s) => (
          <Link key={s} href={`/news?symbol=${s}`} className={`chip ${pick?.symbol === s ? "chip-live" : ""}`}>
            {s}
          </Link>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
        <Panel title={pick ? `${pick.symbol} · ${pick.name}` : "Market-wide · shares and the economy"} note="Nasdaq" testid="news-list">
          <form className="mb-3 flex gap-2" action="/news">
            {pick ? <input type="hidden" name="symbol" value={pick.symbol} /> : null}
            <input name="q" defaultValue={q} placeholder="Filter headlines" aria-label="Filter headlines" className="field !min-h-[36px] max-w-[300px] !py-1 text-[13.5px]" />
            <button className="btn btn-ghost btn-sm" type="submit">
              Filter
            </button>
          </form>
          {items.length ? (
            <ul className="divide-y divide-line">
              {items.map((h) => (
                <li key={h.url} className="py-3">
                  <a href={h.url} target="_blank" rel="noreferrer nofollow" className="text-[15px] leading-snug text-ink hover:text-stamp">
                    {h.title}
                  </a>
                  <p className="mt-1 text-[12.5px] text-ink-3">
                    {h.publisher} · {h.ago} · <span className="num">{h.tag}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-[14px] text-ink-3">No headlines right now. The source may be busy; try again in a few minutes.</p>
          )}
        </Panel>
        <div className="min-w-0 space-y-5">
          <Panel title="Mentioned in these headlines">
            {mentioned.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {mentioned.map((m) => (
                  <li key={m.s}>
                    <Link href={`/markets/${m.s.toLowerCase()}`} className="chip">
                      {m.s} · {m.n}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-3">No listed ticker named in the titles shown.</p>
            )}
          </Panel>
          <Panel title="Feeds">
            <dl className="text-[13px]">
              {[
                ["Source", "Nasdaq news by symbol"],
                ["Refresh", "every 10 minutes"],
                ["Rewritten", "never"],
                ["Effect on scores", "none: scores come from Chainlink only"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0">
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
