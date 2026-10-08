"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAddress, shortAddress } from "@/config/brand";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useLocalStore } from "@/components/wallet/useLocalStore";

type Holding = { symbol: string; name: string; amount: number; price: number | null; priceSource: string; value: number | null; range1d: { low: number; high: number } | null };
type Result = { address: string; holdings: Holding[]; usdg: number; eth: { amount: number; price: number | null; value: number | null }; total: number };

const usd = (v: number | null) => (v == null ? "–" : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export function PortfolioView() {
  const wallet = useWallet();
  const modal = useWalletModal();
  const [saved, setSaved] = useLocalStore<string>("flowtenzor:portfolio", "");
  const [typed, setInput] = useState<string | null>(null);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const address = saved || wallet.address || "";
  const input = typed ?? address;
  useEffect(() => {
    if (!isAddress(address)) return;
    let off = false;
    fetch(`/api/portfolio?address=${address}`)
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "Could not read this address.");
        if (!off) {
          setData(b);
          setError(null);
        }
      })
      .catch((e) => !off && setError(e.message));
    return () => {
      off = true;
    };
  }, [address]);
  const shown = data && data.address.toLowerCase() === address.toLowerCase() ? data : null;
  const busy = isAddress(address) && !shown && !error;
  return (
    <div className="space-y-5" data-testid="portfolio">
      <section className="panel p-4">
        <p className="kicker">Wallet address · balances only, nothing to sign</p>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isAddress(input.trim())) setSaved(input.trim());
            else setError("That is not a 0x address.");
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x… any Robinhood Chain address" aria-label="Robinhood Chain address" className="field num min-w-0 flex-1 !min-h-[40px] text-[13.5px]" />
          <button className="btn btn-ink btn-sm" type="submit">
            View
          </button>
          {!wallet.address ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={modal.open}>
              Connect wallet
            </button>
          ) : saved && saved.toLowerCase() !== wallet.address.toLowerCase() ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSaved(wallet.address!)}>
              Use {shortAddress(wallet.address, 4, 4)}
            </button>
          ) : null}
        </form>
        <p className="mt-2 text-[12px] text-ink-3">We keep the address in your browser; only this site&apos;s balance lookup ever sees it.</p>
      </section>
      {error ? <p className="text-[14px] text-down">{error}</p> : null}
      {!address ? (
        <section className="rounded-[10px] border border-dashed border-line-2 p-8 text-center">
          <p className="text-ink">Type a 0x address, or use your connected wallet</p>
          <p className="mt-1 text-[13px] text-ink-3">Every listed stock token, USDG and ETH in it, priced as of now.</p>
        </section>
      ) : busy ? (
        <p className="text-[14px] text-ink-3">Reading balances…</p>
      ) : shown ? (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-4">
            {[
              ["Total value", usd(shown.total)],
              ["Stock tokens", usd(shown.holdings.reduce((a, h) => a + (h.value ?? 0), 0))],
              ["USDG", usd(shown.usdg)],
              ["ETH", `${shown.eth.amount.toFixed(4)} · ${usd(shown.eth.value)}`],
            ].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-3">
                <dt className="kicker">{k}</dt>
                <dd className="num mt-1 truncate text-[16px] text-ink" data-testid={k === "Total value" ? "portfolio-total" : undefined}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <section className="panel">
            <div className="scroll-x">
              <table className="tbl min-w-[640px] text-[13px]">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Value</th>
                    <th>1-day baseline range</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.holdings.length ? (
                    shown.holdings.map((h) => (
                      <tr key={h.symbol}>
                        <td>
                          <Link href={`/markets/${h.symbol.toLowerCase()}`} className="font-semibold text-ink hover:text-stamp">
                            {h.symbol}
                          </Link>
                          <span className="block text-[12px] text-ink-3">{h.name}</span>
                        </td>
                        <td className="num text-right">{h.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                        <td className="num text-right">
                          {usd(h.price)} <span className="block text-[11px] text-ink-3">{h.priceSource}</span>
                        </td>
                        <td className="num text-right text-ink">{usd(h.value)}</td>
                        <td className="num">{h.range1d ? `${usd(h.range1d.low)} – ${usd(h.range1d.high)}` : "–"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-3">
                        No listed stock tokens in this address.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
