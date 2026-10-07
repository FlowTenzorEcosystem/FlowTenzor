import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { oracleLive } from "@/config/contracts";
import { STOCKS, stockBySymbol } from "@/config/stocks";
import { ArenaBoard } from "@/components/app/ArenaBoard";
import { AppHead } from "@/components/app/ui";
import { getStore } from "@/lib/auth/store";
import { getBoard } from "@/lib/forecast/board";
import { HORIZONS, average, horizonByKey, type HorizonId } from "@/lib/forecast/scoring";
import { allForecasts } from "@/lib/practice/forecasts";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/arena",
  title: `Forecast arena | ${BRAND.name}`,
  description: `Put an 80 % range on any stock token on ${CHAIN.name}, signed by your wallet or committed to the oracle, and let the Chainlink price score it.`,
  noindex: true,
});

export default async function ArenaPage({ searchParams }: { searchParams: Promise<{ symbol?: string; h?: string }> }) {
  const { symbol, h } = await searchParams;
  const [board, practice] = await Promise.all([getBoard(), getStore() ? allForecasts(getStore()!) : Promise.resolve([])]);
  const tokens = board.rows.map((r) => ({ symbol: r.stock.symbol, price: r.price }));
  const wallets = new Set(practice.map((p) => p.wallet)).size;
  const scored = practice.filter((p) => p.status === "scored").length;
  const base = board.tallies["still-water"][0];
  const fresh = board.rows.filter((r) => r.updatedAt && board.at - r.updatedAt < 4 * 86_400).length;
  return (
    <>
      <AppHead
        chips={
          <>
            <span className="chip chip-live">Scored against Chainlink</span>
            <span className={`chip ${oracleLive() ? "chip-live" : "chip-practice"}`}>{oracleLive() ? "Oracle live" : "Practice: free signature"}</span>
          </>
        }
        title="Forecast arena"
        desc={`Put a range on a stock token, exactly as a model does: a bottom, a top and your odds of the price ending between them. ${oracleLive() ? "Commit it to the ForecastOracle with your wallet, or sign a free practice forecast." : "Sign it with your wallet for free; it is scored by the oracle's rule when the horizon passes."} One live forecast per token and horizon.`}
        actions={
          <>
            <Link href="/leaderboard" className="btn btn-ghost btn-sm">
              Leaderboard
            </Link>
            <Link href="/docs/how-it-works" className="btn btn-ghost btn-sm">
              Scoring
            </Link>
          </>
        }
        stats={[
          { k: "Feeds", v: `${fresh} / ${STOCKS.length} live`, note: "24/5" },
          { k: "Practice forecasters", v: wallets },
          { k: "Practice forecasts scored", v: scored },
          { k: "Baseline to beat (1h)", v: base.scored ? Math.round(average(base)).toLocaleString("en-US") : "–", note: "Still Water, random walk" },
        ]}
      />
      <div className="mt-6">
        <ArenaBoard tokens={tokens} initialSymbol={stockBySymbol(symbol ?? "")?.symbol ?? "NVDA"} initialHorizon={(horizonByKey(h ?? "1h")?.id ?? 0) as HorizonId} />
      </div>
      <p className="mt-5 text-[12.5px] text-ink-3">
        Horizons: {HORIZONS.map((x) => x.label).join(", ")}. A forecast made in a window where the feed publishes nothing new is void, never scored.
      </p>
    </>
  );
}
