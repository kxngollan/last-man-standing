import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getAdminOverview } from "@/lib/game/queries";
import { errorResponse } from "@/lib/api";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getAdminOverview());
  } catch (err) {
    return errorResponse(err);
  }
}
