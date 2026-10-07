import { test } from "node:test";
import assert from "node:assert/strict";
import { jsonCapped } from "./capped";

test("jsonCapped reads small answers and refuses large ones", async () => {
  assert.deepEqual(await jsonCapped(new Response(JSON.stringify({ a: 1 })), 100), { a: 1 });
  await assert.rejects(jsonCapped(new Response("x".repeat(500)), 100), /too large/);
  const stream = new ReadableStream({ start(c) { for (let i = 0; i < 10; i++) c.enqueue(new TextEncoder().encode("y".repeat(50))); c.close(); } });
  await assert.rejects(jsonCapped(new Response(stream), 200), /too large/);
});
