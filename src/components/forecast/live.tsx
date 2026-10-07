import Link from "next/link";
import { HEADLINE } from "@/config/stocks";
import { HOUSE } from "@/lib/forecast/baselines";
import { getBoard, rowFor } from "@/lib/forecast/board";
import { SIGNAL_TEXT, signalOf } from "@/lib/forecast/consensus";
import { HORIZONS, average, MIN_RANKED, type HorizonId } from "@/lib/forecast/scoring";
import { usd } from "@/lib/format";
import { FanChart, RangeBar, Spark } from "./charts";

/* Server components that read the forecast board. Each sits in a Suspense boundary on its page. */

export const pct = (v: number | null, digits = 2) => (v == null ? "–" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`);
export const fmtPrice = (v: number) => (v >= 1000 ? usd(v, 0) : usd(v));

export async function HeroFan({ symbol = "NVDA" }: { symbol?: string }) {
  const board = await getBoard();
  const row = rowFor(board, symbol);
  const points = (board.points.get(symbol) ?? []).filter((p) => p.t >= board.at - 6 * 86_400);
  if (!row || row.price == null) return <ChartUnavailable />;
  const ranges = HORIZONS.map((h) => {
    const f = row.forecasts[h.id as HorizonId];
    const s = signalOf(f.map((x) => ({ low: Number(x.low) / 1e8, high: Number(x.high) / 1e8, reference: Number(x.reference) / 1e8 })));
    return { label: h.short, low: s.low, high: s.high, seconds: h.seconds };
  }).filter((r) => r.high > 0);
  return (
    <div className="sheet p-4 sm:p-5" data-testid="hero-fan">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-display text-[19px] font-semibold text-ink">
          {symbol} <span className="num text-[15px] font-normal text-ink-2">{fmtPrice(row.price)}</span>{" "}
          <span className={`num text-[13px] ${row.change24h != null && row.change24h < 0 ? "text-down" : "text-up"}`}>{pct(row.change24h)} 24h</span>
        </p>
        <span className="chip chip-live">Chainlink, live</span>
      </div>
      <FanChart points={points} ranges={ranges} now={board.at} title={`${symbol} price over six days with 80 % forecast ranges for one hour, one day and one week`} height={280} />
      <p className="small mt-1">
        Six days of the {symbol} Chainlink feed, and the average 80 % range of the four house baselines for each horizon. Baselines, not
        advice.
      </p>
    </div>
  );
}

export function ChartUnavailable() {
  return (
    <div className="sheet grid min-h-[260px] place-items-center p-6 text-center text-[14px] text-ink-3" data-testid="chart-unavailable">
      The Chainlink feeds could not be read just now. The chart comes back on the next refresh.
    </div>
  );
}

export function BoardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="sheet p-5" aria-busy="true">
      <p className="small">Reading Chainlink rounds from Robinhood Chain…</p>
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-paper-2" />
        ))}
      </div>
    </div>
  );
}

/** Forecast feed table. `symbols` limits the rows (home shows the headline tokens). */
export async function FeedTable({ symbols, horizon = 1, link = true }: { symbols?: string[]; horizon?: HorizonId; link?: boolean }) {
  const board = await getBoard();
  const rows = board.rows.filter((r) => !symbols || symbols.includes(r.stock.symbol));
  const order = symbols ?? null;
  if (order) rows.sort((a, b) => order.indexOf(a.stock.symbol) - order.indexOf(b.stock.symbol));
  const h = HORIZONS[horizon];
  return (
    <div className="sheet min-w-0 p-2 sm:p-3" data-testid="feed-table">
      <div className="scroll-x">
        <table className="tbl min-w-[720px]">
          <thead>
            <tr>
              <th>Token</th>
              <th className="text-right">Chainlink price</th>
              <th className="text-right">24h</th>
              <th>6 days</th>
              <th>{h.label} range, 80 %</th>
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const votes = r.forecasts[horizon].map((x) => ({ low: Number(x.low) / 1e8, high: Number(x.high) / 1e8, reference: Number(x.reference) / 1e8 }));
              const s = signalOf(votes);
              const pts = (board.points.get(r.stock.symbol) ?? []).filter((p) => p.t >= board.at - 6 * 86_400);
              return (
                <tr key={r.stock.symbol}>
                  <td>
                    {link ? (
                      <Link href={`/markets/${r.stock.symbol.toLowerCase()}`} className="font-semibold text-ink hover:text-stamp">
                        {r.stock.symbol}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{r.stock.symbol}</span>
                    )}
                    <span className="block max-w-[180px] truncate text-[12.5px] text-ink-3">{r.stock.name}</span>
                  </td>
                  <td className="num text-right text-ink">{r.price != null ? fmtPrice(r.price) : "–"}</td>
                  <td className={`num text-right ${r.change24h != null && r.change24h < 0 ? "text-down" : "text-up"}`}>{pct(r.change24h)}</td>
                  <td>
                    <Spark points={pts} width={96} height={26} />
                  </td>
                  <td className="min-w-[200px]">
                    {s.count && r.price != null ? (
                      <>
                        <span className="num text-[13px] whitespace-nowrap text-ink-2">
                          {fmtPrice(s.low)} – {fmtPrice(s.high)}
                        </span>
                        <span className="mt-1.5 block">
                          <RangeBar low={s.low} high={s.high} price={r.price} />
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-3">–</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${s.label === "divergent" ? "chip-down" : s.label.startsWith("consensus") ? "chip-live" : ""}`}>{SIGNAL_TEXT[s.label]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {board.roundsRead === 0 ? <p className="small px-3 pb-2">The feeds could not be read on the last refresh; numbers return on the next one.</p> : null}
    </div>
  );
}

/** The house baselines' backtest record per horizon, as a compact table. */
export async function HouseRecord({ horizon }: { horizon?: HorizonId }) {
  const board = await getBoard();
  const list = horizon === undefined ? HORIZONS.map((h) => h.id as HorizonId) : [horizon];
  return (
    <div className="sheet min-w-0 p-2 sm:p-3" data-testid="house-record">
      <div className="scroll-x">
        <table className="tbl min-w-[620px]">
          <thead>
            <tr>
              <th>Baseline</th>
              <th>Horizon</th>
              <th className="text-right">Avg score</th>
              <th className="text-right">Scored</th>
              <th className="text-right">In range</th>
              <th className="text-right">Direction</th>
              <th className="text-right">Void</th>
            </tr>
          </thead>
          <tbody>
            {list.flatMap((h) =>
              HOUSE.map((m) => {
                const t = board.tallies[m.id][h];
                return (
                  <tr key={`${m.id}-${h}`}>
                    <td>
                      <span className="font-semibold text-ink">{m.name}</span>
                      <span className="block text-[12.5px] text-ink-3">{m.style}</span>
                    </td>
                    <td className="num">{HORIZONS[h].short}</td>
                    <td className="num text-right text-ink">{t.scored >= MIN_RANKED ? Math.round(average(t)).toLocaleString("en-US") : "–"}</td>
                    <td className="num text-right">{t.scored.toLocaleString("en-US")}</td>
                    <td className="num text-right">{t.scored ? `${Math.round((t.inRange / t.scored) * 100)}%` : "–"}</td>
                    <td className="num text-right">{t.directionCalls ? `${Math.round((t.directionHits / t.directionCalls) * 100)}%` : "–"}</td>
                    <td className="num text-right text-ink-3">{t.voided.toLocaleString("en-US")}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Live numbers for the facts band: how many tokens have a fresh feed, how many rounds were replayed. */
export async function BoardFacts() {
  const board = await getBoard();
  const fresh = board.rows.filter((r) => r.updatedAt && board.at - r.updatedAt < 4 * 86_400).length;
  const scored = Object.values(board.tallies).reduce((a, byH) => a + byH[0].scored + byH[1].scored + byH[2].scored, 0);
  return (
    <>
      <Fact value={String(fresh)} label="stock tokens with a fresh Chainlink feed right now" />
      <Fact value={board.roundsRead.toLocaleString("en-US")} label="Chainlink rounds read for the current board" />
      <Fact value={scored.toLocaleString("en-US")} label="baseline forecasts replayed and scored over the rounds read (up to 12 days)" />
    </>
  );
}

export function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 border-t border-line pt-4">
      <p className="num text-[clamp(30px,3.4vw,44px)] leading-none font-medium text-ink">{value}</p>
      <p className="mt-2 max-w-[260px] text-[14px] leading-snug text-ink-3">{label}</p>
    </div>
  );
}

export const HEADLINE_SET = HEADLINE;
