import { StateShell } from "@/components/portal/StateShell";
import styles from "./portal.module.css";

// Shown while any portal server page fetches — replaces the per-page
// client-side spinners the old fetch-on-mount pages carried.
export default function PortalLoading() {
  return (
    <StateShell className={styles.stateMain}>
      <span className="lms-spinner lms-spinner--lg" aria-hidden="true" />
      <p className="lms-state__body">Loading…</p>
    </StateShell>
  );
}
