import { BRAND, CHAIN } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { MarketsTable, type MarketRow } from "@/components/app/MarketsTable";
import { AppHead, signPct } from "@/components/app/ui";
import { JsonLd } from "@/components/JsonLd";
import { allQuotes } from "@/lib/feeds/nasdaq";
import { latestAll } from "@/lib/forecast/history";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/markets",
  title: `Stock token markets | ${BRAND.name}`,
  description: `Every stock token on ${CHAIN.name} that ${BRAND.name} forecasts: the US listing it tracks, today's move, volume and the Chainlink feed price side by side.`,
});

export default async function MarketsPage() {
  const [quotes, feeds] = await Promise.all([allQuotes(), latestAll()]);
  const rows: MarketRow[] = STOCKS.map((s) => {
    const q = quotes.get(s.symbol);
    return {
      symbol: s.symbol,
      name: q?.company ?? s.name,
      kind: s.kind,
      last: q?.last ?? null,
      changePct: q?.changePct ?? null,
      volume: q?.volume ?? null,
      feed: feeds.get(s.symbol)?.p ?? null,
      spark: q ? q.points.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 60)) === 0) : [],
    };
  });
  const moved = rows.filter((r) => r.changePct != null);
  const adv = moved.filter((r) => (r.changePct ?? 0) > 0).length;
  const avg = moved.length ? moved.reduce((a, r) => a + (r.changePct ?? 0), 0) / moved.length : null;
  const sorted = [...moved].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
  const asOf = [...quotes.values()].find((q) => q?.asOf)?.asOf ?? "–";
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Markets", path: "/markets" }])} />
      <AppHead
        chips={<span className="chip chip-live">Live listings</span>}
        title="Markets"
        desc={`The ${STOCKS.length} US shares and ETFs behind the stock tokens on ${CHAIN.name}. Listing prices come from Nasdaq; the feed column is the Chainlink price the forecasts are scored against.`}
        stats={[
          { k: "Advancers", v: `${adv} / ${moved.length}` },
          { k: "Decliners", v: `${moved.length - adv} / ${moved.length}` },
          { k: "Average 1D", v: <span className={avg != null && avg < 0 ? "text-down" : "text-up"}>{signPct(avg)}</span> },
          { k: "Top gainer", v: sorted[0] ? `${sorted[0].symbol} ${signPct(sorted[0].changePct)}` : "–" },
          { k: "Top decliner", v: sorted.length ? `${sorted[sorted.length - 1].symbol} ${signPct(sorted[sorted.length - 1].changePct)}` : "–" },
          { k: "Last print", v: asOf.replace(/^.*?(\d{1,2}:\d{2} [AP]M ET)$/, "$1") },
        ]}
      />
      <div className="mt-6">
        <MarketsTable rows={rows} />
      </div>
    </>
  );
}
