import { BRAND } from "@/config/brand";
import { FollowTool } from "@/components/app/FollowTool";
import { JsonLd } from "@/components/JsonLd";
import Link from "next/link";
import { AppHead, Panel } from "@/components/app/ui";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/follow",
  title: `Follow mode | ${BRAND.name}`,
  description: `${BRAND.name} follow mode: pick a top-ranked model and set your own stake, loss per trade, daily loss cap and auto-unfollow. Paper trades, real Chainlink outcomes.`,
});

export default function FollowPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Follow mode", path: "/follow" }])} />
      <AppHead
        chips={
          <>
            <span className="chip chip-practice">Paper trades, real Chainlink outcomes</span>
            <span className="chip chip-target">Wallet mirroring: designed, not deployed</span>
          </>
        }
        title="Follow"
        desc="Choose as many as three leaders, write down your limits, then replay their resolved forecasts under those rules: a range leaning up becomes a long, one leaning down a short, and flat ranges are passed over. Mirroring into your wallet needs the follow vault, which is designed and not deployed."
        actions={
          <Link href="/leaderboard" className="btn btn-ghost btn-sm">
            Browse leaderboard
          </Link>
        }
      />
      <div className="mt-6">
        <FollowTool />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel title="Your guardrails">
          <ul className="space-y-2 text-[13.5px] leading-relaxed text-ink-2">
            <li><span className="text-ink">Stake per trade</span>: what each mirrored call puts at risk, split evenly across leaders.</li>
            <li><span className="text-ink">Max loss per trade</span>: a losing trade is cut at this share of its stake.</li>
            <li><span className="text-ink">Daily loss cap</span>: once a UTC day loses this much, its remaining calls are skipped.</li>
            <li><span className="text-ink">Unfollow below</span>: following stops when a leader&apos;s last ten scores average under your line.</li>
          </ul>
        </Panel>
        <Panel title="The vault design">
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            One vault per follower, holding USDG only the follower can withdraw. A keeper may open or close positions that match a leader&apos;s oracle forecast, inside the limits written into the vault and priced by Chainlink. The keeper can never take funds out.
          </p>
          <Link href="/docs/follow/execution" className="link mt-3 inline-block text-[13.5px]">
            Execution and liquidity
          </Link>
        </Panel>
      </div>
      <p className="mt-4 text-[12px] text-ink-3">These are paper numbers. Fees, slippage and funding are left out, and pool prices can drift from the feed. Yesterday&apos;s score says nothing certain about tomorrow. Not advice.</p>
    </>
  );
}
