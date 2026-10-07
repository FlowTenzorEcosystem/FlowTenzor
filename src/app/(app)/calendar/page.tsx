import Link from "next/link";
import { BRAND } from "@/config/brand";
import { Countdown, LocalTime } from "@/components/app/Countdown";
import { AppHead, Panel } from "@/components/app/ui";
import { JsonLd } from "@/components/JsonLd";
import { macroWindow, type CalEvent } from "@/lib/feeds/macro";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { nowSec } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/calendar",
  title: `Macro calendar | ${BRAND.name}`,
  description: `Scheduled economic releases that move stock tokens: date, New York time, your local time, consensus and previous figures, with a countdown to the next high-impact US release.`,
});

const IMPACT: Record<CalEvent["impact"], string> = { high: "chip-down", medium: "chip-practice", low: "" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ impact?: string; region?: string }> }) {
  const { impact = "medium", region = "usd" } = await searchParams;
  const all = await macroWindow();
  const now = nowSec();
  const shown = all.filter((e) => (region === "all" || e.usd) && (impact === "all" || (impact === "high" ? e.impact === "high" : e.impact !== "low")));
  const next = all.find((e) => e.usd && e.impact === "high" && (e.at ?? 0) > now);
  const byDay = new Map<string, CalEvent[]>();
  for (const e of shown) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const link = (k: string, v: string) => `/calendar?${new URLSearchParams({ impact, region, [k]: v }).toString()}`;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Macro calendar", path: "/calendar" }])} />
      <AppHead
        chips={<span className="chip chip-live">Live</span>}
        title="Macro calendar"
        desc="Dates and times of the data releases that shake share and coin prices. Each row shows the New York time it is published at and the same moment in your own zone; past rows turn grey."
        stats={[
          { k: "Events listed", v: all.length },
          { k: "Shown", v: shown.length },
          { k: "Source", v: "Nasdaq calendar" },
          { k: "Impact grade", v: "by event name", note: "our classification" },
        ]}
      />
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5 lg:order-2">
          <Panel title="Next high-impact US release" testid="next-release">
            {next ? (
              <>
                <p className="font-display text-[22px] text-ink">{next.event}</p>
                <p className="mt-1 text-[13px] text-ink-3">
                  {next.date} · {next.gmt} New York · <LocalTime t={next.at ?? 0} withDay /> your time
                </p>
                <div className="mt-3">
                  <Countdown to={next.at ?? 0} label="until release" />
                </div>
                <p className="mt-2 text-[13px] text-ink-2">
                  Consensus {next.consensus || "—"} · previous {next.previous || "—"}
                </p>
              </>
            ) : (
              <p className="text-[14px] text-ink-3">No high-impact US release in the next ten days of data.</p>
            )}
          </Panel>
          <Panel title="Filters">
            <p className="kicker">Impact</p>
            <div className="mt-1.5 flex gap-1 text-[13px]">
              {[
                ["high", "High"],
                ["medium", "Medium and up"],
                ["all", "All"],
              ].map(([k, l]) => (
                <Link key={k} href={link("impact", k)} scroll={false} className={`rounded-[6px] px-2.5 py-1 ${impact === k ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"}`}>
                  {l}
                </Link>
              ))}
            </div>
            <p className="kicker mt-4">Region</p>
            <div className="mt-1.5 flex gap-1 text-[13px]">
              {[
                ["usd", "United States"],
                ["all", "All"],
              ].map(([k, l]) => (
                <Link key={k} href={link("region", k)} scroll={false} className={`rounded-[6px] px-2.5 py-1 ${region === k ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"}`}>
                  {l}
                </Link>
              ))}
            </div>
            <dl className="mt-5 space-y-1.5 text-[12.5px] text-ink-3">
              <div>
                <span className="chip chip-down">High</span> rates, inflation, jobs, growth, spending
              </div>
              <div>
                <span className="chip chip-practice">Medium</span> other US releases
              </div>
              <div>
                <span className="chip">Low</span> auctions, weekly trackers, other regions
              </div>
            </dl>
            <p className="mt-4 text-[12px] text-ink-3">How forecasters score around each event appears once the record covers enough releases.</p>
          </Panel>
        </div>
        <Panel title="Events" note="New York · your time" pad={false} testid="calendar-list" className="lg:order-1">
          {byDay.size ? (
            <div className="divide-y divide-line">
              {[...byDay.entries()].map(([date, list]) => (
                <div key={date} className="px-4 py-3">
                  <p className="kicker !text-ink-2">{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}</p>
                  <ul className="mt-2 space-y-1.5">
                    {list.map((e, i) => (
                      <li key={`${e.event}-${i}`} className={`grid grid-cols-[52px_52px_minmax(0,1fr)] items-baseline gap-2 text-[13px] sm:grid-cols-[56px_56px_minmax(0,1fr)_auto] ${(e.at ?? 0) < now ? "opacity-50" : ""}`}>
                        <span className="num text-ink">{e.gmt || "—"}</span>
                        <span className="text-ink-3">{e.at ? <LocalTime t={e.at} /> : "—"}</span>
                        <span className="min-w-0">
                          <span className={`chip mr-2 ${IMPACT[e.impact]}`}>{e.impact}</span>
                          <span className="text-ink">{e.event}</span>
                          {!e.usd ? <span className="ml-1 text-ink-3">· {e.country}</span> : null}
                        </span>
                        <span className="num col-span-3 text-ink-3 sm:col-span-1 sm:text-right">
                          {e.actual ? `actual ${e.actual} · ` : ""}cons. {e.consensus || "—"} · prev. {e.previous || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-6 text-[14px] text-ink-3">The calendar source could not be read right now.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
