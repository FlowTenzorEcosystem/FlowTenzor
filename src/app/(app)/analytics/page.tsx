import { BRAND, CHAIN } from "@/config/brand";
import { AppHead, Panel } from "@/components/app/ui";
import { JsonLd } from "@/components/JsonLd";
import { correlationMatrix } from "@/lib/forecast/analytics";
import { HOUSE } from "@/lib/forecast/baselines";
import { getBoard } from "@/lib/forecast/board";
import { HORIZONS, average, type HorizonId } from "@/lib/forecast/scoring";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/analytics",
  title: `Analytics: correlations and forecast statistics | ${BRAND.name}`,
  description: `Which ${CHAIN.name} stock tokens rise and fall together, how closely they track BTC, ETH and TAO, and how the ${BRAND.name} forecast record splits by horizon.`,
});

function cellBg(v: number | null) {
  if (v == null) return "transparent";
  return v >= 0 ? `rgba(79, 214, 154, ${Math.min(0.75, Math.abs(v) * 0.75)})` : `rgba(242, 130, 106, ${Math.min(0.75, Math.abs(v) * 0.75)})`;
}

export default async function AnalyticsPage() {
  const [m, board] = await Promise.all([correlationMatrix(), getBoard()]);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Analytics", path: "/analytics" }])} />
      <AppHead
        chips={<span className="chip chip-live">Live data</span>}
        title="Analytics"
        desc="Which listings rise and fall together, and how closely each tracks BTC, ETH and TAO, measured on daily closing prices; forecasts play no part in it. Underneath, the forecast record split by horizon."
        stats={[
          { k: "Window", v: m ? `${m.days} trading days` : "–", note: m ? `${m.from} → ${m.to}` : "" },
          { k: "Instruments", v: m ? m.labels.length : "–" },
          { k: "Sources", v: "Nasdaq · OKX" },
          { k: "Rounds in record", v: board.roundsRead.toLocaleString("en-US") },
        ]}
      />
      <Panel title="Correlation of daily returns" note="−1 to +1" className="mt-6" testid="corr-matrix" pad={false}>
        {m ? (
          <div className="scroll-x p-3">
            <table className="num border-collapse text-[11.5px]">
              <thead>
                <tr>
                  <th className="p-1" />
                  {m.labels.map((l) => (
                    <th key={l} className="p-1 text-center font-normal text-ink-3">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.labels.map((a, i) => (
                  <tr key={a}>
                    <th className="p-1 pr-2 text-right font-normal text-ink-3">{a}</th>
                    {m.m[i].map((v, j) => (
                      <td key={j} className="h-9 w-11 border border-line text-center text-ink" style={{ background: cellBg(v) }} title={`${a} / ${m.labels[j]}`}>
                        {v == null ? "–" : v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-[14px] text-ink-3">Daily prices could not be fetched just now, so the grid stays empty rather than showing old or made-up figures.</div>
        )}
      </Panel>
      <Panel title="Forecast record by horizon" note="house baselines · 12-day backtest" className="mt-5" pad={false}>
        <div className="scroll-x">
          <table className="tbl min-w-[640px] text-[13px]">
            <thead>
              <tr>
                <th>Horizon</th>
                <th className="text-right">Replayed</th>
                <th className="text-right">Void share</th>
                <th className="text-right">Average score</th>
                <th className="text-right">In range</th>
                <th>Best baseline</th>
              </tr>
            </thead>
            <tbody>
              {HORIZONS.map((h) => {
                const hid = h.id as HorizonId;
                const ts = HOUSE.map((x) => ({ m: x, t: board.tallies[x.id][hid] }));
                const committed = ts.reduce((a, x) => a + x.t.committed, 0);
                const voided = ts.reduce((a, x) => a + x.t.voided, 0);
                const scored = ts.reduce((a, x) => a + x.t.scored, 0);
                const sum = ts.reduce((a, x) => a + x.t.scoreSum, 0);
                const inR = ts.reduce((a, x) => a + x.t.inRange, 0);
                const best = [...ts].sort((a, b) => average(b.t) - average(a.t))[0];
                return (
                  <tr key={h.key}>
                    <td className="num">{h.label}</td>
                    <td className="num text-right">{committed.toLocaleString("en-US")}</td>
                    <td className="num text-right">{committed ? `${Math.round((voided / committed) * 100)}%` : "–"}</td>
                    <td className="num text-right">{scored ? Math.round(sum / scored).toLocaleString("en-US") : "–"}</td>
                    <td className="num text-right">{scored ? `${Math.round((inR / scored) * 100)}%` : "–"}</td>
                    <td>{best && best.t.scored ? `${best.m.name} · ${Math.round(average(best.t)).toLocaleString("en-US")}` : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2 text-[12px] text-ink-3">
          A high void share at one hour is expected: the feeds publish on a half-percent move or a daily heartbeat, so many hours pass without a new answer.
        </p>
      </Panel>
    </>
  );
}
