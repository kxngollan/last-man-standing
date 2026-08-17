import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null; // dev fallback: log links instead
  if (cachedTransporter) return cachedTransporter;
  const auth =
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined;
  // A dotless SMTP_HOST (e.g. "gmail") is a nodemailer well-known service
  // name, which presets the real host, port, and TLS settings.
  cachedTransporter = host.includes(".")
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth,
      })
    : nodemailer.createTransport({ service: host, auth });
  return cachedTransporter;
}

const FROM = process.env.SMTP_FROM ?? "Last Man Standing <no-reply@footballlms.com>";

// Brand logo, embedded as an inline attachment (CID) — remote images get
// blocked by most clients and Gmail strips data: URIs. If the file goes
// missing the emails still send, just without the logo.
const LOGO_CID = "logo@lastmanstanding";
const LOGO_PATH = path.join(process.cwd(), "public", "images", "email-logo.png");
const logoAttachments = () =>
  existsSync(LOGO_PATH) ? [{ filename: "logo.png", path: LOGO_PATH, cid: LOGO_CID }] : [];

/* Hallmark · macrostructure: Poster/flyer (centered card) · theme: Hum (email-safe)
 * genre: playful · design-system: tokens.css translation · pre-emit critique: P4 H5 E4 S4 R4 V4
 * Email clients can't load web fonts, custom properties, or OKLCH, so the app's
 * tokens map to fixed values here:
 *   paper→#f2ecdf · card→#fffcf5 · ink→#2b241c · ink-2→#4a4137 · muted→#6b6156
 *   rule→#e0d8c8 · accent→#d1563b (decorative only) · accent-strong→#b8442b (text/fills, ≥4.5:1)
 * Type roles: Arial Black = display (Jakarta 800 stand-in) · system sans = body ·
 * Courier = mono outlier (Space Mono stand-in). Layout is tables for Outlook.
 */
const FONT_BODY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_DISPLAY = "'Arial Black','Helvetica Neue',Arial,sans-serif";
const FONT_MONO = "'Courier New',Courier,monospace";

function flyerHtml(opts: {
  preheader: string;
  headline: string;
  body: string;
  ctaLabel: string;
  link: string;
  ticketNote: string;
  finePrint: string;
}): string {
  const { preheader, headline, body, ctaLabel, link, ticketNote, finePrint } = opts;
  return `
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f2ecdf">
      <tr>
        <td align="center" style="padding:40px 16px">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;border-collapse:separate">
            <tr>
              <td align="center" style="background:#fffcf5;border:2px solid #2b241c;border-top:6px solid #d1563b;border-radius:14px;padding:40px 32px 32px">
                ${existsSync(LOGO_PATH) ? `<img src="cid:${LOGO_CID}" width="56" height="56" alt="Last Man Standing" style="display:block;margin:0 auto 20px">` : ""}
                <p style="margin:0 0 14px;font-family:${FONT_MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#b8442b">Last&nbsp;Man&nbsp;Standing</p>
                <h1 style="margin:0 0 14px;font-family:${FONT_DISPLAY};font-weight:900;font-style:normal;font-size:32px;line-height:1.08;text-transform:uppercase;letter-spacing:-0.5px;color:#2b241c">${headline}</h1>
                <p style="margin:0 auto 28px;max-width:34em;font-family:${FONT_BODY};font-size:16px;line-height:1.5;color:#4a4137">${body}</p>
                <a href="${link}" style="display:inline-block;margin:0 0 32px;background:#b8442b;color:#fffcf5;font-family:${FONT_BODY};font-size:16px;font-weight:700;padding:14px 34px;border-radius:999px;text-decoration:none">${ctaLabel}</a>
                <div style="border-top:2px dashed #e0d8c8;margin:0 0 16px"></div>
                <p style="margin:0 0 20px;font-family:${FONT_MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b6156">${ticketNote}</p>
                <p style="margin:0 0 6px;font-family:${FONT_BODY};font-size:12px;color:#6b6156">Button not working? Paste this link into your browser:</p>
                <p style="margin:0 0 24px;font-family:${FONT_MONO};font-size:12px;word-break:break-all"><a href="${link}" style="color:#b8442b">${link}</a></p>
                <p style="margin:0;font-family:${FONT_BODY};font-size:12px;color:#6b6156">${finePrint}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 24px 0;font-family:${FONT_MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b6156">One pick a week &middot; last one standing wins</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/** Send via SMTP, tagging failures so they aren't mistaken for other outages. */
async function deliver(transporter: Transporter, options: Parameters<Transporter["sendMail"]>[0]) {
  try {
    await transporter.sendMail({
      ...options,
      // Unique per message so Gmail doesn't thread repeat emails (e.g. a
      // resent verification) and collapse their shared content behind "…".
      headers: { "X-Entity-Ref-ID": randomUUID() },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`SMTP: ${msg}`);
  }
}

export async function sendVerificationEmail(to: string, link: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    // No SMTP configured — surface the link in the server console for local dev.
    console.log(`\n[email] Verification link for ${to}:\n${link}\n`);
    return;
  }
  await deliver(transporter, {
    from: FROM,
    to,
    subject: "Confirm your Last Man Standing account",
    text: `You're on the team sheet!\n\nConfirm your email and your place in the game is locked in:\n${link}\n\nThis link expires in 24 hours. Didn't sign up? Ignore this email and nothing happens.`,
    attachments: logoAttachments(),
    html: flyerHtml({
      preheader: "One tap to confirm your email — then you're in the game.",
      headline: "You&rsquo;re on the team&nbsp;sheet",
      body: "One tap to confirm your email and your place in the game is locked in.",
      ctaLabel: "Confirm my email",
      link,
      ticketNote: "Admit one &middot; link expires in 24 hours",
      finePrint: "Didn&rsquo;t sign up? Ignore this email and nothing happens.",
    }),
  });
}

/**
 * Told after the fact, not asked — this is how someone finds out their account
 * was taken. The link goes to the reset flow so they can lock it back down.
 */
export async function sendPasswordChangedEmail(to: string, link: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`\n[email] Password changed for ${to}. Reset link: ${link}\n`);
    return;
  }
  await deliver(transporter, {
    from: FROM,
    to,
    subject: "Your Last Man Standing password was changed",
    text: `Your password was just changed, and every other device has been signed out.\n\nIf that was you, there's nothing to do.\n\nIf it wasn't, reset your password now:\n${link}`,
    attachments: logoAttachments(),
    html: flyerHtml({
      preheader: "Your password was changed. If that wasn't you, act now.",
      headline: "Your password changed",
      body: "Your password was just changed and every other device has been signed out. If that was you, there&rsquo;s nothing to do here.",
      ctaLabel: "It wasn’t me — reset it",
      link,
      ticketNote: "Security notice &middot; sent to the account address",
      finePrint: "Was it you? Then you can safely ignore this email.",
    }),
  });
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`\n[email] Password reset link for ${to}:\n${link}\n`);
    return;
  }
  await deliver(transporter, {
    from: FROM,
    to,
    subject: "Reset your Last Man Standing password",
    text: `We received a request to reset your password.\n\nSet a new one here:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email and your password stays as it is.`,
    attachments: logoAttachments(),
    html: flyerHtml({
      preheader: "Set a new password and get back in the game.",
      headline: "Pick a new password",
      body: "We got a request to reset your password. One tap to choose a new one.",
      ctaLabel: "Set a new password",
      link,
      ticketNote: "Extra time &middot; link expires in 1 hour",
      finePrint: "Didn&rsquo;t ask for this? Ignore this email and your password stays as it is.",
    }),
  });
}
