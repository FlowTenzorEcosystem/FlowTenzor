import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { DeployPanel } from "@/components/onchain/DeployPanel";

export const metadata: Metadata = {
  title: { absolute: `Deploy contracts | ${BRAND.name}` },
  description: `Deploy the ${BRAND.name} contracts from your own wallet.`,
  robots: { index: false, follow: false },
};

export default function DeployPage() {
  return (
    <div className="ctn py-12">
      <DeployPanel />
    </div>
  );
}
