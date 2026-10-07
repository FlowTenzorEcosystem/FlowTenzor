"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { STOCKS } from "@/config/stocks";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { usePrefs } from "./AppShell";
import { useStars } from "./MarketsTable";

export type Alert = { id: string; asset: string; dir: "above" | "below"; price: number; createdAt: number; firedAt?: number; firedPrice?: number };
const KEY = "flowtenzor:alerts";

async function prices(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const [s, t] = await Promise.all([fetch("/api/stocks").then((r) => (r.ok ? r.json() : null)).catch(() => null), fetch("/api/tao").then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
  for (const r of (s?.rows ?? []) as { symbol: string; price: number | null }[]) if (r.price != null) out[r.symbol] = r.price;
  if (t?.last) out.TAO = t.last;
  return out;
}

/** Checks alerts whenever prices refresh while any app page is open. */
export function AlertWatcher() {
  const [alerts, setAlerts] = useLocalStore<Alert[]>(KEY, []);
  const [prefs] = usePrefs();
  const ref = useRef(alerts);
  useEffect(() => {
    ref.current = alerts;
  }, [alerts]);
  useEffect(() => {
    const every = (prefs.refresh || 60) * 1000;
    const tick = async () => {
      if (document.visibilityState !== "visible" || !ref.current.some((a) => !a.firedAt)) return;
      const p = await prices();
      let changed = false;
      const next = ref.current.map((a) => {
        const v = p[a.asset];
        if (a.firedAt || v == null) return a;
        if ((a.dir === "above" && v >= a.price) || (a.dir === "below" && v <= a.price)) {
          changed = true;
          try {
            if ("Notification" in window && Notification.permission === "granted") new Notification(`${a.asset} ${a.dir === "above" ? "rose above" : "fell below"} $${a.price}`, { body: `Now $${v.toFixed(2)}` });
          } catch {
            // Notifications refused; the alert is still marked as fired below.
          }
          return { ...a, firedAt: Date.now(), firedPrice: v };
        }
        return a;
      });
      if (changed) setAlerts(next);
    };
    tick();
    const t = window.setInterval(tick, every);
    return () => window.clearInterval(t);
  }, [prefs.refresh, setAlerts]);
  return null;
}

export function AlertsView() {
  const [alerts, setAlerts] = useLocalStore<Alert[]>(KEY, []);
  const [stars] = useStars();
  const [asset, setAsset] = useState("NVDA");
  const [dir, setDir] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [now, setNow] = useState<Record<string, number>>({});
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => {
    prices().then(setNow);
    // Notification permission is a browser-only value; read it after mount so server and client render the same first frame.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ("Notification" in window) setPerm(Notification.permission);
  }, []);
  const cur = now[asset];
  const quick = (p: number) => cur && setPrice((cur * (1 + p / 100)).toFixed(2));
  const add = () => {
    const v = Number(price);
    if (!(v > 0)) return;
    setAlerts([{ id: Math.random().toString(36).slice(2), asset, dir, price: v, createdAt: Date.now() }, ...alerts].slice(0, 100));
    setPrice("");
  };
  const armed = alerts.filter((a) => !a.firedAt);
  const fired = alerts.filter((a) => a.firedAt);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" data-testid="alerts">
      <section className="rounded-[10px] border border-line bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="kicker !text-ink-2">New alert</h2>
          {perm !== "granted" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => "Notification" in window && Notification.requestPermission().then(setPerm)}>
              Enable notifications
            </button>
          ) : (
            <span className="chip chip-live">Notifications on</span>
          )}
        </div>
        <label className="mt-4 block">
          <span className="kicker">Asset</span>
          <select className="field mt-1.5" value={asset} onChange={(e) => setAsset(e.target.value)} aria-label="Asset">
            {STOCKS.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} · {s.name}
              </option>
            ))}
            <option value="TAO">TAO · Bittensor (OKX)</option>
          </select>
        </label>
        <div className="mt-4">
          <span className="kicker">Condition</span>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-[8px] border border-line-2 p-1">
            {(["above", "below"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={dir === d} onClick={() => setDir(d)} className={`cursor-pointer rounded-[6px] py-1.5 text-[13.5px] ${dir === d ? "bg-ink text-[#050607]" : "text-ink-3"}`}>
                {d === "above" ? "Goes over" : "Goes under"}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-4 block">
          <span className="kicker">Price (USD) · now {cur ? `$${cur.toFixed(2)}` : "…"}</span>
          <input className="field num mt-1.5" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Alert price" data-testid="alert-price" />
        </label>
        <div className="mt-2 flex gap-1 text-[12.5px]">
          {[-5, -2, 2, 5].map((p) => (
            <button key={p} type="button" onClick={() => quick(p)} className="cursor-pointer rounded-[6px] border border-line-2 px-2 py-1 text-ink-2 hover:text-ink">
              {p > 0 ? `+${p}` : p}%
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-accent btn-sm mt-4" onClick={add} disabled={!(Number(price) > 0)} data-testid="alert-create">
          Create alert
        </button>
        <p className="mt-3 text-[12px] text-ink-3">Compared with Chainlink feed prices (TAO with OKX spot) on each refresh while a tab is open. Saved in this browser alone.</p>
      </section>
      <div className="min-w-0 space-y-5">
        <section className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="kicker !text-ink-2">Watchlist · {stars.length} starred</h2>
          {stars.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {stars.map((s) => (
                <li key={s}>
                  <Link href={`/markets/${s.toLowerCase()}`} className="chip">
                    {s} {now[s] ? `$${now[s].toFixed(2)}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-ink-3">Tap ★ beside a token on Markets and it stays here.</p>
          )}
        </section>
        <section className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="kicker !text-ink-2">Armed · {armed.length} active</h2>
          {armed.length ? (
            <ul className="mt-2 divide-y divide-line" data-testid="alerts-armed">
              {armed.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                  <span>
                    <span className="font-semibold text-ink">{a.asset}</span> {a.dir === "above" ? "rises above" : "falls below"} <span className="num">${a.price}</span>
                  </span>
                  <button type="button" onClick={() => setAlerts(alerts.filter((x) => x.id !== a.id))} className="cursor-pointer text-[12.5px] text-ink-3 hover:text-down">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-ink-3">Nothing is armed.</p>
          )}
        </section>
        <section className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="kicker !text-ink-2">Triggered · {fired.length}</h2>
          {fired.length ? (
            <ul className="mt-2 divide-y divide-line">
              {fired.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px] text-ink-2">
                  <span>
                    {a.asset} {a.dir === "above" ? "above" : "below"} ${a.price} · hit ${a.firedPrice?.toFixed(2)}
                  </span>
                  <button type="button" onClick={() => setAlerts(alerts.filter((x) => x.id !== a.id))} className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink">
                    Clear
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-ink-3">No alert has gone off so far.</p>
          )}
        </section>
      </div>
    </div>
  );
}
