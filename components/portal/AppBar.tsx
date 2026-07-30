"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppBar.module.css";

const NAV = [
  { href: "/dashboard", label: "Standings" },
  { href: "/make-selection", label: "Make pick" },
  { href: "/team", label: "My picks" },
];

export default function AppBar() {
  const pathname = usePathname();

  return (
    <>
    <header className={styles.bar}>
      <Link href="/dashboard" className={styles.brand} aria-label="Last Man Standing — home">
        <svg className={styles.mark} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2 3 5.5v6c0 5 3.8 8.6 9 10.5 5.2-1.9 9-5.5 9-10.5v-6L12 2Z"
            fill="currentColor"
            opacity="0.16"
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

      <nav className={styles.nav} aria-label="Primary">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={styles.link}
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <span className={`lms-chip lms-chip--safe ${styles.status}`}>
        <span className="lms-dot" aria-hidden="true" />
        Still in
      </span>
      <button className={styles.avatar} type="button" aria-label="Your account">
        AM
      </button>
    </header>

      <nav className={styles.mobileNav} aria-label="Primary (mobile)">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={styles.link}
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
