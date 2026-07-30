// Deterministic disc colour for a team crest, derived from its code.
// Lightness is held near 52% so the near-white label always meets contrast.
export function teamColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return `oklch(52% 0.15 ${h})`;
}
