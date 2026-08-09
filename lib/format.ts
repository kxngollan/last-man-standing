// Date/label formatting shared by the portal pages. Everything formats in
// Europe/London: fixtures are UK kickoffs for a UK audience, and a fixed zone
// keeps server-rendered output deterministic (no hydration mismatches).

const LOCALE = "en-GB";
const ZONE = { timeZone: "Europe/London" } as const;

/** "2025/26" from a season's starting year. */
export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, "0")}`;
}

/** "15:00" */
export function kickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { ...ZONE, hour: "2-digit", minute: "2-digit" });
}

/** "Sat 14 Feb" */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    ...ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Saturday 14 February" */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    ...ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "Sep 2025" — coarse enough for "member since". */
export function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { ...ZONE, month: "short", year: "numeric" });
}

/** "Sat 14 Feb, 15:00" — deadlines and other date+time moments. */
export function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    ...ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
