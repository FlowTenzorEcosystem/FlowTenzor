/* Building blocks for app screens. Server-safe (no hooks). */

export type StatItem = { k: string; v: React.ReactNode; note?: React.ReactNode; testid?: string };

/** Screen opening: chips, title and description on the left; key numbers in a compact grid on the right. */
export function AppHead({ chips, title, desc, actions, stats }: { chips?: React.ReactNode; title: string; desc?: React.ReactNode; actions?: React.ReactNode; stats?: StatItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 border-b border-line pb-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
      <div className="min-w-0">
        {chips ? <div className="mb-3 flex flex-wrap items-center gap-2">{chips}</div> : null}
        <h1 className="font-display text-[clamp(30px,3.2vw,42px)] leading-[1.05] tracking-[-0.02em] text-ink">{title}</h1>
        {desc ? <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-ink-2">{desc}</p> : null}
        {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {stats?.length ? (
        <dl className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line">
          {stats.map((s) => (
            <div key={s.k} className="min-w-0 bg-card px-4 py-3">
              <dt className="kicker">{s.k}</dt>
              <dd className="num mt-1 truncate text-[16px] text-ink" data-testid={s.testid}>
                {s.v}
              </dd>
              {s.note ? <p className="mt-0.5 truncate text-[12px] text-ink-3">{s.note}</p> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** A titled panel with an optional right-hand note. */
export function Panel({ title, note, children, className = "", testid, pad = true }: { title?: React.ReactNode; note?: React.ReactNode; children: React.ReactNode; className?: string; testid?: string; pad?: boolean }) {
  return (
    <section className={`min-w-0 rounded-[10px] border border-line bg-card ${className}`} data-testid={testid}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="kicker !text-ink-2">{title}</h2>
          {note ? <span className="kicker">{note}</span> : null}
        </div>
      ) : null}
      <div className={pad ? "p-4" : ""}>{children}</div>
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
