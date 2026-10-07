"use client";

import { useEffect, useState } from "react";
import { USDG } from "@/config/brand";
import { CONTRACTS, DEPLOY, creditsLive } from "@/config/contracts";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { txUrl } from "@/lib/onchain/client";
import { buyCredits, callsPurchased } from "@/lib/onchain/oracle";

/** Creates an API key after a free wallet signature. The key is shown once. */
export function ApiKeyPanel() {
  const wallet = useWallet();
  const modal = useWalletModal();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!wallet.address) return modal.open();
    setBusy(true);
    setError(null);
    try {
      const t = await fetch("/api/practice/ticket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: wallet.address, action: { kind: "apikey" } }),
      });
      const tb = await t.json();
      if (!t.ok) throw new Error(tb.error ?? tb.message ?? "Could not start.");
      const signature = await wallet.signMessage(tb.message);
      const r = await fetch("/api/practice/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nonce: tb.nonce, signature }) });
      const rb = await r.json();
      if (!r.ok) throw new Error(rb.error ?? "No key was created.");
      setKey(rb.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sheet min-w-0 p-5" data-testid="apikey-panel">
      <h3 className="h-item">API key</h3>
      <p className="small mt-1">
        Tied to your wallet, valid 30 days, stored only as a hash. The free tier needs no key; a key spends calls your wallet bought.
      </p>
      {key ? (
        <div className="mt-4">
          <code className="num block rounded-[8px] bg-paper-2 p-3 text-[13px] break-all text-ink select-all">{key}</code>
          <p className="small mt-2">Copy it now. It is not shown again.</p>
        </div>
      ) : (
        <button type="button" className="btn btn-ink btn-sm mt-4" onClick={create} disabled={busy}>
          {!wallet.address ? "Connect wallet" : busy ? "Waiting for signature…" : "Create a key (free signature)"}
        </button>
      )}
      {error ? <p className="mt-2 text-[14px] text-down">{error}</p> : null}
    </div>
  );
}

/** Buys call packs through CallCredits; shows what the wallet bought. Disabled until the contract is deployed. */
export function CreditsPanel() {
  const wallet = useWallet();
  const modal = useWalletModal();
  const [packs, setPacks] = useState("1");
  const [bought, setBought] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const live = creditsLive();
  useEffect(() => {
    if (!live || !wallet.address) return;
    callsPurchased(wallet.address)
      .then(setBought)
      .catch(() => setBought(null));
  }, [live, wallet.address, tx]);
  const n = /^\d{1,6}$/.test(packs) ? BigInt(packs) : 0n;
  async function buy() {
    if (!wallet.address) return modal.open();
    if (n <= 0n) return;
    setMsg(null);
    setTx(null);
    try {
      if (!wallet.onRobinhoodChain) await wallet.switchNetwork();
      const r = await buyCredits({ address: wallet.address, send: wallet.sendTransaction }, n, setMsg);
      setTx(r.hash);
      setMsg(`Bought in block ${r.block.toLocaleString("en-US")}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "The purchase did not go through.");
    }
  }
  const price = DEPLOY.packPrice / 10 ** USDG.decimals;
  return (
    <div className="sheet min-w-0 p-5" data-testid="credits-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="h-item">Call packs</h3>
        <span className={`chip ${live ? "chip-live" : "chip-target"}`}>{live ? "CallCredits live" : "Contract not deployed"}</span>
      </div>
      <p className="small mt-1">
        {DEPLOY.callsPerPack.toLocaleString("en-US")} calls for {price} {USDG.symbol}, paid straight to the treasury by the CallCredits contract. Purchases
        are final. Create your API key first: calls are counted from the moment the key&apos;s wallet opens its account here.
      </p>
      {live ? (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block w-[120px]">
              <span className="kicker">Packs</span>
              <input className="field num mt-1.5" inputMode="numeric" value={packs} onChange={(e) => setPacks(e.target.value)} />
            </label>
            <button type="button" className="btn btn-accent btn-sm" onClick={buy}>
              {wallet.address ? `Pay ${(Number(n) * price).toLocaleString("en-US")} ${USDG.symbol}` : "Connect wallet"}
            </button>
          </div>
          {bought !== null ? <p className="small mt-3">This wallet has bought {bought.toLocaleString("en-US")} calls.</p> : null}
          {msg ? (
            <p className="mt-2 text-[14px] text-ink-2">
              {msg}{" "}
              {tx ? (
                <a className="link" href={txUrl(tx)} target="_blank" rel="noreferrer">
                  View ↗
                </a>
              ) : null}
            </p>
          ) : null}
          <p className="small mt-3 break-all">Contract {CONTRACTS.credits.address}</p>
        </>
      ) : (
        <p className="small mt-3">Until it is deployed, the API has its free tier only.</p>
      )}
    </div>
  );
}
