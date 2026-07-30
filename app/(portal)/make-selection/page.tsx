"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

/* ---- Mock data (stands in for the game engine + football-data.org) ---- */

type Team = {
  id: string;
  name: string;
  code: string;
  color: string;
  opponent: string;
  venue: "H" | "A";
  usedGw?: number; // set if the player already spent this team
};

const GAME_WEEK = 3;
const PLAYERS_LEFT = 42;
const WEEKS_SURVIVED = 2;
const WILDCARDS_LEFT = 1;

// Deadline: first kickoff of the game week (picks lock here).
const DEADLINE = new Date("2026-08-01T12:30:00+01:00");
const DEADLINE_LABEL = "Sat 1 Aug, 12:30";

const TEAMS: Team[] = [
  { id: "ars", name: "Arsenal", code: "ARS", color: "oklch(55% 0.2 25)", opponent: "Nott'm Forest", venue: "H" },
  { id: "avl", name: "Aston Villa", code: "AVL", color: "oklch(38% 0.12 15)", opponent: "Chelsea", venue: "H" },
  { id: "bou", name: "Bournemouth", code: "BOU", color: "oklch(52% 0.19 25)", opponent: "Burnley", venue: "H" },
  { id: "bre", name: "Brentford", code: "BRE", color: "oklch(52% 0.2 28)", opponent: "Fulham", venue: "H" },
  { id: "bha", name: "Brighton", code: "BHA", color: "oklch(52% 0.16 245)", opponent: "Man City", venue: "A" },
  { id: "bur", name: "Burnley", code: "BUR", color: "oklch(40% 0.11 350)", opponent: "Bournemouth", venue: "A" },
  { id: "che", name: "Chelsea", code: "CHE", color: "oklch(48% 0.17 260)", opponent: "Aston Villa", venue: "A" },
  { id: "cry", name: "Crystal Palace", code: "CRY", color: "oklch(52% 0.16 265)", opponent: "Wolves", venue: "H" },
  { id: "eve", name: "Everton", code: "EVE", color: "oklch(45% 0.15 260)", opponent: "Man United", venue: "A" },
  { id: "ful", name: "Fulham", code: "FUL", color: "oklch(30% 0.01 0)", opponent: "Brentford", venue: "A" },
  { id: "lee", name: "Leeds", code: "LEE", color: "oklch(50% 0.03 250)", opponent: "Sunderland", venue: "A" },
  { id: "liv", name: "Liverpool", code: "LIV", color: "oklch(52% 0.19 22)", opponent: "Newcastle", venue: "H", usedGw: 2 },
  { id: "mci", name: "Man City", code: "MCI", color: "oklch(52% 0.12 235)", opponent: "Brighton", venue: "H", usedGw: 1 },
  { id: "mun", name: "Man United", code: "MUN", color: "oklch(54% 0.2 28)", opponent: "Everton", venue: "H" },
  { id: "new", name: "Newcastle", code: "NEW", color: "oklch(32% 0.01 0)", opponent: "Liverpool", venue: "A" },
  { id: "nfo", name: "Nott'm Forest", code: "NFO", color: "oklch(52% 0.2 25)", opponent: "Arsenal", venue: "A" },
  { id: "sun", name: "Sunderland", code: "SUN", color: "oklch(52% 0.2 25)", opponent: "Leeds", venue: "H" },
  { id: "tot", name: "Tottenham", code: "TOT", color: "oklch(48% 0.07 265)", opponent: "West Ham", venue: "H" },
  { id: "whu", name: "West Ham", code: "WHU", color: "oklch(40% 0.12 20)", opponent: "Tottenham", venue: "A" },
  { id: "wol", name: "Wolves", code: "WOL", color: "oklch(52% 0.13 72)", opponent: "Crystal Palace", venue: "A" },
];

function useCountdown(target: Date) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (now === null) return null; // avoid hydration mismatch — render nothing until mounted
    const ms = Math.max(0, target.getTime() - now);
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const mins = Math.floor((ms % 3_600_000) / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    return { days, hours, mins, secs, expired: ms === 0 };
  }, [now, target]);
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function MakeSelectionPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [wildcardLeft, setWildcardLeft] = useState(WILDCARDS_LEFT);
  const [wildcardActive, setWildcardActive] = useState(false);

  const countdown = useCountdown(DEADLINE);
  const selectedTeam = TEAMS.find((t) => t.id === selected) ?? null;
  const confirmedTeam = TEAMS.find((t) => t.id === confirmed) ?? null;
  const dirty = selected !== null && selected !== confirmed;

  function confirmPick() {
    if (!selected || confirming) return;
    setConfirming(true);
    // Simulated round-trip to the game engine.
    setTimeout(() => {
      setConfirmed(selected);
      setConfirming(false);
    }, 650);
  }

  function playWildcard() {
    if (wildcardLeft < 1) return;
    setWildcardActive(true);
    setWildcardLeft((n) => n - 1);
    setSelected(null);
    setConfirmed(null);
  }

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              Pick your <span className={styles.titleAccent}>Week {GAME_WEEK}</span> team
            </h1>
            <p className={styles.lede}>
              Choose one team to win. Win and you&rsquo;re through to next week &mdash; draw
              or lose and you&rsquo;re out. Each team can only be used once.
            </p>
            <div className={styles.survived}>
              <span>
                <b data-nums>{PLAYERS_LEFT}</b> still standing
              </span>
              <span>
                You&rsquo;ve survived <b data-nums>{WEEKS_SURVIVED}</b> weeks
              </span>
            </div>
          </div>

          <div className={styles.countdown}>
            <div className={styles.countdownLabel}>Picks lock in</div>
            <div className={styles.clock} data-nums aria-hidden="true">
              {countdown ? (
                countdown.expired ? (
                  <span>Locked</span>
                ) : (
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
                )
              ) : (
                <span>&mdash;&mdash;</span>
              )}
            </div>
            <p className={styles.deadlineWhen}>Deadline &middot; {DEADLINE_LABEL}</p>
          </div>
        </div>

        <section className={styles.wildcard} aria-label="Wildcard" hidden={wildcardActive}>
          <svg
            className={styles.wildcardIcon}
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 5h11l5 5-9 9-7-7V5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" />
          </svg>
          <div className={styles.wildcardBody}>
            <h2>Tough week? Play your wildcard.</h2>
            <p>
              It keeps you safe this week without picking a team &mdash; and doesn&rsquo;t use
              one up. You have{" "}
              <b data-nums>
                {wildcardLeft} wildcard{wildcardLeft === 1 ? "" : "s"}
              </b>{" "}
              left this game.
            </p>
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnWild}`}
            onClick={playWildcard}
            disabled={wildcardLeft < 1}
            aria-disabled={wildcardLeft < 1}
          >
            {wildcardLeft < 1 ? "No wildcards left" : "Play wildcard"}
          </button>
        </section>

        {wildcardActive && (
          <section className={styles.wildcard} aria-live="polite">
            <svg
              className={styles.wildcardIcon}
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="m5 12 4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className={styles.wildcardBody}>
              <h2>Wildcard played &mdash; you&rsquo;re safe this week.</h2>
              <p>No team pick needed. See you in Week {GAME_WEEK + 1}.</p>
            </div>
          </section>
        )}

        {!wildcardActive && (
          <>
            <div className={styles.gridHead}>
              <h2>This week&rsquo;s fixtures</h2>
              <p className={styles.gridHint}>Greyed-out teams are ones you&rsquo;ve already used.</p>
            </div>

            <fieldset className={styles.grid}>
              <legend className={styles.legend}>
                <span className={styles.srOnly}>Choose your team for Game Week {GAME_WEEK}</span>
              </legend>

              {TEAMS.map((team) => {
                const used = team.usedGw !== undefined;
                const id = `team-${team.id}`;
                return (
                  <div key={team.id} style={{ display: "contents" }}>
                    <input
                      className={styles.radio}
                      type="radio"
                      name="team"
                      id={id}
                      value={team.id}
                      disabled={used}
                      checked={selected === team.id}
                      onChange={() => setSelected(team.id)}
                    />
                    <label className={styles.card} htmlFor={id} data-used={used}>
                      <span
                        className={styles.crest}
                        style={{ background: team.color }}
                        aria-hidden="true"
                      >
                        {team.code}
                      </span>
                      <span className={styles.teamMeta}>
                        <span className={styles.teamName}>{team.name}</span>
                        <span className={styles.fixture}>
                          {team.venue === "H" ? "vs " : "@ "}
                          {team.opponent} ({team.venue})
                        </span>
                      </span>
                      {used ? (
                        <span className={styles.usedTag}>USED &middot; GW{team.usedGw}</span>
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
          </>
        )}
      </main>

      {!wildcardActive && (
        <div className={styles.confirmBar}>
          <div className={styles.confirmInner}>
            <p className={styles.confirmSummary} data-done={confirmed !== null && !dirty}>
              {confirmed && !dirty ? (
                <>
                  <b>Pick confirmed: {confirmedTeam?.name}</b>{" "}
                  <span>&middot; change any time before the deadline</span>
                </>
              ) : selectedTeam ? (
                <>
                  <b>{selectedTeam.name}</b>{" "}
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
              disabled={!dirty || confirming}
              aria-disabled={!dirty || confirming}
            >
              {confirming ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Saving&hellip;
                </>
              ) : confirmed && !dirty ? (
                "Pick saved"
              ) : confirmed ? (
                "Update pick"
              ) : (
                "Confirm pick"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
