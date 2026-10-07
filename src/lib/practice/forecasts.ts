import "server-only";
import { randomBytes } from "node:crypto";
import { BRAND, CHAIN } from "@/config/brand";
import { marketIdOf, stockBySymbol } from "@/config/stocks";
import type { Store } from "@/lib/auth/store";
import { recoverSigner } from "@/lib/auth/verify";
import { history, historyReadAt, latestAll, roundAt } from "@/lib/forecast/history";
import { HORIZONS, checkRange, directionOf, emptyTally, outcomeDirection, scoreOf, toUnits, type HorizonId, type Tally } from "@/lib/forecast/scoring";

/*
 * Practice forecasts: the same commit-and-score cycle as ForecastOracle, run
 * by the site while the contract is not deployed. The server writes the exact
 * forecast text with the Chainlink price it read, the wallet signs it with
 * personal_sign (free, no transaction), and only then is it stored. Scoring
 * uses the oracle's rule and its void rule, against the Chainlink round that
 * was current at the horizon.
 */

export const PRACTICE_TTL = 30 * 86_400;
const TICKET_TTL = 5 * 60;
const LIST_ALL = "pf:all";
const LIST_KEEP = 3000;
const WALLET_KEEP = 400;

export type PracticeForecast = {
  id: string;
  wallet: string;
  symbol: string;
  marketId: number;
  horizon: HorizonId;
  low: string; // 8-decimal units
  high: string;
  confidenceBps: number;
  reference: string;
  referenceRound: string;
  madeAt: number;
  resolvesAt: number;
  status: "open" | "scored" | "void";
  score?: number;
  inRange?: boolean;
  directionHit?: boolean;
  direction: -1 | 0 | 1;
  price?: string;
  resolvedRound?: string;
};

export type Action =
  | { kind: "forecast"; symbol: string; horizon: HorizonId; low: string; high: string; confidenceBps: number; reference: string; referenceRound: string }
  | { kind: "apikey" };

const hex = (n: number) => randomBytes(n).toString("hex");
const fmt = (units: string) => (Number(BigInt(units)) / 1e8).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

const slotKey = (wallet: string, marketId: number, h: number) => `pf:slot:${wallet}:${marketId}:${h}`;
const recKey = (id: string) => `pf:rec:${id}`;
const walletList = (wallet: string) => `pf:w:${wallet}`;

/** Parses a price typed by a person ("231.5") into 8-decimal units, or null. */
export function parsePrice(v: unknown): bigint | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).trim();
  if (!/^\d{1,9}(\.\d{1,8})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return BigInt(w) * 100_000_000n + BigInt(f.padEnd(8, "0"));
}

/** Validates a forecast request against the live Chainlink price. The reference is read here, never taken from the browser. */
export async function parseForecast(raw: Record<string, unknown>): Promise<Action | { error: string }> {
  if (raw.kind === "apikey") return { kind: "apikey" };
  if (raw.kind !== "forecast") return { error: "Unknown action." };
  const stock = typeof raw.symbol === "string" ? stockBySymbol(raw.symbol) : null;
  if (!stock) return { error: "Pick a listed stock token." };
  const horizon = Number(raw.horizon);
  if (horizon !== 0 && horizon !== 1 && horizon !== 2) return { error: "Pick a horizon: one hour, one day or one week." };
  const low = parsePrice(raw.low);
  const high = parsePrice(raw.high);
  const confidenceBps = Math.round(Number(raw.confidence) * 100);
  if (low === null || high === null) return { error: "Enter the low and high as prices, e.g. 231.50." };
  const head = (await latestAll()).get(stock.symbol);
  if (!head) return { error: "The Chainlink feed for this token could not be read. Try again in a moment." };
  if (Date.now() / 1000 - head.t > 4 * 86_400) return { error: "This feed has not updated for more than four days; forecasts open when it moves again." };
  const problem = checkRange(low, high, confidenceBps, head.units);
  if (problem) return { error: problem };
  return {
    kind: "forecast",
    symbol: stock.symbol,
    horizon: horizon as HorizonId,
    low: low.toString(),
    high: high.toString(),
    confidenceBps,
    reference: head.units.toString(),
    referenceRound: head.id.toString(),
  };
}

function describe(a: Action) {
  if (a.kind === "apikey") return `Create an API key for the ${BRAND.name} forecast API. The key is tied to this wallet and expires in 30 days.`;
  const h = HORIZONS[a.horizon];
  return `Practice forecast: ${a.symbol} over ${h.label}. Range ${fmt(a.low)} to ${fmt(a.high)} USD at ${a.confidenceBps / 100} % confidence. Reference: Chainlink ${fmt(a.reference)} USD (round ${a.referenceRound}).`;
}

export async function issueTicket(store: Store, address: string, action: Action, host: string) {
  const nonce = hex(16);
  const message = [
    `${host} asks you to sign a ${BRAND.name} action:`,
    "",
    describe(action),
    "",
    action.kind === "forecast" ? "Practice mode: this is a free signature. No transaction is sent and no funds move." : "Free signature, no transaction.",
    "",
    `Wallet: ${address}`,
    `Chain ID: ${CHAIN.id}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    `Expires At: ${new Date(Date.now() + TICKET_TTL * 1000).toISOString()}`,
  ].join("\n");
  await store.setEx(`pf:ticket:${nonce}`, JSON.stringify({ address: address.toLowerCase(), message, action, at: Date.now() }), TICKET_TTL);
  return { nonce, message };
}

/** Burns the nonce atomically, then checks the signature. A ticket is used at most once. */
export async function redeemTicket(store: Store, nonce: string, signature: string) {
  if (!/^[0-9a-f]{32}$/.test(nonce)) return { error: "This request expired or was already used.", status: 409 } as const;
  const raw = await store.take(`pf:ticket:${nonce}`);
  if (!raw) return { error: "This request expired or was already used.", status: 409 } as const;
  let t: { address: string; message: string; action: Action; at: number };
  try {
    t = JSON.parse(raw);
  } catch {
    return { error: "This request could not be read. Try again.", status: 400 } as const;
  }
  if (recoverSigner(t.message, signature) !== t.address) return { error: "That signature does not match the connected wallet.", status: 401 } as const;
  return { address: t.address, action: t.action, at: t.at } as const;
}

/** Stores a signed forecast. One live forecast per wallet, token and horizon, as on chain. */
export async function storeForecast(store: Store, wallet: string, a: Extract<Action, { kind: "forecast" }>, signedAt: number) {
  const marketId = marketIdOf(a.symbol);
  const madeAt = Math.floor(signedAt / 1000);
  const resolvesAt = madeAt + HORIZONS[a.horizon].seconds;
  const id = hex(8);
  const free = await store.setNx(slotKey(wallet, marketId, a.horizon), id, HORIZONS[a.horizon].seconds);
  if (!free) return { ok: false as const, status: 409, error: "You already have a live forecast for this token and horizon. The next one opens when it resolves." };
  const rec: PracticeForecast = {
    id,
    wallet,
    symbol: a.symbol,
    marketId,
    horizon: a.horizon,
    low: a.low,
    high: a.high,
    confidenceBps: a.confidenceBps,
    reference: a.reference,
    referenceRound: a.referenceRound,
    madeAt,
    resolvesAt,
    status: "open",
    direction: directionOf(BigInt(a.low), BigInt(a.high), BigInt(a.reference)),
  };
  await store.setEx(recKey(id), JSON.stringify(rec), PRACTICE_TTL);
  await store.pushCapped(LIST_ALL, id, LIST_KEEP);
  await store.pushCapped(walletList(wallet), id, WALLET_KEEP);
  return { ok: true as const, forecast: rec };
}

/** Scores open forecasts whose horizon has passed, with a history read made after the horizon. */
async function settle(store: Store, recs: PracticeForecast[]) {
  const now = Math.floor(Date.now() / 1000);
  const due = recs.filter((r) => r.status === "open" && r.resolvesAt < now - 30);
  const bySymbol = new Map<string, PracticeForecast[]>();
  for (const r of due) bySymbol.set(r.symbol, [...(bySymbol.get(r.symbol) ?? []), r]);
  for (const [symbol, list] of bySymbol) {
    const stock = stockBySymbol(symbol);
    if (!stock) continue;
    const rounds = await history(stock);
    const readAt = historyReadAt(stock) / 1000;
    for (const r of list) {
      if (readAt <= r.resolvesAt) continue; // the cached read predates the horizon: wait for a fresh one
      const end = roundAt(rounds, r.resolvesAt);
      if (!end) continue;
      if (end.id.toString() === r.referenceRound) {
        r.status = "void";
        r.resolvedRound = end.id.toString();
      } else {
        const ref = BigInt(r.reference);
        const { score, inRange } = scoreOf(BigInt(r.low), BigInt(r.high), r.confidenceBps, ref, end.units, r.horizon);
        Object.assign(r, {
          status: "scored",
          score,
          inRange,
          directionHit: r.direction !== 0 && r.direction === outcomeDirection(ref, end.units),
          price: end.units.toString(),
          resolvedRound: end.id.toString(),
        });
      }
      const left = Math.max(60, r.madeAt + PRACTICE_TTL - now);
      await store.setEx(recKey(r.id), JSON.stringify(r), left);
    }
  }
}

async function load(store: Store, ids: string[]) {
  if (!ids.length) return [];
  const raws = await store.mget(ids.map(recKey));
  const recs = raws.flatMap((raw) => {
    if (!raw) return [];
    try {
      return [JSON.parse(raw) as PracticeForecast];
    } catch {
      return [];
    }
  });
  await settle(store, recs);
  return recs;
}

export async function walletForecasts(store: Store, wallet: string) {
  return load(store, await store.range(walletList(wallet.toLowerCase()), WALLET_KEEP));
}

let boardCache: { at: number; recs: PracticeForecast[] } | null = null;

/** Every practice forecast still kept (newest first), cached 30 s. */
export async function allForecasts(store: Store) {
  if (boardCache && Date.now() - boardCache.at < 30_000) return boardCache.recs;
  const recs = await load(store, await store.range(LIST_ALL, LIST_KEEP));
  boardCache = { at: Date.now(), recs };
  return recs;
}

export const invalidateBoard = () => {
  boardCache = null;
};

export type PracticeRow = { wallet: string; tallies: Record<HorizonId, Tally> };

export function practiceTallies(recs: PracticeForecast[]): PracticeRow[] {
  const by = new Map<string, PracticeRow>();
  for (const r of recs) {
    const row = by.get(r.wallet) ?? { wallet: r.wallet, tallies: { 0: emptyTally(), 1: emptyTally(), 2: emptyTally() } };
    const t = row.tallies[r.horizon];
    t.committed += 1;
    if (r.status === "void") t.voided += 1;
    if (r.status === "scored") {
      t.scored += 1;
      t.scoreSum += r.score ?? 0;
      if (r.inRange) t.inRange += 1;
      if (r.direction !== 0) {
        t.directionCalls += 1;
        if (r.directionHit) t.directionHits += 1;
      }
    }
    by.set(r.wallet, row);
  }
  return [...by.values()];
}

export const toPublic = (r: PracticeForecast) => ({
  ...r,
  lowPrice: Number(BigInt(r.low)) / 1e8,
  highPrice: Number(BigInt(r.high)) / 1e8,
  referencePrice: Number(BigInt(r.reference)) / 1e8,
  resolvedPrice: r.price ? Number(BigInt(r.price)) / 1e8 : null,
});

export { toUnits };
