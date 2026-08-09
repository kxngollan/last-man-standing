import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { nameParts } from "@/lib/displayName";
import { fullDate, monthYear } from "@/lib/format";
import { ensureReferralHandle, referralCount } from "@/lib/referral";
import { SITE_URL } from "@/lib/site";
import SettingsForms from "./SettingsForms";
import ReferralSettings from "./ReferralSettings";
import styles from "./settings.module.css";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings");

  await connectDB();
  const user = await User.findById(session.user.id)
    .select("name firstName lastName email dob createdAt hideFromReferralBoard")
    .lean();
  // The session outlived the account — nothing to settle here.
  if (!user) redirect("/login?next=/settings");

  const { first, last } = nameParts(user);
  const [handle, invited] = await Promise.all([
    ensureReferralHandle(session.user.id),
    referralCount(session.user.id),
  ]);

  return (
    <main className={styles.main}>
      <div className="lms-head">
        <p className={styles.kicker}>Account</p>
        <h1 className={styles.title}>Settings</h1>
        <p className="lms-head__hint">
          Your name and password. See how you look to other players on{" "}
          <Link href="/profile">your profile</Link>.
        </p>
      </div>

      <SettingsForms firstName={first} lastName={last} email={user.email} />

      <section className={styles.block} aria-labelledby="referral-heading">
        <div className="lms-head">
          <h2 className="lms-head__title" id="referral-heading">
            Refer a friend
          </h2>
          <p className="lms-head__hint">
            Share this link and anyone who signs up through it counts as yours — once they
            confirm their email.{" "}
            {invited > 0 ? (
              <>
                You&rsquo;ve brought in <span className={styles.count}>{invited}</span>{" "}
                {invited === 1 ? "player" : "players"} so far. See the{" "}
                <Link href="/referrals">leaderboard</Link>.
              </>
            ) : (
              <>
                Nobody yet. See the <Link href="/referrals">leaderboard</Link>.
              </>
            )}
          </p>
        </div>
        <ReferralSettings
          handle={handle}
          siteHost={SITE_URL.replace(/^https?:\/\//, "")}
          hideFromBoard={user.hideFromReferralBoard === true}
        />
      </section>

      <section className={styles.block} aria-labelledby="details-heading">
        <div className="lms-head">
          <h2 className="lms-head__title" id="details-heading">
            Account details
          </h2>
          <p className="lms-head__hint">
            These can&rsquo;t be changed here. Ask through{" "}
            <span className={styles.quiet}>Report an issue</span> in the account menu if one is
            wrong.
          </p>
        </div>
        <dl className={styles.details}>
          <div className={styles.detail}>
            <dt className={styles.detailKey}>Email</dt>
            <dd className={styles.detailVal}>{user.email}</dd>
          </div>
          <div className={styles.detail}>
            <dt className={styles.detailKey}>Date of birth</dt>
            <dd className={styles.detailVal} data-nums>
              {fullDate(new Date(user.dob).toISOString())}
            </dd>
          </div>
          <div className={styles.detail}>
            <dt className={styles.detailKey}>Member since</dt>
            <dd className={styles.detailVal} data-nums>
              {monthYear(new Date(user.createdAt).toISOString())}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
