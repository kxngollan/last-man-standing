import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null; // dev fallback: log links instead
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return cachedTransporter;
}

const FROM = process.env.SMTP_FROM ?? "Last Man Standing <no-reply@lastmanstanding.app>";

export async function sendVerificationEmail(to: string, link: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    // No SMTP configured — surface the link in the server console for local dev.
    console.log(`\n[email] Verification link for ${to}:\n${link}\n`);
    return;
  }
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Confirm your Last Man Standing account",
    text: `Welcome to Last Man Standing!\n\nConfirm your email to start playing:\n${link}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
        <h1 style="font-size:20px">Welcome to Last Man Standing</h1>
        <p>Confirm your email to start playing.</p>
        <p><a href="${link}" style="display:inline-block;background:#d1563b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Confirm email</a></p>
        <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${link}</p>
        <p style="color:#666;font-size:13px">This link expires in 24 hours.</p>
      </div>`,
  });
}
