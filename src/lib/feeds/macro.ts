import "server-only";
import { economicDay, type MacroEvent } from "./nasdaq";

/*
 * Economic calendar for the next days, from Nasdaq's public calendar. Times
 * in the source are New York times. Nasdaq gives no impact grade, so the site
 * grades events itself from their names (labelled as such on the page).
 */

export type Impact = "high" | "medium" | "low";
export type CalEvent = MacroEvent & { impact: Impact; at: number | null; usd: boolean };

const HIGH = /\b(CPI|Inflation|Nonfarm|Payrolls|Unemployment Rate|FOMC|Fed Interest Rate|Interest Rate Decision|GDP|PCE|Retail Sales|ISM|PPI|Jobless Claims|Michigan|Consumer Confidence|Fed Chair|Powell)\b/i;
const LOW = /\b(Auction|Redbook|Speech|Speaks|Baker Hughes|EIA|API Weekly|Holiday)\b/i;

export function grade(event: string, usd: boolean): Impact {
  if (!usd) return HIGH.test(event) ? "medium" : "low";
  if (HIGH.test(event)) return "high";
  if (LOW.test(event)) return "low";
  return "medium";
}

/** New York wall time on a date to unix seconds (DST from the offset New York shows that day at noon). */
function nyToUnix(date: string, hm: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  const noon = new Date(`${date}T12:00:00Z`);
  const ny = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).formatToParts(noon);
  const offset = 12 - Number(ny.find((p) => p.type === "hour")!.value); // 4 or 5
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Number(m[1]) + offset, Number(m[2])) / 1000;
}

let cache: { at: number; value: CalEvent[] } | null = null;

/** Events from two days ago to ten days ahead, oldest first. */
export async function macroWindow(): Promise<CalEvent[]> {
  if (cache && Date.now() - cache.at < 30 * 60_000) return cache.value;
  const days = Array.from({ length: 13 }, (_, i) => new Date(Date.now() + (i - 2) * 86_400_000).toISOString().slice(0, 10));
  const lists = await Promise.all(days.map((d) => economicDay(d)));
  const value = lists
    .flat()
    .map((e) => {
      const usd = e.country === "United States";
      return { ...e, usd, impact: grade(e.event, usd), at: nyToUnix(e.date, e.gmt) };
    })
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  if (value.length || !cache) cache = { at: Date.now(), value };
  return cache.value;
}
