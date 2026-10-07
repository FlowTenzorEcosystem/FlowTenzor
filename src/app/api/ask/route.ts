import { NextResponse } from "next/server";
import { getStore, type Store } from "@/lib/auth/store";
import { answer } from "@/lib/ask";
import { allowPublic, badBody, readBody, tooLarge, tooMany } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Research console: a question in, an answer built from live data out. Rule-based; no paid model is called. */
export async function POST(request: Request) {
  if (!(await allowPublic(getStore() as Store, request, "ask", 20, 600))) return tooMany();
  const parsed = await readBody<{ q?: unknown }>(request, 4096);
  if (!parsed.ok) return parsed.tooLarge ? tooLarge() : badBody();
  const q = typeof parsed.value.q === "string" ? parsed.value.q.trim() : "";
  if (!q) return NextResponse.json({ error: "Ask something first." }, { status: 400 });
  return NextResponse.json(await answer(q), { headers: { "cache-control": "no-store" } });
}
