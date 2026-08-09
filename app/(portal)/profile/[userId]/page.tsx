import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileName, getUserProfile } from "@/lib/game/profile";
import { ProfileView } from "../ProfileView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const session = await auth();
  if (!session?.user?.id) return { title: "Profile" };
  const { userId } = await params;
  const name = await getProfileName(userId, session.user.id);
  return { title: name ? `${name} · Profile` : "Profile" };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=/profile/${userId}`);

  // One canonical URL for your own record.
  if (userId === session.user.id) redirect("/profile");

  const profile = await getUserProfile(userId, session.user.id);
  if (!profile) notFound();

  return <ProfileView profile={profile} />;
}
