"use client";

import Link from "next/link";
import { useWallet } from "@/components/wallet/WalletProvider";
import { DEFAULT_PREFS, usePrefs, type Prefs } from "./AppShell";

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[8px] border border-line-2 p-0.5" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`num cursor-pointer rounded-[6px] px-2.5 py-1 text-[12.5px] ${value === v ? "bg-ink text-[#050607]" : "text-ink-3 hover:text-ink"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function SettingsView() {
  const [p, set] = usePrefs();
  const wallet = useWallet();
  const put = (patch: Partial<Prefs>) => set({ ...p, ...patch });
  const row = "flex flex-wrap items-center justify-between gap-3 border-b border-line py-3.5 last:border-0";
  return (
    <div className="space-y-5" data-testid="settings">
      <section className="rounded-[10px] border border-line bg-card px-4">
        <h2 className="kicker pt-3 !text-ink-2">Charts and data</h2>
        <div className={row}>
          <div>
            <p className="text-ink">Default chart range</p>
            <p className="text-[12.5px] text-ink-3">Which span a chart shows first.</p>
          </div>
          <Seg label="Default chart range" value={p.chartRange} onChange={(v) => put({ chartRange: v })} options={["1D", "5D", "1M", "6M", "1Y"].map((x) => [x as Prefs["chartRange"], x])} />
        </div>
        <div className={row}>
          <div>
            <p className="text-ink">Alert checks</p>
            <p className="text-[12.5px] text-ink-3">How often price alerts are checked while a tab is visible.</p>
          </div>
          <Seg label="Alert checks" value={p.refresh} onChange={(v) => put({ refresh: v })} options={[[0, "Off"], [30, "30s"], [60, "1m"], [300, "5m"]] as [Prefs["refresh"], string][]} />
        </div>
      </section>
      <section className="rounded-[10px] border border-line bg-card px-4">
        <h2 className="kicker pt-3 !text-ink-2">Display</h2>
        <div className={row}>
          <div>
            <p className="text-ink">Short numbers</p>
            <p className="text-[12.5px] text-ink-3">Show 45.1M where the full figure would be 45,117,412.</p>
          </div>
          <Seg label="Short numbers" value={p.compact ? "on" : "off"} onChange={(v) => put({ compact: v === "on" })} options={[["on", "On"], ["off", "Off"]]} />
        </div>
        <div className={row}>
          <div>
            <p className="text-ink">Intraday lines</p>
            <p className="text-[12.5px] text-ink-3">A small line of today&apos;s trading beside each row on Markets.</p>
          </div>
          <Seg label="Intraday lines" value={p.sparklines ? "on" : "off"} onChange={(v) => put({ sparklines: v === "on" })} options={[["on", "On"], ["off", "Off"]]} />
        </div>
      </section>
      <section className="rounded-[10px] border border-line bg-card px-4 py-3">
        <h2 className="kicker !text-ink-2">Account</h2>
        <p className="mt-2 text-[14px] text-ink-2">{wallet.address ? `Wallet connected: ${wallet.address}` : "No wallet connected. Connecting only reads your address until you sign something."}</p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          API keys are created on the{" "}
          <Link href="/docs/developers/api" className="link">
            API page
          </Link>
          .
        </p>
      </section>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(DEFAULT_PREFS)}>
        Reset to defaults
      </button>
    </div>
  );
}
