/**
 * How player names appear to other players: first name plus last-name
 * initial ("Sam K."), never the full surname.
 *
 * Accounts created before the first/last split only have `name` — for those
 * the first and last words stand in for firstName/lastName.
 */

type Nameish = { firstName?: string | null; lastName?: string | null; name?: string | null };

/** Best-effort { first, last } from either the split fields or legacy `name`. */
export function nameParts(u: Nameish): { first: string; last: string } {
  if (u.firstName) return { first: u.firstName.trim(), last: (u.lastName ?? "").trim() };
  const words = (u.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { first: "", last: "" };
  return { first: words[0], last: words.length > 1 ? words[words.length - 1] : "" };
}

/** Public display name: "First L." (falls back to "First", then "Player"). */
export function publicName(u: Nameish): string {
  const { first, last } = nameParts(u);
  if (!first) return "Player";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/** Full name from the split fields, falling back to legacy `name`. */
export function fullName(u: Nameish): string {
  if (u.firstName) return [u.firstName.trim(), (u.lastName ?? "").trim()].filter(Boolean).join(" ");
  return (u.name ?? "").trim();
}
