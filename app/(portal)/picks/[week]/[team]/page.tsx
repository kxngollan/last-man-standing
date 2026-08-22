import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { StateShell } from "@/components/portal/StateShell";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { PickRoster } from "@/components/portal/PickRoster";
import { ResultMark } from "@/components/ui/ResultMark";
import { getPickSummary } from "@/lib/game/queries";
import { loadTeamByTla } from "@/lib/game/teams";
import { teamWeekMeta } from "@/lib/game/pickMeta";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Who picked this team",
};

// One week, one team — read live off the fixtures.
export const dynamic = "force-dynamic";

/**
 * Everyone who backed one team in one game week, split into who went through
 * and who went out. The boards only show the first few names per line; this is
 * where the rest of them live.
 */
export default async function TeamWeekPicksPage({
  params,
}: {
  params: Promise<{ week: string; team: string }>;
}) {
  const session = await auth();
  const { week: weekParam, team: teamParam } = await params;
  if (!session?.user?.id) {
    redirect(`/login?next=/picks/${weekParam}/${teamParam}`);
  }

  const gameWeek = Number(weekParam);
  if (!Number.isInteger(gameWeek) || gameWeek < 1) redirect("/picks");

  const tla = teamParam.toUpperCase();
  const [summary, team] = await Promise.all([
    // No `playersPerTeam` cap: the whole point of this page is the full list.
    getPickSummary({ gameWeek, withState: true }),
    loadTeamByTla(tla),
  ]);
  if (!team) notFound();

  const row = summary?.teams.find((t) => t.tla === tla);
  const back = summary ? `/picks?week=${summary.gameWeek}` : "/picks";

  if (!summary || !row) {
    return (
      <StateShell className={styles.main}>
        <TeamCrest crest={team.crest} tla={team.tla} size="lg" />
        <h1 className="lms-state__title">Nobody picked {team.name}</h1>
        <p className="lms-state__body">
          {summary
            ? `No player has ${team.name} for Week ${summary.gameWeek}.`
            : "There’s no game on right now, so no picks to show."}
        </p>
        <Link href={back} className="lms-btn lms-btn--primary">
          Back to the week’s picks
        </Link>
      </StateShell>
    );
  }

  const meta = teamWeekMeta(row.counts, row.count, summary.state);
  const share =
    summary.totalPicks > 0 ? Math.round((row.count / summary.totalPicks) * 100) : 0;

  return (
    <main className={styles.main}>
      <Link href={back} className={styles.back}>
        &lsaquo; Back to Week {summary.gameWeek} picks
      </Link>

      <header className={styles.head} data-tone={meta.tone}>
        <TeamCrest crest={row.crest} tla={row.tla} size="lg" />
        <div className={styles.headMain}>
          <p className={styles.kicker} data-nums>
            Game week {summary.gameWeek} &middot;{" "}
            {summary.state === "in-play"
              ? "being played"
              : summary.state === "played"
                ? "already played"
                : "open for picks"}
          </p>
          <h1 className={styles.title}>{row.name}</h1>
          <p className={styles.summary}>
            {meta.detail}
            {" — "}
            {row.count} of the week&rsquo;s {summary.totalPicks}{" "}
            {summary.totalPicks === 1 ? "pick" : "picks"} ({share}%).
            {row.wildcards > 0 &&
              ` ${row.wildcards} ${
                row.wildcards === 1 ? "player" : "players"
              } played a wildcard on it.`}
          </p>
        </div>
        {meta.mark && (
          <span className={styles.disc}>
            <ResultMark kind={meta.mark} size={16} label={meta.detail} />
          </span>
        )}
      </header>

      <section className={`lms-panel ${styles.panel}`} aria-label="Players on this team">
        <PickRoster roster={row.roster ?? []} counts={row.counts} full />
      </section>

      <p className={styles.footnote}>
        Everyone sees this board — one team each per game, no repeats. A wildcard turns a draw into a
        pass, which is why a drawn team can put some players through and knock others out.
      </p>
    </main>
  );
}
