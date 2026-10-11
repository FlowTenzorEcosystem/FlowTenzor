import { BRAND } from "@/config/brand";

/*
 * The FlowTenzor mark: two stacked folded planes forming an F, traced from the
 * owner's logo. Drawn inline so it takes the text colour of its ground; the
 * files in public/brand and the icons come from referensi/tools/make-brand.mjs.
 */
export const MARK_PATH = "M0 80 198 0 376 83V190L125 73V216L0 158ZM0 283 198 204 334 267.5V374L125 276V479L0 421Z";
/** Square frame around the 376 x 480 artwork, so a size prop reads like the old square mark. */
export const MARK_VIEWBOX = "-112 -60 600 600";

export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX} aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** Mark plus name: Inter medium with tight tracking. Inherits the text colour. */
export function Wordmark({ className = "", size = 15 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-[0.5em] ${className}`} style={{ fontSize: size }}>
      <Mark size={Math.round(size * 1.2)} />
      <span className="leading-[1.45] font-medium tracking-[-0.03em]">{BRAND.name}</span>
    </span>
  );
}

/** The mark on its plate, used as an avatar. */
export function MarkBadge({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-[22%] bg-flow text-paper ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <Mark size={Math.round(size * 0.78)} />
    </span>
  );
}
