import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { nameParts } from "@/lib/displayName";
import { errorResponse } from "@/lib/api";
import type { AdminUserRow } from "@/lib/game/portalTypes";

// All player accounts, newest first — the admin Players panel.
export async function GET() {
  try {
    await requireAdmin();
    await connectDB();
    const users = await User.find({})
      .select("name firstName lastName email emailVerified isAdmin createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const rows: AdminUserRow[] = users.map((u) => {
      const { first, last } = nameParts(u);
      return {
        id: String(u._id),
        firstName: first,
        lastName: last,
        email: u.email,
        emailVerified: u.emailVerified,
        isAdmin: u.isAdmin,
        createdAt: new Date(u.createdAt).toISOString(),
      };
    });
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}
