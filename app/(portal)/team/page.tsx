import Link from "next/link";
import styles from "./page.module.css";

type Result = "won" | "wildcard" | "pending" | "lost";

type Pick = {
  gw: number;
  team: string;
  code: string;
  color: string;
  fixture: string;
  result: Result;
  detail: string;
};

const CURRENT_GAME = 4;

const PICKS: Pick[] = [
  {
    gw: 1,
    team: "Man City",
    code: "MCI",
    color: "oklch(52% 0.12 235)",
    fixture: "vs Brighton (H)",
    result: "won",
    detail: "Won 3–1 — through to Week 2",
  },
  {
    gw: 2,
    team: "Liverpool",
    code: "LIV",
    color: "oklch(52% 0.19 22)",
    fixture: "vs Newcastle (H)",
    result: "won",
    detail: "Won 2–0 — through to Week 3",
  },
  {
    gw: 3,
    team: "Arsenal",
    code: "ARS",
    color: "oklch(55% 0.2 25)",
    fixture: "vs Nott'm Forest (H)",
    result: "pending",
    detail: "Locks Sat 1 Aug, 12:30",
  },
];

const USED = PICKS.filter((p) => p.result !== "pending");

const RESULT_META: Record<Result, { chip: string; label: string }> = {
  won: { chip: "lms-chip--safe", label: "Won" },
  wildcard: { chip: "lms-chip--wild", label: "Wildcard" },
  pending: { chip: "lms-chip--neutral", label: "This week" },
  lost: { chip: "lms-chip--out", label: "Out" },
};

export default function TeamPage() {
  return (
    <main className={styles.main}>
      <div className="lms-head">
        <p className={styles.kicker} data-nums>
          Game {CURRENT_GAME}
        </p>
        <h1 className={styles.title}>My picks</h1>
        <p className="lms-head__hint">
          Every team you pick is locked in for the game &mdash; you can&rsquo;t use it again
          until a new game starts.
        </p>
      </div>

      <ol className={styles.timeline}>
        {PICKS.map((p) => {
          const meta = RESULT_META[p.result];
          return (
            <li key={p.gw} className={styles.entry} data-pending={p.result === "pending"}>
              <div className={styles.marker} aria-hidden="true">
                <span className={styles.gw} data-nums>
                  GW{p.gw}
                </span>
              </div>
              <div className={`lms-panel ${styles.card}`}>
                <span
                  className="lms-crest lms-crest--lg"
                  style={{ background: p.color }}
                  aria-hidden="true"
                >
                  {p.code}
                </span>
                <div className={styles.body}>
                  <div className={styles.teamLine}>
                    <span className={styles.team}>{p.team}</span>
                    <span className={styles.fixture} data-nums>
                      {p.fixture}
                    </span>
                  </div>
                  <p className={styles.detail}>{p.detail}</p>
                </div>
                <span className={`lms-chip ${meta.chip}`}>{meta.label}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <section className={styles.used} aria-label="Teams used this game">
        <h2 className={styles.usedTitle}>
          Teams used{" "}
          <span className={styles.usedCount} data-nums>
            ({USED.length} of 20)
          </span>
        </h2>
        <ul className={styles.usedList}>
          {USED.map((p) => (
            <li key={p.code} className={styles.usedItem}>
              <span className="lms-crest" style={{ background: p.color }} aria-hidden="true">
                {p.code}
              </span>
              <span className={styles.usedName}>{p.team}</span>
            </li>
          ))}
        </ul>
        <p className={styles.usedHint}>
          18 teams still available. Choose wisely &mdash; you&rsquo;ll want your strongest
          fixtures later in the game.
        </p>
      </section>

      <div className={styles.footerCta}>
        <Link href="/make-selection" className="lms-btn lms-btn--primary">
          Make your Week 3 pick
        </Link>
      </div>
    </main>
  );
}
