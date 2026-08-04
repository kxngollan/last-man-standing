/* Hallmark · component: decorative football art set · genre: playful · theme: Hum
 * enrichment: E5 hand-built SVG (tier B) — pitch plan, ball, goal, corner flag, whistle
 * All pieces are decorative (aria-hidden), stroke-led, and token-driven:
 *   --art-line   line colour   (defaults to currentColor)
 *   --art-accent accent fills  (defaults to --color-accent)
 * No animation — the art is still on purpose; page motion budgets stay untouched.
 */

type ArtProps = { className?: string };

/** Classic panelled football — centre pentagon in the accent colour. */
export function BallArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="var(--art-fill, transparent)"
        stroke="var(--art-line, currentColor)"
        strokeWidth="2.5"
      />
      <path
        d="M32 20 40.6 26.2 37.3 36.3 26.7 36.3 23.4 26.2 Z"
        fill="var(--art-accent, var(--color-accent))"
      />
      <g stroke="var(--art-line, currentColor)" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M32 20 32 11" />
        <path d="M40.6 26.2 49.1 23.4" />
        <path d="M37.3 36.3 42.6 43.6" />
        <path d="M26.7 36.3 21.4 43.6" />
        <path d="M23.4 26.2 14.9 23.4" />
        <path d="M21.4 43.6 26.5 49.5 37.5 49.5 42.6 43.6" />
        <path d="M14.9 23.4 18 15.2" />
        <path d="M49.1 23.4 46 15.2" />
      </g>
    </svg>
  );
}

/** Top-down half-pitch plan — boundary, centre circle, boxes, penalty arc, corner arcs. */
export function PitchPlanArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 360 240" className={className} aria-hidden="true" focusable="false">
      <g stroke="var(--art-line, currentColor)" strokeWidth="2" fill="none" strokeLinecap="round">
        <rect x="12" y="12" width="336" height="216" />
        {/* centre circle bisected by the halfway line (top edge) */}
        <path d="M138 12 A42 42 0 0 0 222 12" />
        {/* penalty area + six-yard box */}
        <rect x="96" y="156" width="168" height="72" />
        <rect x="132" y="192" width="96" height="36" />
        {/* penalty arc */}
        <path d="M164.5 156 A32 32 0 0 1 195.5 156" />
        {/* corner arcs */}
        <path d="M12 22 A10 10 0 0 0 22 12" />
        <path d="M338 12 A10 10 0 0 0 348 22" />
        <path d="M22 228 A10 10 0 0 0 12 218" />
        <path d="M348 218 A10 10 0 0 0 338 228" />
      </g>
      {/* spots — the one chromatic touch */}
      <circle cx="180" cy="184" r="3" fill="var(--art-accent, var(--color-accent))" />
      <circle cx="180" cy="16" r="3" fill="var(--art-accent, var(--color-accent))" />
    </svg>
  );
}

/** Goalmouth with a ball tucked in the corner — for CTA moments. */
export function GoalArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true" focusable="false">
      {/* ground */}
      <path
        d="M6 128 H234"
        stroke="var(--art-line, currentColor)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* net (back panel + weave) */}
      <g stroke="var(--art-line, currentColor)" strokeWidth="1.1" fill="none" opacity="0.32">
        <path d="M36 36 52 54 M204 36 188 54 M52 54 H188 M52 54 V118 M188 54 V118 M52 118 H188" />
        <path d="M66 54 V118 M80 54 V118 M94 54 V118 M108 54 V118 M122 54 V118 M136 54 V118 M150 54 V118 M164 54 V118 M178 54 V118" />
        <path d="M52 68 H188 M52 82 H188 M52 96 H188 M52 110 H188" />
      </g>
      {/* posts + crossbar */}
      <g stroke="var(--art-line, currentColor)" strokeWidth="4" strokeLinecap="square" fill="none">
        <path d="M36 128 V36 M204 128 V36 M34 36 H206" />
      </g>
      {/* ball resting in the corner */}
      <circle
        cx="172"
        cy="115"
        r="13"
        fill="var(--art-fill, transparent)"
        stroke="var(--art-line, currentColor)"
        strokeWidth="2"
      />
      <path
        d="M172 109.5 176 112.4 174.5 117 169.5 117 168 112.4 Z"
        fill="var(--art-accent, var(--color-accent))"
      />
    </svg>
  );
}

/** Corner flag with quadrant arc — a hand-drawn lean for playfulness. */
export function CornerFlagArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 84 104" className={className} aria-hidden="true" focusable="false">
      <path
        d="M30 12 Q52 11 70 20 Q50 25 32 30 Z"
        fill="var(--art-accent, var(--color-accent))"
      />
      <g stroke="var(--art-line, currentColor)" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M26 96 30 12" />
        {/* corner quadrant */}
        <path d="M6 78 Q26 84 34 100" />
        {/* grass ticks */}
        <path d="M46 96 50 89 M58 98 63 92" />
      </g>
    </svg>
  );
}

/** Referee's whistle mid-toot — kickoff energy for the fixtures list. */
export function WhistleArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 96 72" className={className} aria-hidden="true" focusable="false">
      <rect
        x="34"
        y="16"
        width="50"
        height="17"
        rx="7"
        fill="var(--art-fill, transparent)"
        stroke="var(--art-line, currentColor)"
        strokeWidth="2.4"
      />
      <circle
        cx="30"
        cy="45"
        r="19"
        fill="var(--art-fill, transparent)"
        stroke="var(--art-line, currentColor)"
        strokeWidth="2.4"
      />
      {/* pea */}
      <circle cx="33" cy="43" r="5" fill="var(--art-accent, var(--color-accent))" />
      {/* toot lines */}
      <g
        stroke="var(--art-accent, var(--color-accent))"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M88 10 94 5" />
        <path d="M90 24 96 24" />
      </g>
    </svg>
  );
}
