import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { StateShell } from "@/components/portal/StateShell";
import { getPickSummary } from "@/lib/game/queries";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "The picks",
};

export default async function PicksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/picks");

  const summary = await getPickSummary();

  if (!summary) {
    return (
      <StateShell className={styles.main}>
        <h1 className="lms-state__title">No game running</h1>
        <p className="lms-state__body">There’s no game on right now, so no picks to show.</p>
        <Link href="/dashboard" className="lms-btn lms-btn--primary">
          Back to standings
        </Link>
      </StateShell>
    );
  }

  const max = summary.teams[0]?.count ?? 1;

  return (
    <main className={styles.main}>
      <Link href="/dashboard" className={styles.back}>
        &lsaquo; Back to standings
      </Link>

      <div className="lms-head">
        <p className={styles.kicker} data-nums>
          Game week {summary.gameWeek}
        </p>
        <h1 className={styles.title}>Where the picks went</h1>
        <p className="lms-head__hint">
          {summary.totalPicks === 0
            ? "Picks stay secret until the week’s deadline — check back once it kicks off."
            : `Where all ${summary.totalPicks} Week ${summary.gameWeek} ${
                summary.totalPicks === 1 ? "pick" : "picks"
              } went. One team each, no repeats. The open week’s picks stay secret until the deadline.`}
        </p>
      </div>

      {summary.teams.length > 0 && (
        <ol className={styles.list}>
          {summary.teams.map((t, i) => (
            <li key={t.teamApiId} className={styles.row}>
              <span className={styles.pos} data-nums aria-hidden="true">
                {i + 1}
              </span>
              <TeamCrest crest={t.crest} tla={t.tla} />
              <span className={styles.name}>{t.shortName || t.name}</span>
              <span className={styles.bar} aria-hidden="true">
                <span
                  className={styles.fill}
                  style={{ width: `${Math.max(6, (t.count / max) * 100)}%` }}
                />
              </span>
              <span className={styles.count} data-nums>
                {t.count}
                <span className={styles.share}>
                  {summary.totalPicks > 0
                    ? ` · ${Math.round((t.count / summary.totalPicks) * 100)}%`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
