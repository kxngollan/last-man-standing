"use client";

import { StateShell } from "@/components/portal/StateShell";
import styles from "./portal.module.css";

// Catches render/data errors from any portal page.
export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StateShell className={styles.stateMain}>
      <h1 className="lms-state__title">Something went wrong</h1>
      <p className="lms-state__body">We couldn’t load this page. Please try again.</p>
      <button className="lms-btn lms-btn--primary" onClick={() => reset()}>
        Retry
      </button>
    </StateShell>
  );
}
