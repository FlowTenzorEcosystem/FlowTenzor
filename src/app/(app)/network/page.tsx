import Link from "next/link";
import { BRAND, CHAIN, shortAddress } from "@/config/brand";
import { CONTRACTS, bondLive, oracleLive } from "@/config/contracts";
import { STOCKS } from "@/config/stocks";
import { Panel } from "@/components/app/ui";
import { Lattice } from "@/components/landing/Fx";
import { Mark } from "@/components/Mark";
import { FanChart } from "@/components/forecast/charts";
import { JsonLd } from "@/components/JsonLd";
import { ticker } from "@/lib/feeds/okx";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/network",
  title: `Model network and Bittensor | ${BRAND.name}`,
  description: `Who forecasts on ${BRAND.name}: an open model network on ${CHAIN.name} scored by Chainlink, what is live today, and where a Bittensor subnet fits as an integration target.`,
});

async function taoCandles() {
  try {
    const res = await fetch("https://www.okx.com/api/v5/market/candles?instId=TAO-USDT&bar=4H&limit=180", { next: { revalidate: 900 }, signal: AbortSignal.timeout(9000) });
    const body = (await res.json()) as { data?: string[][] };
    return (body.data ?? []).map((r) => ({ t: Math.floor(Number(r[0]) / 1000), p: Number(r[4]) })).reverse();
  } catch {
    return [];
  }
}

export default async function NetworkPage() {
  const [tao, pts] = await Promise.all([ticker("TAO-USDT").catch(() => null), taoCandles()]);
  const live = oracleLive();
  const hi = pts.length ? Math.max(...pts.map((p) => p.p)) : null;
  const lo = pts.length ? Math.min(...pts.map((p) => p.p)) : null;
  const chg = pts.length > 1 ? (pts[pts.length - 1].p / pts[0].p - 1) * 100 : null;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Model network", path: "/network" }])} />
      <section className="panel relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 hidden h-full w-[46%] lg:block">
          <Lattice />
          <p className="label absolute right-4 bottom-3">Model lattice · live render</p>
        </div>
        <div className="relative max-w-[600px] p-6 max-sm:p-4">
          <p className="flex flex-wrap items-center gap-2">
            <span className="grid size-6 place-items-center rounded-[5px] bg-gradient-to-b from-white to-[#cfcfcf] text-black">
              <Mark size={16} />
            </span>
            <span className={`chip before:hidden ${live ? "chip-live" : "chip-practice"}`}>{live ? "Oracle deployed" : "Oracle: practice until deployed"}</span>
            <span className="chip chip-target before:hidden">Subnet: integration target</span>
          </p>
          <h1 className="mt-5 text-[clamp(26px,2.6vw,34px)] leading-[1.12] font-medium tracking-[-0.03em] text-ink">The model field behind every forecast</h1>
          <p className="mt-3 text-[14px] leading-[1.5] text-ink-3">
            Every forecast on {BRAND.name} is made by a model, graded in public against Chainlink and ranked by that grade alone. Today the field is open to
            any address that can sign on {CHAIN.name}. Running models as miners on a Bittensor subnet is a target, not a live service.
          </p>
          <dl className="mt-5 grid max-w-[460px] grid-cols-2 overflow-hidden rounded-[6px] border border-line">
            <div className="px-3 py-3">
              <dt className="label">TAO / USD</dt>
              <dd className="num mt-1.5 text-[22px] leading-none text-ink">{tao ? `$${tao.last.toFixed(2)}` : "–"}</dd>
              <dd className={`num mt-1 text-[11.5px] ${(tao?.change24h ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                {tao?.change24h != null ? `${tao.change24h >= 0 ? "▲ +" : "▼ −"}${Math.abs(tao.change24h).toFixed(2)}%` : "OKX spot, off-chain"}
              </dd>
            </div>
            <div className="border-l border-line px-3 py-3">
              <dt className="label">Subnet</dt>
              <dd className="mt-1.5 text-[18px] leading-none text-ink">Target</dd>
              <dd className="mt-1 text-[11.5px] text-faint">no id until it exists</dd>
            </div>
          </dl>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-faint">
            <span>Scoring: Chainlink · {STOCKS.length} feeds</span>
            <span>Payment: USDG</span>
            <span>Staking: none</span>
          </dl>
        </div>
        <div className="relative h-[260px] border-t border-line lg:hidden">
          <Lattice />
        </div>
      </section>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="TAO / USD · 4-hour closes" note="OKX · one month">
          {pts.length > 1 ? <FanChart points={pts} ranges={[]} now={pts[pts.length - 1].t} title="TAO price over one month" height={260} /> : <p className="text-[13px] text-ink-3">The TAO market could not be read right now.</p>}
          <p className="num mt-2 text-[12.5px] text-ink-3">
            1M change {chg == null ? "–" : `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`} · high {hi?.toFixed(2) ?? "–"} · low {lo?.toFixed(2) ?? "–"}
          </p>
          <p className="mt-2 text-[12.5px] text-ink-3">Shown for context: TAO is the Bittensor network&apos;s asset. Nothing on this site prices, pays or holds TAO.</p>
        </Panel>
        <div className="min-w-0 space-y-3">
          <Panel title="On Robinhood Chain" note="live">
            <dl className="text-[13px]">
              {[
                ["ForecastOracle", live ? shortAddress(CONTRACTS.oracle.address) : "not deployed yet"],
                ["ModelBond", bondLive() ? shortAddress(CONTRACTS.bond.address) : "after the token launches"],
                ["Who can join", "any wallet, by registering a model"],
                ["Markets", `${STOCKS.length} stock tokens`],
                ["Horizons", "1 hour · 1 day · 1 week"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="num text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Bittensor subnet" note="not live">
            <dl className="text-[13px]">
              {[
                ["Subnet id", "—"],
                ["Miners", "—"],
                ["Validators", "—"],
                ["Bridge for TAO", "none exists today"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[12.5px] text-ink-3">Left blank on purpose. Not one of these is a guess.</p>
          </Panel>
        </div>
      </div>
      <Panel title="From a model to a scored record" className="mt-3">
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            ["Models forecast", "An operator registers a model and commits ranges for any listed token. Today: any wallet. Later: subnet miners relayed under their own model ids."],
            ["Chainlink judges", "After the horizon, the round current at that moment decides the score. The contract checks the round itself."],
            ["Scores rank", "Average score per horizon, with the sample size beside it. No votes, no stake, no override."],
            ["Read on chain", `The forecast feed, the oracle views, the leaderboard and paper follow all sit on ${CHAIN.name}; paid API calls are settled in USDG.`],
          ].map(([k, v], i) => (
            <li key={k} className="min-w-0">
              <span className="num text-[11px] text-faint">0{i + 1}</span>
              <p className="mt-1 text-[14px] font-medium text-ink">{k}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{v}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/docs/network/miners" className="abtn !text-ink">
            Run a model
          </Link>
          <Link href="/docs/network/subnet" className="abtn !text-ink">
            The subnet plan
          </Link>
        </div>
      </Panel>
    </>
  );
}
