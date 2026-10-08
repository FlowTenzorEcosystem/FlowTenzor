import { BRAND } from "@/config/brand";
import { SettingsView } from "@/components/app/SettingsView";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/settings", title: `Settings | ${BRAND.name}`, description: `How ${BRAND.name} pages look for you, kept in your own browser.`, noindex: true });

export default function SettingsPage() {
  return (
    <>
      <div className="mx-auto max-w-[660px] pt-2">
        <SettingsView />
      </div>
    </>
  );
}
