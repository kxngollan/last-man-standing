/* Hallmark · component: football illustration set · genre: playful · theme: Hum
 * enrichment: E5 hand-built SVG (tier B) — poster-grade scenes + spot illustrations
 * All pieces are decorative (aria-hidden) and token-driven — no raw colour values.
 * Line-art pieces expose two hooks:
 *   --art-line   line colour   (defaults to currentColor)
 *   --art-accent accent fills  (defaults to --color-accent)
 * No animation — the art is still on purpose; page motion budgets stay untouched.
 */

type ArtProps = { className?: string };

/* Point on a quadratic curve — used to seat crowd dots along the stand. */
function qPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

const CROWD_FRONT = Array.from({ length: 13 }, (_, i) =>
  qPoint(0.07 + i * 0.072, [100, 162], [260, 132], [420, 162]),
);
const CROWD_BACK = Array.from({ length: 11 }, (_, i) =>
  qPoint(0.12 + i * 0.076, [100, 180], [260, 150], [420, 180]),
);

/** Matchday stadium scene — stand, crowd, floodlights, pitch, big ball. Hero-scale. */
export function StadiumArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 520 420" className={className} aria-hidden="true" focusable="false">
      {/* backdrop disc — the ball breaks its frame bottom-right on purpose */}
      <circle cx="260" cy="205" r="195" fill="var(--color-paper-2)" />

      {/* confetti sky */}
      <circle cx="170" cy="64" r="4" fill="var(--color-accent)" />
      <circle cx="335" cy="54" r="3.5" fill="var(--color-safe)" />
      <rect x="221" y="80" width="8" height="8" fill="var(--color-wild)" transform="rotate(20 225 84)" />
      <circle cx="298" cy="74" r="3" fill="var(--color-accent)" />

      {/* floodlights */}
      <g>
        <path d="M119 58 V146 M401 58 V146" stroke="var(--color-ink)" strokeWidth="3" />
        {/* beams */}
        <path d="M108 58 134 58 214 250 142 250 Z" fill="var(--color-wild)" opacity="0.22" />
        <path d="M386 58 412 58 378 250 306 250 Z" fill="var(--color-wild)" opacity="0.22" />
        <rect x="104" y="40" width="30" height="18" rx="3" fill="var(--color-ink)" />
        <rect x="386" y="40" width="30" height="18" rx="3" fill="var(--color-ink)" />
        <g fill="var(--color-paper)">
          <circle cx="111" cy="46" r="2" /> <circle cx="119" cy="46" r="2" /> <circle cx="127" cy="46" r="2" />
          <circle cx="111" cy="52" r="2" /> <circle cx="119" cy="52" r="2" /> <circle cx="127" cy="52" r="2" />
          <circle cx="393" cy="46" r="2" /> <circle cx="401" cy="46" r="2" /> <circle cx="409" cy="46" r="2" />
          <circle cx="393" cy="52" r="2" /> <circle cx="401" cy="52" r="2" /> <circle cx="409" cy="52" r="2" />
        </g>
      </g>

      {/* pennants on the roofline */}
      <path d="M183 138 197 138 190 123 Z" fill="var(--color-accent)" />
      <path d="M253 135 267 135 260 120 Z" fill="var(--color-wild)" />
      <path d="M323 138 337 138 330 123 Z" fill="var(--color-safe)" />

      {/* grandstand + crowd */}
      <path d="M85 150 Q260 120 435 150 L435 198 Q260 168 85 198 Z" fill="var(--color-ink)" />
      <g fill="var(--color-paper)" opacity="0.85">
        {CROWD_FRONT.map(([x, y], i) => (
          <circle key={`f${i}`} cx={x} cy={y} r="2.6" />
        ))}
      </g>
      <g fill="var(--color-paper)" opacity="0.45">
        {CROWD_BACK.map(([x, y], i) => (
          <circle key={`b${i}`} cx={x} cy={y} r="2.2" />
        ))}
      </g>

      {/* pitch in perspective */}
      <path d="M130 198 390 198 455 330 65 330 Z" fill="var(--color-safe)" />
      {/* mow stripes */}
      <path d="M118 222 402 222 414 246 106 246 Z" fill="var(--color-on-disc)" opacity="0.12" />
      <path d="M96 268 424 268 436 292 84 292 Z" fill="var(--color-on-disc)" opacity="0.12" />
      {/* markings */}
      <g stroke="var(--color-on-disc)" strokeWidth="2.5" fill="none" opacity="0.9">
        <ellipse cx="260" cy="250" rx="44" ry="14" />
        <path d="M185 330 198 288 322 288 335 330" />
      </g>
      <circle cx="260" cy="250" r="3" fill="var(--color-on-disc)" opacity="0.9" />

      {/* ball — foreground, breaking the frame */}
      <ellipse cx="393" cy="360" rx="42" ry="7" fill="var(--color-ink)" opacity="0.12" />
      <circle
        cx="395"
        cy="306"
        r="46"
        fill="var(--color-on-disc)"
        stroke="var(--color-ink)"
        strokeWidth="3"
      />
      <path
        d="M395 288 407.4 297 402.7 311.5 387.3 311.5 382.6 297 Z"
        fill="var(--color-accent)"
      />
      <g stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M395 288 395 275" />
        <path d="M407.4 297 420.6 292.3" />
        <path d="M402.7 311.5 410.4 322" />
        <path d="M387.3 311.5 379.6 322" />
        <path d="M382.6 297 369.4 292.3" />
        <path d="M379.6 322 Q395 330 410.4 322" />
      </g>
    </svg>
  );
}

/** Top-corner screamer — goal, net, flying ball with trail, confetti. CTA-scale. */
export function GoalArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 260 170" className={className} aria-hidden="true" focusable="false">
      {/* grass strip */}
      <rect x="8" y="138" width="244" height="10" rx="5" fill="var(--color-safe)" opacity="0.55" />
      <g stroke="var(--color-safe-ink)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M28 138 31 131 M228 138 231 131 M130 138 133 131" />
      </g>

      {/* net */}
      <g stroke="var(--color-ink)" strokeWidth="1.1" fill="none" opacity="0.28">
        <path d="M44 40 60 56 M216 40 200 56 M60 56 H200 M60 56 V130 M200 56 V130 M60 130 H200" />
        <path d="M74 56 V130 M88 56 V130 M102 56 V130 M116 56 V130 M130 56 V130 M144 56 V130 M158 56 V130 M172 56 V130 M186 56 V130" />
        <path d="M60 70 H200 M60 85 H200 M60 100 H200 M60 115 H200" />
      </g>

      {/* frame */}
      <g stroke="var(--color-ink)" strokeWidth="4.5" strokeLinecap="square" fill="none">
        <path d="M44 140 V40 M216 140 V40 M42 40 H218" />
      </g>

      {/* confetti above the bar */}
      <circle cx="95" cy="18" r="3" fill="var(--color-safe)" />
      <circle cx="122" cy="12" r="3.5" fill="var(--color-wild)" />
      <rect x="146" y="18" width="7" height="7" fill="var(--color-accent)" transform="rotate(24 149 21)" />

      {/* motion trail */}
      <g stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" fill="none">
        <path d="M14 100 Q34 92 50 84" />
        <path d="M20 114 Q40 106 56 98" />
      </g>

      {/* ball into the top corner */}
      <circle
        cx="80"
        cy="68"
        r="15"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeWidth="2.2"
      />
      <path d="M80 61.5 84.6 65 82.9 70.4 77.1 70.4 75.4 65 Z" fill="var(--color-accent)" />
      <g stroke="var(--color-ink)" strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M80 61.5 80 57 M84.6 65 89 63.5 M82.9 70.4 85.5 74 M77.1 70.4 74.5 74 M75.4 65 71 63.5" />
      </g>
    </svg>
  );
}

/** Night-match goal scene for dark panels — paper-chalk strokes, colour pops on ink. */
export function NightMatchArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 360 250" className={className} aria-hidden="true" focusable="false">
      {/* confetti above the bar */}
      <circle cx="130" cy="52" r="4" fill="var(--color-safe)" />
      <circle cx="168" cy="42" r="4.5" fill="var(--color-wild)" />
      <rect x="200" y="48" width="9" height="9" fill="var(--color-accent)" transform="rotate(24 204 52)" />
      <circle cx="242" cy="56" r="3.5" fill="var(--color-safe)" />

      {/* net (back panel + weave) */}
      <g stroke="var(--color-paper)" strokeWidth="1.2" fill="none" opacity="0.3">
        <path d="M70 90 88 108 M290 90 272 108 M88 108 H272 M88 108 V186 M272 108 V186 M88 186 H272" />
        <path d="M104 108 V186 M120 108 V186 M136 108 V186 M152 108 V186 M168 108 V186 M184 108 V186 M200 108 V186 M216 108 V186 M232 108 V186 M248 108 V186" />
        <path d="M88 124 H272 M88 140 H272 M88 156 H272 M88 172 H272" />
      </g>

      {/* frame */}
      <g stroke="var(--color-paper)" strokeWidth="4.5" strokeLinecap="square" fill="none">
        <path d="M70 200 V90 M290 200 V90 M68 90 H292" />
      </g>

      {/* ground + grass blades */}
      <path
        d="M18 200 H342"
        stroke="var(--color-paper)"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <g stroke="var(--color-safe)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M40 200 44 191 M96 200 100 191 M310 200 314 191 M256 200 260 191" />
      </g>

      {/* motion trail — coming in from the right wing */}
      <g stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M348 156 Q322 144 298 134" />
        <path d="M342 178 Q316 166 292 156" />
      </g>

      {/* ball flying into the top corner */}
      <circle cx="252" cy="122" r="18" fill="var(--color-paper)" stroke="var(--color-paper)" strokeWidth="2" />
      <path d="M252 114 257.6 118.2 255.4 124.7 248.6 124.7 246.4 118.2 Z" fill="var(--color-accent)" />
      <g stroke="var(--color-ink)" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85">
        <path d="M252 114 252 108.5 M257.6 118.2 263 116.4 M255.4 124.7 258.6 129 M248.6 124.7 245.4 129 M246.4 118.2 241 116.4" />
      </g>
    </svg>
  );
}

/** Floodlit pitch plan — line art for dark panels; strokes follow currentColor. */
export function FloodlitPitchArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 420 320" className={className} aria-hidden="true" focusable="false">
      {/* beams */}
      <path d="M50 26 78 26 150 180 90 180 Z" fill="currentColor" opacity="0.07" />
      <path d="M342 26 370 26 330 180 270 180 Z" fill="currentColor" opacity="0.07" />
      <g stroke="var(--art-line, currentColor)" strokeWidth="2" fill="none" strokeLinecap="round">
        {/* masts + heads */}
        <path d="M60 80 V26 M360 80 V26" />
        <rect x="44" y="10" width="32" height="16" rx="3" />
        <rect x="344" y="10" width="32" height="16" rx="3" />
        {/* pitch plan */}
        <rect x="40" y="80" width="340" height="220" />
        <path d="M168 80 A42 42 0 0 0 252 80" />
        <rect x="125" y="228" width="170" height="72" />
        <rect x="161" y="264" width="98" height="36" />
        <path d="M194 228 A32 32 0 0 1 226 228" />
        <path d="M40 90 A10 10 0 0 0 50 80 M370 80 A10 10 0 0 0 380 90 M50 300 A10 10 0 0 0 40 290 M380 290 A10 10 0 0 0 370 300" />
      </g>
      <g fill="var(--art-line, currentColor)">
        <circle cx="52" cy="15" r="1.8" /> <circle cx="60" cy="15" r="1.8" /> <circle cx="68" cy="15" r="1.8" />
        <circle cx="52" cy="21" r="1.8" /> <circle cx="60" cy="21" r="1.8" /> <circle cx="68" cy="21" r="1.8" />
        <circle cx="352" cy="15" r="1.8" /> <circle cx="360" cy="15" r="1.8" /> <circle cx="368" cy="15" r="1.8" />
        <circle cx="352" cy="21" r="1.8" /> <circle cx="360" cy="21" r="1.8" /> <circle cx="368" cy="21" r="1.8" />
        <circle cx="210" cy="256" r="3" />
        <circle cx="210" cy="84" r="3" />
      </g>
    </svg>
  );
}

/** Pennant bunting on a sagging string — accent/wild/safe rotation. */
export function BuntingArt({ className }: ArtProps) {
  const flags: { x: number; y: number; fill: string }[] = [
    { x: 48, y: 16, fill: "var(--color-accent)" },
    { x: 112, y: 19.9, fill: "var(--color-wild)" },
    { x: 176, y: 22.2, fill: "var(--color-safe)" },
    { x: 240, y: 23, fill: "var(--color-accent)" },
    { x: 304, y: 22.2, fill: "var(--color-wild)" },
    { x: 368, y: 19.9, fill: "var(--color-safe)" },
    { x: 432, y: 16, fill: "var(--color-accent)" },
  ];
  return (
    <svg viewBox="0 0 480 70" className={className} aria-hidden="true" focusable="false">
      <path
        d="M0 12 Q240 34 480 12"
        stroke="var(--art-line, var(--color-ink))"
        strokeWidth="2"
        fill="none"
      />
      {flags.map((f) => (
        <path key={f.x} d={`M${f.x - 13} ${f.y} ${f.x + 13} ${f.y} ${f.x} ${f.y + 26} Z`} fill={f.fill} />
      ))}
    </svg>
  );
}

/* ---------- Spot illustrations (How-it-works steps) ---------- */

/** Striped kit jersey. */
export function JerseyArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <circle cx="48" cy="48" r="44" fill="var(--color-paper-2)" />
      <path
        d="M30 28 42 20 Q48 27 54 20 L66 28 74 40 63 46 63 74 33 74 33 46 22 40 Z"
        fill="var(--color-accent)"
        stroke="var(--color-ink)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="44" y="24" width="8" height="50" fill="var(--color-on-disc)" opacity="0.85" />
      <path d="M42 20 Q48 28 54 20" stroke="var(--color-ink)" strokeWidth="2.4" fill="none" />
    </svg>
  );
}

/** Shield with a check — matches the brand mark, in the safe green. */
export function ShieldCheckArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <circle cx="48" cy="48" r="44" fill="var(--color-paper-2)" />
      <path
        d="M48 18 24 27 v16 c0 13 10 22.6 24 27 14-4.4 24-14 24-27 V27 Z"
        fill="var(--color-safe-wash)"
        stroke="var(--color-safe-ink)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="m38 46 7.5 7.5L60 39"
        stroke="var(--color-safe-ink)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Repeat arrow, crossed out — each team only once. */
export function NoRepeatArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <circle cx="48" cy="48" r="44" fill="var(--color-paper-2)" />
      <path
        d="M66 40 A21 21 0 1 0 68.5 52"
        stroke="var(--color-ink)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M60 40 68 42 70 33 Z" fill="var(--color-ink)" />
      <path
        d="M30 70 66 26"
        stroke="var(--color-out)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The trophy — last one standing takes it. */
export function TrophyArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true" focusable="false">
      <circle cx="48" cy="48" r="44" fill="var(--color-paper-2)" />
      {/* confetti */}
      <circle cx="26" cy="28" r="3" fill="var(--color-accent)" />
      <circle cx="72" cy="24" r="2.6" fill="var(--color-safe)" />
      <rect x="64" y="38" width="6" height="6" fill="var(--color-accent)" transform="rotate(18 67 41)" />
      {/* handles */}
      <g stroke="var(--color-ink)" strokeWidth="2.6" fill="none">
        <path d="M34 30 Q20 32 26 44 Q29.5 50 36 48" />
        <path d="M62 30 Q76 32 70 44 Q66.5 50 60 48" />
      </g>
      {/* cup */}
      <path
        d="M34 24 H62 V42 Q62 58 48 60 Q34 58 34 42 Z"
        fill="var(--color-wild)"
        stroke="var(--color-ink)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M44 60 h8 v8 h-8 Z" fill="var(--color-wild)" stroke="var(--color-ink)" strokeWidth="2.4" />
      <rect x="34" y="68" width="28" height="7" rx="2" fill="var(--color-ink)" />
      {/* shine */}
      <path d="M40 30 Q39 38 42 44" stroke="var(--color-on-disc)" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.8" />
    </svg>
  );
}

/* ---------- Line-art ornaments (portal pages) ---------- */

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

/** Top-down half-pitch plan — boundary, centre circle, boxes, penalty arc. */
export function PitchPlanArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 360 240" className={className} aria-hidden="true" focusable="false">
      <g stroke="var(--art-line, currentColor)" strokeWidth="2" fill="none" strokeLinecap="round">
        <rect x="12" y="12" width="336" height="216" />
        <path d="M138 12 A42 42 0 0 0 222 12" />
        <rect x="96" y="156" width="168" height="72" />
        <rect x="132" y="192" width="96" height="36" />
        <path d="M164.5 156 A32 32 0 0 1 195.5 156" />
        <path d="M12 22 A10 10 0 0 0 22 12" />
        <path d="M338 12 A10 10 0 0 0 348 22" />
        <path d="M22 228 A10 10 0 0 0 12 218" />
        <path d="M348 218 A10 10 0 0 0 338 228" />
      </g>
      <circle cx="180" cy="184" r="3" fill="var(--art-accent, var(--color-accent))" />
      <circle cx="180" cy="16" r="3" fill="var(--art-accent, var(--color-accent))" />
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
        <path d="M6 78 Q26 84 34 100" />
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
      <circle cx="33" cy="43" r="5" fill="var(--art-accent, var(--color-accent))" />
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
