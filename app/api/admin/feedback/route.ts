import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { Feedback } from "@/models/Report/Feedback";
import { User } from "@/models/User/User";
import { fullName } from "@/lib/displayName";
import { errorResponse } from "@/lib/api";
import type { AdminFeedbackList, AdminFeedbackRow } from "@/lib/game/portalTypes";

// Player feedback, newest first, with the overall average — the admin panel.
export async function GET() {
  try {
    await requireAdmin();
    await connectDB();

    const [entries, count, avg] = await Promise.all([
      Feedback.find({}).sort({ createdAt: -1 }).limit(100).lean(),
      Feedback.countDocuments({}),
      Feedback.aggregate<{ _id: null; avg: number }>([
        { $group: { _id: null, avg: { $avg: "$rating" } } },
      ]),
    ]);

    const users = await User.find({ _id: { $in: entries.map((f) => f.userId) } })
      .select("name firstName lastName email")
      .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const rows: AdminFeedbackRow[] = entries.map((f) => {
      const u = userById.get(String(f.userId));
      return {
        id: String(f._id),
        rating: f.rating,
        message: f.message,
        user: {
          name: u ? fullName(u) : "Deleted account",
          email: u?.email ?? "—",
        },
        createdAt: new Date(f.createdAt).toISOString(),
      };
    });

    const payload: AdminFeedbackList = {
      count,
      averageRating: avg[0] ? Math.round(avg[0].avg * 10) / 10 : null,
      rows,
    };
    return NextResponse.json(payload);
  } catch (err) {
    return errorResponse(err);
  }
}
