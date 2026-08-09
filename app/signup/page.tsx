import type { Metadata } from "next";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { publicName } from "@/lib/displayName";
import { resolveHandle } from "@/lib/referral";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import SignupForm from "./SignupForm";

const BASE_DESCRIPTION =
  "Create a free Last Man Standing account and join the Premier League survival game. Pick one team to win each week and be the last player standing.";

/**
 * Who sent them, if they arrived on a referral link. `/r/<handle>` redirects
 * here with ?ref= precisely so this can run: social crawlers follow the
 * redirect and read the destination's metadata, so a personalised card has to
 * be generated on this page rather than on the short link.
 *
 * The cookie set by /r is what actually credits the referral — this parameter
 * only drives what the preview and the page say.
 */
async function inviterFrom(ref: string | undefined): Promise<string | null> {
  if (!ref) return null;
  try {
    const userId = await resolveHandle(ref);
    if (!userId) return null;
    await connectDB();
    const user = await User.findById(userId).select("name firstName lastName").lean();
    return user ? publicName(user) : null;
  } catch {
    return null; // a preview is never worth failing the page over
  }
}

function refOf(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}): Promise<Metadata> {
  const ref = refOf((await searchParams).ref);
  const inviter = await inviterFrom(ref);

  const title = inviter ? `${inviter} has invited you to play` : "Sign up";
  const description = inviter
    ? `${inviter} wants you in their Last Man Standing game. ${SITE_DESCRIPTION}`
    : BASE_DESCRIPTION;
  // The generic card unless we know who sent them.
  const image = ref ? `${SITE_URL}/og/referral/${encodeURIComponent(ref)}` : "/images/og.png";

  return {
    title,
    description,
    alternates: { canonical: "/signup" },
    openGraph: {
      title,
      description,
      url: "/signup",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const inviter = await inviterFrom(refOf((await searchParams).ref));
  return <SignupForm inviter={inviter} />;
}
