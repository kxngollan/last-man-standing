"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import RulesModal from "./RulesModal";
import FeedbackModal, { type FeedbackModalHandle } from "./FeedbackModal";
import ReportIssueModal, { type ReportIssueModalHandle } from "./ReportIssueModal";
import ThemeToggle from "@/components/ui/ThemeToggle";
import styles from "./AppBar.module.css";

const NAV = [
  { href: "/dashboard", label: "Standings" },
  { href: "/make-selection", label: "Make pick" },
  { href: "/team", label: "My picks" },
  { href: "/table", label: "Table" },
  { href: "/fixtures", label: "Fixtures" },
];

// Table and fixtures are public — the only destinations shown signed-out.
const PUBLIC_NAV = NAV.filter((i) => i.href === "/table" || i.href === "/fixtures");

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((w) => w[0]).join("");
  return (letters || name[0] || "?").toUpperCase();
}

function AccountMenu({
  onFeedback,
  onReportIssue,
}: {
  onFeedback?: () => void;
  onReportIssue?: () => void;
}) {
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
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {initialsOf(name)}
      </button>

      {/* A plain disclosure of links/buttons — no ARIA menu roles, which
          would promise arrow-key navigation this doesn't implement. */}
      {open && (
        <div className={styles.menu} aria-label="Account">
          <div className={styles.menuHead}>
            {name && <span className={styles.menuName}>{name}</span>}
            {email && <span className={styles.menuEmail}>{email}</span>}
          </div>
          {session?.user?.isAdmin && (
            <Link
              href="/admin"
              className={styles.menuLink}
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            className={styles.feedbackItem}
            onClick={() => {
              setOpen(false);
              onReportIssue?.();
            }}
          >
            Report an issue
          </button>
          <button
            type="button"
            className={styles.feedbackItem}
            onClick={() => {
              setOpen(false);
              onFeedback?.();
            }}
          >
            Give feedback
          </button>
          <button
            type="button"
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
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const isGuest = status === "unauthenticated";
  const nav = isAuthed ? NAV : PUBLIC_NAV;
  const feedbackRef = useRef<FeedbackModalHandle>(null);
  const issueRef = useRef<ReportIssueModalHandle>(null);

  return (
    <>
      <header className={styles.bar}>
        <Link
          href={isAuthed ? "/dashboard" : "/"}
          className={styles.brand}
          aria-label="Last Man Standing home"
        >
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
          {nav.map((item) => {
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

        {isAuthed ? (
          <span className={`lms-chip lms-chip--safe ${styles.status}`}>
            <span className="lms-dot" aria-hidden="true" />
            Still in
          </span>
        ) : (
          // Keeps the right-hand cluster right-aligned when the status chip
          // (which normally carries the auto margin) isn't rendered.
          <span className={styles.spacer} aria-hidden="true" />
        )}
        <ThemeToggle />
        <RulesModal />
        {isAuthed && (
          <AccountMenu
            onFeedback={() => feedbackRef.current?.open()}
            onReportIssue={() => issueRef.current?.open()}
          />
        )}
        {/* Render nothing visible until prompted (or opened from the menu). */}
        {isAuthed && <FeedbackModal ref={feedbackRef} />}
        {isAuthed && <ReportIssueModal ref={issueRef} />}
        {isGuest && (
          <span className={styles.guestActions}>
            <Link href="/login" className={styles.link}>
              Log in
            </Link>
            <Link href="/signup" className="lms-btn lms-btn--primary lms-btn--sm">
              Sign up
            </Link>
          </span>
        )}
      </header>

      <nav className={styles.mobileNav} aria-label="Primary (mobile)">
        {nav.map((item) => {
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
