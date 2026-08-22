import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { TeamCrest } from '@/components/portal/TeamCrest'
import { PickRoster } from '@/components/portal/PickRoster'
import { ResultMark } from '@/components/ui/ResultMark'
import { teamWeekMeta } from '@/lib/game/pickMeta'
import { StateShell } from '@/components/portal/StateShell'
import { WeekBar } from '@/components/portal/WeekBar'
import { getPickSummary, getWeekOptions } from '@/lib/game/queries'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: "This week's picks"
}

// The week being viewed lives in the URL, and the board moves with the games.
export const dynamic = 'force-dynamic'

export default async function PicksPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?next=/picks')

  const asked = Number((await searchParams).week)
  const [summary, weeks] = await Promise.all([
    getPickSummary({
      gameWeek: Number.isInteger(asked) && asked > 0 ? asked : undefined,
      withState: true,
      // Enough names to fill the three result lines; the rest are one click
      // away on the team's own page.
      playersPerTeam: 15
    }),
    // Just for the switcher: which weeks a player can look at right now.
    getWeekOptions().catch(() => [])
  ])

  if (!summary) {
    return (
      <StateShell className={styles.main}>
        <h1 className='lms-state__title'>No game running</h1>
        <p className='lms-state__body'>There’s no game on right now, so no picks to show.</p>
        <Link href='/dashboard' className='lms-btn lms-btn--primary'>
          Back to standings
        </Link>
      </StateShell>
    )
  }

  return (
    <main className={styles.main}>
      <Link href='/dashboard' className={styles.back}>
        &lsaquo; Back to standings
      </Link>

      <div className='lms-head'>
        <p className={styles.kicker} data-nums>
          Game week {summary.gameWeek} &middot;{' '}
          {summary.state === 'in-play'
            ? 'being played'
            : summary.state === 'played'
              ? 'already played'
              : 'open for picks'}
        </p>
        <h1 className={styles.title}>
          {summary.state === 'in-play'
            ? 'This week’s picks'
            : summary.state === 'played'
              ? `Week ${summary.gameWeek} picks`
              : 'Next week’s picks'}
        </h1>
        <p className='lms-head__hint'>
          {summary.totalPicks === 0
            ? 'Nobody has picked for this week yet — be the first.'
            : `Where all ${summary.totalPicks} ${
                summary.totalPicks === 1 ? 'pick' : 'picks'
              } for this week have gone, and who’s behind each one. Everyone sees this board — one team each, no repeats.`}
        </p>
        {summary.state !== 'open' ? (
          <p className='lms-head__hint'>
            {`${summary.counts.safe} through, ${summary.counts.out} out, ${summary.counts.pending} still to play.`}
          </p>
        ) : (
          <p className='lms-head__hint'>
            {`${summary.counts.safe} of these players are already through to this week; ${summary.counts.pending} are still playing for their place.`}
            {summary.excluded > 0 &&
              ` ${summary.excluded} pick${summary.excluded === 1 ? '' : 's'} from players already out ${
                summary.excluded === 1 ? 'isn’t' : 'aren’t'
              } shown.`}
          </p>
        )}
      </div>

      {/* One week at a time — these move between them. */}
      <WeekBar weeks={weeks} selected={summary.gameWeek} href={(w) => `/picks?week=${w}`} />

      {summary.teams.length > 0 && (
        <ol className={styles.list}>
          {summary.teams.map((t, i) => {
            const week = teamWeekMeta(t.counts, t.count, summary.state)
            return (
              <li key={t.teamApiId} className={styles.row} data-tone={week.tone}>
                {/* The row opens the team's week, where the full list lives. */}
                <Link href={`/picks/${summary.gameWeek}/${t.tla.toLowerCase()}`} className={styles.rowLink}>
                  <span className={styles.pos} data-nums aria-hidden='true'>
                    {i + 1}
                  </span>
                  <TeamCrest crest={t.crest} tla={t.tla} />
                  <span className={styles.name}>{t.shortName || t.name}</span>
                  {/* How the team's week went — the disc, then the tally. */}
                  <span className={styles.outcome}>
                    {week.mark && (
                      <span className={styles.disc}>
                        <ResultMark kind={week.mark} size={11} label={week.detail} />
                      </span>
                    )}
                    <span className={styles.tally} data-nums>
                      {week.label}
                    </span>
                    {t.wildcards > 0 && (
                      <span className={styles.wcCount} title={`${t.wildcards} played a wildcard on this team`}>
                        {t.wildcards} WC
                      </span>
                    )}
                  </span>
                  <span className={styles.count} data-nums>
                    {t.count}
                    <span className={styles.share}>
                      {summary.totalPicks > 0 ? ` · ${Math.round((t.count / summary.totalPicks) * 100)}%` : ''}
                    </span>
                  </span>
                  {/* Through on one line, out on the next — a full-width row of
                      its own, so the line above keeps its shape. */}
                  {t.players.length > 0 && (
                    <span className={styles.players}>
                      <PickRoster roster={t.roster ?? []} counts={t.counts} perLine={6} />
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </main>
  )
}
