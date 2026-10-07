import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { oracleLive } from "@/config/contracts";
import { STOCKS } from "@/config/stocks";
import { FeedBoard } from "@/components/app/FeedBoard";
import { AppHead } from "@/components/app/ui";
import { JsonLd } from "@/components/JsonLd";
import { feedRows } from "@/lib/forecast/feed";
import { horizonByKey, type HorizonId } from "@/lib/forecast/scoring";
import { appLd, breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/forecasts",
  title: `Stock token forecasts | ${BRAND.name}`,
  description: `${BRAND.name} forecast feed: an 80 % price range for every stock token on ${CHAIN.name} at one hour, one day and one week, beside the live Chainlink price.`,
});

export default async function ForecastsPage({ searchParams }: { searchParams: Promise<{ h?: string }> }) {
  const { h } = await searchParams;
  const horizon = (horizonByKey(h ?? "1h")?.id ?? 0) as HorizonId;
  const { rows, practiceLive, at } = await feedRows();
  const fresh = rows.filter((r) => r.updatedAt && at - r.updatedAt < 4 * 86_400).length;
  const covered = new Set(rows.filter((r) => Object.values(r.cells).some((c) => c && c.practice > 0)).map((r) => r.symbol)).size;
  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: "Forecasts", path: "/forecasts" }]), appLd]} />
      <AppHead
        chips={
          <>
            <span className="chip chip-live">Live</span>
            <span className="kicker">House baselines + practice forecasters{oracleLive() ? " + on-chain models" : ""}</span>
          </>
        }
        title="Forecasts"
        desc={`An 80 % price range for every stock token with a Chainlink feed on ${CHAIN.name}. Four house baselines fill the feed for every token; practice forecasts signed by wallets join beside them${oracleLive() ? ", and models committing to the oracle" : " until the oracle is deployed"}.`}
        actions={
          <Link href="/arena" className="btn btn-accent btn-sm">
            Add your forecast
          </Link>
        }
        stats={[
          { k: "Live practice forecasts", v: practiceLive },
          { k: "Tokens with forecasters", v: `${covered} / ${STOCKS.length}` },
          { k: "Feeds fresh", v: `${fresh} / ${STOCKS.length}`, note: "updated within 4 days" },
          { k: "Feed hours", v: "24/5", note: "Sun 20:00 – Fri 20:00 NY" },
        ]}
      />
      <div className="mt-6">
        <FeedBoard rows={rows} initialHorizon={horizon} />
      </div>
      <p className="mt-4 max-w-[900px] text-[13px] leading-relaxed text-ink-3">
        Baseline range: the average of the four house baselines at 80 % confidence, sized from realised volatility in the Chainlink rounds. Practice
        view: open practice forecasts and which way they lean. Signal: consensus when three in four of at least three forecasters lean one way,
        divergence when their centres disagree by more than half their ranges. Statistical yardsticks and practice data, not advice.
      </p>
    </>
  );
}
