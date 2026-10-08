import Link from "next/link";
import { BRAND } from "@/config/brand";
import { DocsHeader, DocsNav } from "@/components/docs/DocsChrome";
import { XGlyph } from "@/components/SiteHeader";

/** Docs: a floating header, the section list on the left, the page and its outline, and a one-line footer. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocsHeader />
      <div className="mx-auto flex max-w-[1440px] gap-10 px-4 pt-[100px] lg:px-7">
        <aside className="sticky top-[100px] hidden h-[calc(100dvh-120px)] w-[232px] shrink-0 overflow-y-auto pb-10 lg:block" aria-label="Docs sections">
          <DocsNav />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-8 text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between lg:px-7">
          <p>© 2026 {BRAND.name}. The docs describe a product in practice mode. Forecasts are not investment advice.</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-ink">
              {BRAND.domain}
            </Link>
            <Link href="/ask" className="hover:text-ink">
              App
            </Link>
            <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`} className="hover:text-ink">
              <XGlyph size={15} />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
