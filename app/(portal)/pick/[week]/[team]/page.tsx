import { redirect } from "next/navigation";

/** Singular spelling of the team page — /pick/3/ars → /picks/3/ars. */
export default async function PickTeamRedirect({
  params,
}: {
  params: Promise<{ week: string; team: string }>;
}) {
  const { week, team } = await params;
  const n = Number(week);
  redirect(
    Number.isInteger(n) && n > 0 ? `/picks/${n}/${encodeURIComponent(team.toLowerCase())}` : "/picks"
  );
}
