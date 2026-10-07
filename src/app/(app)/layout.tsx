import { AppHeader, AppRail, AppTicker } from "@/components/app/AppShell";
import { SiteFooter } from "@/components/SiteFooter";
import { AlertWatcher } from "@/components/app/Alerts";

/**
 * App screens: a top bar with search and wallet, group tabs underneath, the
 * page in a wide column with a status rail on the right (below on smaller
 * screens), and the live price strip at the foot of the page.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <div className="mx-auto grid max-w-[1560px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <main id="main" className="min-w-0">
          {children}
        </main>
        <aside className="min-w-0 xl:sticky xl:top-[124px] xl:self-start" aria-label="Status">
          <AppRail />
        </aside>
      </div>
      <AppTicker />
      <AlertWatcher />
      <SiteFooter />
    </>
  );
}
