import { NextResponse } from "next/server";
import { isAddress } from "@/config/brand";
import { signInDomain } from "@/lib/auth/domain";
import { getStore } from "@/lib/auth/store";
import { allowPublic, badBody, clientIp, readBody, tooLarge, tooMany } from "@/lib/guard";
import { issueTicket, parseForecast } from "@/lib/practice/forecasts";
import { notConfigured } from "@/lib/practice/http";
import { allowTicket } from "@/lib/practice/limits";

export const dynamic = "force-dynamic";

/** Step 1: the server reads the Chainlink price and writes the exact text for the wallet to sign. */
export async function POST(request: Request) {
  const store = getStore();
  if (!store) return notConfigured();
  if (!(await allowPublic(store, request, "ticket", 40, 600))) return tooMany();
  const parsed = await readBody<{ address?: unknown; action?: unknown }>(request, 1024);
  if (!parsed.ok) return parsed.tooLarge ? tooLarge() : badBody();
  const address = typeof parsed.value.address === "string" ? parsed.value.address : "";
  if (!isAddress(address)) return NextResponse.json({ error: "Connect a wallet first." }, { status: 400 });
  if (!(await allowTicket(store, clientIp(request), address))) return tooMany();
  const raw = parsed.value.action && typeof parsed.value.action === "object" ? (parsed.value.action as Record<string, unknown>) : {};
  const action = await parseForecast(raw);
  if ("error" in action) return NextResponse.json({ error: action.error }, { status: 400 });
  return NextResponse.json(await issueTicket(store, address, action, signInDomain(request.headers.get("host"))));
}
