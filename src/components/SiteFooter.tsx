import Link from "next/link";
import { BRAND, CHAIN, hasGithub } from "@/config/brand";
import { oracleLive } from "@/config/contracts";
import { MarkHero } from "@/components/landing/MarkHero";
import { Mark, Wordmark } from "@/components/Mark";
import { DocsGlyph, XGlyph } from "@/components/SiteHeader";
import { FOOTER, LEGAL } from "@/components/site";

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}

const social = "grid size-9 place-items-center rounded-full border border-line text-ink transition-colors hover:border-line-2 hover:bg-paper-2";

/** Closing call to action, the oversized wordmark and the link card. Shared by every marketing page. */
export function SiteFooter({ cta = true }: { cta?: boolean }) {
  return (
    <footer className="bg-black px-3 pb-3 sm:px-5 sm:pb-5">
      {cta ? (
        <div className="px-4 pt-[100px] pb-[60px] text-center sm:pt-[130px] sm:pb-[90px]">
          <MarkHero size={123} box={220} />
          <p className="kicker mt-6">Start here</p>
          <h2 className="mx-auto mt-6 max-w-[560px] font-display text-[clamp(52px,6vw,86px)] leading-none tracking-[-0.045em] text-ink">
            Forecasts flow. Records stay.
          </h2>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link href="/forecasts" className="btn btn-ghost btn-mono bg-card">
              See the forecasts
            </Link>
            <Link href="/ask" className="btn btn-accent btn-mono !py-3">
              Open the app <Mark size={20} />
            </Link>
          </div>
        </div>
      ) : null}
      <p
        aria-hidden="true"
        className="pointer-events-none overflow-hidden bg-gradient-to-b from-[#1f1f1f] to-transparent bg-clip-text text-center font-display text-[17vw] leading-[0.8] tracking-[-0.045em] whitespace-nowrap text-transparent select-none min-[1440px]:text-[244px]"
      >
        {BRAND.name}
      </p>
      <div className="rounded-[14px] border border-line bg-card px-5 pt-6 pb-8 sm:px-9 sm:pb-9">
        <div className="flex flex-col justify-between gap-10 lg:flex-row">
          <div className="min-w-0">
            <Link href="/" aria-label={`${BRAND.name} home`} className="text-ink">
              <Wordmark size={32} />
            </Link>
            <div className="mt-6 flex gap-2">
              <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`} className={social}>
                <XGlyph size={15} />
              </a>
              <Link href="/docs" aria-label="Documentation" className={social}>
                <DocsGlyph size={15} />
              </Link>
              {hasGithub ? (
                <a href={BRAND.github} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on GitHub`} className={social}>
                  <GithubIcon />
                </a>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-[100px] gap-y-8 sm:grid-cols-3">
            {FOOTER.map((group) => (
              <div key={group.label} className="min-w-0">
                <h2 className="kicker !text-faint">{group.label}</h2>
                <ul className="mt-5 space-y-1.5 text-[13px]">
                  {group.items.map((item) => {
                    const inner = (
                      <>
                        {item.label}
                        {item.note ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] leading-[15px] text-[#0a0a0a] uppercase">{item.note}</span>
                        ) : null}
                      </>
                    );
                    const cls = "flex items-center gap-1.5 whitespace-nowrap text-ink-3 transition-colors hover:text-ink";
                    return (
                      <li key={item.href}>
                        {item.href.startsWith("http") ? (
                          <a href={item.href} target="_blank" rel="noreferrer" className={cls}>
                            {inner}
                          </a>
                        ) : (
                          <Link href={item.href} className={cls}>
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-16 max-w-[720px] text-[12px] leading-relaxed text-faint lg:mt-32">
          {BRAND.symbol} is a token on {CHAIN.name} (chain id {CHAIN.id}). A forecast is a model&apos;s view, not advice to trade, and a past score
          promises nothing about the next one.{" "}
          {oracleLive()
            ? "Forecasts committed through the site are recorded and scored by the ForecastOracle contract."
            : "Forecasting runs in practice mode until the ForecastOracle contract is deployed."}
        </p>
        <div className="mt-4 flex flex-col gap-3 text-[13px] text-faint sm:flex-row sm:justify-between">
          <p>© 2026 {BRAND.name}. All rights reserved.</p>
          <div className="flex gap-6">
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
