"use client";

import { useEffect, useState } from "react";

/** Live countdown to a unix time; shows local time beside it. */
export function Countdown({ to, label }: { to: number; label?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // The clock is read after mount so the server-rendered frame and the first client frame match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now() / 1000);
    const t = window.setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = now == null ? null : Math.max(0, Math.floor(to - now));
  const hms = left == null ? "--:--:--" : `${String(Math.floor(left / 3600)).padStart(2, "0")}:${String(Math.floor((left % 3600) / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  return (
    <span>
      <span className="num text-[28px] text-ink" data-testid="countdown">
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
