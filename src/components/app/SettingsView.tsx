"use client";

import Link from "next/link";
import { useWallet } from "@/components/wallet/WalletProvider";
import { DEFAULT_PREFS, usePrefs, type Prefs } from "./AppShell";

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className="!px-2.5">
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
  const row = "flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-3 last:border-0";
  const sw = (on: boolean, flip: () => void, label: string) => (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={flip} className={`relative h-[20px] w-[36px] cursor-pointer rounded-full transition-colors ${on ? "bg-white" : "bg-paper-3"}`}>
      <span className={`absolute top-[3px] size-[14px] rounded-full transition-[left] ${on ? "left-[19px] bg-black" : "left-[3px] bg-ink-3"}`} />
    </button>
  );
  return (
    <div className="space-y-3" data-testid="settings">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-[22px] leading-[1.3] font-medium tracking-[-0.02em] text-ink">Settings</h1>
          <p className="mt-1.5 text-[13px] text-ink-3">Display choices. They stay in this browser and never reach a server.</p>
        </div>
        <button type="button" className="abtn !text-ink" onClick={() => set(DEFAULT_PREFS)}>
          Reset to defaults
        </button>
      </header>
      <section className="panel overflow-hidden">
        <h2 className="label border-b border-white/[0.06] bg-white/[0.015] px-3 py-3 !text-ink/85">Charts and data</h2>
        <div className={row}>
          <div>
            <p className="text-[13.5px] text-ink">Default chart range</p>
            <p className="text-[12px] text-ink-3">Which span a chart shows first.</p>
          </div>
          <Seg label="Default chart range" value={p.chartRange} onChange={(v) => put({ chartRange: v })} options={["1D", "5D", "1M", "6M", "1Y"].map((x) => [x as Prefs["chartRange"], x])} />
        </div>
        <div className={row}>
          <div>
            <p className="text-[13.5px] text-ink">Alert checks</p>
            <p className="text-[12px] text-ink-3">How often price alerts are checked while a tab is visible.</p>
          </div>
          <Seg label="Alert checks" value={p.refresh} onChange={(v) => put({ refresh: v })} options={[[0, "Off"], [30, "30s"], [60, "1m"], [300, "5m"]] as [Prefs["refresh"], string][]} />
        </div>
      </section>
      <section className="panel overflow-hidden">
        <h2 className="label border-b border-white/[0.06] bg-white/[0.015] px-3 py-3 !text-ink/85">Display</h2>
        <div className={row}>
          <div>
            <p className="text-[13.5px] text-ink">Short numbers</p>
            <p className="text-[12px] text-ink-3">Show 45.1M where the full figure would be 45,117,412.</p>
          </div>
          {sw(p.compact, () => put({ compact: !p.compact }), "Short numbers")}
        </div>
        <div className={row}>
          <div>
            <p className="text-[13.5px] text-ink">Intraday lines</p>
            <p className="text-[12px] text-ink-3">A small line of today&apos;s trading beside each row on Markets.</p>
          </div>
          {sw(p.sparklines, () => put({ sparklines: !p.sparklines }), "Intraday lines")}
        </div>
      </section>
      <section className="panel overflow-hidden">
        <h2 className="label border-b border-white/[0.06] bg-white/[0.015] px-3 py-3 !text-ink/85">Account</h2>
        <p className="px-3 pt-3 text-[13.5px] text-ink">{wallet.address ? `Wallet connected: ${wallet.address}` : "No wallet connected. Connecting only reads your address until you sign something."}</p>
        <p className="px-3 pt-1 pb-3 text-[12px] text-ink-3">
          API keys are created on the{" "}
          <Link href="/docs/developers/api" className="link">
            API page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
