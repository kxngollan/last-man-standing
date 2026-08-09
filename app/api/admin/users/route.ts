import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { UserReferralHandle } from "@/models/User/UserReferralHandle";
import { UserReferredBy } from "@/models/User/UserReferredBy";
import { nameParts, publicName } from "@/lib/displayName";
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

    // Referral context in three batched reads rather than per row.
    const [handles, referredRows, counts] = await Promise.all([
      UserReferralHandle.find({}).select("userId referralHandle").lean(),
      UserReferredBy.find({}).select("userId referrerUserId").lean(),
      UserReferredBy.aggregate<{ _id: string; n: number }>([
        { $match: { confirmed: true } },
        { $group: { _id: "$referrerUserId", n: { $sum: 1 } } },
      ]),
    ]);
    const nameById = new Map(users.map((u) => [String(u._id), publicName(u)]));
    const handleByUser = new Map(handles.map((h) => [String(h.userId), h.referralHandle]));
    const referrerByUser = new Map(
      referredRows.map((r) => [String(r.userId), String(r.referrerUserId)])
    );
    const countByUser = new Map(counts.map((c) => [String(c._id), c.n]));

    const rows: AdminUserRow[] = users.map((u) => {
      const { first, last } = nameParts(u);
      const id = String(u._id);
      const referrerId = referrerByUser.get(id);
      return {
        id,
        firstName: first,
        lastName: last,
        email: u.email,
        emailVerified: u.emailVerified,
        isAdmin: u.isAdmin,
        createdAt: new Date(u.createdAt).toISOString(),
        referralHandle: handleByUser.get(id),
        referredBy: referrerId ? nameById.get(referrerId) ?? "a player" : null,
        referrals: countByUser.get(id) ?? 0,
      };
    });
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}
