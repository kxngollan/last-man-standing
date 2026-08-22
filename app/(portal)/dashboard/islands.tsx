"use client";

// The dashboard's interactive islands. Everything else on the page is
// server-rendered; these hydrate with their data already in props.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { ResultMark, markFor } from "@/components/ui/ResultMark";
import { WildcardBadge } from "@/components/portal/WildcardBadge";
import type { StandingRow, StandingsPage } from "@/lib/game/portalTypes";
import styles from "./page.module.css";

function useCountUp(target: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const dur = reduce ? 0 : 900;
    let raf = requestAnimationFrame(function tick(t: number) {
      const p = dur === 0 ? 1 : Math.min(1, (t - start) / dur);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

/** A headline number that counts up on arrival. */
export function Stat({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(value);
  return (
    <div className={styles.stat}>
      <div className="lms-stat__num" data-nums aria-hidden="true">
        {shown}
      </div>
      <div className="lms-stat__label">
        <span className={styles.srOnly}>{value} </span>
        {label}
      </div>
    </div>
  );
}

/** Join the open game — surfaces the server's error instead of failing silently. */
export function JoinButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const busy = joining || pending;

  async function join() {
    setJoining(true);
    setError("");
    try {
      const res = await fetch("/api/games/join", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Couldn’t join the game. Please try again.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div>
      <button
        className="lms-btn lms-btn--primary"
        onClick={join}
        disabled={busy}
        aria-disabled={busy}
      >
        {busy ? "Joining…" : "Join this game"}
      </button>
      {error && (
        <p role="alert" style={{ color: "var(--color-out-ink)", marginTop: "0.5rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** How a pick's mark reads out loud, since the mark itself is the only cue. */
const PICK_LABEL = {
  safe: "through this week",
  out: "knocked out this week",
  pending: "still to play this week",
} as const;

function StandingRowItem({ p }: { p: StandingRow }) {
  const out = p.status === "eliminated";
  return (
    // Greyed only when they're actually out of the game — a winner's row is
    // not a spent one.
    <li className={styles.row} data-you={p.you} data-out={out}>
      <span className={styles.rank} data-nums aria-hidden="true">
        {p.rank}
      </span>
      <span className={styles.player}>
        <span className={styles.pname}>
          <Link href={p.you ? "/profile" : `/profile/${p.userId}`} className={styles.nameLink}>
            {p.name}
          </Link>
          {p.you && <span className={styles.youTag}>you</span>}
        </span>
        <span className={styles.psub} data-nums>
          survived {p.survivedWeeks} {p.survivedWeeks === 1 ? "week" : "weeks"}
        </span>
      </span>
      {/* The pick for the one week the board is showing — never a mix of
          weeks, and never a later week's pick standing in for this one. */}
      <span className={styles.lastPick} data-state={p.pick?.state ?? "none"}>
        {p.pick ? (
          <>
            {p.pick.tla && <TeamCrest crest={p.pick.crest} tla={p.pick.tla} />}
            <span className={styles.pickName}>{p.pick.teamName ?? "—"}</span>
            {/* A wildcard turns a draw into a pass, so it changes what this
                row's result means — everyone reading the board needs it, and
                the badge explains the rule on hover or tap. Skipped on a
                legacy teamless wildcard, where the team column already says
                "Wildcard". */}
            {p.pick.isWildcard && p.pick.tla !== "WC" && <WildcardBadge you={p.you} />}
            {/* Tick, cross or dash: how that week went for them, at a glance. */}
            <ResultMark
              kind={markFor(p.pick.state)}
              size={15}
              className={styles.pickMark}
              label={PICK_LABEL[p.pick.state]}
            />
          </>
        ) : (
          <span className={styles.pickName}>—</span>
        )}
      </span>
      <span className={`lms-chip ${out ? "lms-chip--out" : "lms-chip--safe"}`}>
        <ResultMark kind={out ? "cross" : "tick"} size={12} />
        {p.status === "winner" ? "Winner" : out ? "Out" : "In"}
      </span>
    </li>
  );
}

/**
 * The board: first page arrives server-rendered in props; further pages
 * lazy-load from /api/standings as the sentinel scrolls into view.
 *
 * Mounted with `key={week}` so changing week starts a clean board — pages
 * fetched for the old week describe different picks and can't be appended.
 */
export function StandingsBoard({
  firstPage,
  myStanding,
  total,
  week,
}: {
  firstPage: StandingRow[];
  myStanding: StandingRow | null;
  total: number;
  /** The game week the rows' picks are for — later pages must match it. */
  week: number;
}) {
  const [extraRows, setExtraRows] = useState<StandingRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadedCount = firstPage.length + extraRows.length;
  const hasMore = loadedCount < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/standings?offset=${loadedCount}&week=${week}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const page = (await res.json()) as StandingsPage;
      setExtraRows((rows) => [...rows, ...page.rows]);
    } catch {
      /* the button stays — the player can retry */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loadedCount, week]);

  // Auto-load the next page when the end of the board scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  // Own row is pinned on top, so drop it from the pages that contain it.
  const boardRows = [...firstPage, ...extraRows].filter((r) => !r.you);

  return (
    <>
      <ul className={styles.board}>
        {/* Your row first, always — then everyone else in rank order. */}
        {myStanding && <StandingRowItem p={myStanding} />}
        {boardRows.map((p) => (
          <StandingRowItem key={`${p.rank}-${p.name}`} p={p} />
        ))}
      </ul>

      {hasMore && (
        <div className={styles.loadMore} ref={sentinelRef}>
          <button
            className="lms-btn lms-btn--ghost lms-btn--sm"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            aria-disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <span className="lms-spinner" aria-hidden="true" />
                Loading&hellip;
              </>
            ) : (
              `Show more players (${total - loadedCount} to go)`
            )}
          </button>
        </div>
      )}
    </>
  );
}
