import Link from "next/link";
import { BRAND, CHAIN, USDG, explorerAddress, explorerToken, shortAddress } from "@/config/brand";
import { STOCKS, stockBySymbol } from "@/config/stocks";
import { AppHead, Panel, money } from "@/components/app/ui";
import { JsonLd } from "@/components/JsonLd";
import { allQuotes } from "@/lib/feeds/nasdaq";
import { rpc } from "@/lib/feeds/rpc";
import { UNISWAP_V3, allTokenQuotes, depth } from "@/lib/feeds/uniswap";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  path: "/tokens",
  title: `Stock token prices on Robinhood Chain | ${BRAND.name}`,
  description: `What each stock token costs on ${CHAIN.name} right now: bid, ask and spread from the Uniswap v3 USDG pools, the premium to the US listing and the depth for larger orders.`,
});

const pct = (v: number | null, d = 2) => (v == null ? "–" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);

export default async function TokensPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  const [quotes, listings, block] = await Promise.all([allTokenQuotes(), allQuotes(), rpc<string>("eth_blockNumber", []).catch(() => null)]);
  const rows = quotes.map((q) => {
    const l = listings.get(q.symbol)?.last ?? null;
    const mid = q.bid != null && q.ask != null ? (q.bid + q.ask) / 2 : null;
    return { ...q, listing: l, premium: mid != null && l ? mid / l - 1 : null };
  });
  const quoted = rows.filter((r) => r.bid != null);
  const avgPrem = quoted.filter((r) => r.premium != null).reduce((a, r, _, all) => a + (r.premium ?? 0) / all.length, 0);
  const widest = [...quoted].sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0))[0];
  const tightest = [...quoted].sort((a, b) => (a.spread ?? 9) - (b.spread ?? 9))[0];
  const pick = (symbol && stockBySymbol(symbol)) || stockBySymbol(tightest?.symbol ?? "NVDA")!;
  const pq = rows.find((r) => r.symbol === pick.symbol);
  const ladder = pq?.fee ? await depth(pick, pq.fee) : null;
  const mid = pq?.bid != null && pq.ask != null ? (pq.bid + pq.ask) / 2 : null;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Stock tokens", path: "/tokens" }])} />
      <AppHead
        chips={
          <>
            <span className="chip chip-live">Live</span>
            <span className="kicker">Chain {CHAIN.id} · read-only</span>
          </>
        }
        title="What stock tokens cost on chain"
        desc={`The price you would actually get on ${CHAIN.name}, quoted by the Uniswap v3 QuoterV2 against each token's USDG pools, compared with the exchange price of the share each token follows. Quotes refresh every 30 seconds.`}
        stats={[
          { k: "Tokens quoted", v: `${quoted.length} / ${STOCKS.length}`, note: quoted.length < STOCKS.length ? "the rest have no USDG v3 pool" : "" },
          { k: "Average premium", v: pct(quoted.length ? avgPrem : null, 3) },
          { k: "Widest premium", v: widest ? `${widest.symbol} ${pct(widest.premium)}` : "–" },
          { k: "Tightest spread", v: tightest ? `${tightest.symbol} ${pct(tightest.spread, 3).replace("+", "")}` : "–" },
          { k: "Block", v: block ? `#${Number(BigInt(block)).toLocaleString("en-US")}` : "–" },
          { k: "Quoter", v: shortAddress(UNISWAP_V3.quoterV2) },
        ]}
      />
      <div className="mt-6 grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="On-chain quotes" note="Uniswap v3 · USDG pools" pad={false} testid="tokens-table">
          <div className="scroll-x">
            <table className="tbl min-w-[760px] text-[13px]">
              <thead>
                <tr>
                  <th>Token</th>
                  <th className="text-right">Sell 1 token</th>
                  <th className="text-right">Buy for $1,000</th>
                  <th className="text-right">Gap</th>
                  <th className="text-right">Exchange price</th>
                  <th className="text-right">vs exchange</th>
                  <th className="text-right">Extra cost at $10k</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol} className={r.symbol === pick.symbol ? "bg-paper-2" : ""}>
                    <td>
                      <Link href={`/tokens?symbol=${r.symbol}`} scroll={false} className="font-semibold text-ink hover:text-stamp">
                        {r.symbol}
                      </Link>
                      {r.fee ? <span className="ml-2 text-[11.5px] text-ink-3">{r.fee / 10000}% pool</span> : null}
                    </td>
                    {r.bid == null ? (
                      <td colSpan={3} className="text-ink-3">
                        no USDG v3 pool with liquidity
                      </td>
                    ) : (
                      <>
                        <td className="num text-right">{money(r.bid)}</td>
                        <td className="num text-right">{money(r.ask)}</td>
                        <td className="num text-right">{pct(r.spread, 2).replace("+", "")}</td>
                      </>
                    )}
                    <td className="num text-right text-ink-2">{money(r.listing)}</td>
                    <td className={`num text-right ${r.premium == null ? "text-ink-3" : r.premium >= 0 ? "text-up" : "text-down"}`}>{pct(r.premium)}</td>
                    <td className="num text-right text-ink-2">{pct(r.slip10k, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="kicker border-t border-line px-4 py-2 normal-case">
            Bid is what one token sells for in {USDG.symbol}; ask is the average price paid when spending 1,000 {USDG.symbol}; premium compares the middle of the two with the exchange&apos;s last trade.
          </p>
        </Panel>
        <Panel title={`${pick.symbol} · depth`} note="price impact against the mid" testid="tokens-depth">
          <dl className="text-[13px]">
            {[
              ["On-chain bid (sell 1)", money(pq?.bid)],
              ["Ask (buy $1k)", money(pq?.ask)],
              ["Spread", pct(pq?.spread ?? null, 3).replace("+", "")],
              ["Listing (last trade)", money(pq?.listing)],
              ["Premium vs listing", pct(pq?.premium ?? null)],
              ["Token contract", <a key="t" className="hover:text-stamp" href={explorerToken(pick.token)} target="_blank" rel="noreferrer">{shortAddress(pick.token)} ↗</a>],
              ["USDG pool", pq?.pool ? <a key="p" className="hover:text-stamp" href={explorerAddress(pq.pool)} target="_blank" rel="noreferrer">{shortAddress(pq.pool)} ↗</a> : "–"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 border-b border-line py-1.5">
                <dt className="text-ink-3">{k}</dt>
                <dd className="num text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {ladder && mid ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="kicker">Buy with {USDG.symbol}</p>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {ladder.buys.map((b) => (
                    <li key={b.size} className="flex justify-between gap-2">
                      <span className="num text-ink-2">${b.size.toLocaleString("en-US")}</span>
                      <span className="num text-ink">{b.price ? pct(b.price / mid - 1, 3) : "–"}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="kicker">Sell {pick.symbol}</p>
                <ul className="mt-2 space-y-1 text-[13px]">
                  {ladder.sells.map((s) => (
                    <li key={s.size} className="flex justify-between gap-2">
                      <span className="num text-ink-2">{s.size}</span>
                      <span className="num text-ink">{s.price ? pct(s.price / mid - 1, 3) : "–"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-ink-3">No pool depth to show for this token.</p>
          )}
          <p className="mt-4 text-[12px] text-ink-3">Read-only quotes. Nothing here sends a transaction.</p>
        </Panel>
      </div>
    </>
  );
}
