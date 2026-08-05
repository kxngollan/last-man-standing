"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import RulesModal from "./RulesModal";
import ThemeToggle from "@/components/ui/ThemeToggle";
import styles from "./AppBar.module.css";

const NAV = [
  { href: "/dashboard", label: "Standings" },
  { href: "/make-selection", label: "Make pick" },
  { href: "/team", label: "My picks" },
  { href: "/table", label: "Table" },
  { href: "/fixtures", label: "Fixtures" },
];

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((w) => w[0]).join("");
  return (letters || name[0] || "?").toUpperCase();
}

function AccountMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = session?.user?.name ?? null;
  const email = session?.user?.email ?? null;

  return (
    <div className={styles.account} ref={ref}>
      <button
        className={styles.avatar}
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {initialsOf(name)}
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Account">
          <div className={styles.menuHead}>
            {name && <span className={styles.menuName}>{name}</span>}
            {email && <span className={styles.menuEmail}>{email}</span>}
          </div>
          {session?.user?.isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              className={styles.menuLink}
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className={styles.logout}
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut({ callbackUrl: "/login" });
            }}
          >
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppBar() {
  const pathname = usePathname();

  return (
    <>
      <header className={styles.bar}>
        <Link href="/dashboard" className={styles.brand} aria-label="Last Man Standing home">
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
        <ThemeToggle />
        <RulesModal />
        <AccountMenu />
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
