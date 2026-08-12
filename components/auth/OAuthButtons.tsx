"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import styles from "./OAuthButtons.module.css";

/**
 * Sign in with Google or Apple, on both the login and sign-up screens — the
 * same button does both jobs, because a social sign-in that finds no account
 * creates one (lib/oauth.ts).
 *
 * Which buttons appear comes from the server rather than from a constant here:
 * a provider without credentials in the environment isn't registered (auth.ts),
 * and offering it would only lead to an error page. Nothing renders until the
 * answer arrives, so a deployment with neither configured shows nothing at all.
 */

type Provider = "google" | "apple";

function GoogleMark() {
  // Google's brand mark, which their terms require be used unaltered.
  return (
    <svg className={styles.mark} viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M11.18 8.5c-.02-1.6 1.3-2.37 1.36-2.4-.74-1.09-1.9-1.24-2.3-1.25-.98-.1-1.91.57-2.4.57-.5 0-1.26-.56-2.07-.55-1.06.02-2.05.62-2.6 1.57-1.11 1.93-.28 4.78.8 6.34.53.77 1.16 1.62 1.98 1.6.8-.04 1.1-.52 2.06-.52.96 0 1.23.51 2.07.5.86-.02 1.4-.78 1.92-1.55.6-.88.85-1.74.87-1.79-.02-.01-1.67-.64-1.69-2.52ZM9.63 3.83c.44-.53.74-1.27.66-2.01-.63.03-1.4.42-1.85.95-.4.47-.76 1.23-.66 1.95.7.06 1.41-.36 1.85-.89Z" />
    </svg>
  );
}

const LABELS: Record<Provider, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
};

export default function OAuthButtons({ next }: { next?: string }) {
  // Which one was clicked — the redirect to the provider takes a moment, and a
  // second click would start a second flow.
  const [pending, setPending] = useState<Provider | null>(null);
  const [available, setAvailable] = useState<Provider[]>([]);

  useEffect(() => {
    let live = true;
    getProviders()
      .then((providers) => {
        if (!live) return;
        setAvailable(
          (["google", "apple"] as const).filter((p) => providers && p in providers)
        );
      })
      .catch(() => {
        // Can't tell what's configured, so offer nothing rather than a button
        // that might go nowhere. Password login is unaffected.
      });
    return () => {
      live = false;
    };
  }, []);

  function go(provider: Provider) {
    setPending(provider);
    // Auth.js only honours a same-origin `redirectTo`, and `next` has already
    // been through safeNext() on the way in.
    void signIn(provider, { redirectTo: next || "/dashboard" });
  }

  if (available.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.divider} role="separator">
        <span>or</span>
      </div>

      {available.map((provider) => (
        <button
          key={provider}
          type="button"
          className={`lms-btn lms-btn--ghost lms-btn--block ${styles.provider}`}
          onClick={() => go(provider)}
          disabled={pending !== null}
          aria-disabled={pending !== null}
        >
          {pending === provider ? (
            <span className="lms-spinner" aria-hidden="true" />
          ) : provider === "google" ? (
            <GoogleMark />
          ) : (
            <AppleMark />
          )}
          {LABELS[provider]}
        </button>
      ))}
    </div>
  );
}
