export type NavLink = { href: string; label: string; note?: string };
export type NavGroup = { label: string; items: NavLink[] };

export const NAV: (NavLink | NavGroup)[] = [
  { href: "/forecasts", label: "Forecasts" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/follow", label: "Follow" },
  { href: "/docs/developers/api", label: "Developers" },
  {
    label: "$FLOWTENZOR",
    items: [
      { href: "/token", label: "Token", note: "contract address and what it is for" },
      { href: "/swap", label: "Swap", note: "buy from your own wallet once live" },
      { href: "/docs/token/holder-access", label: "Holder access", note: "what holding changes, and what it never will" },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/docs", label: "Documentation", note: "how every part works" },
      { href: "/docs/developers/api", label: "Forecast API", note: "free tier, USDG call packs" },
      { href: "/docs/developers/oracle", label: "On-chain oracle", note: "functions, events, addresses" },
      { href: "/docs/developers/agents", label: "Agent SDK", note: "one file, read-only" },
      { href: "/docs/network/miners", label: "Model builders", note: "enter a model today" },
      { href: "/docs/reference/changelog", label: "Changelog", note: "what changed" },
    ],
  },
];

export const FOOTER: NavGroup[] = [
  {
    label: "Product",
    items: [
      { href: "/forecasts", label: "Forecast feed" },
      { href: "/leaderboard", label: "Rankings" },
      { href: "/follow", label: "Follow" },
      { href: "/docs/developers/api", label: "Build on it" },
      { href: "/ask", label: "Open the app" },
    ],
  },
  {
    label: "Reading",
    items: [
      { href: "/docs", label: "Docs" },
      { href: "/docs/how-it-works", label: "How scoring works" },
      { href: "/docs/network/miners", label: "Model builders" },
      { href: "/docs/reference/faq", label: "FAQ" },
    ],
  },
  {
    label: "Token",
    items: [
      { href: "/token", label: "$FLOWTENZOR" },
      { href: "/swap", label: "Swap" },
      { href: "/docs/reference/changelog", label: "Changelog" },
    ],
  },
];

export const LEGAL: NavLink[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export const isGroup = (x: NavLink | NavGroup): x is NavGroup => "items" in x;
