import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";
import { STOCKS } from "@/config/stocks";
import { DOCS } from "@/content/docs";

// Every indexable page, the same list the navigation and footer link to.
// Account and tool views (/arena, /portfolio, /alerts, /settings, /swap, /deploy) stay out.
export const ROUTES = [
  "",
  "/forecasts",
  "/leaderboard",
  "/follow",
  "/ask",
  "/markets",
  ...STOCKS.map((s) => `/markets/${s.symbol.toLowerCase()}`),
  "/pulse",
  "/tokens",
  "/token",
  "/news",
  "/analytics",
  "/calendar",
  "/battle",
  "/network",
  ...DOCS.map((d) => (d.slug ? `/docs/${d.slug}` : "/docs")),
  "/terms",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${BRAND.url}${r}`,
    lastModified: now,
    changeFrequency: r === "" || r.startsWith("/forecasts") || r === "/leaderboard" ? "daily" : "weekly",
    priority: r === "" ? 1 : 0.6,
  }));
}
