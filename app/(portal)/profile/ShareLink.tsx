"use client";

import { useState } from "react";

/** Copies a link on this site. The address bar is the fallback if it's blocked. */
export default function ShareLink({
  path,
  label = "Share profile",
  copiedLabel = "Link copied",
}: {
  path: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — nothing useful to say, the URL is on screen */
    }
  }

  return (
    <button
      type="button"
      className="lms-btn lms-btn--ghost lms-btn--sm"
      onClick={() => void copy()}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
