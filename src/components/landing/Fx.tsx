"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* Motion pieces of the landing page. All of them stop when off screen and hold still for reduced motion. */

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Calls `draw(t)` about 30 times a second while the canvas is on screen. */
function useCanvasLoop(ref: React.RefObject<HTMLCanvasElement | null>, draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void) {
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let visible = true;
    let last = 0;
    const size = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const still = reduced();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 33) return;
      last = now;
      const r = c.getBoundingClientRect();
      draw(ctx, r.width, r.height, still ? 4 : now / 1000);
    };
    if (still) {
      const r = c.getBoundingClientRect();
      draw(ctx, r.width, r.height, 4);
    } else raf = requestAnimationFrame(frame);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(c);
    const ro = new ResizeObserver(() => {
      size();
      const r = c.getBoundingClientRect();
      draw(ctx, r.width, r.height, still ? 4 : performance.now() / 1000);
    });
    ro.observe(c);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [ref, draw]);
}

/* ------------------------------------------------------------------ hero field */

/** A field of square columns in perspective whose heights ride two slow waves, like a price surface in flow. */
function drawField(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cols = w < 600 ? 48 : 110;
  const rows = 34;
  const fov = w * 0.55;
  const camH = 0.9; // camera height above the ground plane
  const horizon = h * 0.18;
  for (let r = rows - 1; r >= 0; r--) {
    const z = 1.1 + r * 0.16;
    const scale = fov / z;
    const spread = 2.4 + r * 0.05;
    const step = (spread * 2) / cols;
    const fog = 1 - r / rows;
    const ground = horizon + camH * scale * 0.55;
    for (let c = 0; c < cols; c++) {
      const xw = -spread + (c + 0.5) * step;
      const wave =
        0.5 +
        0.35 * Math.sin(xw * 1.2 + t * 0.5 + r * 0.16) +
        0.22 * Math.sin(xw * 0.55 - r * 0.28 - t * 0.33) +
        0.15 * Math.cos(r * 0.45 + t * 0.4);
      const height = Math.max(0.03, wave) * 0.75;
      const sx = w / 2 + xw * scale;
      const bw = Math.max(1, step * scale * 0.82);
      if (sx < -bw || sx > w + bw) continue;
      const top = ground - height * scale * 0.55;
      const capH = Math.max(1, bw * 0.45);
      // Faces are lit from the upper left: the slope of the wave decides how bright a column's face is.
      const slope = Math.cos(xw * 1.2 + t * 0.5 + r * 0.16);
      const lit = Math.round((45 + 70 * fog) * (0.75 + 0.25 * slope));
      ctx.fillStyle = `rgb(${lit},${lit},${lit})`;
      ctx.fillRect(sx - bw / 2, top, bw, Math.max(1, ground - top + capH));
      const cap = Math.min(235, Math.round(95 + 120 * fog));
      ctx.fillStyle = `rgb(${cap},${cap},${cap})`;
      ctx.fillRect(sx - bw / 2, top - capH, bw, capH);
    }
  }
}

export function HeroField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasLoop(ref, drawField);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ globe */

type P3 = [number, number, number];
const GLOBE: { pts: P3[]; links: [number, number][]; big: number[] } = (() => {
  const n = 260;
  const pts: P3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rr = Math.sqrt(1 - y * y);
    const a = i * 2.399963;
    pts.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
  }
  const links: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const d = pts
      .map((p, j) => [j, (p[0] - pts[i][0]) ** 2 + (p[1] - pts[i][1]) ** 2 + (p[2] - pts[i][2]) ** 2] as const)
      .filter(([j]) => j > i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
    for (const [j] of d) links.push([i, j]);
  }
  const big = [3, 17, 40, 58, 77, 96, 121, 140, 163, 181, 199, 222, 240];
  return { pts, links, big };
})();

function drawGlobe(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const R = Math.min(w, h) * 0.46;
  const cx = w / 2;
  const cy = h / 2;
  const a = t * 0.08;
  const tilt = 0.35;
  const proj = GLOBE.pts.map(([x, y, z]) => {
    const x1 = x * Math.cos(a) - z * Math.sin(a);
    const z1 = x * Math.sin(a) + z * Math.cos(a);
    const y1 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
    return [cx + x1 * R, cy + y1 * R, z2] as const;
  });
  ctx.lineWidth = 0.6;
  for (const [i, j] of GLOBE.links) {
    const p = proj[i];
    const q = proj[j];
    const depth = (p[2] + q[2]) / 2;
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.13 * ((depth + 1) / 2)})`;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  }
  for (const p of proj) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.35 * ((p[2] + 1) / 2)})`;
    ctx.fillRect(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6);
  }
  for (const i of GLOBE.big) {
    const p = proj[i];
    const s = 4 + 6 * ((p[2] + 1) / 2);
    const g = Math.round(90 + 90 * ((p[2] + 1) / 2));
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.beginPath();
    ctx.arc(p[0], p[1], s, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function Globe() {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasLoop(ref, drawGlobe);
  return <canvas ref={ref} className="h-full w-full" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ typing */

/** Cycles through phrases, typing each one out and erasing it. */
export function useTypeLoop(phrases: string[], speed = 38) {
  const [text, setText] = useState(phrases[0] ?? "");
  useEffect(() => {
    if (reduced()) return;
    let i = 0;
    let k = 0;
    let dir = 1;
    let hold = 0;
    const id = window.setInterval(() => {
      const p = phrases[i];
      if (hold > 0) {
        hold--;
        return;
      }
      k += dir;
      if (k >= p.length) {
        dir = -1;
        hold = 45;
      } else if (k <= 0) {
        dir = 1;
        i = (i + 1) % phrases.length;
        hold = 6;
      }
      setText(phrases[i].slice(0, Math.max(0, k)));
    }, speed);
    return () => window.clearInterval(id);
  }, [phrases, speed]);
  return text;
}

/** Ask pill: white field with a typed example; submitting opens the research console with the question. */
export function AskPill({ phrases, button = "Ask", big = false }: { phrases: string[]; button?: string; big?: boolean }) {
  const typed = useTypeLoop(phrases);
  const [q, setQ] = useState("");
  const router = useRouter();
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const v = (q || typed).trim();
    router.push(v ? `/ask?q=${encodeURIComponent(v)}` : "/ask");
  };
  return (
    <form
      onSubmit={go}
      className={`relative mx-auto flex w-full items-center rounded-full bg-white shadow-[0_0_0_9px_#1a1a1a,0_0_60px_rgba(255,255,255,0.18)] ${big ? "h-[72px] max-w-[520px] pr-2 pl-7" : "h-[66px] max-w-[720px] pr-1.5 pl-7 max-sm:h-[54px] max-sm:pl-4"}`}
    >
      <label className="sr-only" htmlFor={big ? "ask-pill-b" : "ask-pill-a"}>
        Ask a question
      </label>
      <input
        id={big ? "ask-pill-b" : "ask-pill-a"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={typed}
        className={`min-w-0 flex-1 bg-transparent text-[#0a0a0a] outline-none placeholder:text-[#0a0a0a] ${big ? "text-[19px] placeholder:text-[#0a0a0a]/50" : "text-[18px] max-sm:text-[14px]"}`}
      />
      {big ? null : (
        <button type="submit" className="kicker shrink-0 cursor-pointer rounded-full bg-[#0a0a0a] px-8 py-[17px] !text-white max-sm:px-4 max-sm:py-3">
          {button}
        </button>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ barcode */

function bars(seed: number, n: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ w: rnd() < 0.5 ? 4 : 5, gap: rnd() < 0.55 ? 8 + Math.round(rnd() * 6) : 18 + Math.round(rnd() * 40) }));
}

/** Three bands of vertical bars sliding at different speeds, the ask pill floating on top. */
export function BarcodeBand({ phrases }: { phrases: string[] }) {
  const rows = [bars(7, 120), bars(31, 120), bars(97, 120)];
  return (
    <div className="relative overflow-hidden rounded-[8px] border border-line bg-card p-[2px]">
      {rows.map((r, i) => (
        <div key={i} className="overflow-hidden" aria-hidden="true">
          <div className={`flex h-[98px] w-max ${i === 1 ? "barcode-r" : "barcode-l"}`} style={{ animationDuration: `${40 + i * 14}s` }}>
            {[...r, ...r].map((b, k) => (
              <span key={k} className="h-full shrink-0 bg-[rgba(244,244,244,0.35)]" style={{ width: b.w, marginRight: b.gap }} />
            ))}
          </div>
        </div>
      ))}
      <div className="absolute inset-0 grid place-items-center px-4">
        <AskPill phrases={phrases} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ reveal */

export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`rv ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ claims scrolly */

const CARDS = [
  { label: "Momentum", x: 50, y: 23, bars: 16, w: 220, h: 130 },
  { label: "News flow", x: 75.5, y: 21, bars: 0, w: 96, h: 40 },
  { label: "Macro", x: 15, y: 28, bars: 0, w: 90, h: 40 },
  { label: "Volatility", x: 82.5, y: 33, bars: 12, w: 136, h: 80 },
  { label: "Earnings drift", x: 16, y: 55, bars: 10, w: 136, h: 196 },
  { label: "Mean reversion", x: 80.5, y: 73, bars: 9, w: 136, h: 130 },
  { label: "Order book", x: 29, y: 84, bars: 0, w: 104, h: 40 },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

/**
 * Three beats on one sticky stage, driven by scroll:
 * the model cards and the claim, then the ask pill and its promise, then a single point and the grading rule.
 */
export function ClaimsScrolly({
  claim,
  doubt,
  askTitle,
  askBody,
  askPhrases,
  grade,
}: {
  claim: string;
  doubt: string;
  askTitle: string;
  askBody: string;
  askPhrases: string[];
  grade: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        setP(total > 0 ? clamp01(-r.top / total) : 0);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  const gather = seg(p, 0.18, 0.36); // cards fly to the centre
  const claimOut = seg(p, 0.16, 0.3);
  const askIn = seg(p, 0.36, 0.46);
  const askOut = seg(p, 0.66, 0.76);
  const dotIn = seg(p, 0.74, 0.84);
  return (
    <section ref={ref} className="relative h-[4600px] max-md:h-[3800px]" aria-label="Why scores matter">
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* dashed links between the cards */}
        <svg className="absolute inset-0 h-full w-full" style={{ opacity: 1 - gather }} aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
          {CARDS.map((c, i) => (
            <path
              key={c.label}
              d={`M${c.x} ${c.y} Q ${(c.x + 50) / 2 + (i % 2 ? 8 : -8)} ${(c.y + 52) / 2 + 6} 50 52`}
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {CARDS.map((c, i) => {
          const x = c.x + (50 - c.x) * gather;
          const y = c.y + (52 - c.y) * gather;
          const s = 1 - 0.85 * gather;
          return (
            <div
              key={c.label}
              className="absolute rounded-[8px] border border-line-2 bg-paper-2 p-3 max-md:scale-[0.62]"
              style={{ left: `${x}%`, top: `${y}%`, width: c.w, transform: `translate(-50%,-50%) scale(${s})`, opacity: 1 - seg(p, 0.3, 0.38) }}
              aria-hidden="true"
            >
              <p className="kicker !text-ink whitespace-nowrap">{c.label}</p>
              {c.bars ? (
                <div className="mt-2.5 flex justify-between rounded-[4px] bg-black px-1.5 py-1" style={{ height: c.h - 52 }}>
                  {Array.from({ length: c.bars }, (_, k) => (
                    <span key={k} className="barcode-blink w-[3px] bg-white" style={{ animationDelay: `${(k * 137 + i * 61) % 1600}ms` }} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center" style={{ opacity: 1 - claimOut, transform: `translateY(calc(-50% - ${claimOut * 40}px))` }}>
          <h2 className="h-sec mx-auto max-w-[580px]">{claim}</h2>
          <p className="mt-6 text-[22px] leading-[1.5] text-ink-3 max-sm:text-[17px]">{doubt}</p>
        </div>
        <div
          className="absolute inset-x-0 top-1/2 px-4 text-center"
          style={{ opacity: askIn * (1 - askOut), transform: `translateY(calc(-50% + ${(1 - askIn) * 50}px))`, pointerEvents: askIn > 0.5 && askOut < 0.5 ? "auto" : "none" }}
        >
          <h2 className="h-sec mx-auto max-w-[720px]">{askTitle}</h2>
          <p className="mx-auto mt-7 max-w-[560px] text-[16px] leading-[1.5] text-ink-3 max-sm:text-[14px]">{askBody}</p>
          <div className="mt-8 flex justify-center" style={{ transform: `scale(${1 - askOut * 0.6})` }}>
            <AskPill phrases={askPhrases} big />
          </div>
        </div>
        <div className="absolute inset-x-0 top-[44%] flex flex-col items-center px-4" style={{ opacity: dotIn }}>
          <span className="grid size-10 place-items-center rounded-full bg-[#1a1a1a]">
            <span className="size-[22px] rounded-full bg-white shadow-[0_0_30px_rgba(255,255,255,0.4)]" />
          </span>
          <span className="h-[30px] w-px border-l border-dashed border-line-2" />
          <p className="max-w-[260px] rounded-[30px] bg-[#1a1a1a]/80 px-4 py-2.5 text-center text-[16px] leading-[1.25] text-ink">{grade}</p>
          <span className="h-[60vh] w-px border-l border-dashed border-line-2" style={{ transform: `scaleY(${dotIn})`, transformOrigin: "top" }} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ follow bento */

type Tile = { title: string; body?: string; tag?: string; extra?: React.ReactNode; h: string };

/** The six follow tiles in two staggered columns; one tile at a time lights up white. */
export function FollowBento({ left, right }: { left: Tile[]; right: Tile[] }) {
  const [on, setOn] = useState(2);
  const total = left.length + right.length;
  useEffect(() => {
    if (reduced()) return;
    const id = window.setInterval(() => setOn((v) => (v + 1) % total), 2200);
    return () => window.clearInterval(id);
  }, [total]);
  const order = [...left.map((_, i) => i * 2), ...right.map((_, i) => i * 2 + 1)];
  const tile = (t: Tile, idx: number) => {
    const lit = order[idx] === on;
    return (
      <div
        key={t.title}
        className={`rounded-[12px] p-2 transition-[background-color,opacity] duration-500 ${lit ? "bg-white/15" : "bg-card"} ${lit ? "opacity-100" : "opacity-45"}`}
        onMouseEnter={() => setOn(order[idx])}
      >
        <div className={`flex flex-col justify-between rounded-[8px] p-4 transition-colors duration-500 ${t.h} ${lit ? "bg-white text-[#0a0a0a]" : "bg-paper-2 text-ink"}`}>
          <div>
            {t.tag ? <p className="mb-1.5 flex items-center gap-1.5 text-[13px] opacity-60">{t.tag}</p> : null}
            <p className="text-[22px] leading-[1.1] tracking-[-0.02em]">{t.title}</p>
            {t.body ? <p className="mt-2 text-[13px] leading-[1.5] opacity-60">{t.body}</p> : null}
          </div>
          {t.extra}
        </div>
      </div>
    );
  };
  return (
    <div className="grid w-full max-w-[620px] grid-cols-2 gap-3 max-sm:gap-2">
      <div className="flex flex-col gap-3 max-sm:gap-2">{left.map((t, i) => tile(t, i))}</div>
      <div className="flex flex-col gap-3 max-sm:gap-2">{right.map((t, i) => tile(t, left.length + i))}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ ask cards */

export function ArrowButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="grid size-[46px] shrink-0 place-items-center rounded-full bg-white text-[#0a0a0a] transition-transform hover:translate-x-0.5">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </Link>
  );
}

/* ------------------------------------------------------------------ lattice */

const LATTICE: { pts: P3[]; big: Set<number> } = (() => {
  const pts: P3[] = [];
  const n = 5;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) pts.push([i / (n - 1) - 0.5, j / (n - 1) - 0.5, k / (n - 1) - 0.5]);
  return { pts, big: new Set([7, 18, 31, 44, 57, 62, 78, 93, 101, 117]) };
})();

function drawLattice(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const s = Math.min(w, h) * 0.62;
  const a = t * 0.15;
  const b = 0.45;
  const proj = LATTICE.pts.map(([x, y, z]) => {
    const x1 = x * Math.cos(a) - z * Math.sin(a);
    const z1 = x * Math.sin(a) + z * Math.cos(a);
    const y1 = y * Math.cos(b) - z1 * Math.sin(b);
    const z2 = y * Math.sin(b) + z1 * Math.cos(b);
    const f = 2.2 / (2.2 + z2);
    return [w / 2 + x1 * s * f, h / 2 + y1 * s * f, z2] as const;
  });
  const n = 5;
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < proj.length; i++) {
    const ix = Math.floor(i / (n * n));
    const iy = Math.floor(i / n) % n;
    const iz = i % n;
    for (const [d, ok] of [
      [n * n, ix < n - 1],
      [n, iy < n - 1],
      [1, iz < n - 1],
    ] as const) {
      if (!ok) continue;
      ctx.beginPath();
      ctx.moveTo(proj[i][0], proj[i][1]);
      ctx.lineTo(proj[i + d][0], proj[i + d][1]);
      ctx.stroke();
    }
  }
  proj.forEach((p, i) => {
    const big = LATTICE.big.has(i);
    const r = big ? 4 + 2 * (1 - p[2]) : 1.4;
    ctx.fillStyle = big ? "#f4f4f4" : "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function Lattice() {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasLoop(ref, drawLattice);
  return <canvas ref={ref} className="h-full w-full" aria-hidden="true" />;
}
