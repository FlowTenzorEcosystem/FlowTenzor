// Owner tool for the paid-call accounts kept by the forecast API.
//   node scripts/api-account.mjs show <wallet>
//   node scripts/api-account.mjs set-base <wallet> <base>     restore an account (e.g. after a lost record; keeps used)
// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from your shell (export them for the session;
// this script never writes them anywhere). Key prefix: STORE_KEY_PREFIX, else "flowtenzor:" (the same rule as the site).
// Available calls = CallCredits.callsPurchased(wallet) - base - used.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const prefix = process.env.STORE_KEY_PREFIX || "flowtenzor:";
const [cmd, walletRaw, value] = process.argv.slice(2);
if (!url || !token) {
  console.log("Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your shell first.");
  process.exit(1);
}
if (!/^0x[0-9a-fA-F]{40}$/.test(walletRaw ?? "")) {
  console.log("Usage: node scripts/api-account.mjs show|set-base <wallet> [base]");
  process.exit(1);
}
const wallet = walletRaw.toLowerCase();
const run = async (...cmds) => {
  const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(cmds) });
  return (await res.json()).map((x) => x.result);
};
// One record per wallet: {"base": n, "used": n} (see src/lib/practice/accounting.ts).
const key = `${prefix}apiacct:${wallet}`;
const [raw] = await run(["GET", key]);
const current = raw ? JSON.parse(raw) : null;
if (cmd === "set-base") {
  if (!/^\d+$/.test(value ?? "")) {
    console.log("set-base needs a whole number.");
    process.exit(1);
  }
  const next = { base: Number(value), used: current?.used ?? 0 };
  await run(["SET", key, JSON.stringify(next)]);
  console.log(JSON.stringify({ wallet, before: current, after: next }));
} else {
  console.log(JSON.stringify({ wallet, account: current }));
}
