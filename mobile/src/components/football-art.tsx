import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { useTheme } from "@/theme";

/**
 * The website's football art, on the phone.
 *
 * Ported piece-for-piece from components/ui/FootballArt.tsx — same viewBoxes,
 * same path data, same shapes. Only the plumbing changes: the web version
 * paints from CSS custom properties (`var(--color-accent)`), which React
 * Native has no notion of, so the colours are read from the shared theme and
 * passed as props. The drawings themselves are untouched, which is the point —
 * a player who knows the site should recognise these instantly.
 *
 * Hand-built vector, no bitmaps: they stay crisp at any density and cost a few
 * hundred bytes rather than a download.
 */

export function BuntingArt({ width, height = 40 }: { width: number; height?: number }) {
  const { colors } = useTheme();

  // Pennants sag with the string — the y values ride the curve rather than
  // sitting on a straight line, which is what stops it reading as a chart.
  const flags = [
    { x: 48, y: 16, fill: colors.accent },
    { x: 112, y: 19.9, fill: colors.wild },
    { x: 176, y: 22.2, fill: colors.safe },
    { x: 240, y: 23, fill: colors.accent },
    { x: 304, y: 22.2, fill: colors.wild },
    { x: 368, y: 19.9, fill: colors.safe },
    { x: 432, y: 16, fill: colors.accent },
  ];

  return (
    <Svg width={width} height={height} viewBox="0 0 480 70">
      <Path d="M0 12 Q240 34 480 12" stroke={colors.rule2} strokeWidth={2} fill="none" />
      {flags.map((f) => (
        <Path
          key={f.x}
          d={`M${f.x - 13} ${f.y} ${f.x + 13} ${f.y} ${f.x} ${f.y + 26} Z`}
          fill={f.fill}
        />
      ))}
    </Svg>
  );
}

/** Floodlit pitch plan — line art, strokes only. */
export function FloodlitPitchArt({ width, height }: { width: number; height?: number }) {
  const { colors } = useTheme();
  const line = colors.rule2;

  return (
    <Svg width={width} height={height ?? width * 0.76} viewBox="0 0 420 320">
      {/* light beams falling from the masts */}
      <Path d="M50 26 78 26 150 180 90 180 Z" fill={colors.wild} opacity={0.14} />
      <Path d="M342 26 370 26 330 180 270 180 Z" fill={colors.wild} opacity={0.14} />

      <G stroke={line} strokeWidth={2} fill="none" strokeLinecap="round">
        {/* masts + heads */}
        <Path d="M60 80 V26 M360 80 V26" />
        <Rect x={44} y={10} width={32} height={16} rx={3} />
        <Rect x={344} y={10} width={32} height={16} rx={3} />
        {/* pitch plan */}
        <Rect x={40} y={80} width={340} height={220} />
        <Path d="M168 80 A42 42 0 0 0 252 80" />
        <Rect x={125} y={228} width={170} height={72} />
        <Rect x={161} y={264} width={98} height={36} />
        <Path d="M194 228 A32 32 0 0 1 226 228" />
        <Path d="M40 90 A10 10 0 0 0 50 80 M370 80 A10 10 0 0 0 380 90 M50 300 A10 10 0 0 0 40 290 M380 290 A10 10 0 0 0 370 300" />
      </G>

      <G fill={line}>
        {[52, 60, 68, 352, 360, 368].map((cx) => (
          <Circle key={`a${cx}`} cx={cx} cy={15} r={1.8} />
        ))}
        {[52, 60, 68, 352, 360, 368].map((cx) => (
          <Circle key={`b${cx}`} cx={cx} cy={21} r={1.8} />
        ))}
        <Circle cx={210} cy={256} r={3} />
        <Circle cx={210} cy={84} r={3} />
      </G>
    </Svg>
  );
}

/** Ball flying into the top corner, with confetti above the bar. */
export function NightMatchArt({ width, height }: { width: number; height?: number }) {
  const { colors } = useTheme();
  const line = colors.rule2;

  return (
    <Svg width={width} height={height ?? width * 0.69} viewBox="0 0 360 250">
      {/* confetti above the bar */}
      <Circle cx={130} cy={52} r={4} fill={colors.safe} />
      <Circle cx={168} cy={42} r={4.5} fill={colors.wild} />
      <Rect x={200} y={48} width={9} height={9} fill={colors.accent} transform="rotate(24 204 52)" />
      <Circle cx={242} cy={56} r={3.5} fill={colors.safe} />

      {/* net — back panel and weave */}
      <G stroke={line} strokeWidth={1.2} fill="none" opacity={0.55}>
        <Path d="M70 90 88 108 M290 90 272 108 M88 108 H272 M88 108 V186 M272 108 V186 M88 186 H272" />
        <Path d="M104 108 V186 M120 108 V186 M136 108 V186 M152 108 V186 M168 108 V186 M184 108 V186 M200 108 V186 M216 108 V186 M232 108 V186 M248 108 V186" />
        <Path d="M88 124 H272 M88 140 H272 M88 156 H272 M88 172 H272" />
      </G>

      {/* frame */}
      <G stroke={colors.ink} strokeWidth={4.5} strokeLinecap="square" fill="none">
        <Path d="M70 200 V90 M290 200 V90 M68 90 H292" />
      </G>

      {/* ground + grass */}
      <Path d="M18 200 H342" stroke={line} strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
      <G stroke={colors.safe} strokeWidth={2.2} strokeLinecap="round">
        <Path d="M40 200 44 191 M96 200 100 191 M310 200 314 191 M256 200 260 191" />
      </G>

      {/* motion trail — coming in off the right wing */}
      <G stroke={colors.accent} strokeWidth={2.6} strokeLinecap="round" fill="none">
        <Path d="M348 156 Q322 144 298 134" />
        <Path d="M342 178 Q316 166 292 156" />
      </G>

      {/* the ball */}
      <Circle cx={252} cy={122} r={18} fill={colors.paper} stroke={colors.ink} strokeWidth={2} />
      <Path d="M252 114 257.6 118.2 255.4 124.7 248.6 124.7 246.4 118.2 Z" fill={colors.accent} />
      <G stroke={colors.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.85}>
        <Path d="M252 114 252 108.5 M257.6 118.2 263 116.4 M255.4 124.7 258.6 129 M248.6 124.7 245.4 129 M246.4 118.2 241 116.4" />
      </G>
    </Svg>
  );
}
