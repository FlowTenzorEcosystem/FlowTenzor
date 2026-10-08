import { Suspense } from "react";
import { BRAND, CHAIN } from "@/config/brand";
import { oracleLive } from "@/config/contracts";
import { AskConsole } from "@/components/app/AskConsole";
import { RailChain } from "@/components/app/RailChain";
import { money } from "@/components/app/ui";
import { Spark } from "@/components/forecast/charts";
import { HeroField } from "@/components/landing/Fx";
import { MarkHero } from "@/components/landing/MarkHero";
import { dailyBrief, SUGGESTED } from "@/lib/ask";
import { getBoard } from "@/lib/forecast/board";
import { macroWindow } from "@/lib/feeds/macro";
import { quote } from "@/lib/feeds/nasdaq";
import { pageMeta } from "@/lib/seo";
import { nowSec } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/ask",
  title: `Ask: research console | ${BRAND.name}`,
  description: `Plain-language questions about stock tokens on ${CHAIN.name}, answered from live listing quotes, Chainlink feeds and the forecast board.`,
});

async function Brief() {
  const [b, events] = await Promise.all([dailyBrief(), macroWindow().catch(() => [])]);
  const now = nowSec();
  const soon = events.filter((e) => e.usd && e.impact !== "low" && (e.at ?? 0) > now - 86_400).slice(0, 4);
  return (
    <>
      <div className="p-3" data-testid="daily-brief">
        <h3 className="text-[15px] font-medium text-ink">{b.lines[0]}</h3>
        <ol className="mt-2 space-y-1.5 text-[13.5px] leading-[1.5] text-ink-2">
          {b.lines.slice(1).map((l, i) => (
            <li key={i} className="grid grid-cols-[24px_minmax(0,1fr)]">
              <span className="num text-[11.5px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <span>{l}</span>
            </li>
          ))}
        </ol>
        {soon.length ? (
          <div className="mt-4 border-t border-line pt-3">
            <p className="label">On watch</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {soon.map((e, i) => (
                <li key={i} className="rounded-[3px] border border-line px-2 py-1 text-[12.5px] text-ink-2">
                  {e.event}, {e.date} {e.gmt} NY{e.consensus ? `; consensus ${e.consensus}` : ""}
                  {e.previous ? `, previous ${e.previous}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="label border-t border-line px-3 py-2.5">Assembled by fixed rules from live data · {b.sources.join(", ")}</p>
    </>
  );
}

async function Watch() {
  const syms = ["NVDA", "TSLA", "AAPL", "SPY"];
  const [list, board] = await Promise.all([Promise.all(syms.map((s) => quote(s))), getBoard().catch(() => null)]);
  return (
    <ul>
      {list.map((q, i) => {
        const pts = board ? (board.points.get(syms[i]) ?? []).filter((p) => p.t >= board.at - 3 * 86_400) : [];
        const ch = q?.changePct ?? null;
        return (
          <li key={syms[i]} className="grid grid-cols-[48px_minmax(0,1fr)_auto_74px] items-center gap-2 border-b border-line px-3 py-2.5 text-[13px] last:border-0">
            <span className="num font-medium text-ink">{syms[i]}</span>
            <span className="opacity-70">{pts.length > 2 ? <Spark points={pts} width={60} height={16} /> : null}</span>
            <span className="num text-right text-ink">{money(q?.last)}</span>
            <span className={`num text-right text-[11.5px] whitespace-nowrap ${ch == null ? "text-faint" : ch >= 0 ? "text-up" : "text-down"}`}>
              {ch == null ? "–" : `${ch >= 0 ? "▲ +" : "▼ −"}${Math.abs(ch).toFixed(2)}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RailPanel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="panel overflow-hidden">
      <h2 className="label flex gap-3 border-b border-line px-3 py-3 !text-ink/85">
        {title} {note ? <span className="!text-faint">{note}</span> : null}
      </h2>
      {children}
    </section>
  );
}

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="-mx-4 -mt-4 -mb-10 grid min-h-full grid-cols-1 max-sm:-mx-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="mx-auto w-full max-w-[880px] min-w-0 p-6 max-sm:p-3">
        <section className="relative h-[262px] overflow-hidden rounded-[6px] border border-line bg-card text-center max-sm:h-[256px]">
          <div className="absolute inset-x-0 bottom-0 h-[150px] opacity-30">
            <HeroField />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-card via-card/70 to-transparent" aria-hidden="true" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:24px_24px]" aria-hidden="true" />
          <div className="relative px-4 pt-11">
            <MarkHero size={54} box={60} />
            <p className="label mt-3">Research console</p>
            <h1 className="mt-2 text-[26px] leading-tight font-medium tracking-[-0.02em] text-ink">Ask {BRAND.name}</h1>
            <p className="mx-auto mt-2 max-w-[440px] text-[14px] leading-[1.4] text-ink-3">
              Plain questions about the stock tokens on {CHAIN.name}, answered from live prices and the forecast board by fixed rules.
            </p>
          </div>
        </section>
        <div className="mt-4">
          <AskConsole
            suggested={SUGGESTED}
            initial={q?.slice(0, 300)}
            brief={
              <section className="panel">
                <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-2">
                  <h2 className="label !text-ink/85">Daily brief</h2>
                  <span className="label max-sm:hidden">Session summary from live quotes</span>
                  <span className="label ml-auto rounded-[3px] border border-dashed border-line-2 px-1.5 py-0.5">Not advice</span>
                </div>
                <Suspense fallback={<p className="p-3 text-[13px] text-ink-3">Putting the brief together…</p>}>
                  <Brief />
                </Suspense>
              </section>
            }
          />
        </div>
      </div>
      <aside className="min-w-0 border-line xl:border-l" aria-label="Console status">
        <div className="space-y-3 p-3 xl:sticky xl:top-0">
          <RailPanel title="Engine">
            <RailChain forecasts={oracleLive() ? "Oracle live" : "Practice"} />
          </RailPanel>
          <RailPanel title="Watch" note="Nasdaq listings">
            <Suspense fallback={<p className="p-3 text-[13px] text-ink-3">Loading…</p>}>
              <Watch />
            </Suspense>
          </RailPanel>
          <RailPanel title="Shortcuts">
            <dl className="text-[13px]">
              {[
                ["Command palette", "⌘K"],
                ["Send", "↵"],
                ["New line", "⇧↵"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line px-3 py-2.5 last:border-0">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="num text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </RailPanel>
        </div>
      </aside>
    </div>
  );
}
