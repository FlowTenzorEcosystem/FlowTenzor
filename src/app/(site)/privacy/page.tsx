import { BRAND } from "@/config/brand";
import { PageHead } from "@/components/kit";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/privacy", title: `Privacy | ${BRAND.name}`, description: `What ${BRAND.name} stores: signed practice forecasts with their wallet address, hashed API keys, rate-limit counters. No accounts, no tracking cookies.` });

const ITEMS: [string, string][] = [
  ["No accounts, no tracking", "There is no sign-up, no email, no analytics cookie and no advertising tag. Connecting a wallet tells the site your address while the page is open."],
  ["What the server keeps", "Practice forecasts you sign (with your wallet address) for 30 days; API keys only as a SHA-256 hash mapped to your wallet for 30 days; per-network and per-wallet request counters for rate limits, which expire on their own."],
  ["What stays in your browser", "Alerts, starred tokens, follow settings, display preferences and a portfolio address you typed. They never leave the browser except the portfolio address, which is sent to the site's own read API to look up balances."],
  ["On chain", "Anything sent to a contract on Robinhood Chain is public and permanent by the nature of the chain."],
  ["Third parties", "The server reads public data from Robinhood Chain RPC endpoints, Nasdaq and OKX. Your address is not sent to them, except as part of an on-chain read your wallet asks for."],
];

export default function Privacy() {
  return (
    <>
      <PageHead title="Privacy" lede="What is stored, where, and for how long." />
      <div className="ctn max-w-[860px] py-12">
        <dl className="space-y-6">
          {ITEMS.map(([k, v]) => (
            <div key={k}>
              <dt className="h-item">{k}</dt>
              <dd className="mt-1.5 text-[15.5px] leading-relaxed text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
