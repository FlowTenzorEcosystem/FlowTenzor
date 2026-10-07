import { NextResponse } from "next/server";
import { getStore } from "@/lib/auth/store";
import { latestAll } from "@/lib/forecast/history";
import { allowPublic, badBody, clientIp, readBody, tooLarge, tooMany } from "@/lib/guard";
import { createKey } from "@/lib/practice/apikeys";
import { invalidateBoard, redeemTicket, storeForecast, toPublic } from "@/lib/practice/forecasts";
import { notConfigured } from "@/lib/practice/http";
import { allowApiKey, allowCreate } from "@/lib/practice/limits";

export const dynamic = "force-dynamic";

/** Step 2: the signed ticket comes back; the stored action (never the browser's copy) is applied. */
export async function POST(request: Request) {
  const store = getStore();
  if (!store) return notConfigured();
  if (!(await allowPublic(store, request, "redeem", 40, 600))) return tooMany();
  const parsed = await readBody<{ nonce?: unknown; signature?: unknown }>(request, 1024);
  if (!parsed.ok) return parsed.tooLarge ? tooLarge() : badBody();
  const nonce = typeof parsed.value.nonce === "string" ? parsed.value.nonce : "";
  const signature = typeof parsed.value.signature === "string" ? parsed.value.signature : "";
  const t = await redeemTicket(store, nonce, signature);
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: t.status });
  const network = clientIp(request);

  if (t.action.kind === "apikey") {
    if (!(await allowApiKey(store, network, t.address))) return tooMany();
    try {
      return NextResponse.json({ ok: true, key: await createKey(store, t.address) }, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      console.error(`api key: ${e instanceof Error ? e.message : String(e)}`);
      return NextResponse.json({ error: "The purchase record on chain could not be read, so no key was created. Try again." }, { status: 503 });
    }
  }

  // If the feed moved while the wallet was open, the signer has seen a newer price: ask again instead of storing.
  const head = (await latestAll()).get(t.action.symbol);
  if (!head || head.id.toString() !== t.action.referenceRound) {
    return NextResponse.json({ error: "The Chainlink price updated while you were signing. Review the new price and sign again." }, { status: 409 });
  }
  if (!(await allowCreate(store, network, t.address))) return tooMany();
  const result = await storeForecast(store, t.address, t.action, Date.now());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  invalidateBoard();
  return NextResponse.json({ ok: true, forecast: toPublic(result.forecast) }, { headers: { "cache-control": "no-store" } });
}
