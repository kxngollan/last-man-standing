export function ageFromDob(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** Nobody younger than this may hold an account at all. */
export const MIN_AGE = 13;

/**
 * Below this, playing needs a parent or guardian's say-so.
 *
 * The game is free and has no stakes, so 13 is the floor rather than 16 — but
 * 13, 14 and 15 year olds are still children in the eyes of UK GDPR's
 * Article 8 and of both stores, so they confirm someone has said yes before
 * they can sign up. It is a declaration, not verified consent; see the note on
 * `parentalConsent` in models/User/User.ts.
 */
export const PARENTAL_CONSENT_AGE = 16;

export function isOldEnough(dob: Date, now: Date = new Date()): boolean {
  return ageFromDob(dob, now) >= MIN_AGE;
}

/**
 * Whether this date of birth needs the parental-permission box ticked.
 *
 * Anyone below MIN_AGE is refused outright by isOldEnough(), so callers check
 * that first and this only ever decides the 13–15 band.
 */
export function needsParentalConsent(dob: Date, now: Date = new Date()): boolean {
  return ageFromDob(dob, now) < PARENTAL_CONSENT_AGE;
}
