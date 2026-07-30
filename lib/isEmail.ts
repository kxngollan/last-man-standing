const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function isEmail(value: unknown): boolean {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}
