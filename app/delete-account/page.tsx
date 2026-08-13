import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";
// Shared with /policy — the two legal pages are the same shape.
import styles from "../legal.module.css";

/**
 * How to delete your account, spelled out on a public page.
 *
 * Google Play's data deletion policy asks for a URL where anyone can find out
 * how to delete their account and the data behind it, reachable in a browser
 * without installing the app and without signing in — which is why this page
 * explains the route rather than being the route. The deletion itself happens in
 * Settings, on the phone or on the site.
 *
 * This URL is what goes in the Play Console Data safety form.
 */
export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "How to delete your Last Man Standing account and the personal data held with it.",
  alternates: { canonical: "/delete-account" },
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.h2}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DeleteAccountPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.wordmark}>
          Last Man Standing
        </Link>
        <Link href="/" className={styles.navLink}>
          Home
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.head}>
          <p className={styles.kicker}>Your data</p>
          <h1 className={styles.title}>Delete your account</h1>
          <p className={styles.lede}>
            You can delete your Last Man Standing account yourself, whenever you like, from either
            the phone app or the website. It takes effect immediately and cannot be undone.
          </p>
        </div>

        <Section id="in-the-app" title="In the app">
          <p className={styles.p}>
            Open the menu, go to <b>Settings</b>, scroll to <b>Delete account</b>, type DELETE to
            confirm, and tap <b>Delete my account</b>. You will be signed out on every device.
          </p>
        </Section>

        <Section id="on-the-website" title="On the website">
          <p className={styles.p}>
            <Link href="/login?next=/settings" className={styles.link}>
              Log in
            </Link>{" "}
            and go to <b>Settings</b>. The <b>Delete account</b> section is at the bottom of the
            page. Type DELETE to confirm, then choose <b>Delete my account</b>.
          </p>
        </Section>

        <Section id="what-is-deleted" title="What gets deleted">
          <p className={styles.p}>Everything we hold that is about you, straight away:</p>
          <ul className={styles.list}>
            <li>
              <b>Your account</b> — your name, email address and date of birth.
            </li>
            <li>
              <b>Your play</b> — every pick you have made and every game you have entered.
            </li>
            <li>
              <b>Your referrals</b> — your invite link, and the record of who invited you.
            </li>
            <li>
              <b>Anything you sent us</b> — feedback and issue reports.
            </li>
            <li>
              <b>Your sign-in</b> — password, and any Google or Apple sign-in linked to the account.
            </li>
          </ul>
        </Section>

        <Section id="what-remains" title="What stays behind">
          <p className={styles.p}>
            Games that have already been played stay on the standings, because they are every other
            player&rsquo;s history too — but without you in them. Nothing left behind names you or
            points back to you.
          </p>
          <p className={styles.p}>
            We keep no backup copy of a deleted account beyond the routine database backups our
            host takes, which roll over on their own within 30 days.
          </p>
        </Section>

        <Section id="cant-sign-in" title="If you cannot sign in">
          <p className={styles.p}>
            Forgotten your password? <Link href="/forgot">Reset it</Link> and then follow the steps
            above. If you cannot get into the account at all, email us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.link}>
              {SUPPORT_EMAIL}
            </a>{" "}
            from the address you signed up with and we will delete it for you.
          </p>
        </Section>

        <Section id="more" title="More on what we hold">
          <p className={styles.p}>
            Our <Link href="/policy">privacy policy</Link> sets out everything we collect, why we
            collect it, and the rest of your rights over it.
          </p>
        </Section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footLinks}>
          <Link href="/">Home</Link>
          <Link href="/policy">Privacy</Link>
          <Link href="/login">Log in</Link>
        </span>
        <span className={styles.copy} data-nums>
          © 2026 Last Man Standing
        </span>
      </footer>
    </div>
  );
}
