import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import AppBar from "@/components/portal/AppBar";
import { connectDB } from "@/database/connect";
import { Team } from "@/models/Team";
import { TeamCrest } from "@/components/portal/TeamCrest";
import { PitchPlanArt, GoalArt } from "@/components/ui/FootballArt";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_FAQS } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} · Free Premier League Survival Game` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

// Structured data for search engines: what the site is, plus an FAQ built from
// the game's own rules (eligible for FAQ rich results).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en-GB",
    },
    {
      "@type": "VideoGame",
      "@id": `${SITE_URL}/#game`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      genre: ["Sports", "Prediction game"],
      gamePlatform: "Web browser",
      applicationCategory: "Game",
      inLanguage: "en-GB",
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      // Built from the same constant as the visible FAQ section below, so
      // the structured data can never drift from the on-page content.
      mainEntity: SITE_FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

// Curated fallback used for the hero marquee when the crest images can't be
// loaded (e.g. no teams seeded yet, or DB unavailable at render time).
const FALLBACK_CRESTS: { tla: string; color: string }[] = [
  { tla: "ARS", color: "oklch(55% 0.2 25)" },
  { tla: "AVL", color: "oklch(38% 0.12 15)" },
  { tla: "CHE", color: "oklch(48% 0.17 260)" },
  { tla: "LIV", color: "oklch(52% 0.19 22)" },
  { tla: "MCI", color: "oklch(52% 0.12 235)" },
  { tla: "MUN", color: "oklch(54% 0.2 28)" },
  { tla: "NEW", color: "oklch(32% 0.01 0)" },
  { tla: "TOT", color: "oklch(48% 0.07 265)" },
  { tla: "BHA", color: "oklch(52% 0.16 245)" },
  { tla: "WHU", color: "oklch(40% 0.12 20)" },
];

type MarqueeCrest = { tla: string; crest: string | null; color?: string };

/** Official team badges for the hero marquee, with a graceful letter fallback. */
async function marqueeCrests(): Promise<MarqueeCrest[]> {
  try {
    await connectDB();
    const teams = await Team.find({ crest: { $ne: null } })
      .select("tla crest")
      .lean();
    const withCrest = teams
      .filter((t) => t.crest)
      .map((t) => ({ tla: t.tla, crest: t.crest as string }));
    if (withCrest.length >= 6) return withCrest;
  } catch {
    // DB unavailable — fall through to the curated letter discs.
  }
  return FALLBACK_CRESTS.map((c) => ({ tla: c.tla, crest: null, color: c.color }));
}

const STEPS = [
  { n: "01", title: "Pick a team", body: "Each game week, choose one Premier League team you think will win." },
  { n: "02", title: "Survive", body: "If they win, you’re through. If they draw or lose, you’re out." },
  { n: "03", title: "Never repeat", body: "You can only use each team once, so spend your big guns wisely." },
  { n: "04", title: "Last one wins", body: "When a single player is left standing, they win the whole game." },
];

const RULES = [
  { k: "Wildcard", v: "One per game. Play it on a tough week to stay safe without picking." },
  { k: "Postponed?", v: "If your team’s match is called off, you’re safe and go through." },
  { k: "All out?", v: "If everyone falls in the same week, nobody wins and a new game begins." },
];

export default async function LandingPage() {
  const [session, crests] = await Promise.all([auth(), marqueeCrests()]);
  const isLoggedIn = !!session?.user;
  return (
    <div className={styles.page}>
      {/* Team crests in the hero marquee load from this host — warm the connection early. */}
      <link rel="preconnect" href="https://crests.football-data.org" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* Signed in → the app's nav bar; signed out → N7 brutal-slab marketing nav */}
      {isLoggedIn ? (
        <AppBar />
      ) : (
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
      )}

      {/* Marquee hero — half-pitch plan as a faint backdrop, biased right */}
      <section className={styles.hero}>
        <PitchPlanArt className={styles.heroPitch} />
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
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" className="lms-btn lms-btn--primary">
                  Go to my dashboard
                </Link>
                <Link href="/make-selection" className="lms-btn lms-btn--ghost">
                  Make this week&rsquo;s pick
                </Link>
              </>
            ) : (
              <>
                <Link href="/signup" className="lms-btn lms-btn--primary">
                  Create your account
                </Link>
                <Link href="/login" className="lms-btn lms-btn--ghost">
                  Log in
                </Link>
              </>
            )}
          </div>
          <p className={styles.free}>
            Free to play &middot; 16+ &middot; no stakes, just bragging rights
          </p>
        </div>

        <div className={styles.marquee} aria-hidden="true">
          <div className={styles.track}>
            {[...crests, ...crests].map((c, i) => (
              <TeamCrest key={i} crest={c.crest} tla={c.tla} size="lg" fallbackColor={c.color} />
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

      {/* FAQ — same content as the FAQPage JSON-LD above (rich-result parity) */}
      <section className={styles.faq} id="faq" aria-labelledby="faq-title">
        <div className="lms-head">
          <h2 className={styles.h2} id="faq-title">
            Questions
          </h2>
        </div>
        <div className={styles.faqList}>
          {SITE_FAQS.map((f) => (
            <details key={f.q} className={styles.faqItem}>
              <summary className={styles.faqQ}>{f.q}</summary>
              <p className={styles.faqA}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className={styles.cta}>
        <GoalArt className={styles.ctaGoal} />
        <h2 className={styles.ctaTitle}>Think you can outlast everyone?</h2>
        {isLoggedIn ? (
          <Link href="/make-selection" className="lms-btn lms-btn--primary">
            Make this week&rsquo;s pick
          </Link>
        ) : (
          <Link href="/signup" className="lms-btn lms-btn--primary">
            Create your account
          </Link>
        )}
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
            {isLoggedIn ? (
              <>
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/team">My picks</Link>
              </>
            ) : (
              <>
                <Link href="/signup">Sign up</Link>
                <Link href="/login">Log in</Link>
              </>
            )}
            <Link href="/policy">Privacy</Link>
          </span>
          <span className={styles.copy} data-nums>
            © 2026 Last Man Standing
          </span>
        </div>
      </footer>
    </div>
  );
}
