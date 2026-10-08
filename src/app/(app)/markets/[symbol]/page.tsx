import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND, CHAIN, explorerAddress, explorerToken } from "@/config/brand";
import { STOCKS, stockBySymbol } from "@/config/stocks";
import { TokenWorkspace } from "@/components/app/ForecastDesk";
import { PriceChart } from "@/components/app/PriceChart";
import { Panel, big, money, signPct, up } from "@/components/app/ui";
import { FanChart } from "@/components/forecast/charts";
import { JsonLd } from "@/components/JsonLd";
import { earningsDate, headlines, quote, summary } from "@/lib/feeds/nasdaq";
import { HOUSE, ewmaVol, hourlyVol } from "@/lib/forecast/baselines";
import { getBoard, rowFor } from "@/lib/forecast/board";
import { nyWeekHour, sessionHours } from "@/lib/forecast/calendar";
import { SIGNAL_TEXT, signalOf } from "@/lib/forecast/consensus";
import { HORIZONS, zFor, type HorizonId } from "@/lib/forecast/scoring";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { nowSec } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props) {
  const { symbol } = await params;
  const s = stockBySymbol(symbol);
  if (!s) return {};
  return pageMeta({
    path: `/markets/${s.symbol.toLowerCase()}`,
    title: `${s.symbol} stock token forecast | ${BRAND.name}`,
    description: `${s.name} (${s.symbol}) stock token on ${CHAIN.name}: listing chart, Chainlink feed price, 80 % forecast ranges at three horizons, volatility and the scored record on ${BRAND.name}.`,
  });
}

/** Seconds until the next US regular-session open, 9:30 New York, Monday to Friday. */
function untilRegularOpen(now: number) {
  for (let t = Math.ceil(now / 60) * 60; t < now + 8 * 86_400; t += 60) {
    const h = nyWeekHour(t);
    const day = Math.floor(h / 24);
    const minute = new Date(t * 1000).getUTCMinutes();
    if (day >= 1 && day <= 5 && h % 24 === 9 && minute === 30) return t - now;
  }
  return null;
}

export default async function MarketPage({ params }: Props) {
  const { symbol: raw } = await params;
  const stock = stockBySymbol(raw);
  if (!stock) notFound();
  const [board, q, stats, earn, news] = await Promise.all([getBoard(), quote(stock.symbol), summary(stock.symbol), earningsDate(stock.symbol), headlines(stock.symbol, 6)]);
  const row = rowFor(board, stock.symbol);
  const pts = board.points.get(stock.symbol) ?? [];
  const now = board.at;
  const ranges = HORIZONS.map((h) => {
    const f = row?.forecasts[h.id as HorizonId] ?? [];
    const s = signalOf(f.map((x) => ({ low: Number(x.low) / 1e8, high: Number(x.high) / 1e8, reference: Number(x.reference) / 1e8 })));
    return { h, s, list: f };
  });
  const z = zFor(8000);
  const eddy = pts.length > 3 ? ewmaVol(pts, now) : null;
  const flat = pts.length > 3 ? hourlyVol(pts, now) : null;
  const toOpen = untilRegularOpen(now);
  const openMove = eddy && toOpen ? z * eddy * Math.sqrt(Math.max(1, sessionHours(now, now + toOpen))) : null;
  const earnDays = earn?.date ? Math.round((Date.parse(earn.date) / 1000 - nowSec()) / 86_400) : null;
  const lines = board.recent.filter((l) => l.symbol === stock.symbol).slice(0, 10);
  const i = STOCKS.indexOf(stock);
  const prev = STOCKS[(i + STOCKS.length - 1) % STOCKS.length];
  const next = STOCKS[(i + 1) % STOCKS.length];
  const day = ranges[1].s;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Markets", path: "/markets" }, { name: stock.symbol, path: `/markets/${stock.symbol.toLowerCase()}` }])} />
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
        <Link href="/markets" className="hover:text-ink">
          ← Markets
        </Link>
      </nav>

      {/* Identity bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-white/[0.08] bg-card px-3 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[19px] leading-none font-medium tracking-[-0.02em] text-ink">{stock.symbol}</h1>
            <span className="chip !py-0 before:hidden">{stock.kind === "etf" ? "ETF" : "Stock"}</span>
            {stats?.Exchange ? <span className="chip !py-0 before:hidden">{stats.Exchange}</span> : null}
          </div>
          <p className="mt-2 text-[13px] text-ink-3">{q?.company ?? stock.name} · stock token on {CHAIN.name}</p>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <p className="label">Chainlink feed</p>
            <p className="num mt-1.5 text-[15px] text-ink-2">{money(row?.price)}</p>
            <p className={`num mt-0.5 text-[11.5px] ${up(row?.change24h != null ? row.change24h * 100 : null)}`}>{signPct(row?.change24h != null ? row.change24h * 100 : null)} 24h</p>
          </div>
          <div>
            <p className="label">Listing · Nasdaq</p>
            <p className="num mt-1 text-[24px] leading-none text-ink">{money(q?.last)}</p>
            <p className={`num mt-1 text-[11.5px] ${up(q?.changePct)}`}>
              {q?.change != null ? `${q.change >= 0 ? "+" : "−"}${Math.abs(q.change).toFixed(2)} ` : ""}
              {signPct(q?.changePct)}
            </p>
          </div>
        </div>
      </div>

      {/* Forecast + statistics on the left, the chart on the right */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_264px]">
        <div className="min-w-0 space-y-3 lg:order-2">
          <Panel title={`Forecasts · ${stock.symbol}`} note="80 % · house baselines" testid="market-forecasts" pad={false}>
            <ul className="divide-y divide-line text-[13px]">
              {ranges.map(({ h, s }) => (
                <li key={h.key} className="grid grid-cols-[40px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="num text-ink-3">{h.short}</span>
                  <span className="num min-w-0 text-ink">{s.count ? `${money(s.low)} – ${money(s.high)}` : "–"}</span>
                  <span className="col-start-2">
                    <span className="chip">{SIGNAL_TEXT[s.label]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 border-t border-line p-3">
              <Link href={`/arena?symbol=${stock.symbol}`} className="abtn abtn-face">
                Forecast {stock.symbol}
              </Link>
              <Link href={`/ask?q=${encodeURIComponent(`Where is ${stock.symbol} trading now?`)}`} className="abtn">
                Ask
              </Link>
            </div>
          </Panel>
          <Panel title="Statistics" note="reference listing">
            <dl className="text-[13px]">
              {[
                ["Last close", money(q?.prevClose)],
                ["Day range", stats?.["Today's High/Low"] ?? "–"],
                ["52-week range", stats?.["52 Week High/Low"] ?? "–"],
                ["Volume", q?.volume != null ? q.volume.toLocaleString("en-US") : "–"],
                ["Market cap", stats?.["Market Cap"] ? `$${big(Number(stats["Market Cap"].replace(/[^0-9.]/g, "")))}` : "–"],
                ["Sector", stats?.Sector ?? (stock.kind === "etf" ? "Fund" : "–")],
                ["Last print", q?.asOf ?? "–"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="num text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={`News · ${stock.symbol}`} note="Nasdaq">
            {news.length ? (
              <ul className="divide-y divide-line">
                {news.map((n) => (
                  <li key={n.url} className="py-2.5">
                    <a href={n.url} target="_blank" rel="noreferrer nofollow" className="text-[13px] leading-snug text-ink hover:underline">
                      {n.title}
                    </a>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      {n.publisher} · {n.ago}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-3">No headlines right now.</p>
            )}
            <Link href={`/news?symbol=${stock.symbol}`} className="kicker mt-3 inline-block hover:!text-ink">
              All headlines →
            </Link>
          </Panel>
        </div>
        <div className="min-w-0 lg:order-1">
          <PriceChart symbol={stock.symbol} overlay={day.count ? { low: day.low, high: day.high, label: "1D baseline range" } : null} />
        </div>
      </div>

      {/* Three modes */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel title="Volatility forecast" note="Eddy · Chainlink">
          <p className="num text-[22px] text-ink">{eddy ? `${(eddy * Math.sqrt(24 * 252) * 100).toFixed(1)} %` : "–"}</p>
          <p className="mt-1 text-[13px] text-ink-3">annualised, exponentially weighted. Five-day flat estimate: {flat ? `${(flat * Math.sqrt(24 * 252) * 100).toFixed(1)} %` : "–"}.</p>
          <p className="mt-3 text-[13px] text-ink-2">Expected 1-day move at 80 %: {eddy ? `±${(z * eddy * Math.sqrt(24) * 100).toFixed(2)} %` : "–"}</p>
        </Panel>
        <Panel title="Market-open gap" note="next 9:30 New York">
          <p className="num text-[22px] text-ink">{openMove ? `±${(openMove * 100).toFixed(2)} %` : "–"}</p>
          <p className="mt-1 text-[13px] text-ink-3">
            80 % range for the move between now and the next regular-session open{toOpen ? `, in ${Math.floor(toOpen / 3600)}h ${Math.floor((toOpen % 3600) / 60)}m` : ""}. The token
            trades 24/5; the listing opens at 9:30.
          </p>
        </Panel>
        <Panel title="Earnings-week mode" note="Nasdaq · Zacks estimate">
          {earn ? (
            <>
              <p className="num text-[22px] text-ink">{earn.date ?? "–"}</p>
              <p className="mt-1 text-[13px] text-ink-3">{earnDays != null ? (earnDays >= 0 ? `in ${earnDays} days, estimated` : `${-earnDays} days ago`) : "date not published"}.</p>
              <p className="mt-3 text-[13px] text-ink-2">{earnDays != null && earnDays >= 0 && earnDays <= 7 ? "Earnings week: ranges tend to widen. Check each model's record before following." : "Model records around earnings appear once a model has scored forecasts across a report."}</p>
            </>
          ) : (
            <p className="text-[13px] text-ink-3">{stock.kind === "etf" ? "Funds do not report earnings." : "No earnings date available right now."}</p>
          )}
        </Panel>
      </div>

      {/* Fan + workspace */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <Panel title="Forecast fan" note="seven days of rounds · ranges from now">
            {pts.length > 1 && row?.price ? (
              <FanChart
                points={pts.filter((p) => p.t >= now - 7 * 86_400)}
                ranges={ranges.filter((r) => r.s.count).map((r) => ({ label: r.h.short, low: r.s.low, high: r.s.high, seconds: r.h.seconds }))}
                now={now}
                title={`${stock.symbol} Chainlink rounds and forecast ranges`}
              />
            ) : (
              <p className="text-[13px] text-ink-3">Feed history unavailable right now.</p>
            )}
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-4">
              {HOUSE.map((m) => {
                const f = ranges[1].list.find((x) => x.model === m.id);
                return (
                  <li key={m.id} className="min-w-0">
                    <span className="text-ink-3">{m.name}</span>
                    <span className="num block text-ink">{f ? `${money(Number(f.low) / 1e8)} – ${money(Number(f.high) / 1e8)}` : "–"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="kicker mt-2">1-day ranges per baseline</p>
          </Panel>
          <Panel title={`Recently scored on ${stock.symbol}`} note="baseline backtest" pad={false}>
            {lines.length ? (
              <div className="scroll-x">
                <table className="tbl min-w-[560px] text-[13px]">
                  <thead>
                    <tr>
                      <th>Made (UTC)</th>
                      <th>Baseline</th>
                      <th>H</th>
                      <th>Range</th>
                      <th className="text-right">At horizon</th>
                      <th className="text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={`${l.model}-${l.horizon}-${l.madeAt}`}>
                        <td className="num">{new Date(l.madeAt * 1000).toISOString().slice(5, 16).replace("T", " ")}</td>
                        <td>{HOUSE.find((m) => m.id === l.model)?.name}</td>
                        <td className="num">{HORIZONS[l.horizon].short}</td>
                        <td className="num whitespace-nowrap">
                          {money(l.low)} – {money(l.high)}
                        </td>
                        <td className="num text-right">{l.price != null ? money(l.price) : "no new round"}</td>
                        <td className={`num text-right ${l.status === "void" ? "text-ink-3" : l.inRange ? "text-up" : "text-down"}`}>{l.status === "void" ? "void" : l.score.toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-4 text-[13px] text-ink-3">Not enough rounds in the rounds read so far to replay a forecast.</p>
            )}
          </Panel>
        </div>
        <div className="min-w-0">
          <TokenWorkspace symbol={stock.symbol} />
          <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
            <a href={explorerToken(stock.token)} target="_blank" rel="noreferrer" className="chip">
              Token contract ↗
            </a>
            <a href={explorerAddress(stock.feed)} target="_blank" rel="noreferrer" className="chip">
              Chainlink feed ↗
            </a>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between border-t border-line pt-4 text-[13px]">
        <Link href={`/markets/${prev.symbol.toLowerCase()}`} className="text-ink-3 hover:text-ink">
          ← {prev.symbol}
        </Link>
        <Link href={`/markets/${next.symbol.toLowerCase()}`} className="text-ink-3 hover:text-ink">
          {next.symbol} →
        </Link>
      </div>
    </>
  );
}
