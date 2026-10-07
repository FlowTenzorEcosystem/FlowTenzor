import { BRAND, CHAIN } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { PortfolioView } from "@/components/app/PortfolioView";
import { AppHead } from "@/components/app/ui";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/portfolio",
  title: `Portfolio | ${BRAND.name}`,
  description: `Look up what any ${CHAIN.name} wallet holds in stock tokens, USDG and ETH, priced now, beside the forecast ranges.`,
  noindex: true,
});

export default function PortfolioPage() {
  return (
    <>
      <AppHead
        chips={
          <>
            <span className="chip chip-live">Live</span>
            <span className="kicker">Chain {CHAIN.id} · read-only</span>
          </>
        }
        title="Portfolio"
        desc={`Look up any ${CHAIN.name} wallet. Its ${STOCKS.length} possible stock tokens are priced at what the pools would pay right now, USDG counts as one dollar and ETH goes at the spot rate. Nothing to sign.`}
      />
      <div className="mt-6">
        <PortfolioView />
      </div>
    </>
  );
}
