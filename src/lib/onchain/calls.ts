import { keccak_256 } from "@noble/hashes/sha3.js";
import { address, dynamic, encode, fixed, readAddress, readInt, readWord, word } from "@/lib/abi";

/*
 * ABI encoding and decoding for the FlowTenzor contracts, without a library.
 * Selectors are derived from the signatures at load time, so a typo cannot
 * silently call the wrong function.
 */

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const selector = (sig: string) => hex(keccak_256(new TextEncoder().encode(sig))).slice(0, 8);
const sel = (sig: string) => `0x${selector(sig)}`;

const COMMIT_TUPLE = "(uint16,uint8,uint128,uint128,uint16)";

export const SIG = {
  registerModel: "registerModel(string,string)",
  commit: `commit(uint256,${COMMIT_TUPLE})`,
  score: "score(uint256,uint80)",
  scoreMany: "scoreMany(uint256[],uint80[])",
  transferModel: "transferModel(uint256,address)",
  modelCount: "modelCount()",
  model: "model(uint256)",
  forecastCount: "forecastCount()",
  getForecast: "getForecast(uint256)",
  forecastsFrom: "forecastsFrom(uint256,uint256)",
  stats: "stats(uint256,uint8)",
  marketCount: "marketCount()",
  latestId: "latestId(uint256,uint256,uint8)",
  buy: "buy(address,uint256)",
  callsPurchased: "callsPurchased(address)",
  packPrice: "packPrice()",
  callsPerPack: "callsPerPack()",
  bond: "bond(uint256)",
  requestExit: "requestExit(uint256)",
  withdraw: "withdraw(uint256)",
  bondOf: "bondOf(uint256,address)",
  isBonded: "isBonded(uint256)",
  bondAmount: "bondAmount()",
  approve: "approve(address,uint256)",
  allowance: "allowance(address,address)",
  balanceOf: "balanceOf(address)",
} as const;

/** Topic of ModelRegistered, to read the new model id from a receipt. */
export const TOPIC_MODEL_REGISTERED = `0x${hex(keccak_256(new TextEncoder().encode("ModelRegistered(uint256,address,string,string)")))}`;
export const TOPIC_FORECAST_COMMITTED = `0x${hex(
  keccak_256(new TextEncoder().encode("ForecastCommitted(uint256,uint256,uint256,uint8,uint128,uint128,uint16,uint128,uint80,uint40)")),
)}`;

function utf8(s: string) {
  return hex(new TextEncoder().encode(s));
}
function stringArg(s: string) {
  const data = utf8(s);
  return word(data.length / 2) + data.padEnd(Math.ceil(data.length / 64) * 64, "0");
}

export const encodeRegister = (name: string, uri: string) => sel(SIG.registerModel) + encode([dynamic(stringArg(name)), dynamic(stringArg(uri))]);

export type CommitInput = { marketId: number; horizon: number; low: bigint; high: bigint; confidenceBps: number };
export const encodeCommit = (modelId: bigint, c: CommitInput) =>
  sel(SIG.commit) + word(modelId) + word(c.marketId) + word(c.horizon) + word(c.low) + word(c.high) + word(c.confidenceBps);
export const encodeScore = (id: bigint, round: bigint) => sel(SIG.score) + word(id) + word(round);
export const encodeModelCount = () => sel(SIG.modelCount);
export const encodeModel = (id: bigint) => sel(SIG.model) + word(id);
export const encodeForecastCount = () => sel(SIG.forecastCount);
export const encodeGetForecast = (id: bigint) => sel(SIG.getForecast) + word(id);
export const encodeForecastsFrom = (from: bigint, count: number) => sel(SIG.forecastsFrom) + word(from) + word(count);
export const encodeStats = (id: bigint, h: number) => sel(SIG.stats) + word(id) + word(h);
export const encodeMarketCount = () => sel(SIG.marketCount);
export const encodeBuy = (account: string, packs: bigint) => sel(SIG.buy) + address(account) + word(packs);
export const encodeCallsPurchased = (account: string) => sel(SIG.callsPurchased) + address(account);
export const encodePackPrice = () => sel(SIG.packPrice);
export const encodeCallsPerPack = () => sel(SIG.callsPerPack);
export const encodeBond = (id: bigint) => sel(SIG.bond) + word(id);
export const encodeRequestExit = (id: bigint) => sel(SIG.requestExit) + word(id);
export const encodeWithdraw = (id: bigint) => sel(SIG.withdraw) + word(id);
export const encodeBondOf = (id: bigint, poster: string) => sel(SIG.bondOf) + word(id) + address(poster);
export const encodeIsBonded = (id: bigint) => sel(SIG.isBonded) + word(id);
export const encodeBondAmount = () => sel(SIG.bondAmount);
export const encodeApprove = (spender: string, amount: bigint) => sel(SIG.approve) + address(spender) + word(amount);
export const encodeAllowance = (owner: string, spender: string) => sel(SIG.allowance) + address(owner) + address(spender);
export const encodeBalanceOf = (owner: string) => sel(SIG.balanceOf) + address(owner);

/** Constructor arguments, ABI-encoded (appended to the creation code by /deploy). */
export function encodeOracleArgs(feeds: string[], symbols: string[], maxReferenceAge: number) {
  const feedArr = word(feeds.length) + feeds.map(address).join("");
  const symArr = word(symbols.length) + symbols.map((s) => utf8(s).padEnd(64, "0")).join("");
  return encode([dynamic(feedArr), dynamic(symArr), fixed(word(maxReferenceAge))]);
}
export const encodeCreditsArgs = (token: string, treasury: string, callsPerPack: number, packPrice: number) =>
  address(token) + address(treasury) + word(callsPerPack) + word(packPrice);
export const encodeBondArgs = (token: string, oracle: string, amount: bigint, exitDelay: number) =>
  address(token) + address(oracle) + word(amount) + word(exitDelay);

// ------------------------------------------------------------------ decoding

export type ChainForecast = {
  id: bigint;
  modelId: bigint;
  marketId: number;
  horizon: number;
  confidenceBps: number;
  status: number; // 0 none, 1 open, 2 scored, 3 void
  direction: number;
  inRange: boolean;
  directionHit: boolean;
  score: number;
  committedAt: number;
  resolvesAt: number;
  referenceRound: bigint;
  resolvedRound: bigint;
  low: bigint;
  high: bigint;
  referencePrice: bigint;
  resolvedPrice: bigint;
};

function forecastAt(data: string, base: number, id: bigint): ChainForecast {
  const w = (i: number) => readWord(data, base + i);
  return {
    id,
    modelId: w(0),
    marketId: Number(w(1)),
    horizon: Number(w(2)),
    confidenceBps: Number(w(3)),
    status: Number(w(4)),
    direction: Number(readInt(data, base + 5)),
    inRange: w(6) === 1n,
    directionHit: w(7) === 1n,
    score: Number(w(8)),
    committedAt: Number(w(9)),
    resolvesAt: Number(w(10)),
    referenceRound: w(11),
    resolvedRound: w(12),
    low: w(13),
    high: w(14),
    referencePrice: w(15),
    resolvedPrice: w(16),
  };
}

export const FORECAST_WORDS = 17;

export const decodeForecast = (result: string, id: bigint) => forecastAt(result, 0, id);

export function decodeForecastPage(result: string, fromId: bigint): ChainForecast[] {
  const offset = Number(readWord(result, 0)) / 32;
  const n = Number(readWord(result, offset));
  return Array.from({ length: n }, (_, i) => forecastAt(result, offset + 1 + i * FORECAST_WORDS, (fromId === 0n ? 1n : fromId) + BigInt(i)));
}

function readString(result: string, wordIndex: number) {
  const len = Number(readWord(result, wordIndex));
  const data = (result.startsWith("0x") ? result.slice(2) : result).slice((wordIndex + 1) * 64, (wordIndex + 1) * 64 + len * 2);
  return new TextDecoder().decode(Uint8Array.from(data.match(/../g) ?? [], (h) => parseInt(h, 16)));
}

export type ChainModel = { id: bigint; owner: string; registeredAt: number; name: string; uri: string };

/** model(uint256) returns a dynamic tuple (address, uint40, string, string). */
export function decodeModel(result: string, id: bigint): ChainModel {
  const base = Number(readWord(result, 0)) / 32;
  const nameAt = base + Number(readWord(result, base + 2)) / 32;
  const uriAt = base + Number(readWord(result, base + 3)) / 32;
  return { id, owner: readAddress(result, base), registeredAt: Number(readWord(result, base + 1)), name: readString(result, nameAt), uri: readString(result, uriAt) };
}

export type ChainStats = { committed: number; scored: number; voided: number; inRange: number; directionCalls: number; directionHits: number; scoreSum: number; lastScoredAt: number };

export function decodeStats(result: string): ChainStats {
  const w = (i: number) => Number(readWord(result, i));
  return { committed: w(0), scored: w(1), voided: w(2), inRange: w(3), directionCalls: w(4), directionHits: w(5), scoreSum: w(6), lastScoredAt: w(7) };
}

export function decodeString(result: string) {
  try {
    return readString(result, Number(readWord(result, 0)) / 32);
  } catch {
    return "";
  }
}

// ------------------------------------------------------------------ revert reasons

const ERRORS: [string, string][] = [
  ["NotModelOwner(uint256)", "Only the wallet that owns this model can do that."],
  ["UnknownModel(uint256)", "That model id does not exist on the oracle."],
  ["UnknownMarket(uint256)", "That token is not listed on the oracle."],
  ["UnknownHorizon(uint8)", "Horizons are one hour, one day or one week."],
  ["ConfidenceOutOfRange(uint16)", "Confidence must be between 50 % and 99 %."],
  ["BadRange()", "The low end must be above zero and below the high end."],
  ["RangeTooFar()", "Both ends must sit within a factor of four of the current price."],
  ["StillOpen(uint256)", "This model already has a live forecast for this token and horizon. The next one opens when it resolves."],
  ["FeedAnswerInvalid(address)", "The Chainlink feed returned an unusable answer. Try again later."],
  ["ReferenceTooOld(uint256)", "The Chainlink feed has not updated for too long (market closed for several days)."],
  ["NotOpen(uint256)", "This forecast is already scored or void."],
  ["NotDue(uint256)", "This forecast's horizon has not passed yet."],
  ["WrongRound(uint80)", "That Chainlink round was not the one current at the horizon."],
  ["NameLength()", "Model names are 1 to 32 bytes."],
  ["UriLength()", "The link is too long (200 bytes at most)."],
  ["ZeroPacks()", "Choose at least one pack."],
  ["TransferShortfall(uint256,uint256)", "The token moved less than the full amount. Nothing was recorded."],
  ["AlreadyBonded(uint256)", "You already have a bond on this model."],
  ["NoBond(uint256)", "You have no bond on this model."],
  ["ExitPending(uint256)", "An exit is already running for this bond."],
  ["ExitNotRequested(uint256)", "Request the exit first, then withdraw after the delay."],
  ["TooEarly(uint256)", "The exit delay has not passed yet."],
  ["ERC20InsufficientAllowance(address,uint256,uint256)", "The token allowance is too low. Approve first."],
  ["ERC20InsufficientBalance(address,uint256,uint256)", "Not enough tokens in this wallet."],
];

export const REVERT_REASONS: Record<string, string> = Object.fromEntries(ERRORS.map(([sig, text]) => [sel(sig), text]));
