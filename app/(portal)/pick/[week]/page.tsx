import { redirect } from "next/navigation";

/** Singular spelling of a week — /pick/3 → /picks?week=3. */
export default async function PickWeekRedirect({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const n = Number(week);
  redirect(Number.isInteger(n) && n > 0 ? `/picks?week=${n}` : "/picks");
}
