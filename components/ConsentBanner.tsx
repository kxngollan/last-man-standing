"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GoogleAnalytics } from "@next/third-parties/google";
import styles from "./ConsentBanner.module.css";

const STORAGE_KEY = "lms-analytics-consent";

type Consent = "granted" | "denied" | "unset" | "loading";

/**
 * Opt-in consent gate for Google Analytics (UK GDPR / PECR): gtag.js is only
 * loaded after the player explicitly allows it. The choice persists in
 * localStorage; declining leaves the page completely analytics-free.
 */
export default function ConsentBanner({ gaId }: { gaId: string }) {
  const [consent, setConsent] = useState<Consent>("loading");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setConsent(stored === "granted" || stored === "denied" ? stored : "unset");
  }, []);

  function choose(value: "granted" | "denied") {
    localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  }

  return (
    <>
      {consent === "granted" && <GoogleAnalytics gaId={gaId} />}
      {consent === "unset" && (
        <div className={styles.banner} role="region" aria-label="Cookie consent">
          <p className={styles.copy}>
            <strong>Cookies, briefly.</strong> We&rsquo;d like to use Google Analytics to see how
            the game is used — no ads, no selling data. See the{" "}
            <Link href="/policy" className={styles.policyLink}>
              privacy policy
            </Link>
            .
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className="lms-btn lms-btn--primary lms-btn--sm"
              onClick={() => choose("granted")}
            >
              Allow analytics
            </button>
            <button
              type="button"
              className="lms-btn lms-btn--ghost lms-btn--sm"
              onClick={() => choose("denied")}
            >
              No thanks
            </button>
          </div>
        </div>
      )}
    </>
  );
}
