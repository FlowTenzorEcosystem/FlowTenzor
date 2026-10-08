/* Building blocks for app screens. Server-safe (no hooks). */

export type StatItem = { k: string; v: React.ReactNode; note?: React.ReactNode; testid?: string };

/** Screen opening: chips and a subline, the title and description, actions on the right; key numbers in a strip below. */
export function AppHead({ chips, title, desc, actions, stats }: { chips?: React.ReactNode; title: string; desc?: React.ReactNode; actions?: React.ReactNode; stats?: StatItem[] }) {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0 max-w-[672px]">
          {chips ? (
            <div className="mb-2.5 flex flex-wrap items-center gap-2 [&>.kicker]:font-sans [&>.kicker]:text-[15px] [&>.kicker]:tracking-normal [&>.kicker]:text-ink [&>.kicker]:normal-case">
              {chips}
            </div>
          ) : null}
          <h1 className="text-[22px] leading-[1.3] font-medium tracking-[-0.02em] text-ink">{title}</h1>
          {desc ? <p className="mt-2 text-[14px] leading-[1.45] text-ink-3">{desc}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 [&_.btn]:!min-h-8 [&_.btn]:!rounded-[6px] [&_.btn]:!px-3 [&_.btn]:!text-[13px]">{actions}</div> : null}
      </header>
      {stats?.length ? (
        <dl className={`mt-4 grid min-w-0 grid-cols-2 overflow-hidden rounded-[8px] border border-white/[0.08] bg-card ${stats.length >= 4 ? "md:grid-cols-4" : stats.length === 3 ? "md:grid-cols-3" : ""}`}>
          {stats.map((s, i) => (
            <div key={s.k} className={`min-w-0 px-3 py-2.5 ${i % 2 ? "border-l border-line" : ""} ${i >= 2 ? "max-md:border-t" : ""} ${i > 0 && i % 2 === 0 ? "md:border-l md:border-line" : ""} border-line`}>
              <dt className="label truncate">{s.k}</dt>
              <dd className="num mt-1.5 truncate text-[13px] text-ink" data-testid={s.testid}>
                {s.v}
              </dd>
              {s.note ? <p className="mt-0.5 truncate text-[11.5px] text-faint">{s.note}</p> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}

/** A titled panel: lit gradient, a 36 px header with a mono label and an optional note. */
export function Panel({ title, note, children, className = "", testid, pad = true }: { title?: React.ReactNode; note?: React.ReactNode; children: React.ReactNode; className?: string; testid?: string; pad?: boolean }) {
  return (
    <section className={`panel min-w-0 overflow-hidden ${className}`} data-testid={testid}>
      {title ? (
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
          <h2 className="label !text-ink/80">{title}</h2>
          {note ? <span className="label">{note}</span> : null}
        </div>
      ) : null}
      <div className={pad ? "p-3" : ""}>{children}</div>
    </section>
  );
}

export const up = (v: number | null | undefined) => (v == null ? "text-ink-3" : v >= 0 ? "text-up" : "text-down");
export const signPct = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "–" : `${v >= 0 ? "▲ +" : "▼ −"}${Math.abs(v).toFixed(d)}%`);
export const money = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "–" : `$${v.toLocaleString("en-US", { minimumFractionDigits: v >= 1000 ? 0 : 2, maximumFractionDigits: v >= 1000 ? 0 : 2 })}`);
export const big = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};
