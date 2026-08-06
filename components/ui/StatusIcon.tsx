/**
 * The 40×40 status disc used on auth/confirmation screens. One source for
 * the tick and alert marks that used to be pasted per page. Hook-free.
 */
export function StatusIcon({ kind }: { kind: "ok" | "error" | "wild" }) {
  const palette = {
    ok: { wash: "var(--color-safe-wash)", ink: "var(--color-safe-ink)" },
    error: { wash: "var(--color-out-wash)", ink: "var(--color-out-ink)" },
    wild: { wash: "var(--color-wild-wash)", ink: "var(--color-wild-ink)" },
  }[kind];

  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={palette.wash} />
      {kind === "error" ? (
        <path
          d="M12 7v6m0 3.5h.01"
          stroke={palette.ink}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="m8 12 2.8 2.8L16 9.5"
          stroke={palette.ink}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
