import { redirect } from "next/navigation";

/**
 * /picks/3 → /picks?week=3. The board itself takes the week as a query param
 * (the week buttons are links, and one page serves every week), so the tidier
 * path just hands over to it rather than duplicating the board.
 */
export default async function PicksWeekRedirect({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const n = Number(week);
  redirect(Number.isInteger(n) && n > 0 ? `/picks?week=${n}` : "/picks");
}
