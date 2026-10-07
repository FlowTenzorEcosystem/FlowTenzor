"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Answer = { title: string; lines: string[]; sources: string[]; symbols: string[] };

export function AskConsole({ suggested, initial }: { suggested: { tag: string; q: string }[]; initial?: string }) {
  const [q, setQ] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ q: string; a: Answer | null; error?: string }[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const ran = useRef(false);
  async function run(text = q) {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setQ("");
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: t }) });
      const b = await r.json();
      setLog((l) => [{ q: t, a: r.ok ? b : null, error: r.ok ? undefined : (b.error ?? "No answer.") }, ...l].slice(0, 10));
    } catch {
      setLog((l) => [{ q: t, a: null, error: "The console could not be reached." }, ...l]);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initial && !ran.current) {
      ran.current = true;
      run(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  return (
    <div className="space-y-4" data-testid="ask-console">
      <section className="rounded-[10px] border border-line bg-card">
        <textarea
          ref={area}
          value={q}
          maxLength={2000}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              run();
            }
          }}
          rows={3}
          placeholder="Ask about a stock token: price, a comparison, forecast ranges, earnings…"
          aria-label="Question"
          className="block w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] text-ink outline-none placeholder:text-faint"
          data-testid="ask-input"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2">
          <span className="kicker">↵ send · ⇧↵ new line · {q.length}/2000</span>
          <button type="button" className="btn btn-accent btn-sm" onClick={() => run()} disabled={busy || !q.trim()} data-testid="ask-run">
            {busy ? "Reading…" : "Ask"}
          </button>
        </div>
      </section>
      <div className="flex flex-wrap gap-1.5">
        {suggested.map((s) => (
          <button key={s.q} type="button" onClick={() => run(s.q)} className="cursor-pointer rounded-[8px] border border-line px-3 py-1.5 text-left text-[13px] text-ink-2 hover:border-line-2 hover:text-ink">
            <span className="kicker mr-2">{s.tag}</span>
            {s.q}
          </button>
        ))}
      </div>
      {log.map((e, i) => (
        <article key={i} className="rounded-[10px] border border-line bg-card p-4" data-testid="ask-answer">
          <p className="text-[13px] text-ink-3">“{e.q}”</p>
          {e.a ? (
            <>
              <h3 className="mt-2 font-display text-[20px] text-ink">{e.a.title}</h3>
              <ul className="mt-2 space-y-1.5 text-[14.5px] leading-relaxed text-ink-2">
                {e.a.lines.map((l, j) => (
                  <li key={j}>{l}</li>
                ))}
              </ul>
              <p className="kicker mt-3">
                {e.a.sources.length ? `Sources: ${e.a.sources.join(" · ")}` : "No live source needed"} · not advice
              </p>
              {e.a.symbols.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.a.symbols.map((s) => (
                    <Link key={s} href={`/markets/${s.toLowerCase()}`} className="chip">
                      {s} →
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[14px] text-down">{e.error}</p>
          )}
        </article>
      ))}
    </div>
  );
}
