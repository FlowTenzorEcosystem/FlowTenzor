import Link from "next/link";
import { BRAND, CHAIN, shortAddress } from "@/config/brand";
import { HEADLINE } from "@/config/stocks";
import { AppHead, money } from "@/components/app/ui";
import { getStore } from "@/lib/auth/store";
import { HOUSE } from "@/lib/forecast/baselines";
import { getBoard, type ScoredLine } from "@/lib/forecast/board";
import { HORIZONS, average } from "@/lib/forecast/scoring";
import { allForecasts, practiceTallies } from "@/lib/practice/forecasts";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/battle",
  title: `Model battle | ${BRAND.name}`,
  description: `Four house models forecast the same stock tokens on ${CHAIN.name} at the same moments and are scored by the same Chainlink rule. See who wins each call.`,
});

export default async function BattlePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "live" } = await searchParams;
  const board = await getBoard();
  const store = getStore();
  const practice = store ? practiceTallies(await allForecasts(store)) : [];
  // Group scored lines by task (token, horizon, moment) to count wins.
  const tasks = new Map<string, ScoredLine[]>();
  for (const l of board.recent) {
    if (l.status !== "scored") continue;
    const k = `${l.symbol}|${l.horizon}|${l.madeAt}`;
    tasks.set(k, [...(tasks.get(k) ?? []), l]);
  }
  const wins = new Map<string, number>();
  for (const list of tasks.values()) {
    const best = Math.max(...list.map((l) => l.score));
    const top = list.filter((l) => l.score === best);
    if (top.length === 1) wins.set(top[0].model, (wins.get(top[0].model) ?? 0) + 1);
  }
  const cards = HOUSE.map((m) => {
    const lines = board.recent.filter((l) => l.model === m.id && l.status === "scored").slice(0, 50);
    const rolling = lines.length ? lines.reduce((a, l) => a + l.score, 0) / lines.length : 0;
    const all = [0, 1, 2].map((h) => board.tallies[m.id][h as 0 | 1 | 2]);
    const dirCalls = all.reduce((a, t) => a + t.directionCalls, 0);
    const dirHits = all.reduce((a, t) => a + t.directionHits, 0);
    const scored = all.reduce((a, t) => a + t.scored, 0);
    const inR = all.reduce((a, t) => a + t.inRange, 0);
    return { m, rolling, scored, wins: wins.get(m.id) ?? 0, dir: dirCalls ? dirHits / dirCalls : null, inR: scored ? inR / scored : null, trail: lines.slice(0, 30).reverse().map((l) => l.score) };
  }).sort((a, b) => b.rolling - a.rolling);
  const human = practice.filter((p) => p.tallies[0].scored + p.tallies[1].scored >= 1).sort((a, b) => average(b.tallies[0]) - average(a.tallies[0]))[0];
  const live = HEADLINE.slice(0, 8).map((sym) => board.rows.find((r) => r.stock.symbol === sym)!).filter(Boolean);
  // Average score per UTC day and model, for the small chart.
  const dayMap = new Map<string, Map<string, { s: number; n: number }>>();
  for (const l of board.recent) {
    if (l.status !== "scored") continue;
    const d = new Date(l.resolvesAt * 1000).toISOString().slice(5, 10);
    const m = dayMap.get(d) ?? new Map();
    const c = m.get(l.model) ?? { s: 0, n: 0 };
    c.s += l.score;
    c.n += 1;
    m.set(l.model, c);
    dayMap.set(d, m);
  }
  const days = [...dayMap.keys()].sort().slice(-8);
  const results = [...tasks.values()].sort((a, b) => b[0].resolvesAt - a[0].resolvesAt).slice(0, 12);
  return (
    <>
      <AppHead
        chips={<span className="chip chip-live">Graded by Chainlink</span>}
        title="Model battle"
        desc="Four house models forecast the same tokens at the same moments, with the same horizons, scored by the same rule. They are simple on purpose: a preview of how models compete, and the bar a real model has to clear. The record is a replay of up to 12 days of Chainlink rounds."
        actions={
          <Link href="/arena" className="btn btn-accent btn-sm">
            Beat the models
          </Link>
        }
        stats={[
          { k: "Leader", v: `${cards[0].m.name} · ${Math.round(cards[0].rolling).toLocaleString("en-US")}` },
          { k: "Tasks compared", v: tasks.size.toLocaleString("en-US") },
          { k: "Best practice forecaster", v: human ? `${shortAddress(human.wallet, 6, 4)} · ${Math.round(average(human.tallies[0])).toLocaleString("en-US")}` : "none yet" },
          { k: "Record", v: "up to 12 days", note: "replayed, nothing backfilled by hand" },
        ]}
      />
      <ol className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-testid="battle-cards">
        {cards.map((c, i) => (
          <li key={c.m.id} className={`min-w-0 rounded-[8px] border p-3 ${i === 0 ? "border-line-2 bg-paper-2" : "border-line bg-card"}`}>
            <div className="flex items-start gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-[5px] border border-line-2 bg-black text-[13px] text-ink">{c.m.name.slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-ink">
                  {c.m.name} {i === 0 ? <span title="Leader">♛</span> : null}
                </p>
                <p className="truncate text-[11.5px] text-ink-3">{c.m.style}</p>
              </div>
              <span className="num text-[11px] text-faint">#{i + 1}</span>
            </div>
            <p className="label mt-4">Rolling score</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="num text-[30px] leading-none tracking-[-0.03em] text-ink">{Math.round(c.rolling / 100)}</p>
              {c.trail.length > 2 ? (
                <svg width="80" height="20" viewBox="0 0 80 20" aria-hidden="true">
                  <path
                    d={c.trail.map((v, k) => `${k ? "L" : "M"}${((k / (c.trail.length - 1)) * 80).toFixed(1)} ${(19 - (v / 10000) * 18).toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke="var(--color-ink-3)"
                    strokeWidth="1"
                    strokeDasharray={i === 0 ? undefined : "2 2"}
                  />
                </svg>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line text-[11px]">
              {[
                ["Scored", String(c.scored)],
                ["Wins", String(c.wins)],
                ["Direction", c.dir == null ? "–" : `${Math.round(c.dir * 100)}%`],
                ["In range", c.inR == null ? "–" : `${Math.round(c.inR * 100)}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between bg-card px-2 py-1.5">
                  <dt className="text-faint">{k}</dt>
                  <dd className="num text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] leading-snug text-ink-3">{c.m.about}</p>
          </li>
        ))}
        <li className="min-w-0 rounded-[8px] border border-dashed border-line-2 p-3">
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-[5px] border border-dashed border-line-2 text-[13px] text-ink-3">+</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-ink">Practice field</p>
              <p className="text-[11.5px] text-ink-3">Wallet-signed forecasts</p>
            </div>
            <span className="num text-[11px] text-faint">#{cards.length + 1}</span>
          </div>
          <p className="label mt-4">Best 1h score</p>
          <p className="num mt-1 text-[30px] leading-none tracking-[-0.03em] text-ink">{human ? Math.round(average(human.tallies[0]) / 100) : "–"}</p>
          <p className="mt-3 text-[12px] leading-snug text-ink-3">
            {human ? `${shortAddress(human.wallet, 6, 4)} leads the wallets so far.` : "No wallet has a scored forecast yet."} Sign one in the Arena and your row joins this table under the same rule.
          </p>
          <Link href="/arena" className="abtn abtn-face mt-3 w-full">
            Enter a forecast
          </Link>
        </li>
      </ol>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="panel min-w-0 overflow-hidden">
          <div className="flex min-h-9 flex-wrap items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">{view === "results" ? "Results" : "Calls in play"}</h2>
            <span className="label max-md:hidden">{view === "results" ? "score per model · best in bold" : "each model's 80 % range · the dot is the reference"}</span>
            <div className="seg ml-auto" role="tablist">
              {[
                ["live", `Live (${live.length})`],
                ["results", `Results (${results.length})`],
              ].map(([k, l]) => (
                <Link key={k} href={`/battle?view=${k}`} scroll={false} aria-current={view === k ? "page" : undefined} className="!font-sans">
                  {l}
                </Link>
              ))}
            </div>
          </div>
          {view === "results" ? (
            <div className="scroll-x">
              <table className="tbl min-w-[640px] text-[12.5px]">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th className="text-right">Reference → Chainlink</th>
                    {HOUSE.map((m) => (
                      <th key={m.id} className="text-right">
                        {m.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((list) => {
                    const best = Math.max(...list.map((l) => l.score));
                    return (
                      <tr key={`${list[0].symbol}${list[0].horizon}${list[0].madeAt}`}>
                        <td>
                          <span className="font-medium text-ink">{list[0].symbol}</span> <span className="text-faint">{HORIZONS[list[0].horizon].short}</span>
                          <span className="block text-[11px] text-faint">{new Date(list[0].resolvesAt * 1000).toISOString().slice(5, 16).replace("T", " ")} UTC</span>
                        </td>
                        <td className="text-right">
                          {money(list[0].reference)} → {money(list[0].price)}
                        </td>
                        {HOUSE.map((m) => {
                          const l = list.find((x) => x.model === m.id);
                          return (
                            <td key={m.id} className={`text-right ${l?.score === best ? "font-semibold text-ink" : "text-ink-3"}`}>
                              {l ? l.score.toLocaleString("en-US") : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="divide-y divide-line" data-testid="battle-live">
              {live.map((r) => {
                const fs = r.forecasts[0];
                const lo = Math.min(...fs.map((f) => Number(f.low)));
                const hi = Math.max(...fs.map((f) => Number(f.high)));
                const span = hi - lo || 1;
                return (
                  <li key={r.stock.symbol} className="px-3 py-3">
                    <p className="flex items-center gap-2 text-[13px]">
                      <span className="num font-medium text-ink">{r.stock.symbol}</span>
                      <span className="chip !py-0 before:hidden">1h</span>
                      <span className="num text-ink-3">ref {money(r.price)}</span>
                    </p>
                    <ul className="mt-2 space-y-1.5 text-[11.5px]">
                      {fs.map((f) => {
                        const m = HOUSE.find((x) => x.id === f.model)!;
                        const ref = Number(f.reference);
                        const mid = (Number(f.low) + Number(f.high)) / 2;
                        const l = ((Number(f.low) - lo) / span) * 100;
                        const w = ((Number(f.high) - Number(f.low)) / span) * 100;
                        const d = ((ref - lo) / span) * 100;
                        return (
                          <li key={f.model} className="grid grid-cols-[90px_minmax(0,1fr)_58px] items-center gap-3">
                            <span className="truncate text-ink-3">— {m.name}</span>
                            <span className="relative h-[6px] rounded-full bg-paper-3">
                              <span className="absolute inset-y-0 rounded-full bg-[#5a5a5a]" style={{ left: `${l}%`, width: `${Math.max(2, w)}%` }} />
                              <span className="absolute top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${d}%` }} />
                            </span>
                            <span className={`num text-right ${mid > ref ? "text-up" : mid < ref ? "text-down" : "text-ink-3"}`}>{mid > ref ? "leans ▲" : mid < ref ? "leans ▼" : "flat"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="panel min-w-0 overflow-hidden">
          <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">Score by day</h2>
            <span className="label">average per UTC day</span>
          </div>
          <div className="p-3">
            {days.length > 1 ? (
              <svg viewBox="0 0 400 220" className="h-auto w-full" role="img" aria-label="Average score per day for each house model">
                {[0, 5000, 10000].map((v) => (
                  <g key={v}>
                    <line x1={28} x2={396} y1={200 - (v / 10000) * 180} y2={200 - (v / 10000) * 180} stroke="rgba(255,255,255,0.06)" />
                    <text x={0} y={204 - (v / 10000) * 180} fontSize="9" fill="var(--color-faint)" fontFamily="var(--font-mono)">
                      {v / 100}
                    </text>
                  </g>
                ))}
                {days.map((d, k) => (
                  <text key={d} x={28 + (k / (days.length - 1)) * 368} y={216} fontSize="9" textAnchor="middle" fill="var(--color-faint)" fontFamily="var(--font-mono)">
                    {d}
                  </text>
                ))}
                {HOUSE.map((m, mi) => {
                  const pts = days.map((d, k) => {
                    const c = dayMap.get(d)?.get(m.id);
                    return c ? `${28 + (k / (days.length - 1)) * 368},${200 - (c.s / c.n / 10000) * 180}` : null;
                  }).filter(Boolean);
                  return <polyline key={m.id} points={pts.join(" ")} fill="none" stroke={mi === 0 ? "#f4f4f4" : "#9a9a9a"} strokeWidth="1.3" strokeDasharray={["", "4 3", "1 3", "6 2 1 2"][mi]} />;
                })}
              </svg>
            ) : (
              <p className="py-10 text-center text-[13px] text-ink-3">The chart starts after two days of scored tasks.</p>
            )}
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
              {HOUSE.map((m, mi) => (
                <li key={m.id} className="flex items-center gap-1.5">
                  <svg width="18" height="4" aria-hidden="true">
                    <line x1="0" x2="18" y1="2" y2="2" stroke={mi === 0 ? "#f4f4f4" : "#9a9a9a"} strokeWidth="1.3" strokeDasharray={["", "4 3", "1 3", "6 2 1 2"][mi]} />
                  </svg>
                  {m.name}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
