import { ImageResponse } from "next/og";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { publicName } from "@/lib/displayName";
import { resolveHandle } from "@/lib/referral";

/**
 * The share card behind a referral link: "Sam K. has invited you".
 *
 * Lives outside /api on purpose — robots.ts disallows /api/, and the social
 * crawlers that fetch this respect robots.txt, so an /api path would render a
 * blank preview.
 *
 * Colours are the brand tokens' fixed hex equivalents (the same mapping
 * lib/email.ts documents) because Satori can't read CSS custom properties.
 */
const PAPER = "#f7f3ea";
const INK = "#2b241c";
const MUTED = "#6b6156";
const ACCENT = "#d1563b";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Card({ inviter }: { inviter: string | null }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PAPER,
        padding: "72px 80px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
          <path d="M12 2 3 5.5v6c0 5 3.8 8.6 9 10.5 5.2-1.9 9-5.5 9-10.5v-6L12 2Z" fill={ACCENT} />
          <path
            d="m8.1 12 2.7 2.7L16 9.2"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 3,
            color: INK,
          }}
        >
          LAST MAN STANDING
        </span>
      </div>

      {/* Each line is its own flex block: Satori lays bare spans out inline, so
          two of them collide on a single line rather than stacking. */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: INK, lineHeight: 1.1 }}>
          {inviter ? `${inviter} has invited` : "One team. One week."}
        </div>
        <div
          style={{ display: "flex", fontSize: 76, fontWeight: 800, color: ACCENT, lineHeight: 1.1 }}
        >
          {inviter ? "you to play." : "Last one standing."}
        </div>
      </div>

      <span style={{ fontSize: 32, color: MUTED }}>
        The free Premier League survival game. Pick. Survive. Win.
      </span>
    </div>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  // A dud or expired handle still gets a card — the generic one — rather than
  // a broken preview.
  let inviter: string | null = null;
  try {
    const userId = await resolveHandle(handle);
    if (userId) {
      await connectDB();
      const user = await User.findById(userId).select("name firstName lastName").lean();
      // "Sam K." — the same name other players see everywhere else.
      // Names are capped at 40 characters each, which at this type size would
      // wrap and push the card past its fixed height.
      if (user) {
        const name = publicName(user);
        inviter = name.length > 22 ? `${name.slice(0, 21)}…` : name;
      }
    }
  } catch {
    /* fall through to the generic card */
  }

  return new ImageResponse(<Card inviter={inviter} />, {
    ...size,
    headers: {
      // Crawlers refetch often; a name only changes when the player renames.
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
