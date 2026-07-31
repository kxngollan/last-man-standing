import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "Last Man Standing · Free Premier League Survival Game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social share card, in the app's Hum palette (cream paper, coral
// accent, warm ink). Rendered by Satori, so layout is flexbox only.
export default function Image() {
  const paper = "#f7f3ea";
  const ink = "#2c2622";
  const coral = "#d1563b";
  const muted = "#6f665d";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: paper,
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2 3 5.5v6c0 5 3.8 8.6 9 10.5 5.2-1.9 9-5.5 9-10.5v-6L12 2Z"
              fill={coral}
            />
            <path
              d="m8.1 12 2.7 2.7L16 9.2"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: ink,
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: ink,
            }}
          >
            One team. One week.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: coral,
            }}
          >
            Last one standing.
          </div>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: muted }}>
          The free Premier League survival game. Pick. Survive. Win.
        </div>
      </div>
    ),
    { ...size }
  );
}
