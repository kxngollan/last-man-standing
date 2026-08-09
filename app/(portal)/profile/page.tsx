import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserProfile } from "@/lib/game/profile";
import { ProfileView } from "./ProfileView";

export const metadata: Metadata = {
  title: "Your profile",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/profile");

  const profile = await getUserProfile(session.user.id, session.user.id);
  // The session id came from a user row that has since gone — sign-out territory.
  if (!profile) redirect("/login?next=/profile");

  return <ProfileView profile={profile} />;
}
