import Link from "next/link";
import styles from "./AuthShell.module.css";

const POINTS = [
  "Pick one Premier League team to win each week.",
  "Win and you go through. Draw or lose and you’re out.",
  "Last player standing takes the crown.",
];

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrap}>
      <aside className={styles.brandPanel}>
        <Link href="/" className={styles.brand} aria-label="Last Man Standing — home">
          <svg className={styles.mark} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2 3 5.5v6c0 5 3.8 8.6 9 10.5 5.2-1.9 9-5.5 9-10.5v-6L12 2Z"
              fill="currentColor"
              opacity="0.2"
            />
            <path
              d="M12 2 3 5.5v6c0 5 3.8 8.6 9 10.5 5.2-1.9 9-5.5 9-10.5v-6L12 2Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="m8.5 12 2.4 2.4L15.8 9.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.name}>Last Man Standing</span>
        </Link>

        <p className={styles.tagline}>
          One team. One week.
          <br />
          Outlast everyone.
        </p>

        <ul className={styles.points}>
          {POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </aside>

      <main className={styles.formArea}>
        <div className={styles.formInner}>{children}</div>
      </main>
    </div>
  );
}
