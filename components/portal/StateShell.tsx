import type { ReactNode } from "react";

/**
 * Full-page state (loading / empty / gate) wrapper. Hook-free on purpose so
 * both server pages and client islands can render it. `className` takes the
 * page's own `styles.main` so spacing matches the page it stands in for.
 */
export function StateShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <main className={className}>
      <div className="lms-state">{children}</div>
    </main>
  );
}
