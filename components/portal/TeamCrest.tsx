import { teamColor } from "@/lib/teamColor";

/**
 * A team crest disc. Renders the official badge image when the team has a
 * crest URL (from football-data.org, synced onto the Team), and falls back
 * to the deterministic colour disc with the three-letter code otherwise.
 *
 * Presentational only (no hooks) so it works in both server and client
 * components. `discClass` overrides the wrapper class for callers that size
 * the disc through a CSS module (e.g. the make-selection cards).
 */
export function TeamCrest({
  crest,
  tla,
  size = "sm",
  discClass,
  fallbackColor,
}: {
  crest?: string | null;
  tla?: string | null;
  size?: "sm" | "lg";
  discClass?: string;
  /** Disc colour used only when there's no crest image (defaults to a hash of the code). */
  fallbackColor?: string;
}) {
  const cls = discClass ?? `lms-crest${size === "lg" ? " lms-crest--lg" : ""}`;

  if (crest) {
    return (
      <span className={cls} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote crest host, no next/image domain config */}
        <img className="lms-crest__img" src={crest} alt="" loading="lazy" />
      </span>
    );
  }

  return (
    <span className={cls} style={{ background: fallbackColor ?? teamColor(tla ?? "") }} aria-hidden="true">
      {tla}
    </span>
  );
}
