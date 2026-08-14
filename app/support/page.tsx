import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";
// Shared with /policy and /delete-account — the public non-app pages are one shape.
import styles from "../legal.module.css";

/**
 * The Support URL for both store listings.
 *
 * Apple requires one on every listing and Google requires a support contact,
 * and both want a page a person can open in a browser without installing
 * anything or signing in — which rules out pointing them at a screen inside the
 * app. It has to answer "how do I get help" for someone who is locked out,
 * because that is the person who needs it.
 *
 * /help and /contact redirect here (next.config.ts) rather than being pages of
 * their own: three URLs that say the same thing is three that can drift, and
 * people guess all three.
 */
export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with Last Man Standing — report a problem, recover your account, or contact us.",
  alternates: { canonical: "/support" },
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

export default function SupportPage() {
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
          <p className={styles.kicker}>Help</p>
          <h1 className={styles.title}>Support</h1>
          <p className={styles.lede}>
            Something broken, a result that looks wrong, or a name on the board that
            shouldn&rsquo;t be there — here is how to reach us, and the quickest fixes for the
            things that go wrong most.
          </p>
        </div>

        <Section id="contact" title="Contact us">
          <p className={styles.p}>
            Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.link}>
              {SUPPORT_EMAIL}
            </a>
            . We read every message and aim to reply within two working days. If you are writing
            about an account you cannot get into, send it from the address you signed up with —
            it is how we know the account is yours.
          </p>
        </Section>

        <Section id="report" title="Report a problem from inside the app">
          <p className={styles.p}>
            Signed in, the fastest route is <strong>Menu &rarr; Report an issue</strong> on the
            phone, or the same option in the account menu on the site. It reaches us with your
            account attached, so there is nothing to explain twice. Use it for bugs, a result
            that resolved wrongly, or another player&rsquo;s name.
          </p>
        </Section>

        <Section id="names" title="A player’s name">
          <p className={styles.p}>
            Players choose the name other players see. If one is offensive or impersonates
            somebody, report it — <strong>Report an issue &rarr; Player&rsquo;s name</strong> — or
            email us. We look at every report, and a name that breaks the{" "}
            <Link href="/policy">rules</Link> gets changed or the account removed.
          </p>
        </Section>

        <Section id="account" title="Common account problems">
          <ul className={styles.list}>
            <li>
              <strong>Forgotten password.</strong> <Link href="/forgot">Reset it here</Link> — the
              link arrives by email and lasts an hour.
            </li>
            <li>
              <strong>Never got the verification email.</strong> Check spam first, then{" "}
              <Link href="/resend">ask for another</Link>. An unverified account cannot sign in.
            </li>
            <li>
              <strong>Locked out entirely.</strong> Email us from the address you signed up with
              and we will sort it by hand.
            </li>
            <li>
              <strong>Want your account gone.</strong> Settings, on the phone or the site — or see{" "}
              <Link href="/delete-account">deleting your account</Link>.
            </li>
          </ul>
        </Section>

        <Section id="game" title="How the game works">
          <p className={styles.p}>
            Pick one team a week; if they win you go through, and a draw or a loss knocks you out.
            Each team can only be used once per game. The full rules are on the rules screen in the
            app, including the deadline and how the wildcard works. The game is free, has no
            stakes, and there is nothing to buy.
          </p>
        </Section>

        <Section id="privacy" title="Your data">
          <p className={styles.p}>
            Our <Link href="/policy">privacy policy</Link> sets out what we hold and why, and{" "}
            <Link href="/delete-account">deleting your account</Link> explains how to get rid of
            it. Fixtures and results come from football-data.org.
          </p>
        </Section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footLinks}>
          <Link href="/">Home</Link>
          <Link href="/policy">Privacy</Link>
          <Link href="/delete-account">Delete account</Link>
          <Link href="/login">Log in</Link>
        </span>
      </footer>
    </div>
  );
}
