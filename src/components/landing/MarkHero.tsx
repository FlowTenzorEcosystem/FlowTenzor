import { MARK_PATH, MARK_VIEWBOX } from "@/components/Mark";

/*
 * The FlowTenzor mark rendered as a brushed-metal object: the two planes take
 * a silver gradient with a dark bevel underneath, and the whole mark sways
 * slowly in 3D (CSS only).
 */
export function MarkHero({ size = 64, box = 112, className = "" }: { size?: number; box?: number; className?: string }) {
  const id = `mh${size}`;
  return (
    <div className={`mx-auto grid place-items-center [perspective:600px] ${className}`} style={{ width: box, height: box }} aria-hidden="true">
      <svg width={size} height={size} viewBox={MARK_VIEWBOX} className="mark-sway drop-shadow-[0_8px_24px_rgba(255,255,255,0.12)]">
        <defs>
          <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.38" stopColor="#bcbcbc" />
            <stop offset="0.55" stopColor="#f2f2f2" />
            <stop offset="1" stopColor="#6e6e6e" />
          </linearGradient>
        </defs>
        <path d={MARK_PATH} fill="#2a2a2a" transform="translate(9 18)" />
        <path d={MARK_PATH} fill={`url(#${id}-s)`} />
      </svg>
    </div>
  );
}
