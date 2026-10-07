import Link from "next/link";

/* Small layout modules shared by the content pages. */

export function Btn({
  href,
  children,
  tone = "accent",
  small = false,
  external = false,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "accent" | "ink" | "ghost";
  small?: boolean;
  external?: boolean;
  className?: string;
}) {
  const cls = `btn btn-${tone} ${small ? "btn-sm" : ""} ${className}`;
  const inner = (
    <>
      {children}
      <span className="arr" aria-hidden="true">
        →
      </span>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/** Page opening: a kicker line, the h1, a lede and optional actions. Left-aligned. */
export function PageHead({
  kicker,
  title,
  lede,
  children,
  aside,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <div className={`ctn grid grid-cols-1 gap-10 py-14 md:py-20 ${aside ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end" : ""}`}>
        <div className="min-w-0 max-w-[860px]">
          {kicker ? <div className="mb-5 flex flex-wrap items-center gap-2">{kicker}</div> : null}
          <h1 className="h-hero !text-[clamp(38px,5.2vw,68px)]">{title}</h1>
          {lede ? <p className="lede mt-6 max-w-[680px]">{lede}</p> : null}
          {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

/** A content section with a left heading column and the body on the right (stacks on phones). */
export function Section({
  id,
  title,
  intro,
  children,
  tone = "paper",
  wide = false,
}: {
  id?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children?: React.ReactNode;
  tone?: "paper" | "night" | "sand";
  wide?: boolean;
}) {
  const bg = tone === "night" ? "night" : tone === "sand" ? "bg-paper-2" : "";
  return (
    <section id={id} className={`${bg} border-b border-line`}>
      <div className="ctn py-16 md:py-24">
        <div className={wide ? "max-w-[860px]" : "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] lg:gap-16"}>
          <div className="min-w-0">
            <h2 className="h-sec">{title}</h2>
            {intro ? <div className="lede mt-5 max-w-[520px]">{intro}</div> : null}
          </div>
          {!wide ? <div className="min-w-0">{children}</div> : null}
        </div>
        {wide ? <div className="mt-10 min-w-0">{children}</div> : null}
      </div>
    </section>
  );
}

/** Numbered list of short points: number, heading, body. */
export function Steps({ items }: { items: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="grid grid-cols-1 border-t border-line">
      {items.map((it, i) => (
        <li key={it.title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 border-b border-line py-6 sm:grid-cols-[64px_minmax(0,1fr)]">
          <span className="num pt-0.5 text-[15px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <h3 className="h-item">{it.title}</h3>
            <div className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{it.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Two-column definition rows. */
export function Defs({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 border-t border-line sm:grid-cols-[200px_minmax(0,1fr)]">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="pt-3 text-[14px] font-semibold text-ink sm:border-b sm:border-line sm:py-3 sm:pr-4">{k}</dt>
          <dd className="min-w-0 border-b border-line pb-3 text-[15px] break-words text-ink-2 sm:py-3">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="border-t border-line">
      {items.map((it) => (
        <details key={it.q} className="acc">
          <summary>
            <span>{it.q}</span>
            <span className="acc-toggle" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
          </summary>
          <p className="max-w-[760px] pb-6 text-[15.5px] leading-relaxed text-ink-2">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export const LiveTag = ({ children = "Live from Robinhood Chain" }: { children?: React.ReactNode }) => <span className="chip chip-live">{children}</span>;
export const PracticeTag = ({ children = "Practice mode" }: { children?: React.ReactNode }) => <span className="chip chip-practice">{children}</span>;
export const TargetTag = ({ children = "Integration target" }: { children?: React.ReactNode }) => <span className="chip chip-target">{children}</span>;
