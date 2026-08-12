import { useColorScheme } from "react-native";
import { Colors, type ColorName } from "./colors";

/**
 * The web design system, as React Native sees it.
 *
 * Values come from tokens.css — colours generated into ./colors.ts, everything
 * else transcribed below at 1rem = 16px. Referenced by name only, never inlined
 * in a component, exactly as the web CSS requires: it's the one rule that keeps
 * the phone and the site looking like the same product.
 */

export { Colors, type ColorName };

/** Major-third scale (1.25), in points. */
export const Text = {
  xs: 12.8,
  sm: 14.4,
  base: 16,
  md: 18,
  lg: 22,
  xl: 28,
  xxl: 33.6,
} as const;

/** 4pt spacing. */
export const Space = {
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
  xxxl: 96,
} as const;

export const Radius = {
  sm: 8,
  input: 8,
  card: 12,
  pill: 999,
} as const;

/**
 * One shadow, never stacked — the same restraint the web tokens impose.
 * iOS reads the shadow* fields; Android only understands elevation.
 */
export const Shadow = {
  card: {
    shadowColor: "#261d15",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },
  lift: {
    shadowColor: "#261d15",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 6,
  },
} as const;

export const Duration = { instant: 100, short: 180, mid: 260 } as const;

/** Weights that match the web's display face usage. */
export const Weight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/** Both schemes carry the same token names; the values differ, so this is
 *  deliberately widened from the literal types `as const` would otherwise pin. */
export type Palette = Record<ColorName, string>;

/** The palette for the device's current appearance. */
export function useTheme(): { colors: Palette; scheme: "light" | "dark" } {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { colors: Colors[scheme], scheme };
}
