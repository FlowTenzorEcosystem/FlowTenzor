/* App navigation: four groups, the same order everywhere (header tabs, palette, mobile menu). */

export type AppLink = { href: string; label: string; hint: string };
export type AppGroup = { label: string; items: AppLink[] };

export const APP_NAV: AppGroup[] = [
  {
    label: "Research",
    items: [
      { href: "/ask", label: "Ask", hint: "Questions answered from live data" },
      { href: "/markets", label: "Markets", hint: "Every token's listing and chart" },
      { href: "/pulse", label: "Pulse", hint: "Momentum across all feeds" },
      { href: "/tokens", label: "Stock tokens", hint: "On-chain bid, ask and premium" },
      { href: "/token", label: "$FLOWTENZOR", hint: "The project token" },
      { href: "/news", label: "News", hint: "Headlines per ticker" },
      { href: "/analytics", label: "Analytics", hint: "Correlations from daily closes" },
      { href: "/calendar", label: "Macro calendar", hint: "Scheduled economic releases" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/portfolio", label: "Portfolio", hint: "Any address, valued live" },
      { href: "/alerts", label: "Alerts", hint: "Price alerts in this browser" },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/arena", label: "Arena", hint: "Sign or commit a forecast" },
      { href: "/battle", label: "Model battle", hint: "House models side by side" },
      { href: "/network", label: "Model network", hint: "Who forecasts, what is live" },
      { href: "/forecasts", label: "Forecasts", hint: "The feed for every token" },
      { href: "/leaderboard", label: "Leaderboard", hint: "Ranked by score" },
      { href: "/follow", label: "Follow", hint: "Paper follow with your limits" },
    ],
  },
  { label: "System", items: [{ href: "/settings", label: "Settings", hint: "How pages look for you" }] },
];

export const ALL_APP_LINKS = APP_NAV.flatMap((g) => g.items);
