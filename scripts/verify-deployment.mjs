// Proves that a deployed address runs exactly this repository's contract code with the expected arguments.
//   (cd contracts && ./setup.sh && forge build --force) && npm run verify-deployment -- <address> --tx <deployment tx hash> [--kind ForecastOracle] [--treasury 0x…]
// Prints OK/FAIL per check and exits non-zero on any FAIL. See scripts/verify-lib.mjs for what is compared.
// RPC: FLOWTENZOR_RPC_URL from your shell, else the public Robinhood Chain endpoint.
import { readFileSync, existsSync } from "node:fs";
import { KINDS, verifyDeployment } from "./verify-lib.mjs";

const RPC = process.env.FLOWTENZOR_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const address = args.find((a) => /^0x[0-9a-fA-F]{40}$/.test(a) && a !== opt("--treasury"));

async function rpc(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (!body || typeof body !== "object" || !("result" in body || "error" in body)) throw new Error("malformed JSON-RPC answer");
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

const artifacts = {};
for (const name of KINDS) {
  const file = new URL(`../contracts/out/${name}.sol/${name}.json`, import.meta.url);
  if (!existsSync(file)) {
    console.log(`FAIL contracts/out/${name}.sol is missing. Run: cd contracts && ./setup.sh && forge build --force`);
    process.exit(1);
  }
  const a = JSON.parse(readFileSync(file, "utf8"));
  artifacts[name] = { creation: a.bytecode.object.toLowerCase(), runtime: a.deployedBytecode.object.toLowerCase(), immutables: Object.keys(a.deployedBytecode.immutableReferences ?? {}).length };
}
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const contracts = read("../src/config/contracts.ts");
const brand = read("../src/config/brand.ts");
const stocksSrc = read("../src/config/stocks.ts");
// "4 * 24 * 3600" -> 345600, without evaluating code.
const product = (s) => (s ? s.split("*").map((x) => Number(x.trim())).reduce((a, b) => a * b, 1) : 0);
const num = (re) => {
  const m = re.exec(contracts);
  return m ? m[1].replace(/_/g, "") : undefined;
};
const configAddresses = Object.fromEntries([...contracts.matchAll(/const (ORACLE|CREDITS|BOND) = "(0x[0-9a-fA-F]{40})"/g)].map((m) => [m[1], m[2]]));
const expected = {
  stocks: [...stocksSrc.matchAll(/\{ symbol: "(\w+)", name: "[^"]*", token: "0x[0-9a-fA-F]{40}", feed: "(0x[0-9a-fA-F]{40})" \}/g)].map((m) => ({ symbol: m[1], feed: m[2] })),
  maxReferenceAge: product(num(/maxReferenceAge: ([0-9 *_]+),/)),
  usdg: /address: "(0x[0-9a-fA-F]{40})",\n  symbol: "USDG"/.exec(brand)?.[1],
  callsPerPack: num(/callsPerPack: ([0-9_]+),/),
  packPrice: num(/packPrice: ([0-9_]+),/),
  bondAmount: /bondAmount: "(\d+)"/.exec(contracts)?.[1],
  exitDelay: product(num(/exitDelay: ([0-9 *_]+),/)),
  ca: /const CA = "(0x[0-9a-fA-F]{40})"/.exec(brand)?.[1],
  oracle: configAddresses.ORACLE ?? process.env.FLOWTENZOR_ORACLE,
  treasury: opt("--treasury"),
};

let result;
try {
  result = await verifyDeployment({ address, txHash: opt("--tx"), kind: opt("--kind"), artifacts, rpc, expected, configAddresses });
} catch (e) {
  console.log(`FAIL unexpected error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
for (const l of result.lines) console.log(l);
console.log(result.ok ? `MATCH: ${address} runs ${result.kind} from this build with the expected arguments.` : "MISMATCH: do not trust this deployment.");
process.exit(result.ok ? 0 : 1);
