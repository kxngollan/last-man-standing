import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { nameParts } from "@/lib/displayName";
import WelcomeForm from "./WelcomeForm";

/**
 * The step between signing in with Google/Apple and playing: neither provider
 * hands over a date of birth, and the 16+ gate needs one.
 *
 * proxy.ts sends people here off a session claim that can be five minutes old,
 * so the database gets the final word on whether there's anything to collect.
 */
export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/welcome");

  await connectDB();
  const user = await User.findById(session.user.id).select("dob firstName name").lean();
  if (!user) redirect("/login?next=/welcome");
  if (user.dob) redirect("/dashboard");

  return <WelcomeForm firstName={nameParts(user).first} />;
}
