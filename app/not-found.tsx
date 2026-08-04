import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className={styles.main}>
      <p className={styles.kicker} data-nums>
        Full-time &middot; error 404
      </p>
      <h1 className={styles.title}>Offside.</h1>
      <p className={styles.body}>
        That page isn&rsquo;t on the pitch. It might have been knocked out, or it never made the
        squad in the first place.
      </p>
      <figure className={styles.snapshot}>
        <Image
          className={styles.snapshotImg}
          src="/images/confused-henry.jpeg"
          width={247}
          height={204}
          alt="Thierry Henry pitchside, looking confused"
          priority
        />
        <figcaption className={styles.caption}>Confused? So is Thierry.</figcaption>
      </figure>
      <div className={styles.actions}>
        <Link href="/" className="lms-btn lms-btn--primary">
          Back to home
        </Link>
        <Link href="/dashboard" className="lms-btn lms-btn--ghost">
          Go to my dashboard
        </Link>
      </div>
    </main>
  );
}
