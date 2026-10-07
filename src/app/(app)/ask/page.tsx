import { Suspense } from "react";
import { BRAND, CHAIN } from "@/config/brand";
import { oracleLive } from "@/config/contracts";
import { AskConsole } from "@/components/app/AskConsole";
import { AppHead, Panel, money, signPct, up } from "@/components/app/ui";
import { dailyBrief, SUGGESTED } from "@/lib/ask";
import { quote } from "@/lib/feeds/nasdaq";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/ask",
  title: `Ask: research console | ${BRAND.name}`,
  description: `Plain-language questions about stock tokens on ${CHAIN.name}, answered from live listing quotes, Chainlink feeds and the forecast board.`,
});

async function Brief() {
  const b = await dailyBrief();
  return (
    <ol className="space-y-2 text-[14px] leading-relaxed text-ink-2" data-testid="daily-brief">
      {b.lines.map((l, i) => (
        <li key={i} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2">
          <span className="num text-[12px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
          <span>{l}</span>
        </li>
      ))}
    </ol>
  );
}

async function Watch() {
  const list = await Promise.all(["NVDA", "TSLA", "AAPL", "SPY"].map((s) => quote(s)));
  return (
    <ul className="text-[13px]">
      {list.map((q, i) => (
        <li key={i} className="flex justify-between gap-2 border-b border-line py-1.5 last:border-0">
          <span className="text-ink">{q?.symbol ?? ["NVDA", "TSLA", "AAPL", "SPY"][i]}</span>
          <span className="num">
            {money(q?.last)} <span className={up(q?.changePct)}>{signPct(q?.changePct)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <>
      <AppHead
        chips={<span className="kicker">Research console</span>}
        title={`Ask ${BRAND.name}`}
        desc="Questions about the stock tokens, answered from live listing quotes, the Chainlink feeds and the forecast board. Rule-based: every number names its source, and a missing source is said out loud, never filled in."
      />
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <AskConsole suggested={SUGGESTED} initial={q?.slice(0, 300)} />
        <div className="min-w-0 space-y-5">
          <Panel title="Market brief" note="from live quotes, not advice">
            <Suspense fallback={<p className="text-[13px] text-ink-3">Putting the brief together…</p>}>
              <Brief />
            </Suspense>
          </Panel>
          <Panel title="Engine">
            <dl className="text-[13px]">
              {[
                ["Answers", "rule-based, no language model"],
                ["Prices", "Nasdaq listings · Chainlink feeds"],
                ["Forecasts", oracleLive() ? "oracle + practice + baselines" : "practice + house baselines"],
                ["Model network", "open on Robinhood Chain"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Watch" note="listings">
            <Suspense fallback={<p className="text-[13px] text-ink-3">Loading…</p>}>
              <Watch />
            </Suspense>
          </Panel>
          <Panel title="Shortcuts">
            <dl className="grid grid-cols-2 gap-1 text-[13px]">
              <dt className="text-ink-3">Search</dt>
              <dd className="num text-right">⌘K</dd>
              <dt className="text-ink-3">Send</dt>
              <dd className="num text-right">↵</dd>
              <dt className="text-ink-3">New line</dt>
              <dd className="num text-right">⇧↵</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
