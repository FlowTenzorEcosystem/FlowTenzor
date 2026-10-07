import Link from "next/link";
import { BRAND, CHAIN, shortAddress } from "@/config/brand";
import { HEADLINE } from "@/config/stocks";
import { AppHead, Panel, money } from "@/components/app/ui";
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
    return { m, rolling, scored, wins: wins.get(m.id) ?? 0, dir: dirCalls ? dirHits / dirCalls : null, inR: scored ? inR / scored : null };
  }).sort((a, b) => b.rolling - a.rolling);
  const human = practice.filter((p) => p.tallies[0].scored + p.tallies[1].scored >= 1).sort((a, b) => average(b.tallies[0]) - average(a.tallies[0]))[0];
  const live = HEADLINE.slice(0, 8).map((sym) => board.rows.find((r) => r.stock.symbol === sym)!).filter(Boolean);
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
      <ol className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4" data-testid="battle-cards">
        {cards.map((c, i) => (
          <li key={c.m.id} className="min-w-0 rounded-[10px] border border-line bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display text-[20px] text-ink">{c.m.name}</p>
              <span className="num text-[13px] text-ink-3">#{i + 1}</span>
            </div>
            <p className="kicker">{c.m.style}</p>
            <p className="num mt-3 text-[30px] leading-none text-ink">{Math.round(c.rolling).toLocaleString("en-US")}</p>
            <p className="text-[12px] text-ink-3">rolling score, last 50 scored</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
              <dt className="text-ink-3">Scored</dt>
              <dd className="num text-right text-ink">{c.scored}</dd>
              <dt className="text-ink-3">Wins</dt>
              <dd className="num text-right text-ink">{c.wins}</dd>
              <dt className="text-ink-3">Direction</dt>
              <dd className="num text-right text-ink">{c.dir == null ? "no view" : `${Math.round(c.dir * 100)}%`}</dd>
              <dt className="text-ink-3">In range</dt>
              <dd className="num text-right text-ink">{c.inR == null ? "–" : `${Math.round(c.inR * 100)}%`}</dd>
            </dl>
            <p className="mt-3 text-[12.5px] leading-snug text-ink-2">{c.m.about}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex gap-1 text-[13px]" role="tablist">
        {[
          ["live", "Calls in play"],
          ["results", "Results"],
        ].map(([k, l]) => (
          <Link key={k} href={`/battle?view=${k}`} scroll={false} aria-current={view === k ? "page" : undefined} className={`rounded-[6px] px-3 py-1.5 ${view === k ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"}`}>
            {l}
          </Link>
        ))}
      </div>
      {view === "results" ? (
        <Panel title="Latest resolved tasks" note="score per model · best in bold" className="mt-3" pad={false}>
          <div className="scroll-x">
            <table className="tbl min-w-[720px] text-[13px]">
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
                        <span className="font-semibold text-ink">{list[0].symbol}</span> <span className="num text-ink-3">{HORIZONS[list[0].horizon].short}</span>
                        <span className="num block text-[11.5px] text-ink-3">{new Date(list[0].resolvesAt * 1000).toISOString().slice(5, 16).replace("T", " ")} UTC</span>
                      </td>
                      <td className="num text-right">
                        {money(list[0].reference)} → {money(list[0].price)}
                      </td>
                      {HOUSE.map((m) => {
                        const l = list.find((x) => x.model === m.id);
                        return (
                          <td key={m.id} className={`num text-right ${l?.score === best ? "font-semibold text-ink" : "text-ink-3"}`}>
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
        </Panel>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="battle-live">
          {live.map((r) => (
            <li key={r.stock.symbol} className="min-w-0 rounded-[10px] border border-line bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">
                  {r.stock.symbol} <span className="num font-normal text-ink-3">1H</span>
                </p>
                <p className="num text-[12.5px] text-ink-3">ref {money(r.price)}</p>
              </div>
              <ul className="mt-2 space-y-1 text-[12.5px]">
                {r.forecasts[0].map((f) => {
                  const m = HOUSE.find((x) => x.id === f.model)!;
                  const ref = Number(f.reference);
                  const mid = (Number(f.low) + Number(f.high)) / 2;
                  return (
                    <li key={f.model} className="grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-2">
                      <span className="text-ink-2">{m.name}</span>
                      <span className="num truncate text-ink">
                        {money(Number(f.low) / 1e8)} – {money(Number(f.high) / 1e8)}
                      </span>
                      <span className={`num text-right ${mid > ref ? "text-up" : mid < ref ? "text-down" : "text-ink-3"}`}>{mid > ref ? "leans ▲" : mid < ref ? "leans ▼" : "flat"}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
