"use client";

import { useEffect, useState } from "react";
import { dateTimeLabel } from "@/lib/format";
import styles from "./DeadlineClock.module.css";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The pick-deadline countdown card, shared by the dashboard and
 * make-selection. Isolated so its 1-second tick re-renders only the clock —
 * never the page around it.
 */
export function DeadlineClock({ deadline, locked }: { deadline: string | null; locked: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline || locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline, locked]);

  const ms = deadline ? Math.max(0, new Date(deadline).getTime() - now) : null;
  const parts =
    ms === null
      ? null
      : {
          days: Math.floor(ms / 86_400_000),
          hours: Math.floor((ms % 86_400_000) / 3_600_000),
          mins: Math.floor((ms % 3_600_000) / 60_000),
          secs: Math.floor((ms % 60_000) / 1000),
        };

  return (
    <div className={styles.countdown}>
      <div className={styles.label}>{locked ? "Picks locked" : "Picks lock in"}</div>
      <div className={styles.clock} data-nums aria-hidden="true">
        {locked ? (
          <span>Locked</span>
        ) : parts ? (
          <>
            {parts.days > 0 && (
              <span>
                {parts.days}
                <small>d</small>
              </span>
            )}
            <span>
              {pad(parts.hours)}
              <small>h</small>
            </span>
            <span>
              {pad(parts.mins)}
              <small>m</small>
            </span>
            <span>
              {pad(parts.secs)}
              <small>s</small>
            </span>
          </>
        ) : (
          <span>——</span>
        )}
      </div>
      <p className={styles.when}>
        Deadline &middot; {deadline ? dateTimeLabel(deadline) : "To be confirmed"}
      </p>
    </div>
  );
}
