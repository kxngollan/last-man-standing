import type { Metadata } from "next";
import Link from "next/link";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { getLeagueTable } from "@/lib/game/browse";
import { seasonLabel } from "@/lib/format";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Premier League Table",
  description:
    "The live Premier League table — points, goal difference and form for every club. Weigh up who's in form before your next Last Man Standing pick.",
  alternates: { canonical: "/table" },
  // Public page — overrides the portal layout's noindex.
  robots: { index: true, follow: true },
};

// Always render from the latest synced results (the cron keeps them fresh).
export const dynamic = "force-dynamic";

function zoneOf(position: number, total: number): "ucl" | "uel" | "drop" | undefined {
  if (position <= 4) return "ucl";
  if (position === 5) return "uel";
  if (position > total - 3) return "drop";
  return undefined;
}

const FORM_GLYPH: Record<string, { mark: string; word: string }> = {
  W: { mark: "✓", word: "won" },
  D: { mark: "–", word: "drew" },
  L: { mark: "×", word: "lost" },
};

/** Last-5 discs — green tick (win), grey dash (draw), red cross (loss). */
function Form({ form }: { form: string | null }) {
  if (!form) return null;
  const results = form.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(-5);
  const label = results.map((r) => FORM_GLYPH[r]?.word ?? r).join(", ");
  return (
    <span className={styles.form} aria-label={`Last ${results.length} games, oldest first: ${label}`}>
      {results.map((r, i) => (
        <span key={i} className={styles.formDot} data-r={r} aria-hidden="true">
          {FORM_GLYPH[r]?.mark ?? r}
        </span>
      ))}
    </span>
  );
}

/** Number cell with a screen-reader label — the visual header row is decorative. */
function Num({ label, value, className }: { label: string; value: number | string; className: string }) {
  return (
    <span className={className} data-nums>
      <span className="lms-sr-only">{label} </span>
      {value}
    </span>
  );
}

export default async function TablePage() {
  const { rows, season } = await getLeagueTable();

  return (
    <main className={styles.main}>
      <div className="lms-head">
        <p className={styles.kicker} data-nums>
          Premier League &middot; {seasonLabel(season)}
        </p>
        <h1 className={styles.title}>The table</h1>
        <p className="lms-head__hint">
          Live standings from the Premier League. Use it to weigh up who’s in form before you pick.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className={styles.notice}>The table isn’t available yet. Check back once the season is under way.</p>
      ) : (
        <div className={styles.tableWrap}>
          <div className={`${styles.row} ${styles.headRow}`} aria-hidden="true">
            <span className={styles.pos}>#</span>
            <span className={styles.club}>Club</span>
            <span className={styles.num}>P</span>
            <span className={`${styles.num} ${styles.wide}`}>W</span>
            <span className={`${styles.num} ${styles.wide}`}>D</span>
            <span className={`${styles.num} ${styles.wide}`}>L</span>
            <span className={styles.num}>GD</span>
            <span className={styles.pts}>Pts</span>
            <span className={styles.formCell}>Last 5</span>
          </div>

          <ol className={styles.list}>
            {rows.map((r) => (
              <li key={r.tla}>
                {/* No aria-label here on purpose: the cells carry sr-only
                    labels, so screen readers hear the actual numbers. */}
                <Link
                  href={`/fixtures/${r.tla}`}
                  className={styles.row}
                  data-zone={zoneOf(r.position, rows.length)}
                >
                  <Num label="Position" value={r.position} className={styles.pos} />
                  <span className={styles.club}>
                    <TeamCrest crest={r.crest} tla={r.tla} />
                    <span className={styles.clubText}>
                      <span className={styles.clubName}>
                        <span className={styles.clubFull}>{r.shortName || r.name}</span>
                        <span className={styles.clubTla} data-nums aria-hidden="true">
                          {r.tla}
                        </span>
                      </span>
                      {/* On narrow screens the last-5 dots tuck under the name;
                          from 48rem they live in the dedicated end column. */}
                      <span className={styles.clubFormSm}>
                        <Form form={r.form} />
                      </span>
                    </span>
                  </span>
                  <Num label="Played" value={r.played} className={styles.num} />
                  <Num label="Won" value={r.won} className={`${styles.num} ${styles.wide}`} />
                  <Num label="Drawn" value={r.drawn} className={`${styles.num} ${styles.wide}`} />
                  <Num label="Lost" value={r.lost} className={`${styles.num} ${styles.wide}`} />
                  <Num
                    label="Goal difference"
                    value={r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
                    className={styles.num}
                  />
                  <Num label="Points" value={r.points} className={styles.pts} />
                  <span className={styles.formCell}>
                    <Form form={r.form} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <ul className={styles.legend} aria-label="Table zones">
            <li>
              <span className={styles.legendDot} data-zone="ucl" /> Champions League
            </li>
            <li>
              <span className={styles.legendDot} data-zone="uel" /> Europa League
            </li>
            <li>
              <span className={styles.legendDot} data-zone="drop" /> Relegation
            </li>
          </ul>
        </div>
      )}
    </main>
  );
}
