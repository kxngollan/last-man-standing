"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AdminOverview, AdminUserRow } from "@/lib/game/portalTypes";
import styles from "./page.module.css";

type NameEdit = { firstName: string; lastName: string };

/** Player accounts — rename, verify/unverify. */
function PlayersPanel() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState<Record<string, NameEdit>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Failed to load players.");
      setUsers(body as AdminUserRow[]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(u: AdminUserRow, payload: Partial<NameEdit> & { emailVerified?: boolean }) {
    setBusy(u.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error ?? "Update failed.");
        return;
      }
      const row = body as AdminUserRow;
      setUsers((list) => (list ?? []).map((x) => (x.id === row.id ? row : x)));
      setEdits(({ [u.id]: _dropped, ...rest }) => rest);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={`lms-panel ${styles.users}`}>
      <h2 className={styles.panelTitle}>Players</h2>
      <p className={styles.panelHint}>
        Rename a player or verify their email by hand (e.g. when the confirmation email never
        arrived). Everyone sees players as first name + last initial.
      </p>

      {error && (
        <p className={styles.notice} role="alert" style={{ color: "var(--color-out-ink)" }}>
          {error}
        </p>
      )}

      {!users ? (
        <p className={styles.panelHint}>
          <span className="lms-spinner" aria-hidden="true" /> Loading players…
        </p>
      ) : users.length === 0 ? (
        <p className={styles.panelHint}>No accounts yet.</p>
      ) : (
        <ul className={styles.userRows}>
          {users.map((u) => {
            const edit = edits[u.id] ?? { firstName: u.firstName, lastName: u.lastName };
            const dirty = edit.firstName !== u.firstName || edit.lastName !== u.lastName;
            const rowBusy = busy === u.id;
            return (
              <li key={u.id} className={styles.userRow}>
                <span className={styles.userNames}>
                  <input
                    className={`lms-field__control ${styles.userInput}`}
                    aria-label={`First name for ${u.email}`}
                    value={edit.firstName}
                    onChange={(e) =>
                      setEdits((m) => ({ ...m, [u.id]: { ...edit, firstName: e.target.value } }))
                    }
                    disabled={rowBusy}
                  />
                  <input
                    className={`lms-field__control ${styles.userInput}`}
                    aria-label={`Last name for ${u.email}`}
                    value={edit.lastName}
                    onChange={(e) =>
                      setEdits((m) => ({ ...m, [u.id]: { ...edit, lastName: e.target.value } }))
                    }
                    disabled={rowBusy}
                  />
                </span>

                <span className={styles.userEmail} title={u.email}>
                  {u.email}
                </span>

                <span className={styles.userChips}>
                  {u.isAdmin && <span className="lms-chip lms-chip--mono">Admin</span>}
                  <span
                    className={`lms-chip ${u.emailVerified ? "lms-chip--safe" : "lms-chip--wild"}`}
                  >
                    {u.emailVerified ? "Verified" : "Unverified"}
                  </span>
                </span>

                <span className={styles.userActions}>
                  {dirty && (
                    <button
                      className="lms-btn lms-btn--primary lms-btn--sm"
                      disabled={
                        rowBusy || !edit.firstName.trim() || !edit.lastName.trim()
                      }
                      onClick={() =>
                        patch(u, {
                          firstName: edit.firstName.trim(),
                          lastName: edit.lastName.trim(),
                        })
                      }
                    >
                      {rowBusy ? "Saving…" : "Save name"}
                    </button>
                  )}
                  <button
                    className="lms-btn lms-btn--ghost lms-btn--sm"
                    disabled={rowBusy}
                    onClick={() => patch(u, { emailVerified: !u.emailVerified })}
                  >
                    {rowBusy ? "…" : u.emailVerified ? "Unverify" : "Verify"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [resolveMsg, setResolveMsg] = useState("");
  const [startWeek, setStartWeek] = useState("1");
  const [season, setSeason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to load.");
      setData(body as AdminOverview);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(key: string, url: string, payload?: unknown) {
    setBusy(key);
    setActionError("");
    setResolveMsg("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(body.detail ? `${body.error}: ${body.detail}` : body.error ?? "Action failed.");
      } else if (key === "resolve") {
        setResolveMsg(
          body.complete
            ? body.outcome === "winner"
              ? "Game over. We have a winner!"
              : body.outcome === "all-out"
                ? "Everyone out. No winner, start a new game."
                : `${body.eliminated ?? 0} eliminated · ${body.aliveNow ?? 0} through to the next week.`
            : body.message ?? "Matchday isn’t finished yet."
        );
      }
      await load();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <header className={styles.bar}>
          <span className={styles.tag}>Admin</span>
          <Link href="/dashboard" className={styles.back}>
            ← Back to app
          </Link>
        </header>
        <main className={styles.main}>
          <div className="lms-state">
            <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
            <p className="lms-state__body">Loading game control…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.shell}>
        <header className={styles.bar}>
          <span className={styles.tag}>Admin</span>
          <Link href="/dashboard" className={styles.back}>
            ← Back to app
          </Link>
        </header>
        <main className={styles.main}>
          <div className="lms-state">
            <h1 className="lms-state__title">Couldn’t load</h1>
            <p className="lms-state__body">{error}</p>
            <button className="lms-btn lms-btn--primary" onClick={() => load()}>
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  const { current, pastGames, teamsSeeded } = data;

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <span className={styles.tag}>Admin</span>
        <Link href="/dashboard" className={styles.back}>
          ← Back to app
        </Link>
      </header>

      <main className={styles.main}>
        <div className="lms-head">
          <h1 className={styles.title}>Game control</h1>
          <p className="lms-head__hint">
            Results resolve automatically after each game week. Use the controls below to run a
            resolution early or start a new game.
          </p>
        </div>

        {actionError && (
          <p className={styles.notice} role="alert" style={{ color: "var(--color-out-ink)" }}>
            {actionError}
          </p>
        )}

        <div className={styles.grid}>
          {/* Current game */}
          <section className={`lms-panel lms-panel--ink ${styles.current}`}>
            {!current ? (
              <>
                <p className={styles.currentKicker}>No game running</p>
                <p className={styles.bigLabel}>Start one from the panel on the right.</p>
              </>
            ) : current.status === "registration" ? (
              <>
                <div className={styles.currentHead}>
                  <span className={styles.currentKicker} data-nums>
                    Game {current.no} &middot; Registration
                  </span>
                  <span className="lms-chip lms-chip--wild">Open</span>
                </div>
                <p className={styles.big} data-nums>
                  {current.playersTotal}
                </p>
                <p className={styles.bigLabel}>players registered</p>
                <div className={styles.actions}>
                  <button
                    className="lms-btn lms-btn--primary"
                    disabled={busy !== null || teamsSeeded === 0}
                    onClick={() => action("start", "/api/admin/games/start", { gameId: current.id })}
                  >
                    {busy === "start" ? "Starting…" : `Start game week ${current.gameWeek}`}
                  </button>
                </div>
                {teamsSeeded === 0 && (
                  <p className={styles.resolved} style={{ color: "var(--color-wild)" }}>
                    Seed the teams first (panel on the right).
                  </p>
                )}
              </>
            ) : (
              <>
                <div className={styles.currentHead}>
                  <span className={styles.currentKicker} data-nums>
                    Game {current.no} &middot; Week {current.gameWeek}
                  </span>
                  <span className="lms-chip lms-chip--safe">
                    <span className="lms-dot" aria-hidden="true" />
                    Active
                  </span>
                </div>
                <p className={styles.big} data-nums>
                  {current.playersAlive}
                  <span className={styles.of}>/{current.playersTotal}</span>
                </p>
                <p className={styles.bigLabel}>players still standing</p>
                <div className={styles.actions}>
                  <button
                    className="lms-btn lms-btn--primary"
                    disabled={busy !== null}
                    onClick={() => action("resolve", "/api/admin/resolve")}
                  >
                    {busy === "resolve" ? "Processing…" : `Process Week ${current.gameWeek} results`}
                  </button>
                </div>
                {resolveMsg && (
                  <p className={styles.resolved} role="status">
                    {resolveMsg}
                  </p>
                )}
              </>
            )}
          </section>

          {/* Setup: seed teams + start a new game */}
          <section className={`lms-panel ${styles.panel}`}>
            <h2 className={styles.panelTitle}>Setup</h2>
            <p className={styles.panelHint}>
              {teamsSeeded > 0
                ? `${teamsSeeded} teams loaded from football-data.org.`
                : "No teams loaded yet. Seed them before starting a game."}
            </p>
            <button
              className="lms-btn lms-btn--ghost lms-btn--block"
              disabled={busy !== null}
              onClick={() => action("seed", "/api/admin/seed", season ? { season: Number(season) } : {})}
              style={{ marginBottom: "var(--space-md)" }}
            >
              {busy === "seed" ? "Seeding…" : teamsSeeded > 0 ? "Refresh teams" : "Seed teams"}
            </button>

            <form
              className={styles.startForm}
              onSubmit={(e) => {
                e.preventDefault();
                action("create", "/api/admin/games", {
                  startMatchday: Number(startWeek),
                  ...(season ? { season: Number(season) } : {}),
                });
              }}
            >
              <div className="lms-field">
                <label className="lms-field__label" htmlFor="startWeek">
                  Start at game week
                </label>
                <input
                  className="lms-field__control"
                  id="startWeek"
                  type="number"
                  min="1"
                  max="38"
                  value={startWeek}
                  onChange={(e) => setStartWeek(e.target.value)}
                  disabled={!!current}
                />
                <p className="lms-field__help">Premier League matchday (1 to 38).</p>
              </div>
              <div className="lms-field">
                <label className="lms-field__label" htmlFor="season">
                  Season (optional)
                </label>
                <input
                  className="lms-field__control"
                  id="season"
                  type="number"
                  placeholder="2025"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  disabled={!!current}
                />
              </div>
              <button
                type="submit"
                className="lms-btn lms-btn--primary lms-btn--block"
                disabled={busy !== null || !!current}
              >
                {busy === "create"
                  ? "Opening…"
                  : current
                    ? "A game is already open"
                    : "Open registration"}
              </button>
            </form>
          </section>

          {/* Past games */}
          <section className={`lms-panel ${styles.past}`}>
            <h2 className={styles.panelTitle}>Past games</h2>
            {pastGames.length === 0 ? (
              <p className={styles.panelHint}>No finished games yet.</p>
            ) : (
              <ul className={styles.pastList}>
                {pastGames.map((g) => (
                  <li key={g.no} className={styles.pastRow}>
                    <span className={styles.pastNo} data-nums>
                      Game {g.no}
                    </span>
                    <span className={styles.pastOutcome}>{g.outcome}</span>
                    <span className={styles.pastWeeks} data-nums>
                      {g.weeks} wks
                    </span>
                    <span
                      className={`lms-chip ${g.tone === "safe" ? "lms-chip--safe" : "lms-chip--out"}`}
                    >
                      {g.tone === "safe" ? "Winner" : "Restarted"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Player accounts */}
          <PlayersPanel />
        </div>
      </main>
    </div>
  );
}
