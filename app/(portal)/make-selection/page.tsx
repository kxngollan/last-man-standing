"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePortalState } from "@/components/portal/usePortalState";
import { TeamCrest } from "@/components/portal/TeamCrest";
import styles from "./page.module.css";

function useCountdown(targetIso: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return useMemo(() => {
    if (now === null || !targetIso) return null;
    const ms = Math.max(0, new Date(targetIso).getTime() - now);
    return {
      days: Math.floor(ms / 86_400_000),
      hours: Math.floor((ms % 86_400_000) / 3_600_000),
      mins: Math.floor((ms % 3_600_000) / 60_000),
      secs: Math.floor((ms % 60_000) / 1000),
      expired: ms === 0,
    };
  }, [now, targetIso]);
}

const pad = (n: number) => String(n).padStart(2, "0");

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.main}>
      <div className="lms-state">{children}</div>
    </main>
  );
}

export default function MakeSelectionPage() {
  const { state, loading, error, refetch } = usePortalState();
  const [selected, setSelected] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState("");

  const myPick = state?.myPick ?? null;
  const gameWeek = state?.pickGameWeek ?? 0;
  const pickAhead = state?.pickAhead ?? false;
  const deadline = state?.deadline ?? null;
  const countdown = useCountdown(deadline);

  // Sync local selection to the saved pick when data loads.
  useEffect(() => {
    if (myPick && myPick.teamApiId != null) {
      setSelected(myPick.teamApiId);
    }
  }, [myPick]);

  if (loading) {
    return (
      <StateShell>
        <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
        <p className="lms-state__body">Loading this week’s fixtures…</p>
      </StateShell>
    );
  }
  if (error || !state) {
    return (
      <StateShell>
        <h1 className="lms-state__title">Something went wrong</h1>
        <p className="lms-state__body">{error ?? "Please try again."}</p>
        <button className="lms-btn lms-btn--primary" onClick={() => refetch()}>
          Retry
        </button>
      </StateShell>
    );
  }
  if (!state.game) {
    return (
      <StateShell>
        <h1 className="lms-state__title">No game running</h1>
        <p className="lms-state__body">There’s no game to pick for right now.</p>
        <Link href="/dashboard" className="lms-btn lms-btn--ghost">
          Back to dashboard
        </Link>
      </StateShell>
    );
  }
  if (!state.entry) {
    return (
      <StateShell>
        <h1 className="lms-state__title">
          {state.game.status === "registration" ? "Join to play" : "You’re not in this game"}
        </h1>
        <p className="lms-state__body">
          {state.game.status === "registration"
            ? "Registration is open. Join from the dashboard to make your first pick."
            : "This game already kicked off. You’ll be able to join the next one."}
        </p>
        <Link href="/dashboard" className="lms-btn lms-btn--primary">
          Go to dashboard
        </Link>
      </StateShell>
    );
  }
  if (state.entry.status !== "alive") {
    return (
      <StateShell>
        <h1 className="lms-state__title">
          {state.entry.status === "winner" ? "You won this game 🏆" : "You’re out"}
        </h1>
        <p className="lms-state__body">
          {state.entry.status === "winner"
            ? "Last one standing. Enjoy the bragging rights."
            : "Your run ended this game. Hang tight for the next one."}
        </p>
        <Link href="/dashboard" className="lms-btn lms-btn--ghost">
          See standings
        </Link>
      </StateShell>
    );
  }

  // Legacy skip-the-week wildcard (no team attached) from the old rules.
  if (myPick?.isWildcard && myPick.teamApiId == null) {
    return (
      <StateShell>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="var(--color-wild-wash)" />
          <path
            d="m8 12 2.8 2.8L16 9.5"
            stroke="var(--color-wild-ink)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="lms-state__title">Wildcard played</h1>
        <p className="lms-state__body">
          You’re safe for Week {gameWeek} without using a team. See you next week.
        </p>
        <Link href="/dashboard" className="lms-btn lms-btn--ghost">
          Back to dashboard
        </Link>
      </StateShell>
    );
  }

  const { game, entry, teams, players } = state;
  const locked = state.locked;
  const wildcardArmed = !!myPick?.isWildcard;
  const wildcardLeft = entry.wildcardUsed ? 0 : 1;
  const confirmedTeamId = myPick?.teamApiId ?? null;
  const dirty = selected != null && selected !== confirmedTeamId;
  const selectedTeam = teams.find((t) => t.apiId === selected) ?? null;

  async function confirmPick() {
    if (selected == null || confirming) return;
    setConfirming(true);
    setActionError("");
    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamApiId: selected }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setActionError(data.error ?? "Couldn’t save your pick.");
    await refetch();
    setConfirming(false);
  }

  async function playWildcard() {
    if (confirming) return;
    setConfirming(true);
    setActionError("");
    const res = await fetch("/api/picks/wildcard", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setActionError(data.error ?? "Couldn’t play your wildcard.");
    await refetch();
    setConfirming(false);
  }

  async function takeBackWildcard() {
    if (confirming) return;
    setConfirming(true);
    setActionError("");
    const res = await fetch("/api/picks/wildcard", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setActionError(data.error ?? "Couldn’t undo your wildcard.");
    await refetch();
    setConfirming(false);
  }

  const deadlineLabel = deadline
    ? new Date(deadline).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "To be confirmed";

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              Pick your <span className={styles.titleAccent}>Week {gameWeek}</span> team
            </h1>
            {pickAhead && !locked && (
              <p className={styles.aheadNote}>
                <span className={styles.aheadTag}>Ahead</span>
                This week hasn’t kicked off yet — you’re picking early. Change it any time before the
                deadline.
              </p>
            )}
            <p className={styles.lede}>
              Choose one team to win. Win and you’re through to next week. Draw or lose and
              you’re out. Each team can only be used once.
            </p>
            <div className={styles.survived}>
              <span>
                <b data-nums>{players.alive}</b> still standing
              </span>
              <span>
                You’ve survived <b data-nums>{entry.survivedWeeks}</b>{" "}
                {entry.survivedWeeks === 1 ? "week" : "weeks"}
              </span>
            </div>
          </div>

          <div className={styles.countdown}>
            <div className={styles.countdownLabel}>{locked ? "Picks locked" : "Picks lock in"}</div>
            <div className={styles.clock} data-nums aria-hidden="true">
              {locked ? (
                <span>Locked</span>
              ) : countdown ? (
                <>
                  {countdown.days > 0 && (
                    <span>
                      {countdown.days}
                      <small>d</small>
                    </span>
                  )}
                  <span>
                    {pad(countdown.hours)}
                    <small>h</small>
                  </span>
                  <span>
                    {pad(countdown.mins)}
                    <small>m</small>
                  </span>
                  <span>
                    {pad(countdown.secs)}
                    <small>s</small>
                  </span>
                </>
              ) : (
                <span>——</span>
              )}
            </div>
            <p className={styles.deadlineWhen}>Deadline &middot; {deadlineLabel}</p>
          </div>
        </div>

        {!locked && (
          <section className={styles.wildcard} aria-label="Wildcard">
            <svg
              className={styles.wildcardIcon}
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path d="M4 5h11l5 5-9 9-7-7V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" />
            </svg>
            <div className={styles.wildcardBody}>
              {wildcardArmed ? (
                <>
                  <h2>Wildcard armed on this pick.</h2>
                  <p>
                    Win <b>or draw</b> this week and you’re through — only a loss knocks you out.
                    You can take it back any time before the deadline.
                  </p>
                </>
              ) : (
                <>
                  <h2>Tough week? Play your wildcard.</h2>
                  <p>
                    It protects your pick: win <b>or draw</b> and you’re through. One per game
                    {confirmedTeamId == null && wildcardLeft > 0 ? " — pick a team first" : ""}.
                    You have <b data-nums>{wildcardLeft}</b> wildcard
                    {wildcardLeft === 1 ? "" : "s"} left.
                  </p>
                </>
              )}
            </div>
            {wildcardArmed ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnWild}`}
                onClick={takeBackWildcard}
                disabled={confirming}
                aria-disabled={confirming}
              >
                Undo wildcard
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnWild}`}
                onClick={playWildcard}
                disabled={wildcardLeft < 1 || confirmedTeamId == null || confirming}
                aria-disabled={wildcardLeft < 1 || confirmedTeamId == null || confirming}
              >
                {wildcardLeft < 1 ? "No wildcards left" : "Play wildcard"}
              </button>
            )}
          </section>
        )}

        <div className={styles.gridHead}>
          <h2>This week’s fixtures</h2>
          <p className={styles.gridHint}>
            {locked
              ? "Picks are locked for this week."
              : "Greyed-out teams are ones you’ve already used."}
          </p>
        </div>

        {teams.length === 0 ? (
          <p className={styles.gridHint}>Fixtures for this week haven’t loaded yet.</p>
        ) : (
          <fieldset className={styles.grid} disabled={locked}>
            <legend className={styles.legend}>
              <span className={styles.srOnly}>Choose your team for game week {gameWeek}</span>
            </legend>

            {teams.map((team) => {
              const isCurrent = confirmedTeamId === team.apiId;
              const disabled = (team.used && !isCurrent) || locked;
              const id = `team-${team.apiId}`;
              return (
                <div key={team.apiId} style={{ display: "contents" }}>
                  <input
                    className={styles.radio}
                    type="radio"
                    name="team"
                    id={id}
                    value={team.apiId}
                    disabled={disabled}
                    checked={selected === team.apiId}
                    onChange={() => setSelected(team.apiId)}
                  />
                  <label className={styles.card} htmlFor={id} data-used={team.used && !isCurrent}>
                    <TeamCrest crest={team.crest} tla={team.tla} discClass={styles.crest} />
                    <span className={styles.teamMeta}>
                      <span className={styles.teamName}>{team.shortName || team.name}</span>
                      <span className={styles.fixture} data-nums>
                        {team.venue === "H" ? "vs " : "@ "}
                        {team.opponent} ({team.venue})
                      </span>
                    </span>
                    {team.used && !isCurrent ? (
                      <span className={styles.usedTag}>USED</span>
                    ) : (
                      <span className={styles.tick} aria-hidden="true">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path
                            d="m5 12 4.5 4.5L19 7"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </label>
                </div>
              );
            })}
          </fieldset>
        )}
      </main>

      <div className={styles.confirmBar}>
        <div className={styles.confirmInner}>
          <p className={styles.confirmSummary} data-done={confirmedTeamId != null && !dirty}>
            {actionError ? (
              <span style={{ color: "var(--color-out-ink)" }}>{actionError}</span>
            ) : locked ? (
              <span>Picks are locked for this week.</span>
            ) : confirmedTeamId != null && !dirty ? (
              <>
                <b>Pick confirmed: {myPick?.teamName}</b>{" "}
                <span>
                  &middot;{" "}
                  {wildcardArmed
                    ? "wildcard armed — a draw is enough"
                    : "change any time before the deadline"}
                </span>
              </>
            ) : selectedTeam ? (
              <>
                <b>{selectedTeam.shortName || selectedTeam.name}</b>{" "}
                <span>
                  {selectedTeam.venue === "H" ? "vs " : "@ "}
                  {selectedTeam.opponent}
                </span>
              </>
            ) : (
              <span>Select a team to make your pick.</span>
            )}
          </p>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={confirmPick}
            disabled={!dirty || confirming || locked}
            aria-disabled={!dirty || confirming || locked}
          >
            {confirming ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Saving…
              </>
            ) : confirmedTeamId != null && !dirty ? (
              "Pick saved"
            ) : confirmedTeamId != null ? (
              "Update pick"
            ) : (
              "Confirm pick"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
