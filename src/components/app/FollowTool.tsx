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
  const H = 140;
  const vs = points.map((p) => p.v);
  const lo = Math.min(0, ...vs);
  const hi = Math.max(0, ...vs);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Paper equity curve">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line-2)" strokeDasharray="3 4" />
      <path d={d} fill="none" stroke={points[points.length - 1].v >= 0 ? "var(--color-up)" : "var(--color-down)"} strokeWidth="2" />
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
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]" data-testid="follow-tool">
      <div className="sheet min-w-0 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="h-sub">Your limits</h2>
          <span className="chip chip-practice">Paper</span>
        </div>
        <fieldset className="mt-5">
          <legend className="kicker">Leaders (up to 3, stake split evenly)</legend>
          <div className="mt-2 space-y-2">
            {HOUSE.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-start gap-3 rounded-[9px] border border-line p-3 has-[:checked]:border-ink">
                <input type="checkbox" checked={s.leaders.includes(m.id)} onChange={() => toggle(m.id)} className="mt-1" />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">
                    {m.name} <span className="font-normal text-ink-3">· {m.style}</span>
                  </span>
                  <span className="block text-[13px] text-ink-3">{m.about}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="small mt-2">On-chain models become followable leaders once the oracle is live and they have a scored record.</p>
        </fieldset>
        <div className="mt-5">
          <span className="kicker">Horizon</span>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-[9px] border border-line-2 p-1">
            {HORIZONS.map((h) => (
              <button
                key={h.key}
                type="button"
                aria-pressed={s.horizon === h.id}
                onClick={() => setS({ ...s, horizon: h.id as HorizonId })}
                className={`cursor-pointer rounded-[6px] py-2 text-[14px] font-semibold ${s.horizon === h.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"}`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <label className="block min-w-0">
            <span className="kicker">Stake per trade (USDG)</span>
            <input className="field num mt-1.5" inputMode="decimal" value={s.stake} onChange={num("stake")} />
          </label>
          <label className="block min-w-0">
            <span className="kicker">Loss limit per trade (%)</span>
            <input className="field num mt-1.5" inputMode="decimal" value={s.maxLossPct} onChange={num("maxLossPct")} />
          </label>
          <label className="block min-w-0">
            <span className="kicker">Daily loss cap (USDG)</span>
            <input className="field num mt-1.5" inputMode="decimal" value={s.dailyCap} onChange={num("dailyCap")} />
          </label>
          <label className="block min-w-0">
            <span className="kicker">Unfollow below score</span>
            <input className="field num mt-1.5" inputMode="numeric" value={s.unfollowBelow} onChange={num("unfollowBelow")} />
          </label>
        </div>
        <p className="small mt-4">Auto-unfollow uses the leader&apos;s last ten scored forecasts. Settings stay in this browser only.</p>
      </div>

      <div className="min-w-0 space-y-6">
        <div className="sheet min-w-0 p-5 sm:p-6">
          {failed ? (
            <p className="small">The leader&apos;s record could not be loaded. Try again shortly.</p>
          ) : !result ? (
            <p className="small">Replaying the leader&apos;s record…</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Paper P&L", usd(result.total), result.total >= 0 ? "text-up" : "text-down"],
                  ["Trades", String(result.trades.length), "text-ink"],
                  ["Win rate", result.trades.length ? `${Math.round((result.wins / result.trades.length) * 100)}%` : "–", "text-ink"],
                  ["Max drawdown", result.drawdown ? `$${result.drawdown.toFixed(2)}` : "–", "text-ink"],
                ].map(([k, v, c]) => (
                  <div key={k} className="min-w-0">
                    <dt className="kicker">{k}</dt>
                    <dd className={`num mt-1 text-[22px] ${c}`} data-testid={k === "Trades" ? "follow-trades" : undefined}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <Curve points={result.curve} />
              </div>
              <p className="small mt-3">
                {result.flat} flat calls skipped · {result.capped} trades skipped by the daily cap
                {result.stopped.length
                  ? ` · auto-unfollowed ${result.stopped.map((id) => HOUSE.find((m) => m.id === id)?.name).join(", ")} on ${new Date((result.unfollowedAt ?? 0) * 1000).toISOString().slice(0, 10)}`
                  : ""}
                . Up to 12 days of baseline forecasts, replayed against Chainlink outcomes; fees, slippage and funding are left out.
              </p>
            </>
          )}
        </div>
        {result && result.trades.length ? (
          <div className="sheet min-w-0 p-2 sm:p-3">
            <div className="scroll-x">
              <table className="tbl min-w-[620px]">
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
                        <td className="num text-[13px]">{new Date(t.resolvesAt * 1000).toISOString().slice(5, 16).replace("T", " ")}</td>
                        <td className="font-semibold">{t.symbol}</td>
                        <td className={t.side > 0 ? "text-up" : "text-down"}>{t.side > 0 ? "Long" : "Short"}</td>
                        <td className="num text-right text-[13px]">
                          {t.reference.toFixed(2)} → {t.price?.toFixed(2)}
                        </td>
                        <td className={`num text-right ${t.pnl >= 0 ? "text-up" : "text-down"}`}>{usd(t.pnl)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
