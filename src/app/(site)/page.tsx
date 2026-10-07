import { Suspense } from "react";
import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { oracleLive } from "@/config/contracts";
import { HEADLINE, STOCKS } from "@/config/stocks";
import { Btn } from "@/components/kit";
import { BoardFacts, BoardSkeleton, Fact, FeedTable, HeroFan } from "@/components/forecast/live";
import { HOME_DESCRIPTION, HOME_TITLE, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

const STYLES = ["Momentum", "Mean reversion", "Volatility", "Order flow", "Earnings drift", "Macro", "Sentiment", "Pairs", "Seasonality", "Regime switching"];

const TOOLS = [
  { name: "Forecast feed", body: "An 80 % range for every stock token at one hour, one day and one week, with the price it was made against.", href: "/forecasts" },
  { name: "On-chain oracle", body: "Forecasts and scores stored in ForecastOracle, readable by any contract on Robinhood Chain.", href: "/docs/developers/oracle" },
  { name: "Consensus signal", body: "Raised when at least three forecasters are live on a token and three in four lean one way.", href: "/docs/forecasts/consensus" },
  { name: "Divergence flag", body: "Raised when forecasters' centres sit further apart than half their own ranges.", href: "/docs/forecasts/consensus" },
  { name: "Earnings-week mode", body: "The next estimated report date beside every share, and a flag when it falls inside the week.", href: "/docs/forecasts/earnings-and-macro" },
  { name: "Market-open gap", body: "An 80 % range for the move between now and the next 9:30 New York open.", href: "/docs/forecasts/earnings-and-macro" },
  { name: "Volatility forecast", body: "A fast, exponentially weighted volatility estimate per token, next to the direction view.", href: "/markets/nvda" },
  { name: "Agent SDK", body: "One dependency-free file that reads ranges, scores and consensus from the oracle for an agent's decision rule.", href: "/docs/developers/agents" },
];

const BLOG = [
  { kicker: "Track record", title: "Checking any score yourself", body: "Why each forecast is fixed before its outcome, and how to re-score it from the feed contract alone.", href: "/docs/models/explorer" },
  { kicker: "Scoring", title: "The interval score, in plain words", body: "Why a confident miss costs more than a cautious one, and why some forecasts are void.", href: "/docs/how-it-works" },
  { kicker: "Follow", title: "Following with guardrails", body: "Stake, loss per trade, daily cap and auto-unfollow, and the vault that would enforce them.", href: "/docs/follow/limits" },
];

export default function Home() {
  const live = oracleLive();
  return (
    <>
      {/* 1. Hero: statement on the left, live forecast fan on the right */}
      <section className="border-b border-line">
        <div className="ctn grid grid-cols-1 gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <p className="kicker">
              {BRAND.name} · {BRAND.slogan}
            </p>
            <h1 className="h-hero mt-5 !text-[clamp(42px,5.4vw,74px)]">{BRAND.name}: stock forecasts from many competing models, graded in public</h1>
            <p className="lede mt-6 max-w-[600px]">
              {BRAND.tagline} Models put ranges on every stock token on {CHAIN.name}, the Chainlink price grades each one, and the best-scoring
              models climb the table.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn href="/forecasts">Launch the app</Btn>
              <Btn href="/docs" tone="ghost">
                Read the docs
              </Btn>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-2">
              <span className="chip chip-live">Prices: Chainlink, live</span>
              <span className={`chip ${live ? "chip-live" : "chip-practice"}`}>{live ? "Oracle: on chain" : "Oracle: practice until deployed"}</span>
            </p>
          </div>
          <div className="min-w-0">
            <Suspense fallback={<BoardSkeleton rows={8} />}>
              <HeroFan />
            </Suspense>
          </div>
        </div>
      </section>

      {/* 2. What it is: a record you can verify */}
      <section className="border-b border-line">
        <div className="ctn grid grid-cols-1 gap-10 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="min-w-0 lg:order-2">
            <p className="kicker">What {BRAND.name} is</p>
            <h2 className="h-sec mt-4">The stock forecaster whose record anyone can check</h2>
            <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-ink-2">
              <p>
                Most tools that call themselves AI give you one opinion from one model you will never see, with a hit rate nobody can rebuild.{" "}
                {BRAND.name} works the other way round: many independent models forecast the same tokens over the same horizons, every forecast is
                fixed before its outcome exists, and every one is scored by the same public rule against the same public price.
              </p>
              <p>A model earns its place one resolved forecast at a time. Misses are scored as plainly as hits, and no forecast can be withdrawn after it goes wrong.</p>
              <p>
                The yardstick is deliberately dull. Four house baselines (a random walk, a fast volatility model, a mean-reversion rule and a momentum
                rule) forecast every token on the same terms. They need no data beyond the Chainlink rounds and they never get tired, so any model that
                cannot beat them over a long run of scored calls has not shown skill, however good its story sounds. The leaderboard puts them in the
                same table as everyone else, labelled, so the gap between a real edge and a lucky stretch is visible at a glance.
              </p>
            </div>
          </div>
          <div className="min-w-0 lg:order-1">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Forecasting methods that can compete">
              {STYLES.map((s, i) => (
                <li key={s} className={`rounded-[10px] border border-line px-3 py-4 text-center text-[14px] ${i % 4 === 1 ? "bg-paper-2 text-ink" : "text-ink-2"}`}>
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13.5px] text-ink-3">Any method can enter. The score only asks where the price landed.</p>
          </div>
        </div>
      </section>

      {/* 3. Claims versus proof */}
      <section className="night border-b border-line">
        <div className="ctn py-16 md:py-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
            <div className="grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-line bg-line sm:grid-cols-2">
              {[
                ["What you usually get", "A headline hit rate over a chosen period, no losing calls on display."],
                ["What a scored record shows", "Every forecast, its range, its confidence and the Chainlink price it was judged by."],
                ["Usually", "One model, one opinion, nothing to compare it with."],
                ["Here", "Many models on the same tokens and horizons, ranked by one rule."],
                ["Usually", "Confidence that costs nothing when it is wrong."],
                ["Here", "A confident miss costs more than a cautious one, by design."],
              ].map(([k, v], i) => (
                <div key={i} className="min-w-0 bg-paper p-5">
                  <p className={`kicker ${i % 2 ? "!text-stamp" : ""}`}>{k}</p>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{v}</p>
                </div>
              ))}
            </div>
            <div className="min-w-0 lg:pt-6">
              <h2 className="h-sec">Every model says it has an edge</h2>
              <p className="mt-4 font-display text-[clamp(24px,2.6vw,34px)] leading-tight text-ink-3">Almost none can show it.</p>
              <p className="lede mt-6">A claimed accuracy is a number someone chose to tell you. A scored record is a number the market wrote, one horizon at a time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Ask + the feed, scored against Chainlink */}
      <section id="feed" className="border-b border-line">
        <div className="ctn py-16 md:py-24">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
            <div className="min-w-0">
              <h2 className="h-sec">Ask a question, read the answer from the best-scored forecasts</h2>
              <div className="mt-6 flex flex-wrap gap-3">
                <Btn href="/ask" tone="ink" small>
                  Ask {BRAND.name}
                </Btn>
                <Btn href="/forecasts" tone="ghost" small>
                  All {STOCKS.length} tokens
                </Btn>
              </div>
            </div>
            <p className="lede min-w-0">
              A price range and a confidence for every stock token on {CHAIN.name}, at one hour, one day and one week. The research console answers
              plain questions from live listings, the Chainlink feeds and the forecast board, instead of a single opinion.
            </p>
          </div>
          <div className="mt-10">
            <Suspense fallback={<BoardSkeleton rows={10} />}>
              <FeedTable symbols={HEADLINE.slice(0, 8)} horizon={1} />
            </Suspense>
          </div>
          <p className="mt-5 flex items-center gap-2 text-[14px] text-ink-2">
            <span className="chip chip-live">Chainlink</span> Each range is graded by that token&apos;s Chainlink price on {CHAIN.name}.
          </p>
        </div>
      </section>

      {/* 5. Build with scored forecasts */}
      <section id="developers" className="border-b border-line bg-paper-2">
        <div className="ctn py-16 md:py-24">
          <div className="max-w-[820px]">
            <h2 className="h-sec">Build agents and apps on forecasts that carry their own score</h2>
            <p className="lede mt-5">
              Read {BRAND.name} from a contract through the oracle, from a script through the agent SDK, or over HTTP through the forecast API, paid
              per call in USDG. The same numbers wherever you read them.
            </p>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((t, i) => (
              <li key={t.name} className="min-w-0 bg-paper-2">
                <Link href={t.href} className="flex h-full flex-col p-5 transition-colors hover:bg-paper-3">
                  <span className="num text-[12px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-3 text-[16px] font-semibold text-ink">{t.name}</span>
                  <span className="mt-2 text-[14px] leading-relaxed text-ink-2">{t.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Follow mode */}
      <section id="follow" className="border-b border-line">
        <div className="ctn grid grid-cols-1 gap-12 py-16 md:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div className="grid min-w-0 grid-cols-2 gap-3" aria-label="Follow mode features">
            {[
              ["Follow a model", "Copy a leading model into positions whose size you choose.", "col-span-2 sm:col-span-1"],
              ["Backtest", "Replay a leader over its scored record before you commit.", ""],
              ["Paper follow", "Simulated stake on real Chainlink outcomes.", ""],
              ["Your limits", "Stake per trade, max loss per trade, daily loss cap.", "col-span-2 sm:col-span-1 border-accent"],
              ["Auto-unfollow", "Ends the follow when the leader's score falls under your line.", ""],
              ["Multi-model", "Split the stake across up to three leaders.", ""],
            ].map(([k, v, extra]) => (
              <div key={k} className={`min-w-0 rounded-[12px] border border-line bg-card p-4 ${extra}`}>
                <p className="text-[15px] font-semibold text-ink">{k}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{v}</p>
              </div>
            ))}
          </div>
          <div className="min-w-0">
            <h2 className="h-sec">Follow the models that rank, on your own terms</h2>
            <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-ink-2">
              <p>
                Follow mode turns a leader&apos;s forecasts into positions sized by your rules: the most a trade may risk, the most it may lose, a loss cap for
                the day, and the score below which you stop following.
              </p>
              <p>For now it is paper follow, judged by actual outcomes. Mirroring into your own wallet needs a vault with your limits enforced on chain; its design is published, and it is not deployed.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn href="/follow">Try paper follow</Btn>
              <Btn href="/docs/follow/execution" tone="ghost">
                The vault design
              </Btn>
            </div>
          </div>
        </div>
      </section>

      {/* 7. The layer between models and the chain */}
      <section id="leaderboard" className="night border-b border-line">
        <div className="ctn py-16 md:py-24">
          <h2 className="h-sec max-w-[880px]">One layer between the models and {CHAIN.name}</h2>
          <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
            <div className="min-w-0 rounded-[12px] border border-line p-5">
              <p className="kicker">Who reads it</p>
              <ul className="mt-4 space-y-4">
                {[
                  ["Traders", "Read the feed, check the leaderboard, follow inside their limits."],
                  ["dApps and agents", "Read ranges, scores and consensus from the oracle."],
                  ["Developers", "Pull JSON from the API or build a model of their own."],
                  ["Model builders", "Register, commit, and let the score speak."],
                ].map(([k, v]) => (
                  <li key={k}>
                    <p className="font-semibold text-ink">{k}</p>
                    <p className="text-[14px] text-ink-2">{v}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  ["Forecast feed", "Ranges and signals for every token"],
                  ["Leaderboard", "Ranked by score, sample size beside it"],
                  ["Follow mode", "Paper today, a vault later"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[12px] border border-line bg-card p-4">
                    <p className="font-semibold text-ink">{k}</p>
                    <p className="mt-1 text-[13.5px] text-ink-2">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[12px] border border-accent/60 p-5">
                <p className="kicker !text-stamp">ForecastOracle on {CHAIN.name}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  Every forecast, with the Chainlink price it was made against and the round that resolved it. Open scoring: anyone settles, the contract
                  checks. No owner, no admin key, no fee.
                </p>
              </div>
              <div className="rounded-[12px] border border-dashed border-line-2 p-5">
                <p className="kicker">Model network</p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  Open to any wallet today. A Bittensor subnet, with miners forecasting and TAO emissions as their reward, is an integration target; Bittensor
                  is its own chain and TAO is not on {CHAIN.name}.
                </p>
              </div>
            </div>
          </div>
          <p className="num mt-8 text-[13px] text-ink-3">models · Chainlink feeds · stock-token pools · scores · leaderboard · oracle · API · SDK</p>
        </div>
      </section>

      {/* 8. Built to be checked */}
      <section className="border-b border-line">
        <div className="ctn py-16 md:py-24">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
            <h2 className="h-sec min-w-0">Numbers you can reproduce yourself</h2>
            <p className="lede min-w-0">The first three numbers are counted from the chain as this page loads. The rest are fixed in the contract code.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            <Suspense
              fallback={
                <>
                  <Fact value="…" label="stock tokens with a fresh Chainlink feed right now" />
                  <Fact value="…" label="Chainlink rounds read for the current board" />
                  <Fact value="…" label="baseline forecasts replayed and scored over the rounds read (up to 12 days)" />
                </>
              }
            >
              <BoardFacts />
            </Suspense>
            <Fact value="3" label="horizons per token: one hour, one day, one week" />
            <Fact value="1" label="way to pay for API calls: USDG, settled on chain" />
            <Fact value="0" label="admin keys, fees, staking rewards or upgrade switches in the oracle" />
          </div>
        </div>
      </section>

      {/* 9. Ticker */}
      <section className="border-b border-line bg-paper-2 py-5" aria-label={`Stock tokens ${BRAND.name} forecasts`}>
        <p className="ctn kicker mb-3">Forecasts for the stock tokens on {CHAIN.name}</p>
        <div className="overflow-hidden">
          <ul className="marquee flex w-max gap-10 pr-10">
            {[...STOCKS, ...STOCKS].map((s, i) => (
              <li key={`${s.symbol}-${i}`} aria-hidden={i >= STOCKS.length ? true : undefined}>
                <Link href={`/markets/${s.symbol.toLowerCase()}`} className="font-display text-[24px] whitespace-nowrap text-ink-2 hover:text-stamp">
                  {s.symbol}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 10. Questions */}
      <section className="border-b border-line">
        <div className="ctn py-16 md:py-24">
          <h2 className="h-sec max-w-[760px]">Questions people bring, and the part of the product that answers them</h2>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {[
              ["Consensus", "“Where are the best-ranked models leaning on chip and software tokens for the week, and how many have a live call?”", "Consensus signal · leaderboard", "/forecasts?h=1w", "md:row-span-2"],
              ["Earnings", "“Before NVDA reports, is the model I copy any good in earnings weeks, or should I step away for a few days?”", "Earnings-week mode · model record", "/markets/nvda", ""],
              ["Risk", "“Which of my holdings are the forecasters most split on right now?”", "Portfolio · divergence flag", "/portfolio", ""],
            ].map(([k, q, from, href, extra]) => (
              <Link key={k} href={href} className={`card group flex min-w-0 flex-col p-6 transition-colors hover:border-line-2 ${extra}`}>
                <span className="kicker">{k}</span>
                <span className="mt-4 font-display text-[22px] leading-snug text-ink">{q}</span>
                <span className="mt-auto pt-6 text-[13.5px] text-ink-3">
                  Answered by: {from} <span className="text-stamp">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Insights */}
      <section className="border-b border-line bg-paper-2">
        <div className="ctn py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="h-sec">Insights on the design</h2>
            <Link href="/docs" className="link text-[15px]">
              All docs
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-1 divide-y divide-line border-y border-line">
            {BLOG.map((n) => (
              <Link key={n.href} href={n.href} className="group grid grid-cols-1 gap-2 py-6 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-baseline sm:gap-8">
                <span className="kicker">{n.kicker}</span>
                <span className="min-w-0">
                  <span className="h-sub block group-hover:text-stamp">{n.title}</span>
                  <span className="mt-1 block text-[15px] text-ink-2">{n.body}</span>
                </span>
                <span className="text-[13px] text-ink-3">{BRAND.name} team →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 12. Closing */}
      <section className="night">
        <div className="ctn grid grid-cols-1 gap-8 py-20 md:py-28 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <h2 className="h-hero min-w-0 !text-[clamp(40px,5.6vw,76px)]">Forecasts are cheap. Scores are earned.</h2>
          <div className="flex min-w-0 flex-wrap gap-3 lg:justify-end">
            <Btn href="/forecasts">Explore the forecasts</Btn>
            <Btn href="/arena" tone="ghost">
              Enter the arena
            </Btn>
          </div>
        </div>
      </section>
    </>
  );
}
