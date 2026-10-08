"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { HOUSE } from "@/lib/forecast/baselines";
import { HORIZONS, type HorizonId } from "@/lib/forecast/scoring";

/*
 * Paper follow: replays a leader's resolved forecasts as positions sized by
 * the follower's own limits, against the Chainlink price at each horizon.
 * A range centred above the reference is a long, below it a short; flat
 * ranges are skipped. No fees, slippage or funding. Nothing touches a wallet.
 */

type Line = { symbol: string; model: string; horizon: number; madeAt: number; resolvesAt: number; low: number; high: number; reference: number; price: number | null; status: string; score: number };

type Settings = { leaders: string[]; horizon: HorizonId; stake: number; maxLossPct: number; dailyCap: number; unfollowBelow: number };

const DEFAULTS: Settings = { leaders: ["current"], horizon: 0, stake: 100, maxLossPct: 2, dailyCap: 25, unfollowBelow: 3000 };
const KEY = "flowtenzor:follow";

type Trade = Line & { side: 1 | -1; pnl: number; leader: string };

export function simulate(lines: Line[], s: Settings) {
  const per = s.stake / Math.max(1, s.leaders.length);
  const sorted = [...lines].sort((a, b) => a.resolvesAt - b.resolvesAt);
  const trades: Trade[] = [];
  const dayLoss = new Map<string, number>();
  const recent = new Map<string, number[]>();
  const stopped = new Set<string>();
  let flat = 0;
  let capped = 0;
  let unfollowedAt: number | null = null;
  for (const l of sorted) {
    if (l.status !== "scored" || l.price == null) continue;
    if (stopped.has(l.model)) continue;
    const scores = recent.get(l.model) ?? [];
    const mid = (l.low + l.high) / 2;
    const side = mid > l.reference ? 1 : mid < l.reference ? -1 : 0;
    // The leader's own record keeps counting toward auto-unfollow even on skipped trades.
    scores.push(l.score);
    if (scores.length > 10) scores.shift();
    recent.set(l.model, scores);
    if (side === 0) {
      flat++;
      continue;
    }
    const day = new Date(l.resolvesAt * 1000).toISOString().slice(0, 10);
    const lost = dayLoss.get(day) ?? 0;
    if (lost >= s.dailyCap) {
      capped++;
      continue;
    }
    const move = l.price / l.reference - 1;
    let pnl = per * side * move;
    pnl = Math.max(pnl, -per * (s.maxLossPct / 100));
    if (pnl < 0) dayLoss.set(day, lost - pnl);
    trades.push({ ...l, side: side as 1 | -1, pnl, leader: l.model });
    if (scores.length >= 10 && scores.reduce((a, b) => a + b, 0) / scores.length < s.unfollowBelow) {
      stopped.add(l.model);
      unfollowedAt ??= l.resolvesAt;
    }
  }
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  const curve = trades.map((t) => {
    equity += t.pnl;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
    return { t: t.resolvesAt, v: equity };
  });
  const wins = trades.filter((t) => t.pnl > 0).length;
  return { trades, curve, total: equity, wins, drawdown, flat, capped, stopped: [...stopped], unfollowedAt };
}

function Curve({ points }: { points: { t: number; v: number }[] }) {
  if (points.length < 2) return <div className="grid h-[140px] place-items-center text-[14px] text-ink-3">Not enough trades to draw a curve.</div>;
  const W = 600;
  const H = 200;
  const vs = points.map((p) => p.v);
  const lo = Math.min(0, ...vs);
  const hi = Math.max(0, ...vs);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Paper equity curve">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line-2)" strokeDasharray="3 4" />
      <path d={`${d} L${W} ${H} L0 ${H} Z`} fill="rgba(255,255,255,0.05)" />
      <path d={d} fill="none" stroke="#f4f4f4" strokeWidth="1.6" />
    </svg>
  );
}

const usd = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`;

export function FollowTool() {
  const [stored, write] = useLocalStore<Settings>(KEY, DEFAULTS);
  const s: Settings = { ...DEFAULTS, ...stored };
  const setS = (next: Settings | ((cur: Settings) => Settings)) => write(typeof next === "function" ? next(s) : next);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [failed, setFailed] = useState(false);
  const leadersKey = s.leaders.join(",");
  useEffect(() => {
    let off = false;
    Promise.all(s.leaders.map((m) => fetch(`/api/board?model=${m}&h=${s.horizon}`).then((r) => (r.ok ? r.json() : { lines: [] }))))
      .then((all: { lines: Line[] }[]) => !off && setLines(all.flatMap((a) => a.lines ?? [])))
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadersKey, s.horizon]);
  const settingsKey = JSON.stringify(s);
  const result = useMemo(() => (lines ? simulate(lines, JSON.parse(settingsKey) as Settings) : null), [lines, settingsKey]);
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Math.max(0, Number(e.target.value) || 0) });
  const toggle = (id: string) =>
    setS((cur) => {
      const has = cur.leaders.includes(id);
      const leaders = has ? cur.leaders.filter((x) => x !== id) : [...cur.leaders, id].slice(-3);
      return { ...cur, leaders: leaders.length ? leaders : cur.leaders };
    });
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)]" data-testid="follow-tool">
      <div className="min-w-0 space-y-3">
        <section className="panel overflow-hidden">
          <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">Leaders</h2>
            <span className="label">up to 3 · stake split evenly</span>
          </div>
          <fieldset>
            <legend className="sr-only">Leaders</legend>
            {HOUSE.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-start gap-2.5 border-b border-line px-3 py-2.5 last:border-0 has-[:checked]:bg-white/[0.05] has-[:checked]:shadow-[inset_2px_0_0_#fff]">
                <input type="checkbox" checked={s.leaders.includes(m.id)} onChange={() => toggle(m.id)} className="mt-0.5 accent-white" />
                <span className="min-w-0">
                  <span className="flex justify-between gap-2 text-[13px] text-ink">
                    {m.name} <span className="text-[11.5px] text-faint">{m.style}</span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">{m.about}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="border-t border-line px-3 py-2.5 text-[11.5px] text-faint">On-chain models become followable leaders once the oracle is live and they have a scored record.</p>
        </section>
        <section className="panel overflow-hidden">
          <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">Guardrails</h2>
            <span className="label">checked before each trade</span>
          </div>
          <div className="p-3">
            <span className="label">Horizon</span>
            <div className="seg mt-1.5 !grid w-full grid-cols-3">
              {HORIZONS.map((h) => (
                <button key={h.key} type="button" aria-pressed={s.horizon === h.id} onClick={() => setS({ ...s, horizon: h.id as HorizonId })} className="text-center">
                  {h.key}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span className="label">Stake per trade</span>
                <span className="relative mt-1.5 block">
                  <span className="num absolute top-1/2 left-2.5 -translate-y-1/2 text-[12px] text-faint">$</span>
                  <input className="field num !pl-6" inputMode="decimal" value={s.stake} onChange={num("stake")} />
                </span>
              </label>
              <label className="block min-w-0">
                <span className="label">Max loss per trade</span>
                <span className="relative mt-1.5 block">
                  <input className="field num !pr-6" inputMode="decimal" value={s.maxLossPct} onChange={num("maxLossPct")} />
                  <span className="num absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-faint">%</span>
                </span>
              </label>
              <label className="block min-w-0">
                <span className="label">Daily loss cap</span>
                <span className="relative mt-1.5 block">
                  <span className="num absolute top-1/2 left-2.5 -translate-y-1/2 text-[12px] text-faint">$</span>
                  <input className="field num !pl-6" inputMode="decimal" value={s.dailyCap} onChange={num("dailyCap")} />
                </span>
              </label>
              <label className="block min-w-0">
                <span className="label">Unfollow below score</span>
                <input className="field num mt-1.5" inputMode="numeric" value={s.unfollowBelow} onChange={num("unfollowBelow")} />
              </label>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">Auto-unfollow reads the leader&apos;s last ten scored forecasts. Settings stay in this browser only.</p>
          </div>
        </section>
        <p className="flex items-center gap-2 rounded-[8px] border border-dashed border-line-2 px-3 py-2.5 text-[12px] text-ink-3">
          <span className="chip chip-practice before:hidden">Paper</span> Mirroring into a wallet waits for the follow vault.
        </p>
      </div>

      <div className="min-w-0 space-y-3">
        {failed ? (
          <p className="panel p-4 text-[13px] text-ink-3">The leader&apos;s record could not be loaded. Try again shortly.</p>
        ) : !result ? (
          <p className="panel p-4 text-[13px] text-ink-3">Replaying the leader&apos;s record…</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 overflow-hidden rounded-[8px] border border-white/[0.08] bg-card sm:grid-cols-5">
              {[
                ["Paper P&L", usd(result.total), result.total >= 0 ? "text-up" : "text-down"],
                ["Trades", String(result.trades.length), "text-ink"],
                ["Win rate", result.trades.length ? `${Math.round((result.wins / result.trades.length) * 100)}%` : "–", "text-ink"],
                ["Max drawdown", result.drawdown ? `$${result.drawdown.toFixed(2)}` : "–", "text-ink"],
                ["Leaders", String(s.leaders.length), "text-ink"],
              ].map(([k, v, c], i) => (
                <div key={k} className={`min-w-0 px-3 py-2.5 ${i ? "border-l border-line" : ""} ${i >= 2 ? "max-sm:border-t" : ""}`}>
                  <dt className="label">{k}</dt>
                  <dd className={`num mt-1.5 text-[16px] ${c}`} data-testid={k === "Trades" ? "follow-trades" : undefined}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <section className="panel overflow-hidden">
              <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
                <h2 className="label !text-ink/85">Equity</h2>
                <span className="label">paper · ${s.stake} per trade</span>
              </div>
              <div className="p-3">
                <Curve points={result.curve} />
                <p className="mt-2 text-[11.5px] text-faint">
                  {result.flat} flat calls skipped · {result.capped} skipped by the daily cap
                  {result.stopped.length
                    ? ` · auto-unfollowed ${result.stopped.map((id) => HOUSE.find((m) => m.id === id)?.name).join(", ")} on ${new Date((result.unfollowedAt ?? 0) * 1000).toISOString().slice(0, 10)}`
                    : ""}
                  . Up to 12 days of baseline forecasts replayed against Chainlink outcomes; fees, slippage and funding are left out.
                </p>
              </div>
            </section>
          </>
        )}
        {result && result.trades.length ? (
          <section className="panel overflow-hidden">
            <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
              <h2 className="label !text-ink/85">Paper trades</h2>
              <span className="label">{result.trades.length}</span>
            </div>
            <div className="scroll-x">
              <table className="tbl min-w-[600px] !text-[12.5px]">
                <thead>
                  <tr>
                    <th>Resolved (UTC)</th>
                    <th>Token</th>
                    <th>Side</th>
                    <th className="text-right">Reference → Chainlink</th>
                    <th className="text-right">Paper P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades
                    .slice(-15)
                    .reverse()
                    .map((t) => (
                      <tr key={`${t.leader}-${t.symbol}-${t.madeAt}`}>
                        <td>{new Date(t.resolvesAt * 1000).toISOString().slice(5, 16).replace("T", " ")}</td>
                        <td className="font-medium text-ink">{t.symbol}</td>
                        <td className={t.side > 0 ? "text-up" : "text-down"}>{t.side > 0 ? "▲ Long" : "▼ Short"}</td>
                        <td className="text-right">
                          {t.reference.toFixed(2)} → {t.price?.toFixed(2)}
                        </td>
                        <td className={`text-right ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{usd(t.pnl)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        <p className="text-[11.5px] text-faint">Simulated outcomes. Costs such as fees and slippage are left out, and a token's pool price can sit above or below its feed. Yesterday's score is no promise for tomorrow; nothing here tells you to trade.</p>
      </div>
    </div>
  );
}
