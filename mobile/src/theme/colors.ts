/**
 * The web app's palette, in a form React Native can read.
 *
 * Generated from tokens.css — the single source of truth for the design system
 * — because RN has no oklch parser. Regenerate rather than editing by hand:
 * the point is that the phone and the site can't drift apart.
 *
 * Every key is a --color-* token with the prefix dropped and camelCased.
 */

export const Colors = {
  light: {
    paper: "#f8f5ef",
    paper2: "#f1ece3",
    paper3: "#e7e0d5",
    rule: "#dbd7cf",
    rule2: "#c2bdb4",
    ink: "#261d15",
    ink2: "#3f362d",
    muted: "#6a625a",
    neutral: "#524c45",
    accent: "#e05c45",
    accentStrong: "#cf432c",
    accentInk: "#250f09",
    accentWash: "#ffddcf",
    safe: "#54b66e",
    safeInk: "#006129",
    safeWash: "#d1f2d7",
    out: "#d33a3c",
    outInk: "#a21a1b",
    outWash: "#ffdcd7",
    wild: "#f3b94c",
    wildInk: "#845000",
    wildWash: "#ffe8c2",
    focus: "#cb4832",
    onDisc: "#faf8f5",
    scrim: "#261d1580",
  },
  dark: {
    paper: "#1c1812",
    paper2: "#26211a",
    paper3: "#302a23",
    rule: "#3c3730",
    rule2: "#58514a",
    ink: "#ebe7df",
    ink2: "#cecac1",
    muted: "#a09b92",
    neutral: "#b5b0a8",
    accent: "#ea6d56",
    accentStrong: "#fa8469",
    accentInk: "#200a05",
    accentWash: "#4e2a22",
    safe: "#54b66e",
    safeInk: "#83d494",
    safeWash: "#1a3520",
    out: "#de4e4b",
    outInk: "#f98f84",
    outWash: "#47211e",
    wild: "#e9b452",
    wildInk: "#efbe72",
    wildWash: "#3c2e14",
    focus: "#fa8469",
    onDisc: "#faf8f5",
    scrim: "#050301a6",
  },
} as const;

export type ColorName = keyof typeof Colors.light;
