"use client";

// The interactive pick flow. Server data arrives via props; after a mutation
// we router.refresh() so the server re-renders with fresh state (the page
// keys this island on the confirmed pick, so it remounts in sync).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { TopPicks } from "@/components/portal/TopPicks";
import { DeadlineClock } from "@/components/portal/DeadlineClock";
import type { TeamOption, PickSummary } from "@/lib/game/portalTypes";
import styles from "./page.module.css";

export interface PickFormProps {
  gameWeek: number;
  pickAhead: boolean;
  locked: boolean;
  deadline: string | null;
  teams: TeamOption[];
  myPick: { teamApiId: number | null; teamName: string | null; isWildcard: boolean } | null;
  wildcardUsed: boolean;
  survivedWeeks: number;
  playersAlive: number;
  /** The open week's live pick board — shown so players decide with the same information. */
  summary: PickSummary | null;
}

export default function PickForm({
  gameWeek,
  pickAhead,
  locked,
  deadline,
  teams,
  myPick,
  wildcardUsed,
  survivedWeeks,
  playersAlive,
  summary,
}: PickFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number | null>(myPick?.teamApiId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const confirming = submitting || pending;
  const wildcardArmed = !!myPick?.isWildcard;
  const wildcardLeft = wildcardUsed ? 0 : 1;
  const confirmedTeamId = myPick?.teamApiId ?? null;
  const dirty = selected != null && selected !== confirmedTeamId;
  const selectedTeam = teams.find((t) => t.apiId === selected) ?? null;

  async function mutate(run: () => Promise<Response>, fallback: string) {
    if (confirming) return;
    setSubmitting(true);
    setActionError("");
    try {
      const res = await run();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((data as { error?: string }).error ?? fallback);
        return;
      }
      // Re-render the server page — this island remounts with the new pick.
      startTransition(() => router.refresh());
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const confirmPick = () =>
    selected != null &&
    mutate(
      () =>
        fetch("/api/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamApiId: selected }),
        }),
      "Couldn’t save your pick."
    );

  const playWildcard = () =>
    mutate(() => fetch("/api/picks/wildcard", { method: "POST" }), "Couldn’t play your wildcard.");

  const takeBackWildcard = () =>
    mutate(() => fetch("/api/picks/wildcard", { method: "DELETE" }), "Couldn’t undo your wildcard.");

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
                <b data-nums>{playersAlive}</b> still standing
              </span>
              <span>
                You’ve survived <b data-nums>{survivedWeeks}</b>{" "}
                {survivedWeeks === 1 ? "week" : "weeks"}
              </span>
            </div>
          </div>

          <DeadlineClock deadline={deadline} locked={locked} />
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

        {/* The live pick board — the same one the dashboard shows, so every
            player decides with identical information. */}
        <TopPicks summary={summary} limit={5} />

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
          <p
            className={styles.confirmSummary}
            data-done={confirmedTeamId != null && !dirty}
            role={actionError ? "alert" : undefined}
          >
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
