import { BRAND, CHAIN } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { MarketsTable, type MarketRow } from "@/components/app/MarketsTable";
import { signPct } from "@/components/app/ui";
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
      change: q?.change ?? null,
      prevClose: q?.prevClose ?? null,
      asOf: q?.asOf ?? "",
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
      <h1 className="sr-only">Markets: the listings behind the stock tokens</h1>
      <div className="-mx-4 -mt-4 -mb-10 max-sm:-mx-3">
        <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-3 xl:grid-cols-6">
          {(
            [
              ["Advancers", `${adv} / ${moved.length}`, ""],
              ["Decliners", `${moved.length - adv} / ${moved.length}`, ""],
              ["Avg 1D", signPct(avg), avg != null && avg < 0 ? "text-down" : "text-up"],
              ["Top gainer", sorted[0] ? `${sorted[0].symbol} ${signPct(sorted[0].changePct)}` : "–", ""],
              ["Top decliner", sorted.length ? `${sorted[sorted.length - 1].symbol} ${signPct(sorted[sorted.length - 1].changePct)}` : "–", ""],
              ["Last print", asOf.replace(/^.*?(\d{1,2}:\d{2} [AP]M ET)$/, "$1"), ""],
            ] as [string, string, string][]
          ).map(([k, v, c]) => (
            <div key={k} className="min-w-0 border-r border-b border-line px-3 py-2 xl:border-b-0">
              <dt className="label">{k}</dt>
              <dd className={`num mt-1.5 truncate text-[13px] text-ink ${c}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <MarketsTable rows={rows} />
      </div>
    </>
  );
}
