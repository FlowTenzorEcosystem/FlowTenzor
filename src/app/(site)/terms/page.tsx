import { BRAND, CHAIN } from "@/config/brand";
import { PageHead } from "@/components/kit";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/terms", title: `Terms | ${BRAND.name}`, description: `Terms of use for ${BRAND.name}: forecasts are information, not advice; practice mode moves no funds; on-chain actions are yours.` });

const ITEMS: [string, string][] = [
  ["Information, not advice", `Everything on ${BRAND.name} (forecasts, scores, rankings, signals, paper results, answers in the research console) is information produced by models and rules. It is not investment, legal or tax advice, and a past score does not promise anything about a future forecast.`],
  ["Practice mode", "Practice forecasts are free wallet signatures. No transaction is sent and no funds move. Practice records are kept for 30 days and may be removed earlier."],
  ["On-chain actions", `When contracts are deployed, transactions you send through the site go from your own wallet to contracts on ${CHAIN.name}. They are public, final and paid for by you in gas. You are responsible for checking what you sign.`],
  ["Third-party data", "Listing prices, headlines and calendars come from third-party sources and can be late, wrong or missing. Chainlink feeds decide scores; the site shows when a source could not be read."],
  ["Paper follow", "Paper follow replays past forecasts under your limits. It ignores fees, slippage and funding, and it is not a promise of any result."],
  ["The token", `${BRAND.symbol} is a token on ${CHAIN.name}. Nothing here is an offer of securities. Its only on-chain use is the model bond described in the docs.`],
  ["Availability", "The site and its data sources can be interrupted. Nothing on the site holds your funds, so an outage cannot lock them."],
];

export default function Terms() {
  return (
    <>
      <PageHead title="Terms" lede="Short and plain. Using the site means accepting these." />
      <div className="ctn max-w-[860px] py-12">
        <ol className="space-y-6">
          {ITEMS.map(([k, v], i) => (
            <li key={k} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3">
              <span className="num text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="h-item">{k}</h2>
                <p className="mt-1.5 text-[15.5px] leading-relaxed text-ink-2">{v}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
