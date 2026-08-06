/**
 * Is this address on the ADMIN_EMAILS allowlist? Admin is granted when the
 * address is VERIFIED (email confirmation or password-reset, both of which
 * prove inbox ownership) — never at signup, so nobody can squat an admin
 * email they don't control.
 */
export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
