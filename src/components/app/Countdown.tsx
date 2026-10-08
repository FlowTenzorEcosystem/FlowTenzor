"use client";

import { useEffect, useState } from "react";

/** Live countdown to a unix time; shows local time beside it. */
export function Countdown({ to, label, big = false }: { to: number; label?: string; big?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // The clock is read after mount so the server-rendered frame and the first client frame match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now() / 1000);
    const t = window.setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = now == null ? null : Math.max(0, Math.floor(to - now));
  const days = left == null ? 0 : Math.floor(left / 86_400);
  const rest = left == null ? 0 : left % 86_400;
  const clock = `${String(Math.floor(rest / 3600)).padStart(2, "0")}:${String(Math.floor((rest % 3600) / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`;
  const hms = left == null ? "--:--:--" : days ? `${days}d ${clock}` : clock;
  return (
    <span>
      <span className={`num text-ink ${big ? "text-[40px] leading-none tracking-[-0.02em]" : "text-[28px]"}`} data-testid="countdown">
        {hms}
      </span>
      {label ? <span className="ml-2 text-[12.5px] text-ink-3">{label}</span> : null}
    </span>
  );
}

/** A unix time printed in the visitor's own time zone (client only, so the server never guesses it). */
export function LocalTime({ t, withDay = false }: { t: number; withDay?: boolean }) {
  const [s, setS] = useState<string>("");
  useEffect(() => {
    // The visitor's time zone only exists in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setS(new Date(t * 1000).toLocaleString(undefined, withDay ? { weekday: "short", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" }));
  }, [t, withDay]);
  return <span className="num">{s || "…"}</span>;
}
