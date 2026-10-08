import { AppFrame } from "@/components/app/AppShell";
import { AlertWatcher } from "@/components/app/Alerts";

/**
 * App screens: a left sidebar with the page groups and the token card, a top
 * bar with search and wallet, the live price strip, the page in a scrolling
 * column, and a status bar along the bottom (a tab bar on phones).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppFrame>
      <div className="px-4 pt-4 pb-10 max-sm:px-3">{children}</div>
      <AlertWatcher />
    </AppFrame>
  );
}
