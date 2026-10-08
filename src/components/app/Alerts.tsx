"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
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
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[380px_minmax(0,1fr)]" data-testid="alerts">
      <div className="min-w-0 space-y-3">
        <section className="panel overflow-hidden">
          <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">New alert</h2>
            {perm !== "granted" ? (
              <button type="button" className="abtn ml-auto !h-7 !text-ink" onClick={() => "Notification" in window && Notification.requestPermission().then(setPerm)}>
                <Bell className="size-3.5" /> Enable notifications
              </button>
            ) : (
              <span className="chip chip-live ml-auto">Notifications on</span>
            )}
          </div>
          <div className="p-3">
            <label className="block">
              <span className="label">Asset</span>
              <select className="field mt-1.5" value={asset} onChange={(e) => setAsset(e.target.value)} aria-label="Asset">
                {STOCKS.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} · {s.name}
                  </option>
                ))}
                <option value="TAO">TAO · Bittensor (OKX)</option>
              </select>
            </label>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="label">Condition</span>
              <div className="seg">
                {(["above", "below"] as const).map((d) => (
                  <button key={d} type="button" aria-pressed={dir === d} onClick={() => setDir(d)} className="!font-sans">
                    {d === "above" ? "Goes over" : "Goes under"}
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-3 block">
              <span className="label flex justify-between">
                Price (USD) <span>now {cur ? `$${cur.toFixed(2)}` : "…"}</span>
              </span>
              <input className="field num mt-1.5" inputMode="decimal" value={price} placeholder={cur ? cur.toFixed(2) : ""} onChange={(e) => setPrice(e.target.value)} aria-label="Alert price" data-testid="alert-price" />
            </label>
            <div className="mt-2 flex gap-1">
              {[-5, -2, 2, 5].map((p) => (
                <button key={p} type="button" onClick={() => quick(p)} className="num cursor-pointer rounded-[4px] border border-line px-2 py-1 text-[11.5px] text-ink-3 hover:border-line-2 hover:text-ink">
                  {p > 0 ? `+${p}` : p}%
                </button>
              ))}
            </div>
            <button type="button" className="abtn abtn-face mt-3 w-full" onClick={add} disabled={!(Number(price) > 0)} data-testid="alert-create">
              Create alert
            </button>
            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">Checked against Chainlink feed prices (TAO against OKX spot) on each refresh while a tab is open. Saved in this browser alone.</p>
          </div>
        </section>
        <section className="panel overflow-hidden">
          <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">Watchlist</h2>
            <span className="label">{stars.length} starred</span>
          </div>
          {stars.length ? (
            <ul className="flex flex-wrap gap-1.5 p-3">
              {stars.map((s) => (
                <li key={s}>
                  <Link href={`/markets/${s.toLowerCase()}`} className="num rounded-[3px] border border-line px-1.5 py-0.5 text-[12px] text-ink hover:border-line-2">
                    {s} {now[s] ? `$${now[s].toFixed(2)}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-[13px] text-ink-3">
              Star a token on the{" "}
              <Link href="/markets" className="link">
                Markets
              </Link>{" "}
              page to pin it here.
            </p>
          )}
        </section>
      </div>
      <div className="min-w-0 space-y-3">
        <section className="panel overflow-hidden">
          <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">Armed</h2>
            <span className="label">{armed.length} active</span>
          </div>
          {armed.length ? (
            <ul className="divide-y divide-line" data-testid="alerts-armed">
              {armed.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
                  <span>
                    <span className="num font-medium text-ink">{a.asset}</span> {a.dir === "above" ? "rises above" : "falls below"} <span className="num">${a.price}</span>
                  </span>
                  <button type="button" onClick={() => setAlerts(alerts.filter((x) => x.id !== a.id))} className="abtn !h-6 !px-2 !text-[11.5px]">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-3">No active alerts.</p>
          )}
        </section>
        <section className="panel overflow-hidden">
          <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
            <h2 className="label !text-ink/85">Triggered</h2>
            <span className="label">{fired.length}</span>
          </div>
          {fired.length ? (
            <ul className="divide-y divide-line">
              {fired.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] text-ink-2">
                  <span>
                    {a.asset} {a.dir === "above" ? "above" : "below"} ${a.price} · hit ${a.firedPrice?.toFixed(2)}
                  </span>
                  <button type="button" onClick={() => setAlerts(alerts.filter((x) => x.id !== a.id))} className="abtn !h-6 !px-2 !text-[11.5px]">
                    Clear
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-3">Nothing has gone off yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
