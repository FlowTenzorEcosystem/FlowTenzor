import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBatch } from "./relay";

const FEED = "0x379ec4f7c378f34a1b47e4f3cbebcbac3e8e9f15";
const targets = new Set([FEED]);
const logs = (filter: Record<string, unknown>) => [{ method: "eth_getLogs", params: [filter] }];

test("eth_getLogs needs an allowed address", () => {
  assert.ok("error" in checkBatch(logs({ fromBlock: "0x1", toBlock: "0x10" }), targets));
  assert.ok("error" in checkBatch(logs({ fromBlock: "0x1", toBlock: "0x10", topics: ["0x" + "1".repeat(64)] }), targets));
  assert.ok("error" in checkBatch(logs({ fromBlock: "0x1", toBlock: "0x10", address: "0x000000000000000000000000000000000000dead" }), targets));
  assert.ok("error" in checkBatch(logs({ fromBlock: "0x1", toBlock: "0x10", address: [] }), targets));
  assert.ok("error" in checkBatch(logs({ fromBlock: "0x1", toBlock: "0x10", address: Array(6).fill(FEED) }), targets));
  assert.ok("units" in checkBatch(logs({ fromBlock: "0x1", toBlock: "0x10", address: FEED }), targets));
  assert.ok("units" in checkBatch(logs({ fromBlock: "0x1", toBlock: "0x10", address: [FEED] }), targets));
});

test("eth_getLogs is priced by span", () => {
  const narrow = checkBatch(logs({ fromBlock: "0x1", toBlock: "0x10", address: FEED }), targets);
  const wide = checkBatch(logs({ fromBlock: "0x1", toBlock: "0x4e20", address: FEED }), targets);
  assert.ok("units" in narrow && "units" in wide && wide.units > narrow.units + 15);
});

test("eth_getBlockByNumber only without transaction bodies", () => {
  assert.ok("units" in checkBatch([{ method: "eth_getBlockByNumber", params: ["latest", false] }], targets));
  assert.ok("error" in checkBatch([{ method: "eth_getBlockByNumber", params: ["latest", true] }], targets));
  assert.ok("error" in checkBatch([{ method: "eth_getBlockByNumber", params: ["latest"] }], targets));
});
