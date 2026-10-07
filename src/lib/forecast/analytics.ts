import "server-only";
import { HEADLINE } from "@/config/stocks";
import { daily } from "@/lib/feeds/nasdaq";

/*
 * Correlations of daily returns between the headline stock listings and
 * BTC, ETH and TAO (OKX daily candles, UTC days). Days are matched by date;
 * crypto trades every day, so only weekdays both sides traded are used.
 */

const cache: { at: number; value: Matrix | null } = { at: 0, value: null };
export type Matrix = { labels: string[]; m: (number | null)[][]; days: number; from: string; to: string };

async function okxDaily(inst: string): Promise<Map<string, number>> {
  try {
    const res = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${inst}&bar=1Dutc&limit=120`, { cache: "no-store", signal: AbortSignal.timeout(9000) });
    const body = (await res.json()) as { data?: string[][] };
    return new Map((body.data ?? []).map((r) => [new Date(Number(r[0])).toISOString().slice(0, 10), Number(r[4])]));
  } catch {
    return new Map();
  }
}

function corr(a: number[], b: number[]) {
  const n = a.length;
  if (n < 10) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

export async function correlationMatrix(): Promise<Matrix | null> {
  if (cache.value && Date.now() - cache.at < 30 * 60_000) return cache.value;
  const symbols = HEADLINE.slice(0, 12);
  const [stocks, btc, eth, tao] = await Promise.all([Promise.all(symbols.map((s) => daily(s, 130))), okxDaily("BTC-USDT"), okxDaily("ETH-USDT"), okxDaily("TAO-USDT")]);
  const series = new Map<string, Map<string, number>>();
  symbols.forEach((s, i) => series.set(s, new Map(stocks[i].map((b) => [new Date(b.t * 1000).toISOString().slice(0, 10), b.c]))));
  series.set("BTC", btc);
  series.set("ETH", eth);
  series.set("TAO", tao);
  const labels = [...series.keys()].filter((k) => (series.get(k)?.size ?? 0) > 20);
  if (labels.length < 4) return cache.value;
  // Common trading days (weekdays where every series has a close), sorted, last ~90.
  const days = [...(series.get(labels[0]) ?? new Map()).keys()].filter((d) => labels.every((l) => series.get(l)!.has(d))).sort().slice(-91);
  const rets = new Map(labels.map((l) => [l, days.slice(1).map((d, i) => Math.log(series.get(l)!.get(d)! / series.get(l)!.get(days[i])!))]));
  const m = labels.map((a) => labels.map((b) => (a === b ? 1 : corr(rets.get(a)!, rets.get(b)!))));
  const value = { labels, m, days: Math.max(0, days.length - 1), from: days[0] ?? "", to: days[days.length - 1] ?? "" };
  cache.at = Date.now();
  cache.value = value;
  return value;
}
