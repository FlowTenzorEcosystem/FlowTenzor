import { BRAND, CHAIN } from "@/config/brand";
import { JsonLd } from "@/components/JsonLd";
import { SwapScreen } from "@/components/swap/SwapScreen";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/swap",
  title: `Swap ETH for ${BRAND.symbol} on ${CHAIN.name} | ${BRAND.name}`,
  description: `Swap ETH for ${BRAND.symbol} on ${CHAIN.name} from your own wallet: live quotes through Pons, the bonding curve until graduation, then the Uniswap v4 pool.`,
  noindex: true,
});

export default function SwapPage() {
  return (
    <div className="acct">
      <JsonLd data={breadcrumbLd([{ name: `Swap ${BRAND.symbol}`, path: "/swap" }])} />
      <SwapScreen />
    </div>
  );
}
