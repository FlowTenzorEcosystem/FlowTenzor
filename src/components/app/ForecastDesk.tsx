"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { shortAddress } from "@/config/brand";
import { CONTRACTS, oracleLive } from "@/config/contracts";
import { STOCKS, marketIdOf } from "@/config/stocks";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useChain } from "@/components/providers/ChainProvider";
import { HORIZONS, checkRange, type HorizonId } from "@/lib/forecast/scoring";
import { txUrl } from "@/lib/onchain/client";
import { nowSec } from "@/lib/time";
import { commitOnChain, readModels, readRecentForecasts, registerOnChain, roundHint, scoreOnChain, type Wallet } from "@/lib/onchain/oracle";
import type { ChainForecast, ChainModel } from "@/lib/onchain/calls";

type BoardRow = { symbol: string; price: number | null; forecasts: Record<string, { low: number; high: number }[]> };
type PracticeRec = {
  id: string;
  wallet: string;
  symbol: string;
  horizon: HorizonId;
  lowPrice: number;
  highPrice: number;
  referencePrice: number;
  resolvedPrice: number | null;
  confidenceBps: number;
  madeAt: number;
  resolvesAt: number;
  status: "open" | "scored" | "void";
  score?: number;
  inRange?: boolean;
};

const money = (v: number) => (v >= 1000 ? v.toFixed(0) : v.toFixed(2));
const when = (t: number) => new Date(t * 1000).toISOString().slice(5, 16).replace("T", " ");

function useBoardRow(symbol: string) {
  const [row, setRow] = useState<BoardRow | null>(null);
  useEffect(() => {
    let off = false;
    fetch("/api/board", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { rows: BoardRow[] } | null) => !off && setRow(b?.rows.find((r) => r.symbol === symbol) ?? null))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [symbol]);
  return row;
}

/** Where a forecast goes: the oracle when it is deployed (default), or practice. */
type Mode = "chain" | "practice";

export function ForecastDesk({ symbol: fixedSymbol, onSaved, initialSymbol, initialHorizon = 1 }: { symbol?: string; onSaved?: () => void; initialSymbol?: string; initialHorizon?: HorizonId }) {
  const wallet = useWallet();
  const modal = useWalletModal();
  const [symbol, setSymbol] = useState(fixedSymbol ?? initialSymbol ?? "NVDA");
  const [horizon, setHorizon] = useState<HorizonId>(initialHorizon);
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [confidence, setConfidence] = useState("80");
  const [mode, setMode] = useState<Mode>(oracleLive() ? "chain" : "practice");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [models, setModels] = useState<ChainModel[] | null>(null);
  const [picked, setModelId] = useState<string | null>(null);
  const [newModel, setNewModel] = useState("");
  const row = useBoardRow(symbol);

  const fill = useCallback(() => {
    const list = row?.forecasts[String(horizon)] ?? [];
    if (!list.length) return;
    const lo = list.reduce((a, f) => a + f.low, 0) / list.length;
    const hi = list.reduce((a, f) => a + f.high, 0) / list.length;
    setLow(money(lo));
    setHigh(money(hi));
  }, [row, horizon]);

  useEffect(() => {
    // Prefill the range from the baselines once their data arrives (and when the horizon changes).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fill();
  }, [fill]);

  /** Reshape the range around its centre: tighter, wider, or shifted up or down by a tenth of its width. */
  const shape = (kind: "tighter" | "wider" | "up" | "down") => {
    const lo = Number(low);
    const hi = Number(high);
    if (!(lo > 0 && hi > lo)) return;
    const mid = (lo + hi) / 2;
    const half = (hi - lo) / 2;
    const k = kind === "tighter" ? 0.8 : kind === "wider" ? 1.25 : 1;
    const shift = kind === "up" ? half * 0.2 : kind === "down" ? -half * 0.2 : 0;
    setLow(money(mid + shift - half * k));
    setHigh(money(mid + shift + half * k));
  };

  const mine = useMemo(() => (models ?? []).filter((m) => wallet.address && m.owner.toLowerCase() === wallet.address.toLowerCase()), [models, wallet.address]);
  useEffect(() => {
    if (mode !== "chain" || !oracleLive()) return;
    readModels()
      .then(setModels)
      .catch(() => setModels([]));
  }, [mode, wallet.address, tx]);
  // The chosen model, or the wallet's newest one; "" means "register a new model".
  const modelId = picked !== null && (picked === "" || mine.some((m) => m.id.toString() === picked)) ? picked : (mine[0]?.id.toString() ?? "");

  const toUnits = (s: string) => (/^\d{1,9}(\.\d{1,8})?$/.test(s.trim()) ? BigInt(Math.round(Number(s) * 1e8)) : null);
  const conf = Math.round(Number(confidence) * 100);
  const lowU = toUnits(low);
  const highU = toUnits(high);
  const refU = row?.price ? BigInt(Math.round(row.price * 1e8)) : null;
  const problem = lowU === null || highU === null ? "Enter both ends as prices." : refU ? checkRange(lowU, highU, conf, refU) : null;

  const w: Wallet | null = wallet.address ? { address: wallet.address, send: wallet.sendTransaction } : null;

  async function submit() {
    setError(null);
    setStatus(null);
    setTx(null);
    if (!wallet.address) return modal.open();
    if (problem) return setError(problem);
    setBusy(true);
    try {
      if (mode === "practice") {
        setStatus("Reading the Chainlink price…");
        const t = await fetch("/api/practice/ticket", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: wallet.address, action: { kind: "forecast", symbol, horizon, low: low.trim(), high: high.trim(), confidence: Number(confidence) } }),
        });
        const tb = await t.json();
        if (!t.ok) throw new Error(tb.error ?? tb.message ?? "Could not prepare the forecast.");
        setStatus("Sign the forecast in your wallet (free, no transaction)…");
        const signature = await wallet.signMessage(tb.message);
        const r = await fetch("/api/practice/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nonce: tb.nonce, signature }) });
        const rb = await r.json();
        if (!r.ok) throw new Error(rb.error ?? "The forecast was not stored.");
        setStatus(`Saved. It resolves ${when(rb.forecast.resolvesAt)} UTC and is scored against Chainlink then.`);
      } else {
        if (!w) return;
        if (!wallet.onRobinhoodChain) await wallet.switchNetwork();
        let id = modelId ? BigInt(modelId) : null;
        if (!id) {
          const name = newModel.trim();
          if (!name) throw new Error("Name your model first (1 to 32 characters).");
          const reg = await registerOnChain(w, name, "", setStatus);
          if (!reg.modelId) throw new Error("The model was registered but its id could not be read. Reload and pick it from the list.");
          id = reg.modelId;
          setModelId(id.toString());
        }
        const res = await commitOnChain(w, id, { marketId: marketIdOf(symbol), horizon, low: lowU!, high: highU!, confidenceBps: conf }, setStatus);
        setTx(res.hash);
        setStatus(`Committed on chain in block ${res.block.toLocaleString("en-US")}.`);
      }
      onSaved?.();
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message.replace(/^.*user rejected.*$/i, "You cancelled in the wallet. Nothing was sent.") : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet min-w-0 p-5 sm:p-6" data-testid="forecast-desk">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="h-sub">Add a forecast</h2>
        {oracleLive() ? (
          <div role="tablist" aria-label="Where to record" className="flex rounded-[9px] border border-line-2 p-0.5 text-[13px]">
            {(["chain", "practice"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`cursor-pointer rounded-[7px] px-3 py-1.5 font-semibold ${mode === m ? "bg-ink text-paper" : "text-ink-2"}`}
              >
                {m === "chain" ? "On chain" : "Practice"}
              </button>
            ))}
          </div>
        ) : (
          <span className="chip chip-practice">Practice: free signature</span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fixedSymbol ? null : (
          <label className="block min-w-0">
            <span className="kicker">Token</span>
            <select className="field mt-1.5" value={symbol} onChange={(e) => setSymbol(e.target.value)} data-testid="desk-symbol">
              {STOCKS.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} · {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={`min-w-0 ${fixedSymbol ? "sm:col-span-2" : ""}`}>
          <span className="kicker">Horizon</span>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-[9px] border border-line-2 p-1">
            {HORIZONS.map((h) => (
              <button
                key={h.key}
                type="button"
                onClick={() => setHorizon(h.id as HorizonId)}
                aria-pressed={horizon === h.id}
                className={`cursor-pointer rounded-[6px] py-2 text-[14px] font-semibold ${horizon === h.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"}`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block min-w-0">
          <span className="kicker">Low (USD)</span>
          <input className="field num mt-1.5" inputMode="decimal" value={low} onChange={(e) => setLow(e.target.value)} aria-label="Low price" data-testid="desk-low" />
        </label>
        <label className="block min-w-0">
          <span className="kicker">High (USD)</span>
          <input className="field num mt-1.5" inputMode="decimal" value={high} onChange={(e) => setHigh(e.target.value)} aria-label="High price" data-testid="desk-high" />
        </label>
        <label className="block min-w-0">
          <span className="kicker">Confidence (50 to 99 %)</span>
          <input className="field num mt-1.5" inputMode="numeric" value={confidence} onChange={(e) => setConfidence(e.target.value)} aria-label="Confidence" />
        </label>
        <div className="flex min-w-0 flex-col justify-end">
          <p className="small">
            Chainlink now: <span className="num text-ink">{row?.price ? `$${money(row.price)}` : "reading…"}</span>
          </p>
          <button type="button" onClick={fill} className="link mt-1 cursor-pointer self-start text-[14px]">
            Reset to the baselines&apos; range
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Shape the range">
        {(
          [
            ["tighter", "Tighter"],
            ["wider", "Wider"],
            ["up", "Lean up ▲"],
            ["down", "Lean down ▼"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => shape(k)} className="cursor-pointer rounded-[7px] border border-line-2 px-2.5 py-1 text-[12.5px] text-ink-2 hover:text-ink">
            {l}
          </button>
        ))}
        {row?.price && Number(low) > 0 && Number(high) > Number(low) ? (
          <span className="num ml-auto self-center text-[12.5px] text-ink-3">
            ±{((((Number(high) - Number(low)) / 2) / row.price) * 100).toFixed(2)}% · leans {(Number(low) + Number(high)) / 2 > row.price ? "up" : (Number(low) + Number(high)) / 2 < row.price ? "down" : "flat"}
          </span>
        ) : null}
      </div>

      {mode === "chain" ? (
        <div className="mt-5 rounded-[10px] border border-line bg-paper-2 p-4">
          <p className="kicker">Model</p>
          {!wallet.address ? (
            <p className="small mt-1">Connect a wallet to pick or register a model.</p>
          ) : mine.length ? (
            <select className="field mt-1.5" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {mine.map((m) => (
                <option key={m.id.toString()} value={m.id.toString()}>
                  #{m.id.toString()} {m.name}
                </option>
              ))}
              <option value="">Register a new model…</option>
            </select>
          ) : null}
          {wallet.address && (!mine.length || modelId === "") ? (
            <input
              className="field mt-2"
              maxLength={32}
              placeholder="Name your model (registered in the same flow)"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              aria-label="New model name"
            />
          ) : null}
          <p className="small mt-2">
            Two transactions the first time (register, then commit), one after that. The oracle reads the Chainlink price itself.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || (!!wallet.address && !!problem)} onClick={submit} className="btn btn-accent" data-testid="desk-submit">
          {!wallet.address ? "Connect wallet to forecast" : busy ? "Working…" : mode === "chain" ? "Commit on chain" : "Sign practice forecast"}
        </button>
        {wallet.address && problem ? <span className="text-[14px] text-down">{problem}</span> : null}
      </div>
      {status ? (
        <p className="mt-3 text-[14px] text-ink-2" role="status" data-testid="desk-status">
          {status}{" "}
          {tx ? (
            <a href={txUrl(tx)} target="_blank" rel="noreferrer" className="link">
              View transaction ↗
            </a>
          ) : null}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-[14px] text-down" role="alert" data-testid="desk-error">
          {error}
        </p>
      ) : null}
      <p className="small mt-4">
        One live forecast per {mode === "chain" ? "model" : "wallet"}, token and horizon. Scored by the{" "}
        <Link href="/docs/how-it-works" className="link">
          published rule
        </Link>{" "}
        when the horizon passes. Not advice.
      </p>
    </div>
  );
}

/** Practice forecasts from /api/practice/forecasts (one token, one wallet, or all). */
export function PracticeList({ symbol, wallet, refresh = 0, title = "Practice forecasts" }: { symbol?: string; wallet?: string; refresh?: number; title?: string }) {
  const [rows, setRows] = useState<PracticeRec[] | null>(null);
  const [configured, setConfigured] = useState(true);
  useEffect(() => {
    let off = false;
    const q = wallet ? `wallet=${wallet}` : symbol ? `symbol=${symbol}` : "";
    fetch(`/api/practice/forecasts?${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { configured: boolean; forecasts: PracticeRec[] }) => {
        if (off) return;
        setConfigured(b.configured !== false);
        setRows(b.forecasts ?? []);
      })
      .catch(() => !off && setRows([]));
    return () => {
      off = true;
    };
  }, [symbol, wallet, refresh]);
  return (
    <div className="sheet min-w-0 p-2 sm:p-3" data-testid="practice-list">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 pb-1">
        <h3 className="h-item">{title}</h3>
        <span className="chip chip-practice">Practice, signed by wallets</span>
      </div>
      {!configured ? (
        <p className="small px-3 py-4">Practice storage is not configured on this site yet, so practice forecasts cannot be saved here.</p>
      ) : rows === null ? (
        <p className="small px-3 py-4">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="small px-3 py-4">No practice forecasts yet{symbol ? ` for ${symbol}` : ""}. Be the first.</p>
      ) : (
        <div className="scroll-x">
          <table className="tbl min-w-[680px]">
            <thead>
              <tr>
                <th>Made (UTC)</th>
                {wallet ? <th>Token</th> : <th>Forecaster</th>}
                <th>Horizon</th>
                <th>Range</th>
                <th className="text-right">Conf.</th>
                <th className="text-right">Reference</th>
                <th className="text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr key={r.id}>
                  <td className="num text-[13px]">{when(r.madeAt)}</td>
                  {wallet ? <td className="font-semibold">{r.symbol}</td> : <td className="num text-[13px]">{shortAddress(r.wallet, 6, 4)}</td>}
                  <td className="num">{HORIZONS[r.horizon].short}</td>
                  <td className="num text-[13px] whitespace-nowrap">
                    {money(r.lowPrice)} – {money(r.highPrice)}
                  </td>
                  <td className="num text-right">{r.confidenceBps / 100}%</td>
                  <td className="num text-right">{money(r.referencePrice)}</td>
                  <td className="num text-right">
                    {r.status === "open" ? (
                      <span className="text-ink-3">resolves {when(r.resolvesAt)}</span>
                    ) : r.status === "void" ? (
                      <span className="text-ink-3">void (no new round)</span>
                    ) : (
                      <span className={r.inRange ? "text-up" : "text-down"}>
                        {(r.score ?? 0).toLocaleString("en-US")} · {money(r.resolvedPrice ?? 0)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Forecasts recorded in the ForecastOracle contract, with a Score button for due ones. */
export function ChainList({ symbol, refresh = 0 }: { symbol?: string; refresh?: number }) {
  const wallet = useWallet();
  const chain = useChain();
  const [rows, setRows] = useState<ChainForecast[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!oracleLive()) return;
    let off = false;
    Promise.all([readRecentForecasts(100), readModels()])
      .then(([f, m]) => {
        if (off) return;
        const mid = symbol ? marketIdOf(symbol) : -1;
        setRows(symbol ? f.filter((x) => x.marketId === mid) : f);
        setNames(Object.fromEntries(m.map((x) => [x.id.toString(), x.name])));
      })
      .catch(() => !off && setRows([]));
    return () => {
      off = true;
    };
  }, [symbol, refresh, tick]);
  if (!oracleLive()) return null;
  // The contract judges "due" by block time; use it when known.
  const now = Math.max(nowSec(), chain.facts?.blockTime ?? 0);
  async function score(f: ChainForecast) {
    if (!wallet.address) return;
    setMsg(null);
    try {
      if (!wallet.onRobinhoodChain) await wallet.switchNetwork();
      const round = await roundHint(STOCKS[f.marketId].symbol, f.resolvesAt);
      const r = await scoreOnChain({ address: wallet.address, send: wallet.sendTransaction }, f.id, round, setMsg);
      setMsg(`Scored in block ${r.block}.`);
      setTick((x) => x + 1);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not score.");
    }
  }
  return (
    <div className="sheet min-w-0 p-2 sm:p-3" data-testid="chain-list">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 pb-1">
        <h3 className="h-item">On-chain forecasts</h3>
        <a href={`https://robinhoodchain.blockscout.com/address/${CONTRACTS.oracle.address}`} target="_blank" rel="noreferrer" className="chip chip-live">
          ForecastOracle ↗
        </a>
      </div>
      {rows === null ? (
        <p className="small px-3 py-4">Reading the oracle…</p>
      ) : rows.length === 0 ? (
        <p className="small px-3 py-4">No forecasts on chain yet{symbol ? ` for ${symbol}` : ""}.</p>
      ) : (
        <div className="scroll-x">
          <table className="tbl min-w-[700px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Model</th>
                <th>Token</th>
                <th>Horizon</th>
                <th>Range</th>
                <th className="text-right">Reference</th>
                <th className="text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((f) => (
                <tr key={f.id.toString()} data-testid="chain-row">
                  <td className="num">{f.id.toString()}</td>
                  <td>{names[f.modelId.toString()] ?? `#${f.modelId}`}</td>
                  <td className="font-semibold">{STOCKS[f.marketId]?.symbol}</td>
                  <td className="num">{HORIZONS[f.horizon]?.short}</td>
                  <td className="num text-[13px] whitespace-nowrap">
                    {money(Number(f.low) / 1e8)} – {money(Number(f.high) / 1e8)}
                  </td>
                  <td className="num text-right">{money(Number(f.referencePrice) / 1e8)}</td>
                  <td className="num text-right">
                    {f.status === 1 ? (
                      f.resolvesAt < now ? (
                        <button type="button" className="btn btn-ink btn-sm" onClick={() => score(f)} disabled={!wallet.address}>
                          Score
                        </button>
                      ) : (
                        <span className="text-ink-3">resolves {when(f.resolvesAt)}</span>
                      )
                    ) : f.status === 3 ? (
                      <span className="text-ink-3">void</span>
                    ) : (
                      <span className={f.inRange ? "text-up" : "text-down"} data-testid="chain-score">
                        {f.score.toLocaleString("en-US")} · {money(Number(f.resolvedPrice) / 1e8)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {msg ? <p className="small px-3 pb-2">{msg}</p> : null}
    </div>
  );
}

/** Desk plus the lists it feeds, refreshed after each saved forecast. */
export function TokenWorkspace({ symbol }: { symbol: string }) {
  const [n, setN] = useState(0);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <ForecastDesk symbol={symbol} onSaved={() => setN((x) => x + 1)} />
      <ChainList symbol={symbol} refresh={n} />
      <PracticeList symbol={symbol} refresh={n} title={`Practice forecasts on ${symbol}`} />
    </div>
  );
}
