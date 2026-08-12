import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { nameParts } from "@/lib/displayName";
import WelcomeForm from "./WelcomeForm";
import OnboardingDone from "./OnboardingDone";

/**
 * The step between signing in with Google/Apple and playing: neither provider
 * hands over a date of birth, and the 16+ gate needs one.
 *
 * Note what this page must never do: redirect to the portal because the
 * database says onboarding is finished. proxy.ts sends people here off the
 * session claim, and that claim can be up to five minutes behind the database —
 * so a redirect out of here on database state alone bounces off the proxy's
 * redirect into here, forever. When the two disagree, the session is the one
 * that has to be brought up to date, and that's what OnboardingDone does.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/welcome");

  await connectDB();
  const user = await User.findById(session.user.id).select("dob firstName name").lean();
  if (!user) redirect("/login?next=/welcome");

  const raw = (await searchParams).next;
  const next = typeof raw === "string" ? raw : undefined;

  if (user.dob) return <OnboardingDone next={next} />;

  return <WelcomeForm firstName={nameParts(user).first} />;
}
