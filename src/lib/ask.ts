import "server-only";
import { STOCKS, stockBySymbol } from "@/config/stocks";
import { earningsDate, quote, summary } from "@/lib/feeds/nasdaq";
import { allTokenQuotes } from "@/lib/feeds/uniswap";
import { macroWindow } from "@/lib/feeds/macro";
import { getBoard, rowFor } from "@/lib/forecast/board";
import { SIGNAL_TEXT, signalOf } from "@/lib/forecast/consensus";
import { HORIZONS, type HorizonId } from "@/lib/forecast/scoring";

/*
 * The research console. It answers a fixed set of question shapes from live
 * data: price and range, comparisons, forecasts and consensus, earnings,
 * how a token tracks its listing, scoring and follow mode. It is rule-based,
 * not a language model, so every number in an answer comes from a source
 * named in the answer and nothing is invented to fill a gap.
 */

export type Answer = { title: string; lines: string[]; sources: string[]; symbols: string[] };

const m = (v: number | null | undefined) => (v == null ? "n/a" : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const p = (v: number | null | undefined) => (v == null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

export function symbolsIn(q: string) {
  const words = q.toUpperCase().match(/\$?[A-Z]{2,5}\b/g) ?? [];
  const out: string[] = [];
  for (const w of words) {
    const s = stockBySymbol(w.replace("$", ""));
    if (s && !out.includes(s.symbol)) out.push(s.symbol);
  }
  // Company names too, for shares whose first word is distinctive (not "Oracle", which also names the contract).
  const generic = new Set(["United", "Space", "USA", "Strategy", "Oracle", "Circle", "Rocket"]);
  for (const s of STOCKS) {
    const first = s.name.split(" ")[0];
    if (s.kind === "stock" && first.length > 3 && !generic.has(first) && !out.includes(s.symbol) && new RegExp(`\\b${first}\\b`, "i").test(q)) out.push(s.symbol);
  }
  return out;
}

async function priceAnswer(sym: string): Promise<Answer> {
  const [q, s, board] = await Promise.all([quote(sym), summary(sym), getBoard()]);
  const row = rowFor(board, sym);
  const range = s?.["52 Week High/Low"]?.split("/").map((x) => Number(x.replace(/[$,]/g, ""))) ?? [];
  const [hi52, lo52] = range.length === 2 ? range : [null, null];
  const lines = [
    `${sym} (${q?.company ?? sym}) last traded at ${m(q?.last)} on its listing, ${p(q?.changePct)} on the day (${q?.asOf ?? "time n/a"}).`,
    `The stock token's Chainlink feed on Robinhood Chain reads ${m(row?.price)}${row?.change24h != null ? `, ${p(row.change24h * 100)} over 24 hours` : ""}.`,
  ];
  if (hi52 && lo52 && q?.last) {
    const pos = ((q.last - lo52) / (hi52 - lo52)) * 100;
    lines.push(`Its 52-week range is ${m(lo52)} to ${m(hi52)}; today's price sits ${pos.toFixed(0)}% of the way up, ${p((q.last / hi52 - 1) * 100)} from the high.`);
  }
  if (s?.["Today's High/Low"]) lines.push(`Today's range on the listing: ${s["Today's High/Low"].replace("/", " to ")}.`);
  return { title: `${sym} today`, lines, sources: ["Nasdaq listing quote", "Chainlink feed on Robinhood Chain"], symbols: [sym] };
}

async function compareAnswer(a: string, b: string): Promise<Answer> {
  const [qa, qb] = await Promise.all([quote(a), quote(b)]);
  const lines = [`${a}: ${m(qa?.last)}, ${p(qa?.changePct)} today.`, `${b}: ${m(qb?.last)}, ${p(qb?.changePct)} today.`];
  if (qa?.changePct != null && qb?.changePct != null) {
    const d = qa.changePct - qb.changePct;
    lines.push(`${d >= 0 ? a : b} is ahead by ${Math.abs(d).toFixed(2)} percentage points on the session.`);
  }
  return { title: `${a} vs ${b}`, lines, sources: ["Nasdaq listing quotes"], symbols: [a, b] };
}

async function forecastAnswer(sym: string): Promise<Answer> {
  const board = await getBoard();
  const row = rowFor(board, sym);
  if (!row || row.price == null) return { title: `${sym} forecasts`, lines: ["The Chainlink feed could not be read just now."], sources: [], symbols: [sym] };
  const lines = HORIZONS.map((h) => {
    const s = signalOf(row.forecasts[h.id as HorizonId].map((f) => ({ low: Number(f.low) / 1e8, high: Number(f.high) / 1e8, reference: Number(f.reference) / 1e8 })));
    return `${h.label}: the house baselines' 80 % range is ${m(s.low)} to ${m(s.high)} (${SIGNAL_TEXT[s.label].toLowerCase()}, ${s.up} lean up, ${s.down} down).`;
  });
  lines.unshift(`${sym}'s feed price is ${m(row.price)}.`);
  lines.push("These are statistical baselines, the bar a model must beat; practice and on-chain forecasts show on the token's market page.");
  return { title: `${sym}: ranges and consensus`, lines, sources: ["Chainlink rounds", "house baselines"], symbols: [sym] };
}

async function earningsAnswer(sym: string): Promise<Answer> {
  const e = await earningsDate(sym);
  return {
    title: `${sym} earnings`,
    lines: e ? [e.date ? `${sym} is expected to report around ${e.date} (an estimate from Zacks, via Nasdaq; the company sets the real date).` : e.text] : [`No earnings date is available for ${sym}${stockBySymbol(sym)?.kind === "etf" ? ": it is a fund" : ""}.`],
    sources: ["Nasdaq earnings calendar"],
    symbols: [sym],
  };
}

async function trackingAnswer(sym: string | null): Promise<Answer> {
  const quotes = await allTokenQuotes();
  const pick = sym ? quotes.find((q) => q.symbol === sym) : null;
  const lines = [
    "A stock token on Robinhood Chain is an ERC-20 issued by Robinhood. Its Chainlink feed tracks the underlying listing, and the token itself trades in on-chain pools, where its price can sit above or below the listing.",
    "Arbitrage keeps pool prices near the listing when there is liquidity; thin pools and closed markets let the gap widen.",
  ];
  if (pick && pick.bid != null && pick.ask != null) lines.push(`${pick.symbol} right now: on-chain bid ${m(pick.bid)}, ask for $1,000 ${m(pick.ask)}, spread ${((pick.spread ?? 0) * 100).toFixed(2)}%.`);
  return { title: "How stock tokens track their shares", lines, sources: ["Uniswap v3 QuoterV2 on Robinhood Chain"], symbols: sym ? [sym] : [] };
}

const STATIC: Record<string, Answer> = {
  score: {
    title: "How forecasts are scored",
    lines: [
      "Each forecast is a low, a high and a confidence. After its horizon (1 hour, 1 day or 1 week), the Chainlink round current at that moment decides the outcome.",
      "Score = 10,000 × (1 − relative interval ÷ budget), where the interval is the range width plus a penalty of twice the miss divided by one minus the confidence, relative to the price. Budgets: 2 %, 6 % and 15 %.",
      "If the feed published nothing new during the window, the forecast is void and not scored.",
    ],
    sources: ["ForecastOracle scoring rule"],
    symbols: [],
  },
  follow: {
    title: "What follow mode does",
    lines: [
      "Follow mode turns a leader's forecasts into positions sized by your rules: a stake per trade, a maximum loss per trade, a daily loss cap and a score below which you stop following.",
      "For now it is paper follow, judged by actual Chainlink outcomes. Mirroring into a wallet needs the follow vault, which is designed and not deployed.",
    ],
    sources: ["follow mode design"],
    symbols: [],
  },
};

export const SUGGESTED = [
  { tag: "Level", q: "Where does NVDA sit in its 52-week band today?" },
  { tag: "Versus", q: "TSLA versus COIN on today's session" },
  { tag: "Forecast", q: "What range do the baselines give AAPL?" },
  { tag: "Earnings", q: "When does MSFT report earnings?" },
  { tag: "Network", q: "How are forecasts scored?" },
  { tag: "Follow", q: "How does following a model work?" },
  { tag: "Tokens", q: "Why can a stock token's price differ from the share?" },
];

export async function answer(raw: string): Promise<Answer> {
  const q = raw.slice(0, 2000);
  const syms = symbolsIn(q);
  if (/score|scored|scoring|judge/i.test(q) && !syms.length) return STATIC.score;
  if (/follow|mirror|copy/i.test(q) && !syms.length) return STATIC.follow;
  if (/track|tokeni[sz]ed|premium|pool|on-?chain price/i.test(q)) return trackingAnswer(syms[0] ?? null);
  if (syms.length >= 2 && /compare|vs\.?|versus|against|and/i.test(q)) return compareAnswer(syms[0], syms[1]);
  if (syms.length && /earning|report/i.test(q)) return earningsAnswer(syms[0]);
  if (syms.length && /forecast|range|consensus|predict|expect|baseline|model/i.test(q)) return forecastAnswer(syms[0]);
  if (syms.length) return priceAnswer(syms[0]);
  return {
    title: "Questions this console can answer",
    lines: [
      "Ask about a listed stock token by ticker: its price today, a comparison of two tickers, the forecast ranges and consensus, its next earnings date, or how it trades on chain.",
      "General questions: how forecasts are scored, and what follow mode does.",
      "The console answers from live data with fixed rules. It is not a language model, and it says so when a source is missing instead of guessing.",
    ],
    sources: [],
    symbols: [],
  };
}

let briefCache: { at: number; value: Answer } | null = null;

/** A short market brief from live data: the indices, the biggest movers among the listings, the next macro release. */
export async function dailyBrief(): Promise<Answer> {
  if (briefCache && Date.now() - briefCache.at < 10 * 60_000) return briefCache.value;
  const syms = STOCKS.map((s) => s.symbol);
  const quotes = await Promise.all(syms.map((s) => quote(s)));
  const rows = syms.map((s, i) => ({ s, q: quotes[i] })).filter((r) => r.q?.changePct != null);
  const idx = rows.filter((r) => r.s === "SPY" || r.s === "QQQ");
  const sorted = [...rows].sort((a, b) => (b.q!.changePct ?? 0) - (a.q!.changePct ?? 0));
  const up = sorted.slice(0, 3);
  const down = sorted.slice(-3).reverse();
  const events = (await macroWindow()).filter((e) => e.usd && e.impact === "high" && (e.at ?? 0) > Date.now() / 1000).slice(0, 2);
  const lines = [
    idx.length ? `Indices: ${idx.map((r) => `${r.s} ${p(r.q!.changePct)} at ${m(r.q!.last)}`).join(", ")}.` : "Index quotes are unavailable right now.",
    up.length ? `Biggest gains among the listings: ${up.map((r) => `${r.s} ${p(r.q!.changePct)}`).join(", ")}.` : "",
    down.length ? `Biggest declines: ${down.map((r) => `${r.s} ${p(r.q!.changePct)}`).join(", ")}.` : "",
    `${rows.filter((r) => (r.q!.changePct ?? 0) > 0).length} of ${rows.length} listings are up on the session.`,
    events.length ? `Next high-impact US releases: ${events.map((e) => `${e.event} on ${e.date} at ${e.gmt} New York`).join("; ")}.` : "No high-impact US release is listed in the next days.",
  ].filter(Boolean);
  const value = { title: "Market brief", lines, sources: ["Nasdaq listings", "Nasdaq economic calendar"], symbols: [...up, ...down].map((r) => r.s) };
  briefCache = { at: Date.now(), value };
  return value;
}
