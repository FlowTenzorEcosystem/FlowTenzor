import { BRAND } from "@/config/brand";
import { SettingsView } from "@/components/app/SettingsView";
import { AppHead } from "@/components/app/ui";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/settings", title: `Settings | ${BRAND.name}`, description: `How ${BRAND.name} pages look for you, kept in your own browser.`, noindex: true });

export default function SettingsPage() {
  return (
    <>
      <AppHead title="Settings" desc="Choices about how pages look. They live in this browser and never reach the server." />
      <div className="mt-6 max-w-[860px]">
        <SettingsView />
      </div>
    </>
  );
}
