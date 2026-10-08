import Link from "next/link";
import { BRAND, CHAIN, PONS, TOKEN, USDG } from "@/config/brand";
import { CONTRACTS, DEPLOY, bondLive } from "@/config/contracts";
import { CaConsole } from "@/components/CopyCa";
import { Mark } from "@/components/Mark";
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
      />
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          <section className="panel overflow-hidden" data-testid="token-price">
            <div className="flex flex-wrap items-center gap-4 p-4">
              <span className="grid size-11 place-items-center rounded-[8px] border border-line bg-black">
                <Mark size={28} />
              </span>
              <div>
                <p className="label">Price</p>
                <p className="num mt-1 text-[26px] leading-none text-ink">{live ? "Live on Pons" : "At launch"}</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-1.5">
                {["5m", "1h", "6h", "24h"].map((k) => (
                  <span key={k} className="chip !py-0.5 before:hidden">
                    {k} –
                  </span>
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-2 border-t border-line md:grid-cols-4">
              {[
                ["FDV", "–"],
                ["Liquidity", "–"],
                ["Staking rewards", "None"],
                ["Model bond", bondLive() ? "Live" : "After launch"],
              ].map(([k, v], i) => (
                <div key={k} className={`px-4 py-3 ${i ? "border-l border-line" : ""} ${i === 2 ? "max-md:border-l-0 max-md:border-t" : ""} ${i === 3 ? "max-md:border-t" : ""}`}>
                  <dt className="label">{k}</dt>
                  <dd className="num mt-1.5 text-[18px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <Panel title="Chart" note={live ? "launchpad" : "at launch"}>
            <div className="relative grid h-[300px] place-items-center overflow-hidden rounded-[5px] border border-dashed border-line-2 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]">
              <p className="max-w-[360px] text-center text-[13px] text-ink-3">
                {live
                  ? "The price chart lives on the launchpad page until the pool graduates."
                  : "The chart starts with the first trade. Nothing is drawn before then, so nothing here can be a guess."}
              </p>
            </div>
          </Panel>
          <Panel title="What the token is for">
            <ul className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
              <li>
                <span className="font-medium text-ink">Model bond.</span> A model owner locks {Number(BigInt(DEPLOY.bondAmount) / 10n ** 18n).toLocaleString("en-US")} {BRAND.symbol} in the
                ModelBond contract to mark the model as bonded on the leaderboard and in follow mode. The full amount comes back after a {DEPLOY.exitDelay / 86_400}-day exit delay. Never
                slashed, never paid.
              </li>
              <li>
                <span className="font-medium text-ink">Holder access.</span> Higher limits for holders are planned; the thresholds are set at launch and read from the wallet balance, with no
                staking or locking.
              </li>
              <li>
                <span className="font-medium text-ink">Not for.</span> Paying for API calls (that is USDG), earning model rewards, or voting on scores. Scores come from the Chainlink rule only.
              </li>
            </ul>
            {bondLive() ? <p className="mt-3 text-[12.5px] text-ink-3">ModelBond: {CONTRACTS.bond.address}</p> : null}
          </Panel>
        </div>
        <div className="min-w-0 space-y-3">
          <Panel title="Contract" note="the only official address">
            <CaConsole testid="ca-console-token-page" />
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <a
                href={live ? PONS.page(BRAND.ca) : "/swap"}
                {...(live ? { target: "_blank", rel: "noreferrer" } : {})}
                className="abtn abtn-face"
              >
                {live ? "Buy on Pons ↗" : "Swap screen"}
              </a>
              {TOKEN.explorerUrl ? (
                <a href={TOKEN.explorerUrl} target="_blank" rel="noreferrer" className="abtn">
                  Explorer ↗
                </a>
              ) : (
                <span className="abtn cursor-default opacity-50">Explorer ↗</span>
              )}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
              {live ? `Any other address calling itself ${BRAND.symbol} is not ${BRAND.symbol}.` : `Until the address appears here, every "${BRAND.symbol}" you see elsewhere is someone else's token.`}
            </p>
          </Panel>
          <Panel title="Your balance" note="read on chain">
            <HolderPanel />
          </Panel>
          <Panel title="Market" note={live ? "launchpad and pools" : "at launch"}>
            {live ? (
              <p className="text-[13px] text-ink-2">
                {BRAND.symbol} trades on its Pons bonding curve until it graduates, then in a Uniswap v4 pool. The swap page quotes it live from your wallet.{" "}
                <a className="link" href={PONS.page(BRAND.ca)} target="_blank" rel="noreferrer">
                  Price, liquidity and trades on the launchpad
                </a>
                .
              </p>
            ) : (
              <p className="text-[13px] text-ink-2">Price, liquidity, volume, holders and pools appear here once the token is live.</p>
            )}
          </Panel>
          <Panel title="Other addresses" note="copy to check">
            <div className="space-y-1.5">
              <CaConsole value={USDG.address} label="USDG" fit="short" testid="ca-console-usdg" />
              <CaConsole value={PONS.factory} label="Pons" fit="short" kind="address" testid="ca-console-pons" />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
