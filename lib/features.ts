// Feature flags. NODE_ENV is inlined by Next at build time on both the server
// and the client, so this constant is safe to read from either.

/**
 * Password reset (forgot-password) flow. Disabled in production for now —
 * re-enable by relaxing this check once the email sender is turned back on.
 */
export const PASSWORD_RESET_ENABLED = process.env.NODE_ENV !== "production";
