import { NextResponse } from "next/server";
import { readCapped } from "@/lib/guard";
import { getStore } from "@/lib/auth/store";
import { rpcBatch } from "@/lib/feeds/rpc";
import { clientIp, trustsProxyHeaders } from "@/lib/netkey";
import { spend } from "@/lib/ratelimit";
import { BUDGET, MAX_BODY, checkBatch, readTargets, type Call } from "@/lib/relay";

export const dynamic = "force-dynamic";

/*
 * Read-only JSON-RPC relay for the browser. Some networks intercept the
 * chain's public RPC host, so the site reads through its own server first.
 * Only read methods, only the contracts the site reads, and a cost budget per
 * network (IPv6 per /64) so nobody can spend the operator's RPC quota.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  const text = await readCapped(request, MAX_BODY).catch(() => "");
  if (text === null) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: Call | Call[];
  try {
    body = JSON.parse(text) as Call | Call[];
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const calls = Array.isArray(body) ? body : [body];
  // First pass with every call target allowed, to price the request and check its shape.
  const targets = readTargets();
  const callTargets = calls.flatMap((c) => {
    const to = c?.method === "eth_call" && Array.isArray(c.params) ? (c.params[0] as { to?: unknown } | undefined)?.to : undefined;
    return typeof to === "string" ? [to.toLowerCase()] : [];
  });
  const priced = checkBatch(calls, new Set([...targets, ...callTargets]));
  if ("error" in priced) return NextResponse.json({ error: priced.error }, { status: 400 });

  const store = getStore();
  if (!(await spend(store, "rpc", clientIp(request), priced.units, BUDGET.units, BUDGET.windowSec, { aggregate: true }))) {
    return NextResponse.json({ error: "Too many chain reads from your network. Slow down a little." }, { status: 429 });
  }
  // Without trusted proxy headers everyone shares one key; a site-wide ceiling applies too.
  if (!trustsProxyHeaders() && !(await spend(store, "rpc-site", "all", priced.units, BUDGET.siteUnits, BUDGET.windowSec))) {
    return NextResponse.json({ error: "The relay is busy. Try again shortly." }, { status: 429 });
  }
  const checked = checkBatch(calls, targets);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const results = await rpcBatch<unknown>(calls.map((c) => ({ method: c.method, params: c.params ?? [] })));
    const out = calls.map((c, i) =>
      results[i] === null ? { jsonrpc: "2.0", id: c.id ?? null, error: { code: -32000, message: "read failed" } } : { jsonrpc: "2.0", id: c.id ?? null, result: results[i] },
    );
    return NextResponse.json(Array.isArray(body) ? out : out[0], { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The chain could not be reached." }, { status: 502 });
  }
}
