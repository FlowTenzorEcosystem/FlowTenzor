import Link from "next/link";
import { BRAND, CHAIN, USDG, shortAddress } from "@/config/brand";
import { STOCKS, stockBySymbol } from "@/config/stocks";
import { AppHead, Panel, money } from "@/components/app/ui";
import { CaConsole } from "@/components/CopyCa";
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
  // A pool so thin that the quote sits more than 50 % from the listing says nothing about the token's price: keep it in the table, out of the aggregates.
  const sane = quoted.filter((r) => r.premium != null && Math.abs(r.premium) <= 0.5);
  const avgPrem = sane.filter((r) => r.premium != null).reduce((a, r, _, all) => a + (r.premium ?? 0) / all.length, 0);
  const widest = [...sane].sort((a, b) => Math.abs(b.premium ?? 0) - Math.abs(a.premium ?? 0))[0];
  const tightest = [...sane].sort((a, b) => (a.spread ?? 9) - (b.spread ?? 9))[0];
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
            <span className="chip before:hidden">Chain {CHAIN.id}</span>
            <span className="chip chip-practice before:hidden">Read-only</span>
          </>
        }
        title="What stock tokens cost on chain"
        desc={`The price you would actually get on ${CHAIN.name}, quoted by the Uniswap v3 QuoterV2 against each token's USDG pools, compared with the exchange price of the share each token follows. Quotes refresh every 30 seconds.`}
        actions={
          <>
            <span className="label">Refresh 30 s</span>
            <Link href={`/tokens${symbol ? `?symbol=${symbol}` : ""}`} className="abtn !text-ink">
              ↻ Refresh
            </Link>
          </>
        }
        stats={[
          { k: "Tokens quoted", v: `${quoted.length} / ${STOCKS.length}`, note: quoted.length < STOCKS.length ? "the rest have no USDG v3 pool" : "" },
          { k: "Average premium", v: pct(quoted.length ? avgPrem : null, 3) },
          { k: "Widest premium", v: widest ? `${widest.symbol} ${pct(widest.premium)}` : "–" },
          { k: "Tightest spread", v: tightest ? `${tightest.symbol} ${pct(tightest.spread, 3).replace("+", "")}` : "–" },
          { k: "Block", v: block ? `#${Number(BigInt(block)).toLocaleString("en-US")}` : "–", note: `quoter ${shortAddress(UNISWAP_V3.quoterV2)}` },
        ]}
      />
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
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
                  <tr key={r.symbol} className={r.symbol === pick.symbol ? "bg-white/[0.04] shadow-[inset_2px_0_0_#fff]" : ""}>
                    <td>
                      <Link href={`/tokens?symbol=${r.symbol}`} scroll={false} className="font-medium text-ink hover:underline">
                        {r.symbol}
                      </Link>
                      {r.fee ? <span className="ml-1.5 text-[10.5px] whitespace-nowrap text-faint">{r.fee / 10000}%</span> : null}
                    </td>
                    {r.bid == null ? (
                      <td colSpan={3} className="font-sans text-faint">
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
              ["Token contract", <CaConsole key="t" value={pick.token} label="Token" fit="short" className="!py-0.5" testid="ca-console-token" />],
              ["USDG pool", pq?.pool ? <CaConsole key="p" value={pq.pool} label="Pool" fit="short" kind="address" className="!py-0.5" testid="ca-console-pool" /> : "–"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between gap-3 border-b border-line py-2">
                <dt className="text-ink-3">{k}</dt>
                <dd className="num text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {ladder && mid ? (
            <div className="mt-4">
              <p className="label flex justify-between">
                Order size versus price move <span>mid {money(mid)}</span>
              </p>
              <p className="label mt-3">Buy with {USDG.symbol}</p>
              <ul className="mt-1.5 space-y-1 text-[12px]">
                {ladder.buys.map((b) => {
                  const imp = b.price ? b.price / mid - 1 : null;
                  return (
                    <li key={b.size} className="grid grid-cols-[44px_minmax(0,1fr)_72px_56px] items-center gap-2">
                      <span className="num text-ink-3">${b.size >= 1000 ? `${b.size / 1000}k` : b.size}</span>
                      <span className="h-2.5 rounded-[2px] bg-paper-3">
                        <span className="block h-full rounded-[2px] bg-ink-2" style={{ width: `${imp == null ? 0 : Math.min(100, 30 + Math.abs(imp) * 3000)}%` }} />
                      </span>
                      <span className="num text-right text-ink">{b.price ? money(b.price) : "–"}</span>
                      <span className="num text-right text-ink-3">{imp == null ? "–" : pct(imp, 3)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="label mt-3">Sell {pick.symbol}</p>
              <ul className="mt-1.5 space-y-1 text-[12px]">
                {ladder.sells.map((x) => {
                  const imp = x.price ? x.price / mid - 1 : null;
                  return (
                    <li key={x.size} className="grid grid-cols-[44px_minmax(0,1fr)_72px_56px] items-center gap-2">
                      <span className="num text-ink-3">{x.size}</span>
                      <span className="h-2.5 rounded-[2px] bg-paper-3">
                        <span className="block h-full rounded-[2px] bg-down" style={{ width: `${imp == null ? 0 : Math.min(100, 30 + Math.abs(imp) * 3000)}%` }} />
                      </span>
                      <span className="num text-right text-ink">{x.price ? money(x.price) : "–"}</span>
                      <span className="num text-right text-ink-3">{imp == null ? "–" : pct(imp, 3)}</span>
                    </li>
                  );
                })}
              </ul>
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
