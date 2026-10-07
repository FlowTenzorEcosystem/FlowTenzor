"use client";

import { CONTRACTS, DEPLOY } from "@/config/contracts";
import { BRAND, USDG, isAddress } from "@/config/brand";
import { rpc } from "@/lib/rpc";
import { simulate, waitReceipt } from "@/lib/onchain/client";
import {
  TOPIC_MODEL_REGISTERED,
  decodeForecastPage,
  decodeModel,
  decodeStats,
  encodeAllowance,
  encodeApprove,
  encodeBalanceOf,
  encodeBond,
  encodeBondOf,
  encodeBuy,
  encodeCallsPurchased,
  encodeCommit,
  encodeForecastCount,
  encodeForecastsFrom,
  encodeIsBonded,
  encodeModel,
  encodeModelCount,
  encodeRegister,
  encodeRequestExit,
  encodeScore,
  encodeStats,
  encodeWithdraw,
  type ChainForecast,
  type ChainModel,
  type ChainStats,
  type CommitInput,
} from "@/lib/onchain/calls";
import { readWord } from "@/lib/abi";

/*
 * Browser side of the FlowTenzor contracts: reads through the site relay (and
 * the public RPC as fallback), a dry run of every transaction before the
 * wallet is asked, and the receipt afterwards.
 */

export type Wallet = { address: string; send: (tx: { to?: string; data: string; value?: bigint }) => Promise<string> };
export type Step = (label: string) => void;
export type TxResult = { hash: string; block: number };

const call = (to: string, data: string) => rpc<string>("eth_call", [{ to, data }, "latest"]);

async function sendChecked(w: Wallet, to: string, data: string, step: Step, label: string): Promise<TxResult & { logs: { topics: string[]; data: string; address: string }[] }> {
  step(`Checking: ${label}`);
  await simulate({ from: w.address, to, data });
  step(`Confirm in your wallet: ${label}`);
  const hash = await w.send({ to, data });
  step("Waiting for the block…");
  const receipt = await waitReceipt(hash);
  return { hash, block: Number(BigInt(receipt.blockNumber)), logs: receipt.logs };
}

const oracle = () => CONTRACTS.oracle.address;

export async function modelCount() {
  return Number(BigInt(await call(oracle(), encodeModelCount())));
}

export async function readModel(id: bigint): Promise<ChainModel> {
  return decodeModel(await call(oracle(), encodeModel(id)), id);
}

/** All models (newest 200), with their owner. */
export async function readModels(limit = 200): Promise<ChainModel[]> {
  const n = await modelCount();
  const ids: bigint[] = [];
  for (let i = n; i >= 1 && ids.length < limit; i--) ids.push(BigInt(i));
  return Promise.all(ids.map(readModel));
}

export async function readStats(id: bigint, horizon: number): Promise<ChainStats> {
  return decodeStats(await call(oracle(), encodeStats(id, horizon)));
}

/** The newest `count` forecasts, newest first. */
export async function readRecentForecasts(count = 100): Promise<ChainForecast[]> {
  const total = Number(BigInt(await call(oracle(), encodeForecastCount())));
  if (total === 0) return [];
  const from = Math.max(1, total - count + 1);
  const page = decodeForecastPage(await call(oracle(), encodeForecastsFrom(BigInt(from), Math.min(count, 100))), BigInt(from));
  return page.reverse();
}

export async function registerOnChain(w: Wallet, name: string, uri: string, step: Step): Promise<TxResult & { modelId: bigint | null }> {
  const r = await sendChecked(w, oracle(), encodeRegister(name, uri), step, `register model "${name}"`);
  const log = r.logs.find((l) => l.address.toLowerCase() === oracle().toLowerCase() && l.topics[0]?.toLowerCase() === TOPIC_MODEL_REGISTERED);
  return { hash: r.hash, block: r.block, modelId: log ? BigInt(log.topics[1]) : null };
}

export async function commitOnChain(w: Wallet, modelId: bigint, input: CommitInput, step: Step): Promise<TxResult> {
  const r = await sendChecked(w, oracle(), encodeCommit(modelId, input), step, "commit the forecast");
  return { hash: r.hash, block: r.block };
}

export async function scoreOnChain(w: Wallet, forecastId: bigint, round: bigint, step: Step): Promise<TxResult> {
  const r = await sendChecked(w, oracle(), encodeScore(forecastId, round), step, `score forecast #${forecastId}`);
  return { hash: r.hash, block: r.block };
}

/** The Chainlink round that was current at a forecast's horizon, found by the server from the feed's history. */
export async function roundHint(symbol: string, at: number): Promise<bigint> {
  const res = await fetch(`/api/onchain/hint?symbol=${encodeURIComponent(symbol)}&t=${at}`, { cache: "no-store" });
  const body = (await res.json()) as { round?: string; error?: string };
  if (!res.ok || !body.round) throw new Error(body.error ?? "Could not find the Chainlink round for this horizon yet.");
  return BigInt(body.round);
}

// ------------------------------------------------------------------ token helpers

export async function balanceOf(token: string, owner: string) {
  return BigInt(await call(token, encodeBalanceOf(owner)));
}
export async function allowanceOf(token: string, owner: string, spender: string) {
  return BigInt(await call(token, encodeAllowance(owner, spender)));
}

async function ensureAllowance(w: Wallet, token: string, spender: string, amount: bigint, symbol: string, step: Step) {
  const have = await allowanceOf(token, w.address, spender).catch(() => 0n);
  if (have >= amount) return;
  // Exact amount, never unlimited.
  await sendChecked(w, token, encodeApprove(spender, amount), step, `approve ${symbol}`);
}

// ------------------------------------------------------------------ credits

export async function callsPurchased(account: string) {
  return Number(BigInt(await call(CONTRACTS.credits.address, encodeCallsPurchased(account))));
}

export async function buyCredits(w: Wallet, packs: bigint, step: Step): Promise<TxResult> {
  const amount = packs * BigInt(DEPLOY.packPrice);
  await ensureAllowance(w, USDG.address, CONTRACTS.credits.address, amount, USDG.symbol, step);
  const r = await sendChecked(w, CONTRACTS.credits.address, encodeBuy(w.address, packs), step, `buy ${packs} pack${packs === 1n ? "" : "s"}`);
  return { hash: r.hash, block: r.block };
}

// ------------------------------------------------------------------ bond

export async function bondState(modelId: bigint, poster: string) {
  const [raw, bonded] = await Promise.all([call(CONTRACTS.bond.address, encodeBondOf(modelId, poster)), call(CONTRACTS.bond.address, encodeIsBonded(modelId))]);
  return { amount: readWord(raw, 0), postedAt: Number(readWord(raw, 1)), exitAt: Number(readWord(raw, 2)), bonded: BigInt(bonded) === 1n };
}

export async function bondModel(w: Wallet, modelId: bigint, step: Step): Promise<TxResult> {
  if (!isAddress(BRAND.ca)) throw new Error("The token is not live yet.");
  await ensureAllowance(w, BRAND.ca, CONTRACTS.bond.address, BigInt(DEPLOY.bondAmount), BRAND.symbol, step);
  const r = await sendChecked(w, CONTRACTS.bond.address, encodeBond(modelId), step, "post the bond");
  return { hash: r.hash, block: r.block };
}

export async function requestBondExit(w: Wallet, modelId: bigint, step: Step): Promise<TxResult> {
  const r = await sendChecked(w, CONTRACTS.bond.address, encodeRequestExit(modelId), step, "start the exit delay");
  return { hash: r.hash, block: r.block };
}

export async function withdrawBond(w: Wallet, modelId: bigint, step: Step): Promise<TxResult> {
  const r = await sendChecked(w, CONTRACTS.bond.address, encodeWithdraw(modelId), step, "withdraw the bond");
  return { hash: r.hash, block: r.block };
}
