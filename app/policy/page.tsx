import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";
// Shared with /delete-account — the two legal pages are the same shape.
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Last Man Standing collects, uses, and protects your personal data.",
  alternates: { canonical: "/policy" },
};

const LAST_UPDATED = "5 August 2026";

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

export default function PolicyPage() {
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
          <p className={styles.kicker} data-nums>
            Last updated {LAST_UPDATED}
          </p>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.lede}>
            Last Man Standing is a free Premier League survival game. This policy explains what
            personal data we collect, why we collect it, and the choices you have. We keep it short
            and only collect what we need to run the game.
          </p>
        </div>

        <Section id="who-we-are" title="Who we are">
          <p className={styles.p}>
            Last Man Standing (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs this game and is responsible
            for the personal data described here. If you have any questions, see the contact section
            at the end of this policy.
          </p>
        </Section>

        <Section id="what-we-collect" title="Information we collect">
          <p className={styles.p}>We only collect what you give us when you sign up and play:</p>
          <ul className={styles.list}>
            <li>
              <b>Your name</b>, so other players can see who they are up against on the standings.
            </li>
            <li>
              <b>Your email address</b>, used to confirm your account, sign you in, and send account
              emails such as password resets.
            </li>
            <li>
              <b>Your date of birth</b>, used only to confirm you are 13 or older and, if you are
              under 16, that a parent or guardian has given permission. We store the date you enter
              and, where it applies, that the permission was confirmed.
            </li>
            <li>
              <b>Your password</b>, which we never store in plain text. It is kept only as a secure
              one way hash.
            </li>
            <li>
              <b>Your gameplay</b>, meaning the games you join, the teams you pick each week, your
              wildcard use, and whether you are still in or knocked out.
            </li>
          </ul>
          <p className={styles.p}>
            We do not collect payment details, because the game is free to play. We do not use
            advertising trackers. We use Google Analytics to understand how the game is used —
            see the cookies section below.
          </p>
        </Section>

        <Section id="how-we-use" title="How we use your information">
          <p className={styles.p}>We use your data to:</p>
          <ul className={styles.list}>
            <li>Create and secure your account and sign you in.</li>
            <li>Run the game, record your picks, and show the standings.</li>
            <li>Confirm you are old enough to play (13 or older).</li>
            <li>
              Send you essential account emails, such as email confirmation and password resets. We
              do not send marketing email.
            </li>
          </ul>
        </Section>

        <Section id="cookies" title="Cookies">
          <p className={styles.p}>
            We use a single essential cookie to keep you signed in while you play. It is not used
            for advertising or tracking, and the game will not work without it.
          </p>
          <p className={styles.p}>
            We also use Google Analytics, which sets its own cookies to measure how the game is
            used (pages visited, general location, device type). This helps us understand and
            improve the game. If you would rather not be included, you can block these cookies in
            your browser settings or use Google&rsquo;s{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Analytics opt-out browser add-on
            </a>
            . We do not use advertising cookies.
          </p>
        </Section>

        <Section id="sharing" title="Who we share data with">
          <p className={styles.p}>
            We do not sell your personal data. We share it only with the service providers that make
            the game work, and only so they can provide that service to us:
          </p>
          <ul className={styles.list}>
            <li>
              <b>Our database host</b>, which stores your account and gameplay data.
            </li>
            <li>
              <b>Our email provider</b>, which delivers your account confirmation and password reset
              emails.
            </li>
          </ul>
          <p className={styles.p}>
            Match fixtures, results and club crests shown in the game come from{" "}
            <a
              href="https://www.football-data.org/"
              className={styles.link}
              rel="noreferrer"
              target="_blank"
            >
              football-data.org
            </a>
            . We only receive data from them. We do not send them any of your personal data.
          </p>
          <p className={styles.p}>
            We may also disclose data if the law requires it, or to protect the safety and rights of
            our players.
          </p>
        </Section>

        <Section id="retention" title="How long we keep it">
          <p className={styles.p}>
            We keep your account data for as long as your account is active. Email confirmation and
            password reset links are short lived and expire automatically.
          </p>
          <p className={styles.p}>
            You can delete your account yourself at any time, in the app or on this site — see{" "}
            <Link href="/delete-account">how to delete your account</Link>. When you do, your
            personal data goes immediately, and the only copies left are the routine database
            backups our host takes, which roll over within 30 days.
          </p>
        </Section>

        <Section id="security" title="How we protect your data">
          <p className={styles.p}>
            Passwords are stored only as secure one way hashes, never in plain text. We use industry
            standard measures to protect your data, but no online service can promise perfect
            security. Please use a strong, unique password and keep it private.
          </p>
        </Section>

        <Section id="your-rights" title="Your rights">
          <p className={styles.p}>
            <b>Deleting your account</b> you can do yourself, without asking us —{" "}
            <Link href="/delete-account">here is how</Link>. You can change your name in Settings at
            any time too.
          </p>
          <p className={styles.p}>You can also ask us to:</p>
          <ul className={styles.list}>
            <li>See the personal data we hold about you.</li>
            <li>Correct anything that is wrong.</li>
            <li>Send you a copy of your data, or restrict what we do with it.</li>
          </ul>
          <p className={styles.p}>
            To make a request, get in touch using the contact details at the end of this policy.
            Depending on where you live, you may also have the right to complain to your local data
            protection authority.
          </p>
        </Section>

        <Section id="children" title="Children">
          <p className={styles.p}>
            The game is for players aged 13 and over, and players under 16 must confirm that a
            parent or guardian has given them permission before they can sign up. We do not
            knowingly collect data from anyone under 13. If you are a parent or guardian and want
            your child&rsquo;s account removed, or you believe a child under 13 has signed up,
            contact us and we will remove the account.
          </p>
        </Section>

        <Section id="changes" title="Changes to this policy">
          <p className={styles.p}>
            We may update this policy from time to time. When we do, we will change the date at the
            top of this page. If the changes are significant, we will let you know.
          </p>
        </Section>

        <Section id="contact" title="Contact us">
          <p className={styles.p}>
            Questions about your privacy or this policy? Email us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.link}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footLinks}>
          <Link href="/">Home</Link>
          <Link href="/signup">Sign up</Link>
          <Link href="/login">Log in</Link>
        </span>
        <span className={styles.copy} data-nums>
          © 2026 Last Man Standing
        </span>
      </footer>
    </div>
  );
}
