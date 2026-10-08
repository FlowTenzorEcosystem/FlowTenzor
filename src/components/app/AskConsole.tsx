"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Answer = { title: string; lines: string[]; sources: string[]; symbols: string[] };

export function AskConsole({ suggested, initial, brief }: { suggested: { tag: string; q: string }[]; initial?: string; brief?: React.ReactNode }) {
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
      <section className="panel">
        <div className="flex gap-2 px-3 pt-3">
          <span className="num pt-[1px] text-[15px] text-faint" aria-hidden="true">
            &gt;
          </span>
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
            rows={2}
            placeholder="Ask about a stock token, a model, or the forecast board…"
            aria-label="Question"
            className="block min-h-[44px] w-full resize-none bg-transparent text-[15px] leading-[1.45] text-ink outline-none placeholder:text-faint"
            data-testid="ask-input"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
          <span className="label">
            <span className="max-sm:hidden">↵ send &nbsp;·&nbsp; ⇧↵ newline &nbsp;&nbsp;</span>context · live quotes
          </span>
          <span className="flex items-center gap-3">
            <span className="num text-[11px] text-faint">{q.length}/2000</span>
            <button type="button" className="abtn abtn-face" onClick={() => run()} disabled={busy || !q.trim()} data-testid="ask-run">
              {busy ? "Reading…" : "Run ↑"}
            </button>
          </span>
        </div>
      </section>
      {log.map((e, i) => (
        <article key={i} className="panel" data-testid="ask-answer">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.015] px-3 py-2">
            <p className="label truncate !normal-case !tracking-normal">&gt; {e.q}</p>
            <span className="label shrink-0 rounded-[3px] border border-dashed border-line-2 px-1.5 py-0.5">Not advice</span>
          </div>
          <div className="p-3">
            {e.a ? (
              <>
                <h3 className="text-[15px] font-medium text-ink">{e.a.title}</h3>
                <ol className="mt-2 space-y-1.5 text-[13.5px] leading-[1.5] text-ink-2">
                  {e.a.lines.map((l, j) => (
                    <li key={j} className="grid grid-cols-[24px_minmax(0,1fr)]">
                      <span className="num text-[11.5px] text-faint">{String(j + 1).padStart(2, "0")}</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ol>
                {e.a.symbols.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.a.symbols.map((s) => (
                      <Link key={s} href={`/markets/${s.toLowerCase()}`} className="rounded-[4px] border border-line px-2 py-1 text-[12.5px] text-ink-2 hover:border-line-2 hover:text-ink">
                        {s} →
                      </Link>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-[13.5px] text-ink-2">{e.error}</p>
            )}
          </div>
          {e.a ? <p className="label border-t border-line px-3 py-2.5">{e.a.sources.length ? `Sources: ${e.a.sources.join(" · ")}` : "No live source needed"}</p> : null}
        </article>
      ))}
      {brief}
      <section className="panel">
        <h2 className="label border-b border-white/[0.06] bg-white/[0.015] px-3 py-3 !text-ink/80">Suggested queries</h2>
        <ul>
          {suggested.map((s) => (
            <li key={s.q} className="border-b border-line last:border-0">
              <button type="button" onClick={() => run(s.q)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-[14px] text-ink hover:bg-white/[0.02]">
                <span className="label w-[68px] shrink-0 rounded-[3px] border border-line-2 py-1 text-center !text-ink-3">{s.tag}</span>
                {s.q}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
