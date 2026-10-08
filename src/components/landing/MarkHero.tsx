/*
 * The FlowTenzor mark rendered as a brushed-metal object: the three
 * streamlines take a silver gradient with a dark bevel underneath, the amber
 * point keeps its colour, and the whole mark sways slowly in 3D (CSS only).
 */
export function MarkHero({ size = 64, box = 112, className = "" }: { size?: number; box?: number; className?: string }) {
  const id = `mh${size}`;
  return (
    <div className={`mx-auto grid place-items-center [perspective:600px] ${className}`} style={{ width: box, height: box }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 64 64" className="mark-sway drop-shadow-[0_8px_24px_rgba(255,255,255,0.12)]">
        <defs>
          <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.38" stopColor="#bcbcbc" />
            <stop offset="0.55" stopColor="#f2f2f2" />
            <stop offset="1" stopColor="#6e6e6e" />
          </linearGradient>
        </defs>
        <g fill="none" strokeLinecap="round" strokeWidth="6.4" stroke="#2a2a2a" transform="translate(0.8 1.6)">
          <path d="M8 21 C 24 21, 37 19, 50 13" />
          <path d="M8 33 C 26 33, 38 27, 50 13" />
          <path d="M8 45 C 28 45, 41 35, 50 13" />
        </g>
        <g fill="none" strokeLinecap="round" strokeWidth="5.6" stroke={`url(#${id}-s)`}>
          <path d="M8 21 C 24 21, 37 19, 50 13" />
          <path d="M8 33 C 26 33, 38 27, 50 13" />
          <path d="M8 45 C 28 45, 41 35, 50 13" />
        </g>
        <circle cx="51" cy="12.5" r="6.4" fill="#f5b84a" />
        <circle cx="49.6" cy="11" r="2" fill="#ffe2a8" opacity="0.8" />
      </svg>
    </div>
  );
}
