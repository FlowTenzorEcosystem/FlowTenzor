import Link from "next/link";
import { BRAND, CHAIN, PONS, TOKEN } from "@/config/brand";
import { CONTRACTS, DEPLOY, bondLive } from "@/config/contracts";
import { CopyCaBlock } from "@/components/CopyCa";
import { HolderPanel } from "@/components/app/HolderPanel";
import { AppHead, Panel } from "@/components/app/ui";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/token",
  title: `${BRAND.name} (${BRAND.symbol}) Token`,
  description: `${BRAND.name} (${BRAND.symbol}) token on ${CHAIN.name}: the official contract address, where it trades, what it is used for and what it is not.`,
});

export default function TokenPage() {
  const live = TOKEN.isLive;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: `${BRAND.symbol} token`, path: "/token" }])} />
      <AppHead
        chips={<span className="kicker">{CHAIN.name} · chain {CHAIN.id}</span>}
        title={`${BRAND.name} (${BRAND.symbol}) Token`}
        desc={`${BRAND.symbol} is the project token of ${BRAND.name}. Its planned job is the model bond: a refundable amount locked behind a model to show it is a serious entry. It pays no reward and nothing is minted to holders.`}
        actions={
          <>
            <Link href="/swap" className={`btn btn-accent btn-sm ${live ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!live}>
              Swap for {BRAND.symbol}
            </Link>
            {live ? (
              <a href={PONS.page(BRAND.ca)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                Launchpad page ↗
              </a>
            ) : null}
          </>
        }
        stats={[
          { k: "Price", v: live ? "see the launchpad" : "At launch" },
          { k: "Contract", v: live ? "published" : "Contract address coming soon" },
          { k: "Staking rewards", v: "None" },
          { k: "Model bond", v: bondLive() ? "live" : "after launch" },
        ]}
      />
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-5">
          <Panel title="Contract" note="the only official address">
            <CopyCaBlock />
            <p className="mt-3 text-[13px] text-ink-3">
              {live ? `Any other address calling itself ${BRAND.symbol} is not ${BRAND.symbol}.` : `Until the address appears here, every "${BRAND.symbol}" you see elsewhere is someone else's token.`}
            </p>
          </Panel>
          <Panel title="Your balance" note="read on chain">
            <HolderPanel />
          </Panel>
        </div>
        <div className="min-w-0 space-y-5">
          <Panel title="Market" note={live ? "launchpad and pools" : "at launch"}>
            {live ? (
              <p className="text-[14px] text-ink-2">
                {BRAND.symbol} trades on its Pons bonding curve until it graduates, then in a Uniswap v4 pool. The swap page quotes it live from your wallet.{" "}
                <a className="link" href={PONS.page(BRAND.ca)} target="_blank" rel="noreferrer">
                  Price, liquidity and trades on the launchpad
                </a>
                .
              </p>
            ) : (
              <p className="text-[14px] text-ink-2">Price, liquidity, volume, holders and pools appear here once the token is live. Nothing is shown before then, so nothing here can be a guess.</p>
            )}
          </Panel>
          <Panel title="What the token is for">
            <ul className="space-y-3 text-[14px] leading-relaxed text-ink-2">
              <li>
                <span className="font-semibold text-ink">Model bond.</span> A model owner locks {Number(BigInt(DEPLOY.bondAmount) / 10n ** 18n).toLocaleString("en-US")} {BRAND.symbol} in the
                ModelBond contract to mark the model as bonded on the leaderboard and in follow mode. The full amount comes back after a {DEPLOY.exitDelay / 86_400}-day exit delay. Never
                slashed, never paid.
              </li>
              <li>
                <span className="font-semibold text-ink">Holder access.</span> Higher limits for holders are planned; the thresholds are set at launch and read from the wallet balance, with no
                staking or locking.
              </li>
              <li>
                <span className="font-semibold text-ink">Not for.</span> Paying for API calls (that is USDG), earning model rewards, or voting on scores. Scores come from the Chainlink rule only.
              </li>
            </ul>
            {bondLive() ? <p className="mt-3 text-[12.5px] text-ink-3">ModelBond: {CONTRACTS.bond.address}</p> : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
