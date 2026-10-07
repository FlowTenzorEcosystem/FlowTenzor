import { BRAND } from "@/config/brand";

/*
 * The FlowTenzor mark: three streamlines that converge and rise into one
 * point. Drawn inline so it takes the text colour of its ground; the files in
 * public/brand and the icons come from referensi/tools/make-brand.mjs.
 */
export function Mark({ size = 28, className = "", accent = "#f2b33d" }: { size?: number; className?: string; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth="5.6" strokeLinecap="round">
        <path d="M8 21 C 24 21, 37 19, 50 13" />
        <path d="M8 33 C 26 33, 38 27, 50 13" />
        <path d="M8 45 C 28 45, 41 35, 50 13" />
      </g>
      <circle cx="51" cy="12.5" r="6.4" fill={accent} />
    </svg>
  );
}

/** Mark plus name in the display face. Inherits the text colour. */
export function Wordmark({ className = "", size = 22 }: { className?: string; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-[0.35em] ${className}`} style={{ fontSize: size }}>
      <Mark size={Math.round(size * 1.35)} />
      <span className="font-display leading-none font-bold tracking-[-0.03em]">{BRAND.name}</span>
    </span>
  );
}

/** The mark on its teal plate, used as an avatar. */
export function MarkBadge({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-[22%] bg-flow text-paper ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <Mark size={Math.round(size * 0.78)} />
    </span>
  );
}
