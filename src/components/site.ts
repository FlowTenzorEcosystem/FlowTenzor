const BRAND_SYMBOL = "$FLOWTENZOR";

export type NavLink = { href: string; label: string; note?: string };
export type NavGroup = { label: string; items: NavLink[] };

export const NAV: (NavLink | NavGroup)[] = [
  { href: "/forecasts", label: "Forecasts" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/follow", label: "Follow" },
  {
    label: "Developers",
    items: [
      { href: "/docs/developers/api", label: "Forecast API", note: "JSON over HTTP, free tier and USDG call packs" },
      { href: "/docs/developers/oracle", label: "On-chain oracle", note: "read ranges and scores from a contract" },
      { href: "/docs/developers/agents", label: "Agent SDK", note: "one read-only file for trading agents" },
      { href: "/docs/developers/widgets", label: "Widgets", note: "embeds for other sites" },
    ],
  },
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
      { href: "/docs/how-it-works", label: "How scoring works", note: "the interval score in plain words" },
      { href: "/docs/network/miners", label: "Model builders", note: "enter a model today" },
      { href: "/docs/reference/changelog", label: "Changelog", note: "what changed" },
    ],
  },
];

export const FOOTER: NavGroup[] = [
  {
    label: "Explore",
    items: [
      { href: "/forecasts", label: "Forecasts" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/follow", label: "Follow mode" },
      { href: "/docs/developers/api", label: "Developers" },
      { href: "/ask", label: "App" },
    ],
  },
  {
    label: "Learn",
    items: [
      { href: "/docs/how-it-works", label: "Notes" },
      { href: "/docs", label: "Docs" },
      { href: "/docs/reference/faq", label: "FAQ" },
    ],
  },
  {
    label: "Connect",
    items: [
      { href: "https://x.com/flowtenzorcom", label: "X" },
      { href: "/token", label: BRAND_SYMBOL },
      { href: "/docs/reference/changelog", label: "Changelog", note: "new" },
      { href: "/docs/network/miners", label: "Model builders" },
    ],
  },
];

export const LEGAL: NavLink[] = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
];

export const isGroup = (x: NavLink | NavGroup): x is NavGroup => "items" in x;
