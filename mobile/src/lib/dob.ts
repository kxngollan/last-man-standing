/**
 * Mirrors lib/age.ts on the server, which is the copy that decides. These are
 * here so a form can say no before a round trip, not so it can say yes.
 */
export const MIN_AGE = 13;
export const PARENTAL_CONSENT_AGE = 16;

/**
 * Date of birth, typed rather than picked.
 *
 * A native date picker would mean another native dependency and a different
 * control on every platform; a plain numeric field works everywhere and is
 * faster for a date thirty years back, which no spinner is good at. We accept
 * what people actually type — slashes, dots, dashes, or nothing — and turn it
 * into the ISO string the API wants.
 *
 * Shared by /sign-up and /social-consent: both ask the same question, and the
 * age gate has to answer it the same way in both places.
 */
export function parseDob(raw: string): { iso: string; age: number } | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects the 31st of a 30-day month, and the 29th of a non-leap February —
  // JS would silently roll those forward into the next month.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day);
  if (beforeBirthday) age--;

  return { iso: date.toISOString().slice(0, 10), age };
}

/** Whether the entered age falls in the band that needs a guardian's tick. */
export function needsGuardian(age: number | null): boolean {
  return age !== null && age >= MIN_AGE && age < PARENTAL_CONSENT_AGE;
}
