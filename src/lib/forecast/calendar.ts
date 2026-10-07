/*
 * Stock-token feeds on Robinhood Chain follow US equities 24/5: from Sunday
 * 20:00 to Friday 20:00 New York time. Outside that window the feeds hold
 * their last answer. Times here are unix seconds.
 */

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  hour12: false,
});

// New York's UTC offset, looked up once per UTC day (it only changes on the two DST days, by an hour).
const offsets = new Map<number, number>();
function nyOffset(t: number) {
  const day = Math.floor(t / 86_400);
  let off = offsets.get(day);
  if (off === undefined) {
    const at = day * 86_400 + 12 * 3600;
    const parts = Object.fromEntries(fmt.formatToParts(new Date(at * 1000)).map((p) => [p.type, p.value]));
    const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24) / 1000;
    off = local - at;
    offsets.set(day, off);
  }
  return off;
}

/** Hour of the week in New York: Sunday 00:00 = 0. */
export function nyWeekHour(t: number) {
  const local = t + nyOffset(t);
  const dayOfWeek = (Math.floor(local / 86_400) + 4) % 7; // 1 Jan 1970 was a Thursday
  return dayOfWeek * 24 + Math.floor((local % 86_400) / 3600);
}

export function inSession(t: number) {
  const h = nyWeekHour(t);
  return h >= 20 && h < 5 * 24 + 20;
}

/** Session hours between two moments, counted per hour (good to an hour, which is all the baselines need). */
export function sessionHours(from: number, to: number) {
  if (to <= from) return 0;
  let n = 0;
  for (let t = from; t < to; t += 3600) if (inSession(t)) n += Math.min(1, (to - t) / 3600);
  return n;
}
