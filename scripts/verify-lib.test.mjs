import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeArgs, verifyDeployment } from "./verify-lib.mjs";

const pad = (n) => BigInt(n).toString(16).padStart(64, "0");
const addr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const FEEDS = ["0x379ec4f7c378f34a1b47e4f3cbebcbac3e8e9f15", "0x6b22a786baa607d76728168703a39ea9c99f2cd0"];
const stocks = [{ symbol: "NVDA", feed: FEEDS[0] }, { symbol: "AAPL", feed: FEEDS[1] }];
const sym = (s) => Buffer.from(s).toString("hex").padEnd(64, "0");
const oracleArgs = (feeds = FEEDS, age = 345600) => pad(96) + pad(96 + 32 + feeds.length * 32) + pad(age) + pad(feeds.length) + feeds.map(addr).join("") + pad(2) + sym("NVDA") + sym("AAPL");
const artifacts = {
  ForecastOracle: { creation: "0x6001600255", runtime: "0xaa01", immutables: 0 },
  CallCredits: { creation: "0x6002600255", runtime: "0xbb02", immutables: 0 },
  ModelBond: { creation: "0x6003600255", runtime: "0xcc03", immutables: 0 },
};
const ADDRESS = "0x1111111111111111111111111111111111111111";
const TX = "0x" + "ab".repeat(32);

function chain({ code = "0xaa01", input = "0x6001600255" + oracleArgs(), status = "0x1", getters = {} } = {}) {
  return async (method, params) => {
    if (method === "eth_chainId") return "0x1237";
    if (method === "eth_getCode") return code;
    if (method === "eth_getTransactionByHash") return { hash: TX, to: null, input };
    if (method === "eth_getTransactionReceipt") return { status, contractAddress: ADDRESS, blockNumber: "0x10" };
    if (method === "eth_call") {
      const sel = params[0].data.slice(0, 10);
      if (getters[sel]) return getters[sel];
      if (sel === "0xbc5c06af") return "0x" + pad(345600);
      if (sel === "0xec979082") return "0x" + pad(2);
      if (sel === "0x28861d22") return "0x" + addr(FEEDS[0]) + sym("NVDA");
      return "0x" + pad(0);
    }
    throw new Error("unexpected " + method);
  };
}
const expected = { stocks, maxReferenceAge: 345600 };

test("decodes oracle arguments", () => {
  const a = decodeArgs("ForecastOracle", oracleArgs());
  assert.deepEqual(a.symbols, ["NVDA", "AAPL"]);
  assert.equal(a.feeds[1], FEEDS[1]);
  assert.equal(a.maxReferenceAge, 345600n);
});

test("a matching oracle deployment passes", async () => {
  const r = await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain(), expected });
  assert.equal(r.ok, true, r.lines.join("\n"));
  assert.equal(r.kind, "ForecastOracle");
});

test("a swapped feed fails", async () => {
  const r = await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain({ input: "0x6001600255" + oracleArgs([FEEDS[1], FEEDS[0]]) }), expected });
  assert.equal(r.ok, false);
});

test("a different max age fails, also when only the getter differs", async () => {
  assert.equal((await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain({ input: "0x6001600255" + oracleArgs(FEEDS, 60) }), expected })).ok, false);
  assert.equal((await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain({ getters: { "0xbc5c06af": "0x" + pad(7) } }), expected })).ok, false);
});

test("foreign runtime code, trailing bytes, failed tx and immutables all fail", async () => {
  assert.equal((await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain({ code: "0xaa02" }), expected })).ok, false);
  assert.equal((await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain({ input: "0x6001600255" + oracleArgs() + "00" }), expected })).ok, false);
  assert.equal((await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain({ status: "0x0" }), expected })).ok, false);
  const bad = { ...artifacts, ForecastOracle: { ...artifacts.ForecastOracle, immutables: 1 } };
  assert.equal((await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts: bad, rpc: chain(), expected })).ok, false);
});

test("model bond must point at the configured token and oracle", async () => {
  const CA = "0x2222222222222222222222222222222222222222";
  const OR = "0x3333333333333333333333333333333333333333";
  const input = "0x6003600255" + addr(CA) + addr(OR) + pad(10n ** 24n) + pad(604800);
  const getters = { "0xfc0c546a": "0x" + addr(CA), "0x7dc0d1d0": "0x" + addr(OR) };
  const exp = { ca: CA, oracle: OR, bondAmount: (10n ** 24n).toString(), exitDelay: 604800 };
  const ok = await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain({ code: "0xcc03", input, getters }), expected: exp });
  assert.equal(ok.ok, true, ok.lines.join("\n"));
  const wrong = await verifyDeployment({ address: ADDRESS, txHash: TX, artifacts, rpc: chain({ code: "0xcc03", input, getters }), expected: { ...exp, oracle: CA } });
  assert.equal(wrong.ok, false);
});
