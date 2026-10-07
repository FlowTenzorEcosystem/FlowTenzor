import { Suspense } from "react";
import Link from "next/link";
import { BRAND, CHAIN, shortAddress } from "@/config/brand";
import { CONTRACTS, oracleLive } from "@/config/contracts";
import { BoardSkeleton } from "@/components/forecast/live";
import { JsonLd } from "@/components/JsonLd";
import { AppHead } from "@/components/app/ui";
import { getStore } from "@/lib/auth/store";
import { HOUSE } from "@/lib/forecast/baselines";
import { getBoard } from "@/lib/forecast/board";
import { HORIZONS, MIN_RANKED, average, horizonByKey, type HorizonId, type Tally } from "@/lib/forecast/scoring";
import { chainLeaderboard } from "@/lib/onchain/oracle-server";
import { allForecasts, practiceTallies } from "@/lib/practice/forecasts";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/leaderboard",
  title: `Model leaderboard | ${BRAND.name}`,
  description: `The ${BRAND.name} leaderboard ranks forecasters by their average score against Chainlink at one hour, one day and one week, with sample sizes beside every rank.`,
});

type Entry = { key: string; name: React.ReactNode; kind: "chain" | "practice" | "house"; note: string; t: Tally };

const KIND = {
  chain: <span className="chip chip-live">On chain</span>,
  practice: <span className="chip chip-practice">Practice</span>,
  house: <span className="chip chip-target">Baseline backtest</span>,
};

async function Table({ horizon }: { horizon: HorizonId }) {
  const [board, chain] = await Promise.all([getBoard(), chainLeaderboard()]);
  const store = getStore();
  const practice = store ? practiceTallies(await allForecasts(store)) : [];
  const entries: Entry[] = [
    ...(chain ?? []).map((c) => ({
      key: `c${c.model.id}`,
      name: (
        <span>
          {c.model.name} <span className="num text-[12px] text-ink-3">#{c.model.id.toString()}</span>
          {c.bonded ? <span className="chip chip-live ml-2">Bonded</span> : null}
        </span>
      ),
      kind: "chain" as const,
      note: shortAddress(c.model.owner, 6, 4),
      t: { committed: c.stats[horizon].committed, scored: c.stats[horizon].scored, voided: c.stats[horizon].voided, inRange: c.stats[horizon].inRange, directionCalls: c.stats[horizon].directionCalls, directionHits: c.stats[horizon].directionHits, scoreSum: c.stats[horizon].scoreSum },
    })),
    ...practice.map((p) => ({ key: `p${p.wallet}`, name: <span className="num">{shortAddress(p.wallet, 6, 4)}</span>, kind: "practice" as const, note: "wallet", t: p.tallies[horizon] })),
    ...HOUSE.map((m) => ({ key: `h${m.id}`, name: <span>{m.name}</span>, kind: "house" as const, note: m.style, t: board.tallies[m.id][horizon] })),
  ].filter((e) => e.t.committed > 0);
  const ranked = entries.filter((e) => e.t.scored >= MIN_RANKED).sort((a, b) => average(b.t) - average(a.t));
  const unranked = entries.filter((e) => e.t.scored < MIN_RANKED).sort((a, b) => b.t.scored - a.t.scored);
  const bar = Math.max(...HOUSE.map((m) => (board.tallies[m.id][horizon].scored >= MIN_RANKED ? average(board.tallies[m.id][horizon]) : 0)));
  const rows = [...ranked, ...unranked];
  return (
    <div className="sheet min-w-0 p-2 sm:p-3" data-testid="leaderboard">
      <div className="scroll-x">
        <table className="tbl min-w-[760px]">
          <thead>
            <tr>
              <th className="w-[56px]">Rank</th>
              <th>Forecaster</th>
              <th>Source</th>
              <th className="text-right">Avg score</th>
              <th className="text-right">Scored</th>
              <th className="text-right">In range</th>
              <th className="text-right">Direction</th>
              <th className="text-right">Void</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const rank = ranked.indexOf(e);
              const beats = e.kind !== "house" && rank >= 0 && average(e.t) > bar && bar > 0;
              return (
                <tr key={e.key} className={e.kind === "house" ? "bg-paper-2/60" : ""}>
                  <td className="num text-ink-3">{rank >= 0 ? rank + 1 : "–"}</td>
                  <td>
                    <span className="font-semibold text-ink">{e.name}</span>
                    <span className="block text-[12.5px] text-ink-3">
                      {e.note}
                      {beats ? " · beats every baseline" : ""}
                    </span>
                  </td>
                  <td>{KIND[e.kind]}</td>
                  <td className="num text-right text-[15px] text-ink">{e.t.scored >= MIN_RANKED ? Math.round(average(e.t)).toLocaleString("en-US") : "–"}</td>
                  <td className="num text-right">{e.t.scored.toLocaleString("en-US")}</td>
                  <td className="num text-right">{e.t.scored ? `${Math.round((e.t.inRange / e.t.scored) * 100)}%` : "–"}</td>
                  <td className="num text-right">{e.t.directionCalls ? `${Math.round((e.t.directionHits / e.t.directionCalls) * 100)}%` : "–"}</td>
                  <td className="num text-right text-ink-3">{e.t.voided.toLocaleString("en-US")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!oracleLive() ? (
        <p className="small px-3 pt-3 pb-2">
          On-chain models join this table when the ForecastOracle contract is deployed. Until then the board holds the house baselines and practice
          forecasters.
        </p>
      ) : (
        <p className="small px-3 pt-3 pb-2">
          On-chain rows are read from ForecastOracle{" "}
          <a className="link" href={`${CHAIN.explorer}/address/${CONTRACTS.oracle.address}`} target="_blank" rel="noreferrer">
            {shortAddress(CONTRACTS.oracle.address)}
          </a>
          .
        </p>
      )}
    </div>
  );
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ h?: string }> }) {
  const { h } = await searchParams;
  const horizon = (horizonByKey(h ?? "1d")?.id ?? 1) as HorizonId;
  const board = await getBoard();
  const store = getStore();
  const practice = store ? practiceTallies(await allForecasts(store)) : [];
  const base = board.tallies["still-water"][horizon];
  const ranked = practice.filter((p) => p.tallies[horizon].scored >= MIN_RANKED);
  const stats = [
    { k: "Ranked practice forecasters", v: ranked.length },
    { k: "Practice forecasts scored", v: practice.reduce((a, p) => a + p.tallies[horizon].scored, 0) },
    { k: "Baseline score", v: base.scored >= MIN_RANKED ? Math.round(average(base)).toLocaleString("en-US") : "–", note: "Still Water, random walk" },
    { k: "Beating the baseline", v: `${ranked.filter((p) => average(p.tallies[horizon]) > average(base)).length} of ${ranked.length}` },
  ];
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Leaderboard", path: "/leaderboard" }])} />
      <AppHead
        chips={
          <>
            <span className="chip chip-live">Order set by scores against Chainlink</span>
          </>
        }
        title="Leaderboard"
        desc={`Every forecaster ranked by average score at one horizon: on-chain models, practice wallets and the four house baselines. A rank needs at least ${MIN_RANKED} scored forecasts. Click a horizon to switch.`}
        stats={stats}
      />
      <section>
        <div className="mt-6">
          <nav aria-label="Horizon" className="flex w-max max-w-full gap-1 rounded-[10px] border border-line-2 bg-card p-1">
            {HORIZONS.map((x) => (
              <Link
                key={x.key}
                href={`/leaderboard?h=${x.key}`}
                scroll={false}
                aria-current={x.id === horizon ? "page" : undefined}
                className={`rounded-[7px] px-4 py-2 text-[14px] font-semibold ${x.id === horizon ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"}`}
              >
                {x.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6">
            <Suspense key={horizon} fallback={<BoardSkeleton rows={8} />}>
              <Table horizon={horizon} />
            </Suspense>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 text-[15px] leading-relaxed text-ink-2 md:grid-cols-3">
            <p>
              <span className="font-semibold text-ink">Average score</span> is the mean of the 0 to 10,000 scores of a forecaster&apos;s scored
              forecasts at this horizon. <Link href="/docs/how-it-works" className="link">How a score is made</Link>.
            </p>
            <p>
              <span className="font-semibold text-ink">Baseline backtest</span> rows are recomputed over up to the last 12 days of Chainlink rounds
              with data that existed at each moment. They show what plain statistics achieve, nothing more.
            </p>
            <p>
              <span className="font-semibold text-ink">Void</span> forecasts had no new Chainlink round in their window (closed market or a quiet
              feed) and are not scored, so nobody gains from forecasting a weekend.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
