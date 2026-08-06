"use client";

import { useRouter } from "next/navigation";
import styles from "./page.module.css";

/** The game-week dropdown — navigation state lives in the URL (?matchday=N). */
export default function WeekSelect({
  matchday,
  currentMatchday,
  totalMatchdays,
}: {
  matchday: number;
  currentMatchday: number;
  totalMatchdays: number;
}) {
  const router = useRouter();
  return (
    <label className={styles.weekPick}>
      <span className={styles.weekLabel}>
        Game week
        {matchday === currentMatchday && <span className={styles.nowTag}>now</span>}
      </span>
      <select
        className={styles.weekSelect}
        value={matchday}
        onChange={(e) => router.push(`/fixtures?matchday=${e.target.value}`)}
        data-nums
      >
        {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            Week {n}
            {n === currentMatchday ? " (now)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
