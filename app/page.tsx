import Link from "next/link";
import styles from "./page.module.css";

const CRESTS: { code: string; color: string }[] = [
  { code: "ARS", color: "oklch(55% 0.2 25)" },
  { code: "AVL", color: "oklch(38% 0.12 15)" },
  { code: "CHE", color: "oklch(48% 0.17 260)" },
  { code: "LIV", color: "oklch(52% 0.19 22)" },
  { code: "MCI", color: "oklch(52% 0.12 235)" },
  { code: "MUN", color: "oklch(54% 0.2 28)" },
  { code: "NEW", color: "oklch(32% 0.01 0)" },
  { code: "TOT", color: "oklch(48% 0.07 265)" },
  { code: "BHA", color: "oklch(52% 0.16 245)" },
  { code: "WHU", color: "oklch(40% 0.12 20)" },
];

const STEPS = [
  { n: "01", title: "Pick a team", body: "Each game week, choose one Premier League team you think will win." },
  { n: "02", title: "Survive", body: "If they win, you’re through. If they draw or lose, you’re out." },
  { n: "03", title: "Never repeat", body: "You can only use each team once — spend your big guns wisely." },
  { n: "04", title: "Last one wins", body: "When a single player is left standing, they win the whole game." },
];

const RULES = [
  { k: "Wildcard", v: "One per game. Play it on a tough week to stay safe without picking." },
  { k: "Postponed?", v: "If your team’s match is called off, you’re safe and go through." },
  { k: "All out?", v: "If everyone falls in the same week, nobody wins — a new game begins." },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* N7 brutal-slab nav */}
      <header className={styles.nav}>
        <span className={styles.wordmark}>Last Man Standing</span>
        <nav className={styles.navLinks} aria-label="Primary">
          <a href="#how" className={styles.navLink}>
            How it works
          </a>
          <Link href="/login" className={styles.navLink}>
            Log in
          </Link>
          <Link href="/signup" className="lms-btn lms-btn--primary lms-btn--sm">
            Sign up
          </Link>
        </nav>
      </header>

      {/* Marquee hero */}
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 className={styles.title}>
            One team. One week.
            <br />
            <span className={styles.accent}>Last one standing.</span>
          </h1>
          <p className={styles.lede}>
            The Premier League survival game. Pick a team to win each week. Keep surviving.
            Be the last player left and take the crown.
          </p>
          <div className={styles.heroCta}>
            <Link href="/signup" className="lms-btn lms-btn--primary">
              Create your account
            </Link>
            <Link href="/login" className="lms-btn lms-btn--ghost">
              Log in
            </Link>
          </div>
          <p className={styles.free}>
            Free to play &middot; 16+ &middot; no stakes, just bragging rights
          </p>
        </div>

        <div className={styles.marquee} aria-hidden="true">
          <div className={styles.track}>
            {[...CRESTS, ...CRESTS].map((c, i) => (
              <span key={i} className="lms-crest lms-crest--lg" style={{ background: c.color }}>
                {c.code}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.how} id="how">
        <div className="lms-head">
          <h2 className={styles.h2}>How it works</h2>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li key={s.n} className={styles.step}>
              <span className={styles.stepN} data-nums aria-hidden="true">
                {s.n}
              </span>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Rules strip */}
      <section className={styles.rules}>
        {RULES.map((r) => (
          <div key={r.k} className={styles.rule}>
            <h3 className={styles.ruleK}>{r.k}</h3>
            <p className={styles.ruleV}>{r.v}</p>
          </div>
        ))}
      </section>

      {/* CTA band */}
      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>Think you can outlast everyone?</h2>
        <Link href="/signup" className="lms-btn lms-btn--primary">
          Create your account
        </Link>
      </section>

      {/* Ft8 marquee footer */}
      <footer className={styles.footer}>
        <div className={styles.footMarquee} aria-hidden="true">
          <div className={styles.footTrack}>
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className={styles.footTag}>
                Last Man Standing <span className={styles.footDot}>&middot;</span>
              </span>
            ))}
          </div>
        </div>
        <div className={styles.footBar}>
          <span className={styles.footLinks}>
            <Link href="/signup">Sign up</Link>
            <Link href="/login">Log in</Link>
          </span>
          <span className={styles.copy} data-nums>
            © 2026 Last Man Standing
          </span>
        </div>
      </footer>
    </div>
  );
}
