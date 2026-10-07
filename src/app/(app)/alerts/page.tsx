import { BRAND } from "@/config/brand";
import { AlertsView } from "@/components/app/Alerts";
import { AppHead } from "@/components/app/ui";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/alerts",
  title: `Alerts and watchlist | ${BRAND.name}`,
  description: `Price alerts for stock tokens and TAO, checked while ${BRAND.name} is open and stored only in your browser.`,
  noindex: true,
});

export default function AlertsPage() {
  return (
    <>
      <AppHead
        title="Alerts and watchlist"
        desc="Get told when a stock-token feed or TAO crosses a price you pick. Alerts are re-checked on each price refresh while any tab of the site stays open, and they are saved nowhere but this browser. Push and messaging alerts, and alerts on forecasts, are not built yet."
      />
      <div className="mt-6">
        <AlertsView />
      </div>
    </>
  );
}
