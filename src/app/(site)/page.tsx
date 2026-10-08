import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { MarkHero } from "@/components/landing/MarkHero";
import { Mark } from "@/components/Mark";
import { ArrowButton, BarcodeBand, ClaimsScrolly, FollowBento, Globe, HeroField, Reveal } from "@/components/landing/Fx";
import { HOME_DESCRIPTION, HOME_TITLE, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

const ASK_EXAMPLES = [
  "Which model has the best one-day record on NVDA?",
  "Where do the top models lean on TSLA this week?",
  "How wide is the 80 % range on AAPL right now?",
  "Is HOOD trading above or below its forecast range?",
];

const TOOLS = [
  { name: "Forecast feed", body: "An 80 % range and a confidence for each stock token, at one hour, one day and one week.", href: "/forecasts" },
  { name: "On-chain oracle", body: "Ranges and scores stored in ForecastOracle, readable by any contract on Robinhood Chain.", href: "/docs/developers/oracle" },
  { name: "Consensus signal", body: "Raised when three in four live forecasters lean the same way.", href: "/docs/forecasts/consensus" },
  { name: "Divergence flag", body: "Marks the tokens where the leading models pull hardest in different directions.", href: "/docs/forecasts/consensus" },
  { name: "Earnings-week mode", body: "The next report date beside each share, and a flag inside that week.", href: "/docs/forecasts/earnings-and-macro" },
  { name: "Market-open gap", body: "A range for the move between now and the next 9:30 New York open.", href: "/docs/forecasts/earnings-and-macro" },
  { name: "Volatility forecast", body: "A fast volatility estimate per token, shown beside the direction view.", href: "/markets/nvda" },
  { name: "Agent SDK", body: "One read-only file that hands ranges, scores and consensus to an agent's rules.", href: "/docs/developers/agents" },
];

const ASKED = [
  {
    k: "Consensus",
    q: "“Where are the best-ranked models leaning on chip stocks this week, and how many of them have a live call?”",
    tool: `Ask ${BRAND.name}`,
    from: "consensus signal · leaderboard",
    href: "/ask?q=Where%20do%20the%20top%20models%20lean%20on%20NVDA%3F",
  },
  {
    k: "Earnings",
    q: "“How has my leader scored when a company reports, and is NVDA's report a week to sit out?”",
    tool: "Earnings-week mode",
    from: "scored model record",
    href: "/markets/nvda",
  },
  {
    k: "Risk",
    q: "“Which of my holdings are the forecasters most split on right now, and how wide are their ranges?”",
    tool: "Portfolio view",
    from: "forecast feed · divergence flag",
    href: "/portfolio",
  },
];

const NOTES = [
  {
    title: "A record you can recompute",
    body: `Why every ${BRAND.name} forecast is fixed before its outcome, and how to re-grade any model from the feed contract alone.`,
    href: "/docs/models/explorer",
    tone: "dark",
  },
  {
    title: "How a range is graded against Chainlink",
    body: "The interval score in plain words: why a confident miss costs more than a cautious one, and when a forecast is void.",
    href: "/docs/how-it-works",
    tone: "mid",
  },
  {
    title: "Following with guardrails",
    body: "Stake per trade, loss per trade, a daily cap and auto-unfollow: the limits that sit around follow mode.",
    href: "/docs/follow/limits",
    tone: "light",
  },
];

const TYPE_STYLES = [
  "font-display text-[46px] tracking-[-0.04em]",
  "font-sans text-[40px] font-semibold tracking-[0.18em]",
  "font-mono text-[38px] tracking-[-0.02em]",
  "font-sans text-[42px] font-light tracking-[-0.03em]",
  "font-display text-[44px] italic tracking-[-0.03em]",
  "font-sans text-[38px] font-bold tracking-[0.04em]",
  "font-sans text-[42px] tracking-[0.12em]",
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS = [
  "M5 3h10l4 4v14H5zM9 12h6M9 16h6",
  "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  "M4 20V9M10 20V4M16 20v-8M22 20H2",
  "M4 5h16v14H4zM8 9h8M8 13h8M8 17h4",
  "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM15 16h4M17 14v4",
  "M3 12h4l3-8 4 16 3-8h4",
  "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6",
  "M4 20V12M9 20V7M14 20v-9M19 20V4",
  "M4 5h16v10H8l-4 4zM8 9h8",
  "M3 17l6-6 4 4 8-8M15 7h6v6",
  "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z",
  "M8 4c-2 0-3 1-3 3v2c0 1.5-1 2-2 2 1 0 2 .5 2 2v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 2 2 2-1 0-2 .5-2 2v2c0 2-1 3-3 3",
];

export default function Home() {
  return (
    <>
      {/* 1. Hero */}
      <section className="relative overflow-hidden pt-[150px] max-md:pt-[120px]">
        <div className="relative z-10 mx-auto max-w-[1100px] px-4 text-center">
          <MarkHero size={63} box={112} />
          <h1 className="h-hero mx-auto mt-4 max-w-[1068px] !text-[clamp(38px,6.67vw,96px)]">
            Intelligence flows. <br className="max-sm:hidden" />
            Winners rise.
          </h1>
          <p className="mx-auto mt-6 max-w-[540px] text-[16px] leading-[1.4] text-ink-3 max-sm:text-[14px]">
            Real-time AI forecasts for every stock token on {CHAIN.name}. Many models publish ranges, Chainlink grades each one, the table ranks them
            live, and you can follow the winners as they rise.
          </p>
          <div className="mt-8 flex justify-center gap-2">
            <Link href="/ask" className="btn btn-accent">
              Launch app
            </Link>
            <Link href="/docs" className="btn btn-ghost">
              Read the docs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="relative h-[520px] md:-mt-10 max-md:mt-6 max-md:h-[260px]">
          <HeroField />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
        </div>
      </section>

      {/* 2. What it is */}
      <section className="px-4 pt-[150px] md:px-14 max-md:pt-[90px]">
        <div className="mx-auto flex max-w-[1328px] flex-col justify-between gap-10 lg:flex-row">
          <h2 className="h-sec max-w-[640px]">A stock forecaster whose record is open to inspection</h2>
          <div className="max-w-[430px] pt-2">
            <p className="kicker flex items-center gap-2 !text-ink">
              <span className="size-1.5 rounded-full bg-ink" /> What {BRAND.name} is
            </p>
            <p className="mt-5 text-[14.5px] leading-[1.35] text-ink-3">
              Most stock AI is a single model behind a curtain. {BRAND.name} lets many models compete in the open: each range is fixed before its
              outcome exists and graded against the on-chain Chainlink price, so the ranking is something you can recompute rather than something you
              are told.
            </p>
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-[1328px]">
          <BarcodeBand phrases={ASK_EXAMPLES} />
        </div>
      </section>

      {/* 3. Claims, the ask console, and the grading rule */}
      <ClaimsScrolly
        claim="Every model sounds sure of itself"
        doubt="Very few can show the receipts"
        askTitle="Ask in plain words, hear from the best-ranked models"
        askBody={`An 80 % price range with a confidence for every stock token on ${CHAIN.name}, at one hour, one day and one week. Type a question and ${BRAND.name} answers from live prices and the forecast board, not from one model's mood.`}
        askPhrases={[`Ask ${BRAND.name}…`, "How did the leaders do on TSLA?", "Show the NVDA ranges"]}
        grade="Each forecast is graded by the Chainlink price on chain"
      />

      {/* 4. Build on it */}
      <section id="developers" className="relative overflow-hidden pb-[150px]">
        <span className="absolute top-0 left-1/2 h-[120px] border-l border-dashed border-line-2" aria-hidden="true" />
        <div className="mx-auto max-w-[760px] px-4 pt-[130px] text-center max-md:pt-[90px]">
          <h2 className="h-sec">Wire ranked forecasts into your agents, dApps and scripts</h2>
          <p className="mx-auto mt-7 max-w-[440px] text-[16px] leading-[1.5] text-ink-3">
            Read {BRAND.name} from a contract through the oracle, from code through the agent SDK, or over HTTP through the forecast API, paid per call
            in USDG.
          </p>
        </div>
        <div className="relative mt-10 h-[110px]" aria-hidden="true">
          <span className="absolute top-0 left-1/2 h-full border-l border-dashed border-line-2" />
          <span className="absolute bottom-0 inset-x-0 border-t border-dashed border-line-2" />
        </div>
        <div className="overflow-hidden pt-2">
          <ul className="drift flex w-max gap-3">
            {[...TOOLS, ...TOOLS].map((t, i) => (
              <li key={`${t.name}-${i}`} aria-hidden={i >= TOOLS.length ? true : undefined} className="w-[300px] shrink-0 rounded-[14px] border border-line bg-card p-2">
                <Link href={t.href} tabIndex={i >= TOOLS.length ? -1 : undefined} className="block h-[150px] rounded-[9px] bg-paper-2 p-4 transition-colors hover:bg-paper-3">
                  <span className="h-item block">{t.name}</span>
                  <span className="mt-2 block text-[13.5px] leading-[1.35] text-ink-3">{t.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Follow */}
      <section id="follow" className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 px-4 py-[120px] md:px-14 lg:grid-cols-2 max-md:py-[80px]">
        <div className="min-w-0">
          <h2 className="h-sec !text-[clamp(36px,5vw,72px)]">Follow the leading models, inside your own limits</h2>
          <p className="mt-7 max-w-[540px] text-[16px] leading-[1.45] text-ink-3">
            Follow mode turns a top-ranked model&apos;s forecasts into positions sized by your rules: the most a trade may stake, the most it may lose,
            a loss cap for the day, and the score below which you stop following. Paper follow tries a model on simulated capital first, judged by real
            Chainlink outcomes.
          </p>
        </div>
        <div className="flex min-w-0 justify-center lg:justify-end">
          <FollowBento
            left={[
              { title: "Follow a model", body: "Mirror a leader into positions you size", h: "h-[122px]" },
              {
                title: "Paper follow",
                tag: "Simulated",
                h: "h-[122px]",
                extra: (
                  <p className="flex items-center gap-2 text-[13px] opacity-70">
                    <span className="size-6 rounded-full bg-[#333]" /> Practice capital
                  </p>
                ),
              },
              { title: "Auto-unfollow", tag: "Built in", body: "Stops when the score drops under your line", h: "h-[122px]" },
            ]}
            right={[
              { title: "Backtest", body: "Replay its scored past", h: "h-[86px]" },
              {
                title: "Your limits",
                h: "h-[122px]",
                extra: (
                  <div className="flex justify-between text-[13px]">
                    <span>
                      Max stake <span className="block text-[11px] opacity-60">USDG [ ]</span>
                    </span>
                    <span className="text-right">
                      Daily cap <span className="block text-[11px] opacity-60">Loss [ ]</span>
                    </span>
                  </div>
                ),
              },
              { title: "Multi-model", body: "Split across up to three leaders", h: "h-[124px]" },
            ]}
          />
        </div>
      </section>

      {/* 6. The layer */}
      <section id="leaderboard" className="relative px-4 py-[130px] max-md:py-[80px]">
        <div className="pointer-events-none absolute top-0 left-1/2 h-[760px] w-[min(1100px,100%)] -translate-x-1/2 max-md:h-[520px]">
          <Globe />
        </div>
        <h2 className="h-sec relative mx-auto max-w-[620px] text-center !text-[clamp(36px,5vw,72px)]">One layer between the model field and {CHAIN.name}</h2>
        <div className="relative mx-auto mt-[290px] max-w-[424px] max-md:mt-[150px]">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Traders", "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8"],
              ["dApps & agents", "M4 4h16v16H4zM9.5 4v16M14.5 4v16"],
              ["Developers", "M9 7l-5 5 5 5M15 7l5 5-5 5M13.5 5l-3 14"],
            ].map(([k, d]) => (
              <div key={k} className="rounded-[8px] border border-line bg-card p-2">
                <div className="grid h-[55px] place-items-center rounded-[5px] bg-paper-2 text-ink">
                  <Icon d={d} />
                </div>
                <p className="pt-2.5 pb-1 text-center text-[13px] text-ink max-sm:text-[11.5px]">{k}</p>
              </div>
            ))}
          </div>
          <Connector />
          <div className="relative rounded-[8px] border border-line-2 bg-paper-3 p-2">
            <p className="flex justify-center py-4 text-ink">
              <span className="flex items-center gap-2 text-[20px] font-medium tracking-[-0.03em]">
                <Mark size={24} /> {BRAND.name}
              </span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Forecast feed", "/forecasts"],
                ["Follow mode", "/follow"],
                ["Leaderboard", "/leaderboard"],
              ].map(([k, href]) => (
                <Link key={k} href={href} className="grid h-14 place-items-center rounded-[5px] bg-white px-1 text-center text-[13px] leading-tight text-[#0a0a0a] max-sm:text-[11.5px]">
                  {k}
                </Link>
              ))}
            </div>
            <Link href="/docs/developers/oracle" className="mt-2 grid h-14 place-items-center rounded-[5px] bg-white/90 px-2 text-center text-[13px] text-[#0a0a0a]">
              ForecastOracle on {CHAIN.name}
            </Link>
            <Link href="/docs/how-it-works" className="mt-2 grid h-14 place-items-center rounded-[5px] bg-white/80 px-2 text-center text-[13px] text-[#0a0a0a]">
              Open grading and a public record
            </Link>
            <SideNotes
              className="top-[58px]"
              items={["Models ranked by score, with the sample size beside it", `Live ranges for every ${BRAND.symbol} holder and app`, "Every forecast and score readable on chain"]}
            />
          </div>
          <Connector />
          <div className="relative rounded-[8px] border border-line bg-card p-2">
            <div className="grid grid-cols-6 gap-y-3 rounded-[5px] bg-paper-2 p-4 text-ink-2">
              {ICONS.map((d, i) => (
                <span key={i} className="flex justify-center">
                  <Icon d={d} />
                </span>
              ))}
            </div>
            <p className="pt-2.5 pb-1 text-center text-[13px] text-ink">Model network</p>
            <SideNotes className="top-[10px]" items={["Models forecast, the next Chainlink round grades them"]} />
          </div>
          {/* phones: the side notes as a list below */}
          <ul className="mt-6 space-y-2 border-l border-dashed border-line-2 pl-3 text-[13px] text-ink-3 lg:hidden">
            <li>Models ranked by score, with the sample size beside it</li>
            <li>Live ranges for every {BRAND.symbol} holder and app</li>
            <li>Every forecast and score readable on chain</li>
            <li>Models forecast, the next Chainlink round grades them</li>
          </ul>
        </div>
        <p className="relative mt-6 flex flex-wrap items-center justify-center gap-x-1 px-4 text-center text-[12px] text-faint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
          </svg>
          Models · Chainlink · Price feeds · Stock-token pools · Scores · Leaderboard · Oracle · API · SDK
        </p>
      </section>

      {/* 7. Built to be checked */}
      <section className="pt-[110px]">
        <div className="mx-auto max-w-[1440px] px-4 md:px-14">
          <h2 className="h-mid max-w-[600px]">Every number here can be checked again</h2>
          <div className="mt-14 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["3", "Horizons per token: one hour, one day, one week"],
              [String(STOCKS.length), `Stock tokens with a Chainlink feed on ${CHAIN.name}`],
              ["1", "Way to pay per API call: USDG, settled on chain"],
              ["0", "Admin keys, fees or upgrade switches in the oracle"],
              ["100", "Of oracle forecasts and their scores kept on chain", "%"],
            ].map(([v, l, unit], i) => (
              <Reveal key={l} delay={i * 90}>
                <div className="flex h-[226px] flex-col justify-between rounded-[8px] border border-line bg-card px-5 pt-3 pb-5 max-sm:h-[180px]">
                  <p className="flex items-start font-display text-[86px] leading-none tracking-[-0.04em] text-ink max-sm:text-[64px]">
                    {v}
                    {unit ? <span className="mt-2 font-sans text-[14px] tracking-normal text-ink-3">{unit}</span> : null}
                  </p>
                  <p className="max-w-[200px] text-[14px] leading-[1.2] text-ink-3">{l}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <p className="mt-[150px] text-center text-[14px] text-ink-3 max-md:mt-20">Forecasts for the stock tokens on {CHAIN.name}</p>
        <div className="mt-14 h-[166px] overflow-hidden" aria-label={`Stock tokens ${BRAND.name} forecasts`}>
          <ul className="marquee flex w-max items-center gap-[78px] pr-[78px]">
            {[...STOCKS, ...STOCKS].map((s, i) => (
              <li key={`${s.symbol}-${i}`} aria-hidden={i >= STOCKS.length ? true : undefined}>
                <Link
                  href={`/markets/${s.symbol.toLowerCase()}`}
                  tabIndex={i >= STOCKS.length ? -1 : undefined}
                  className={`${TYPE_STYLES[i % TYPE_STYLES.length]} leading-none whitespace-nowrap text-ink/70 transition-colors hover:text-ink`}
                >
                  {s.symbol}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 8. What people ask, and notes */}
      <section className="border-t border-line">
        <div className="relative">
          <div className="sticky top-0 flex h-dvh items-center justify-center px-4">
            <h2 className="mx-auto max-w-[640px] text-center font-display text-[clamp(44px,5.8vw,84px)] leading-[1.02] tracking-[-0.045em] text-ink">
              Questions for {BRAND.name}
            </h2>
          </div>
          <div className="relative -mt-[50dvh] flex flex-col items-center gap-6 px-4 pb-[300px]">
            {ASKED.map((a) => (
              <article
                key={a.k}
                className="flex h-[386px] w-full max-w-[416px] flex-col justify-between rounded-[10px] border border-line bg-[rgba(17,17,17,0.9)] p-[26px] backdrop-blur-xl max-sm:h-[320px]"
              >
                <p className="kicker !text-ink">{a.k}</p>
                <p className="text-[17px] leading-[1.22] text-ink">{a.q}</p>
                <div className="flex items-center gap-4">
                  <span className="grid size-16 shrink-0 place-items-center rounded-[6px] bg-paper-3 text-ink">
                    <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-[13px] leading-[1.2]">
                    <p className="text-ink">{a.tool}</p>
                    <p className="text-ink-3">Built on: {a.from}</p>
                  </div>
                  <ArrowButton href={a.href} label={`Open ${a.tool}`} />
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] px-4 pb-[140px] md:px-14">
          <div className="flex items-end justify-between gap-6">
            <h2 className="font-display text-[clamp(36px,4.45vw,64px)] leading-none tracking-[-0.045em] text-ink">Notes on how it works</h2>
            <Link href="/docs" className="kicker shrink-0 rounded-full border border-line-2 px-5 py-[14px] !text-ink transition-colors hover:border-[#555]">
              View all
            </Link>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {NOTES.map((n) => {
              const card = n.tone === "light" ? "bg-white text-[#0a0a0a]" : n.tone === "mid" ? "bg-paper-2 text-ink" : "bg-card text-ink";
              const plate = n.tone === "light" ? "bg-[#ececec] text-[#0a0a0a]" : n.tone === "mid" ? "bg-white text-[#0a0a0a]" : "bg-paper-3 text-ink";
              return (
                <Link key={n.href} href={n.href} className={`flex min-h-[520px] flex-col rounded-[10px] border border-line p-4 transition-transform hover:-translate-y-1 max-md:min-h-0 ${card}`}>
                  <div className={`grid h-[221px] place-items-center rounded-[6px] px-8 text-center ${plate}`}>
                    <p className="font-display text-[26px] leading-[1.1] tracking-[-0.03em]">{n.title}</p>
                  </div>
                  <p className="mt-5 px-4 text-[17px] leading-[1.25]">{n.body}</p>
                  <p className="mt-auto px-4 pt-10 pb-3 text-[13px]">{BRAND.name} Team</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function Connector() {
  return (
    <div className="relative mx-auto h-12 w-[290px] max-w-[70%]" aria-hidden="true">
      <span className="absolute inset-x-0 top-0 h-6 border-x border-b border-dashed border-line-2" />
      <span className="absolute top-6 left-1/2 h-6 border-l border-dashed border-line-2" />
      <span className="absolute top-0 left-1/2 h-6 border-l border-dashed border-line-2" />
    </div>
  );
}

function SideNotes({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`absolute left-[calc(100%+21px)] hidden w-[190px] flex-col gap-[30px] lg:flex ${className}`}>
      {items.map((t) => (
        <li key={t} className="border-l border-dashed border-[#3a3a3a] pl-4 text-[13px] leading-[1.3] text-ink-3">
          {t}
        </li>
      ))}
    </ul>
  );
}
