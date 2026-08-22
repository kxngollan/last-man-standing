"use client";

import { useState } from "react";
import styles from "./WildcardBadge.module.css";

/**
 * The "WC" badge on a pick, with the rule attached.
 *
 * A wildcard is the one thing on a row that changes what its result means, and
 * two letters can't say that on their own — so the badge explains itself on
 * hover, on focus, and on tap. It's a button rather than a `title` because a
 * tooltip nobody can reach on a phone is no help to half the players.
 *
 * Only for places that aren't already inside a link: a button nested in an
 * anchor is invalid, and would swallow the row's own click.
 */
export function WildcardBadge({ you = false }: { you?: boolean }) {
  const [open, setOpen] = useState(false);
  const text = you
    ? "You played your wildcard this week — if your team draws, you’re still safe."
    : "Played their wildcard this week — if their team draws, they’re still safe.";

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={styles.badge}
        aria-expanded={open}
        aria-label={text}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        WC
      </button>
      <span role="tooltip" className={styles.tip} data-open={open} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
