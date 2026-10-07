import { test } from "node:test";
import assert from "node:assert/strict";
import { signInDomain } from "./domain";

test("production without the opt-in never signs for localhost", () => {
  const env = { NODE_ENV: "production" };
  assert.equal(signInDomain("localhost:4940", env), "flowtenzor.com");
  assert.equal(signInDomain("127.0.0.1:4940", env), "flowtenzor.com");
  assert.equal(signInDomain("evil.example", env), "flowtenzor.com");
  assert.equal(signInDomain("www.flowtenzor.com", env), "www.flowtenzor.com");
});

test("localhost only with ALLOW_LOCALHOST_SIGNIN=1 or a development build", () => {
  assert.equal(signInDomain("localhost:4940", { NODE_ENV: "production", ALLOW_LOCALHOST_SIGNIN: "1" }), "localhost:4940");
  assert.equal(signInDomain("127.0.0.1:4940", { NODE_ENV: "development" }), "127.0.0.1:4940");
  assert.equal(signInDomain("localhost.evil.example", { ALLOW_LOCALHOST_SIGNIN: "1" }), "flowtenzor.com");
  assert.equal(signInDomain("localhost:4940", { NODE_ENV: "production", ALLOW_LOCALHOST_SIGNIN: "true" }), "flowtenzor.com");
});
