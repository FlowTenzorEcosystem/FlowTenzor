import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { encodeBondArgs, encodeCommit, encodeCreditsArgs, encodeOracleArgs, encodeRegister, selector } from "./calls";

const cast = `${homedir()}/.foundry/bin/cast`;
const has = existsSync(cast);
const run = (...a: string[]) => execFileSync(cast, a, { encoding: "utf8" }).trim();

test("selectors", () => {
  assert.equal(selector("commit(uint256,(uint16,uint8,uint128,uint128,uint16))"), "8f88ac17");
  assert.equal(selector("consensus(uint256,uint8,uint256[])"), "127e6268");
});

test("encodings match cast abi-encode", { skip: !has }, () => {
  const feeds = ["0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15", "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0"];
  const sym = (s: string) => `0x${Buffer.from(s).toString("hex").padEnd(64, "0")}`;
  assert.equal(`0x${encodeOracleArgs(feeds, ["NVDA", "AAPL"], 345600)}`, run("abi-encode", "f(address[],bytes32[],uint256)", `[${feeds.join(",")}]`, `[${sym("NVDA")},${sym("AAPL")}]`, "345600"));
  const t = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
  const r = "0x000000000000000000000000000000000000dEaD";
  assert.equal(`0x${encodeCreditsArgs(t, r, 1000, 1000000)}`, run("abi-encode", "f(address,address,uint256,uint256)", t, r, "1000", "1000000"));
  assert.equal(`0x${encodeBondArgs(t, r, 10n ** 24n, 604800)}`, run("abi-encode", "f(address,address,uint256,uint256)", t, r, (10n ** 24n).toString(), "604800"));
  assert.equal(encodeRegister("Still Water", "ipfs://x"), run("calldata", "registerModel(string,string)", "Still Water", "ipfs://x"));
  assert.equal(
    encodeCommit(3n, { marketId: 21, horizon: 1, low: 23000000000n, high: 24000000000n, confidenceBps: 8000 }),
    run("calldata", "commit(uint256,(uint16,uint8,uint128,uint128,uint16))", "3", "(21,1,23000000000,24000000000,8000)"),
  );
});
