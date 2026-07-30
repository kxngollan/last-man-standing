export function ageFromDob(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export const MIN_AGE = 16;

export function isOldEnough(dob: Date, now: Date = new Date()): boolean {
  return ageFromDob(dob, now) >= MIN_AGE;
}
