// Feature flags. NODE_ENV is inlined by Next at build time on both the server
// and the client, so this constant is safe to read from either.

/**
 * Password reset (forgot-password) flow. Enabled everywhere now that the
 * SMTP sender (nodemailer via Gmail) is configured.
 */
export const PASSWORD_RESET_ENABLED = true;
