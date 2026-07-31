import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Privacy Policy · Last Man Standing",
  description: "How Last Man Standing collects, uses, and protects your personal data.",
};

const LAST_UPDATED = "31 July 2026";

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
              <b>Your date of birth</b>, used only to confirm you are 16 or older. We store the date
              you enter.
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
            advertising or analytics trackers.
          </p>
        </Section>

        <Section id="how-we-use" title="How we use your information">
          <p className={styles.p}>We use your data to:</p>
          <ul className={styles.list}>
            <li>Create and secure your account and sign you in.</li>
            <li>Run the game, record your picks, and show the standings.</li>
            <li>Confirm you are old enough to play (16 or older).</li>
            <li>
              Send you essential account emails, such as email confirmation and password resets. We
              do not send marketing email.
            </li>
          </ul>
        </Section>

        <Section id="cookies" title="Cookies">
          <p className={styles.p}>
            We use a single essential cookie to keep you signed in while you play. It is not used for
            advertising or tracking, and the game will not work without it. We do not use third party
            advertising or analytics cookies.
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
            Match fixtures and results shown in the game come from a third party football data
            service. We only receive data from them. We do not send them any of your personal data.
          </p>
          <p className={styles.p}>
            We may also disclose data if the law requires it, or to protect the safety and rights of
            our players.
          </p>
        </Section>

        <Section id="retention" title="How long we keep it">
          <p className={styles.p}>
            We keep your account data for as long as your account is active. Email confirmation and
            password reset links are short lived and expire automatically. If you ask us to delete
            your account, we remove your personal data, keeping only what we are legally required to
            retain.
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
          <p className={styles.p}>You can ask us to:</p>
          <ul className={styles.list}>
            <li>See the personal data we hold about you.</li>
            <li>Correct anything that is wrong.</li>
            <li>Delete your account and personal data.</li>
          </ul>
          <p className={styles.p}>
            To make a request, please get in touch using the contact details at the end of this
            policy. Depending on where you live, you may also have the right to complain to your local
            data protection authority.
          </p>
        </Section>

        <Section id="children" title="Children">
          <p className={styles.p}>
            The game is for players aged 16 and over. We do not knowingly collect data from anyone
            under 16. If you believe a child has signed up, contact us and we will remove the account.
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
            Questions about your privacy or this policy? We are setting up a contact email and will
            add it here soon.
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
