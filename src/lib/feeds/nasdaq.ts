import "server-only";
import { STOCKS } from "@/config/stocks";

/*
 * Reference listings for the stock tokens: the US share or ETF each token
 * tracks, from Nasdaq's public quote API (no key; it needs a browser user
 * agent). Used for charts, session statistics, earnings dates, headlines and
 * the economic calendar. Chainlink stays the price that scores forecasts.
 *
 * Every call is cached: hits five minutes, misses 45 seconds, and network
 * errors are retried once, so a dropped connection does not blank a page.
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const cache = new Map<string, { at: number; ok: boolean; value: unknown }>();

async function getJson<T>(url: string, ttlOk = 300_000): Promise<T | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < (hit.ok ? ttlOk : 45_000)) return hit.value as T | null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json", referer: "https://www.nasdaq.com/" },
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { data?: T | null };
      const value = body?.data ?? null;
      cache.set(url, { at: Date.now(), ok: value !== null, value });
      if (cache.size > 2000) cache.clear();
      return value;
    } catch {
      // retry once, then fall back to the last good value
    }
  }
  if (hit) return hit.value as T | null;
  cache.set(url, { at: Date.now(), ok: false, value: null });
  return null;
}

const ETF = new Set(["EWY", "GLD", "QQQ", "SGOV", "SLV", "SPY", "USO"]);
export const assetClass = (symbol: string) => (ETF.has(symbol) ? "etf" : "stocks");
const num = (s: unknown) => {
  if (typeof s !== "string" && typeof s !== "number") return null;
  const v = Number(String(s).replace(/[$,%\s]/g, ""));
  return Number.isFinite(v) ? v : null;
};

export type Quote = { symbol: string; company: string; last: number | null; change: number | null; changePct: number | null; prevClose: number | null; volume: number | null; asOf: string; points: { t: number; p: number }[] };

/** Last sale, change and today's intraday points (minute bars). */
export async function quote(symbol: string): Promise<Quote | null> {
  type Raw = {
    company: string;
    lastSalePrice: string;
    netChange: string;
    percentageChange: string;
    previousClose: string;
    volume: string;
    timeAsOf: string;
    chart: { x: number; y: number }[] | null;
  };
  const d = await getJson<Raw>(`https://api.nasdaq.com/api/quote/${symbol}/chart?assetclass=${assetClass(symbol)}`, 60_000);
  if (!d) return null;
  return {
    symbol,
    company: d.company?.replace(/ Common Stock$| Class A Common Stock$/, "") ?? symbol,
    last: num(d.lastSalePrice),
    change: num(d.netChange),
    changePct: num(d.percentageChange),
    prevClose: num(d.previousClose),
    volume: num(d.volume),
    asOf: d.timeAsOf ?? "",
    points: (d.chart ?? []).map((c) => ({ t: Math.floor(c.x / 1000), p: c.y })),
  };
}

export type Daily = { t: number; o: number; h: number; l: number; c: number; v: number };

/** Daily bars, oldest first, for up to a year. */
export async function daily(symbol: string, days = 370): Promise<Daily[]> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  type Raw = { tradesTable: { rows: { date: string; close: string; volume: string; open: string; high: string; low: string }[] | null } };
  const d = await getJson<Raw>(`https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=${assetClass(symbol)}&fromdate=${from}&limit=400`, 30 * 60_000);
  const rows = d?.tradesTable?.rows ?? [];
  return rows
    .map((r) => {
      const [m, day, y] = r.date.split("/").map(Number);
      return { t: Date.UTC(y, m - 1, day) / 1000, o: num(r.open) ?? 0, h: num(r.high) ?? 0, l: num(r.low) ?? 0, c: num(r.close) ?? 0, v: num(r.volume) ?? 0 };
    })
    .filter((r) => r.c > 0)
    .sort((a, b) => a.t - b.t);
}

export type Summary = Record<string, string>;

/** Exchange, sector, day range, 52-week range, market cap and the like, as labelled strings. */
export async function summary(symbol: string): Promise<Summary | null> {
  type Raw = { summaryData: Record<string, { label: string; value: string }> };
  const d = await getJson<Raw>(`https://api.nasdaq.com/api/quote/${symbol}/summary?assetclass=${assetClass(symbol)}`, 15 * 60_000);
  if (!d?.summaryData) return null;
  return Object.fromEntries(Object.values(d.summaryData).map((v) => [v.label, v.value]));
}

/** Next estimated earnings date (as text) for a share; ETFs have none. */
export async function earningsDate(symbol: string): Promise<{ date: string | null; text: string } | null> {
  if (ETF.has(symbol)) return null;
  const d = await getJson<{ reportText: string }>(`https://api.nasdaq.com/api/analyst/${symbol}/earnings-date`, 6 * 3600_000);
  if (!d?.reportText) return null;
  const m = /(\d{1,2}\/\d{1,2}\/\d{4})/.exec(d.reportText);
  return { date: m ? m[1] : null, text: d.reportText.replace(/\s+/g, " ").trim() };
}

export type Headline = { title: string; url: string; publisher: string; ago: string; created: string };

/** Recent headlines for a ticker. Titles and links only; stories stay on the publisher's site. */
export async function headlines(symbol: string, limit = 8): Promise<Headline[]> {
  type Raw = { rows: { title: string; url: string; publisher: string; ago: string; created: string }[] | null };
  const d = await getJson<Raw>(`https://www.nasdaq.com/api/news/topic/articlebysymbol?q=${symbol.toLowerCase()}|${assetClass(symbol)}&offset=0&limit=${limit}`, 10 * 60_000);
  return (d?.rows ?? []).map((r) => ({
    title: r.title,
    url: r.url.startsWith("http") ? r.url : `https://www.nasdaq.com${r.url}`,
    publisher: r.publisher,
    ago: r.ago,
    created: r.created,
  }));
}

export type MacroEvent = { gmt: string; country: string; event: string; actual: string; consensus: string; previous: string; date: string };

/** Scheduled economic releases for one day (UTC date), as Nasdaq lists them. */
export async function economicDay(date: string): Promise<MacroEvent[]> {
  type Raw = { rows: { gmt: string; country: string; eventName: string; actual: string; consensus: string; previous: string }[] | null };
  const d = await getJson<Raw>(`https://api.nasdaq.com/api/calendar/economicevents?date=${date}`, 30 * 60_000);
  const clean = (s: string) => (s ?? "").replace(/&nbsp;/g, "").trim();
  return (d?.rows ?? []).map((r) => ({ gmt: clean(r.gmt), country: clean(r.country), event: clean(r.eventName), actual: clean(r.actual), consensus: clean(r.consensus), previous: clean(r.previous), date }));
}

/** Quotes for every listed token, four at a time. */
export async function allQuotes() {
  const out = new Map<string, Quote | null>();
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < STOCKS.length) {
        const s = STOCKS[next++];
        out.set(s.symbol, await quote(s.symbol));
      }
    }),
  );
  return out;
}
