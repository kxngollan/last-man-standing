"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AuthShell from "@/components/auth/AuthShell";
import { safeNext } from "@/lib/safeNext";
import styles from "@/components/auth/authContent.module.css";

/**
 * Shown when the database says this account has finished onboarding but the
 * session still says it hasn't — a claim that hasn't caught up yet, which is
 * what a second tab or a failed refresh leaves behind.
 *
 * The one thing that can't happen here is navigating on hope: the proxy trusts
 * the session, so leaving before the claim has actually changed lands straight
 * back on this page. So we refresh, read the session that comes back, and only
 * move once it agrees. If it doesn't, we stop and say so rather than loop.
 */
export default function OnboardingDone({ next }: { next?: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [stuck, setStuck] = useState(false);

  // Written as promise callbacks rather than await/setState so the state change
  // happens in a callback, which is the shape the effect lint rule asks for.
  const refresh = useCallback(
    (onSettled: (recovered: boolean) => void) => {
      update()
        .then((session) => {
          const recovered = !!session?.user && !session.user.needsOnboarding;
          if (recovered) {
            router.replace(safeNext(next));
            router.refresh();
          }
          onSettled(recovered);
        })
        .catch(() => onSettled(false));
    },
    [next, router, update]
  );

  useEffect(() => {
    let live = true;
    refresh((recovered) => {
      if (live && !recovered) setStuck(true);
    });
    return () => {
      live = false;
    };
  }, [refresh]);

  return (
    <AuthShell>
      <h1 className={styles.title}>{stuck ? "Nearly there" : "Getting you set up…"}</h1>
      {stuck ? (
        <>
          <p className={styles.lede}>
            Your details are saved, but this session hasn&rsquo;t picked them up yet. Try again,
            and if that doesn&rsquo;t do it, log out and back in.
          </p>
          <button
            type="button"
            className="lms-btn lms-btn--primary lms-btn--block"
            onClick={() => {
              setStuck(false);
              refresh((recovered) => setStuck(!recovered));
            }}
          >
            Try again
          </button>
        </>
      ) : (
        <p className={styles.lede} role="status">
          <span className="lms-spinner" aria-hidden="true" /> One moment.
        </p>
      )}
    </AuthShell>
  );
}
