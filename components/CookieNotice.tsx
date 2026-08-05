"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./CookieNotice.module.css";

const STORAGE_KEY = "lms-cookie-notice";

/**
 * One-time notice that the site uses Google Analytics, with a link to the
 * privacy policy. Analytics itself always loads (see app/layout.tsx) — this
 * only informs; dismissal persists in localStorage.
 */
export default function CookieNotice() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "dismissed");
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "dismissed");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className={styles.banner} role="region" aria-label="Cookie notice">
      <p className={styles.copy}>
        <strong>Cookies, briefly.</strong> We use Google Analytics to see how the game is used —
        no ads, no selling data. See the{" "}
        <Link href="/policy" className={styles.policyLink}>
          privacy policy
        </Link>
        .
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className="lms-btn lms-btn--primary lms-btn--sm"
          onClick={dismiss}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
