import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ShareLink from "@/app/(portal)/profile/ShareLink";
import { ensureReferralHandle, getReferralBoard, referralCount } from "@/lib/referral";
import { SITE_URL } from "@/lib/site";
import styles from "./referrals.module.css";

export const metadata: Metadata = {
  title: "Referrals",
};

export default async function ReferralsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/referrals");

  const [handle, invited, board] = await Promise.all([
    ensureReferralHandle(session.user.id),
    referralCount(session.user.id),
    getReferralBoard(session.user.id),
  ]);
  const host = SITE_URL.replace(/^https?:\/\//, "");

  return (
    <main className={styles.main}>
      <div className="lms-head">
        <p className={styles.kicker}>Referrals</p>
        <h1 className={styles.title}>Bring people in</h1>
        <p className="lms-head__hint">
          Every player who signs up through your link and confirms their email counts as yours.
        </p>
      </div>

      <section className={`lms-panel ${styles.mine}`} aria-label="Your link">
        <div>
          <p className={styles.mineLabel}>Your link</p>
          <code className={styles.link}>
            {host}/r/{handle}
          </code>
        </div>
        <div className={styles.mineStat}>
          <span className="lms-stat__num" data-nums>
            {invited}
          </span>
          <span className="lms-stat__label">{invited === 1 ? "player" : "players"} brought in</span>
        </div>
        <ShareLink path={`/r/${handle}`} label="Copy link" copiedLabel="Copied" />
      </section>

      <section aria-label="Leaderboard">
        <div className="lms-head">
          <h2 className="lms-head__title">Leaderboard</h2>
          <p className="lms-head__hint">
            Most players brought in. You can take yourself off this board in{" "}
            <Link href="/settings">settings</Link>.
          </p>
        </div>

        {board.length === 0 ? (
          <p className={styles.notice}>
            Nobody has referred anyone yet. Be the first — your link is right up there.
          </p>
        ) : (
          <ol className={styles.board}>
            {board.map((row) => (
              <li key={`${row.rank}-${row.name}`} className={styles.row} data-you={row.you}>
                <span className={styles.rank} data-nums aria-hidden="true">
                  {row.rank}
                </span>
                <span className={styles.name}>
                  {row.name}
                  {row.you && <span className={styles.youTag}>you</span>}
                </span>
                <span className={styles.count} data-nums>
                  {row.count}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
