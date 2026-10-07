// Re-checks every line of src/config/stocks.ts against Robinhood Chain.
//   node scripts/verify-stocks.mjs
// For each stock token: the runtime code embeds Robinhood's token beacon, symbol() equals the ticker and
// name() ends in "Robinhood Token". For each feed: decimals() is 8, description() names the same ticker
// against USD, and latestRoundData() answers a positive price. Exits non-zero on any FAIL.
// RPC: FLOWTENZOR_RPC_URL from your shell, else the public Robinhood Chain endpoint.
import { readFileSync } from "node:fs";

const RPC = process.env.FLOWTENZOR_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const BEACON = "e10b6f6b275de231345c20d14ab812db62151b00";

let seq = 0;
async function rpc(method, params) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method, params }),
        signal: AbortSignal.timeout(20_000),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error.message);
      return body.result;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);

function text(hex) {
  if (!hex || hex === "0x") return "";
  const buf = Buffer.from(hex.slice(2), "hex");
  if (buf.length === 32) return buf.toString("utf8").replace(/\0+$/, "");
  const len = Number(BigInt("0x" + buf.subarray(32, 64).toString("hex")));
  return buf.subarray(64, 64 + len).toString("utf8");
}

const source = readFileSync(new URL("../src/config/stocks.ts", import.meta.url), "utf8");
const rows = [...source.matchAll(/\{ symbol: "(\w+)", name: "[^"]*", token: "(0x[0-9a-fA-F]{40})", feed: "(0x[0-9a-fA-F]{40})" \}/g)].map(
  (m) => ({ symbol: m[1], token: m[2], feed: m[3] }),
);
let failed = 0;
for (const r of rows) {
  const problems = [];
  try {
    const code = (await rpc("eth_getCode", [r.token, "latest"])).toLowerCase();
    if (!code.includes(BEACON)) problems.push("token code does not embed the beacon");
    const [symbol, name] = [text(await call(r.token, "0x95d89b41")), text(await call(r.token, "0x06fdde03"))];
    if (symbol !== r.symbol) problems.push(`symbol() is ${symbol}`);
    if (!/Robinhood Token\s*$/.test(name)) problems.push(`name() is "${name}"`);
    const decimals = Number(BigInt(await call(r.feed, "0x313ce567")));
    if (decimals !== 8) problems.push(`feed decimals ${decimals}`);
    const description = text(await call(r.feed, "0x7284e416"));
    if (!new RegExp(`(?:^|[^A-Z])(?:RH)?${r.symbol}\\s*[-/]\\s*USD$`).test(description)) problems.push(`feed description "${description}"`);
    const latest = await call(r.feed, "0xfeaf968c");
    const answer = BigInt("0x" + latest.slice(66, 130));
    const updated = Number(BigInt("0x" + latest.slice(194, 258)));
    if (answer <= 0n) problems.push("feed answer not positive");
    console.log(
      `${problems.length ? "FAIL" : "OK  "} ${r.symbol.padEnd(5)} ${name.padEnd(48)} feed "${description}" $${(Number(answer) / 1e8).toFixed(2)} ${new Date(updated * 1000).toISOString().slice(0, 16)}${problems.length ? "  " + problems.join("; ") : ""}`,
    );
  } catch (e) {
    problems.push(String(e.message ?? e));
    console.log(`FAIL ${r.symbol}: ${problems.join("; ")}`);
  }
  if (problems.length) failed++;
}
console.log(`${rows.length - failed}/${rows.length} lines verified`);
process.exit(failed || rows.length === 0 ? 1 : 0);
