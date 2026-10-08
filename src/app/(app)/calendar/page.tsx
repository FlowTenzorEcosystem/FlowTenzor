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

const IMPACT: Record<CalEvent["impact"], string> = { high: "chip-live", medium: "chip-practice", low: "" };

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
        chips={
          <>
            <span className="chip chip-live">Live</span>
            <span className="chip chip-practice before:hidden">Release-window scores arrive with the oracle</span>
          </>
        }
        title="Macro calendar"
        desc="Upcoming data releases that tend to move shares and coins. Each row shows the New York time it is published at and the same moment in your own zone; past rows turn grey."
        actions={
          <>
            <div className="seg" role="group" aria-label="Impact">
              {[
                ["high", "High"],
                ["medium", "Medium+"],
                ["all", "All"],
              ].map(([k, l]) => (
                <Link key={k} href={link("impact", k)} scroll={false} aria-current={impact === k ? "page" : undefined} className="min-w-[60px] text-center !font-sans">
                  {l}
                </Link>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Region">
              {[
                ["usd", "USD"],
                ["all", "All"],
              ].map(([k, l]) => (
                <Link key={k} href={link("region", k)} scroll={false} aria-current={region === k ? "page" : undefined} className="!font-sans">
                  {l}
                </Link>
              ))}
            </div>
          </>
        }
      />
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <section className="panel flex flex-wrap items-end justify-between gap-4 p-4" data-testid="next-release">
            {next ? (
              <>
                <div className="min-w-0">
                  <p className="label flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-ink" /> Next high-impact USD release
                  </p>
                  <p className="mt-2 text-[22px] leading-tight tracking-[-0.02em] text-ink">{next.event}</p>
                  <p className="mt-1.5 text-[12.5px] text-ink-3">
                    <LocalTime t={next.at ?? 0} withDay /> your time · {next.gmt} New York · {next.date}
                  </p>
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    <span className="chip chip-live before:hidden">High</span>
                    <span className="chip before:hidden">USD</span>
                    <span className="chip before:hidden">Consensus {next.consensus || "—"}</span>
                    <span className="chip before:hidden">Previous {next.previous || "—"}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="label">Releases in</p>
                  <div className="mt-2">
                    <Countdown to={next.at ?? 0} big />
                  </div>
                  <p className="mt-2 text-[11.5px] text-faint">Model scores around this release · with the oracle</p>
                </div>
              </>
            ) : (
              <p className="text-[14px] text-ink-3">No high-impact US release in the next ten days of data.</p>
            )}
          </section>
          <section className="panel overflow-hidden" data-testid="calendar-list">
            <h2 className="label flex gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-3 !text-ink/85">
              Events <span className="!text-faint">{shown.length} shown · your time / NY</span>
            </h2>
            {byDay.size ? (
              <div className="scroll-x">
                <table className="tbl min-w-[720px] !text-[12.5px] [&_td]:!py-2.5">
                  <thead>
                    <tr>
                      <th>Local</th>
                      <th>NY</th>
                      <th>Ccy</th>
                      <th>Impact</th>
                      <th>Event</th>
                      <th className="text-right">Actual</th>
                      <th className="text-right">Consensus</th>
                      <th className="text-right">Previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...byDay.entries()].flatMap(([date, list]) => [
                      <tr key={date}>
                        <td colSpan={8} className="!bg-white/[0.015] !py-2">
                          <span className="label !text-ink-3">
                            {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
                          </span>
                          <span className="label float-right">{list.length}</span>
                        </td>
                      </tr>,
                      ...list.map((e, i) => (
                        <tr key={`${date}-${e.event}-${i}`} className={(e.at ?? 0) < now ? "opacity-45" : ""}>
                          <td className="whitespace-nowrap text-ink">{e.at ? <LocalTime t={e.at} /> : "—"}</td>
                          <td className="whitespace-nowrap text-faint">{e.gmt || "—"}</td>
                          <td className="text-ink-3">{e.usd ? "USD" : e.country.slice(0, 3).toUpperCase()}</td>
                          <td>
                            <span className={`chip before:hidden ${IMPACT[e.impact]}`}>{e.impact}</span>
                          </td>
                          <td className="font-sans text-[13px] text-ink">{e.event}</td>
                          <td className="text-right">{e.actual || "–"}</td>
                          <td className="text-right text-ink-2">{e.consensus || "–"}</td>
                          <td className="text-right text-ink-3">{e.previous || "–"}</td>
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-[14px] text-ink-3">The calendar source could not be read right now.</p>
            )}
          </section>
        </div>
        <div className="min-w-0 space-y-3">
          <Panel title="This week" note="USD · high impact" pad={false}>
            <ul>
              {all
                .filter((e) => e.usd && e.impact === "high" && (e.at ?? 0) > now - 86_400 && (e.at ?? 0) < now + 7 * 86_400)
                .slice(0, 10)
                .map((e, i) => (
                  <li key={i} className={`grid grid-cols-[112px_minmax(0,1fr)] gap-2 border-b border-line px-3 py-2 text-[12.5px] last:border-0 ${(e.at ?? 0) < now ? "opacity-45" : ""}`}>
                    <span className="whitespace-nowrap text-faint">{e.at ? <LocalTime t={e.at} withDay /> : "—"}</span>
                    <span className="truncate text-ink">{e.event}</span>
                  </li>
                ))}
            </ul>
          </Panel>
          <Panel title="Feed" pad={false}>
            <dl className="text-[13px]">
              {[
                ["Source", "Nasdaq calendar"],
                ["Events listed", String(all.length)],
                ["Shown", String(shown.length)],
                ["Impact grade", "by event name"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line px-3 py-2.5 last:border-0">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="num text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Legend">
            <dl className="space-y-2 text-[12.5px] text-ink-3">
              <div>
                <span className="chip chip-live before:hidden">High</span> rates, inflation, jobs, growth, spending
              </div>
              <div>
                <span className="chip chip-practice before:hidden">Medium</span> other US releases
              </div>
              <div>
                <span className="chip before:hidden">Low</span> auctions, weekly trackers, other regions
              </div>
            </dl>
            <p className="mt-3 text-[11.5px] text-faint">How forecasters score around each release appears once the record covers enough of them.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
