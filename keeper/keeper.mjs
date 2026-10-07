// Scores ForecastOracle forecasts whose horizon has passed, so every record stays complete.
//
// score() is permissionless and the contract proves the Chainlink round itself, so this bot holds no
// power: it only pays gas. It walks the forecasts from a cursor, finds the round that was current at
// each due forecast's horizon, and sends them in batches through scoreMany.
//
// Config (environment):
//   ORACLE_CONTRACT   ForecastOracle address (the bot idles while empty)
//   KEEPER_RPC_URL    Robinhood Chain RPC (default: public endpoint)
//   KEEPER_KEY_FILE   file holding the keeper's private key (0x + 64 hex)
//   KEEPER_CHAIN_ID   default 4663
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACT = (process.env.ORACLE_CONTRACT || "").trim();
const RPC = process.env.KEEPER_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = Number(process.env.KEEPER_CHAIN_ID || 4663);
const KEY_FILE = process.env.KEEPER_KEY_FILE || "/run/keeper/keeper.key";
const TICK_MS = 30_000;
const PAGE = 100;
const BATCH = 32;
const GRACE_S = 20; // wait a little past the horizon so the round is final on every node

const forecastTuple =
  "(uint64 modelId, uint16 marketId, uint8 horizon, uint16 confidenceBps, uint8 status, int8 direction, bool inRange, bool directionHit, uint16 score, uint40 committedAt, uint40 resolvesAt, uint80 referenceRound, uint80 resolvedRound, uint128 low, uint128 high, uint128 referencePrice, uint128 resolvedPrice)";
const abi = parseAbi([
  "function forecastCount() view returns (uint256)",
  `function forecastsFrom(uint256 fromId, uint256 count) view returns (${forecastTuple}[])`,
  "function markets() view returns ((address feed, bytes32 symbol)[])",
  "function scoreMany(uint256[] forecastIds, uint80[] rounds) returns (uint256)",
]);
const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function getRoundData(uint80) view returns (uint80, int256, uint256, uint256, uint80)",
]);

// The RPC URL can carry an API key; it never reaches the logs.
const redact = (v) => (typeof v === "string" ? v.split(RPC).join("<rpc>").replace(/https?:\/\/[^\s"']+/g, "<url>") : v);
const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), level, msg: redact(msg), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, redact(v)])) }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The round current at time t: binary search over the feed's current phase. */
export async function roundAt(pub, feed, t) {
  const [id, , , updatedAt] = await pub.readContract({ address: feed, abi: feedAbi, functionName: "latestRoundData" });
  if (Number(updatedAt) <= t) return id;
  const phase = id >> 64n;
  let lo = 1n;
  let hi = (id & 0xffffffffffffffffn) - 1n;
  let found = null;
  while (lo <= hi) {
    const mid = (lo + hi) / 2n;
    const rid = (phase << 64n) | mid;
    const row = await pub.readContract({ address: feed, abi: feedAbi, functionName: "getRoundData", args: [rid] }).catch(() => null);
    if (row && Number(row[3]) > 0 && Number(row[3]) <= t) {
      found = rid;
      lo = mid + 1n;
    } else hi = mid - 1n;
  }
  return found;
}

async function main(pub, wallet, account) {
  const markets = await pub.readContract({ address: CONTRACT, abi, functionName: "markets" });
  log("info", "keeper up", { oracle: CONTRACT, markets: markets.length, keeper: account.address });
  let cursor = 1n; // lowest id that may still be open
  for (;;) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const total = await pub.readContract({ address: CONTRACT, abi, functionName: "forecastCount" });
      const due = [];
      let firstOpen = null;
      for (let from = cursor; from <= total; from += BigInt(PAGE)) {
        const page = await pub.readContract({ address: CONTRACT, abi, functionName: "forecastsFrom", args: [from, BigInt(PAGE)] });
        page.forEach((f, i) => {
          const id = from + BigInt(i);
          if (f.status !== 1) return;
          if (firstOpen === null) firstOpen = id;
          if (Number(f.resolvesAt) + GRACE_S < now) due.push({ id, f });
        });
      }
      cursor = firstOpen ?? total + 1n;
      for (let i = 0; i < due.length; i += BATCH) {
        const chunk = due.slice(i, i + BATCH);
        const ids = [];
        const rounds = [];
        for (const { id, f } of chunk) {
          const r = await roundAt(pub, markets[f.marketId].feed, Number(f.resolvesAt)).catch(() => null);
          if (r === null) continue;
          ids.push(id);
          rounds.push(r);
        }
        if (!ids.length) continue;
        const { request } = await pub.simulateContract({ account, address: CONTRACT, abi, functionName: "scoreMany", args: [ids, rounds] });
        const hash = await wallet.writeContract(request);
        const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
        log("info", "scored", { count: ids.length, tx: hash, status: receipt.status });
      }
      if (due.length === 0) {
        const bal = await pub.getBalance({ address: account.address });
        if (bal < 10n ** 15n) log("warn", "keeper balance low", { eth: formatEther(bal) });
      }
    } catch (e) {
      log("error", "tick failed", { error: String(e?.shortMessage ?? e?.message ?? e) });
    }
    await sleep(TICK_MS);
  }
}

if (!/^0x[0-9a-fA-F]{40}$/.test(CONTRACT)) {
  log("info", "ORACLE_CONTRACT not set yet; idling");
  setInterval(() => log("info", "still idle: set ORACLE_CONTRACT and restart"), 3600_000);
} else {
  const key = readFileSync(KEY_FILE, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`Bad key in ${KEY_FILE}`);
  const account = privateKeyToAccount(key);
  const chain = defineChain({ id: CHAIN_ID, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
  const pub = createPublicClient({ chain, transport: http(RPC, { timeout: 15_000, retryCount: 2 }) });
  const wallet = createWalletClient({ account, chain, transport: http(RPC, { timeout: 15_000, retryCount: 2 }) });
  main(pub, wallet, account).catch((e) => {
    log("error", "fatal", { error: String(e?.message ?? e) });
    process.exit(1);
  });
}
