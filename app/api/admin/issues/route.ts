import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { IssueReport } from "@/models/Report/IssueReport";
import { User } from "@/models/User/User";
import { fullName } from "@/lib/displayName";
import { errorResponse } from "@/lib/api";
import type { AdminIssueList, AdminIssueRow } from "@/lib/game/portalTypes";

// Issue reports, open first then newest — the admin panel.
export async function GET() {
  try {
    await requireAdmin();
    await connectDB();

    const [entries, openCount] = await Promise.all([
      IssueReport.find({}).sort({ status: 1, createdAt: -1 }).limit(100).lean(),
      IssueReport.countDocuments({ status: "open" }),
    ]);

    const users = await User.find({ _id: { $in: entries.map((i) => i.userId) } })
      .select("name firstName lastName email")
      .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const rows: AdminIssueRow[] = entries.map((i) => {
      const u = userById.get(String(i.userId));
      return {
        id: String(i._id),
        category: i.category,
        message: i.message,
        page: i.page,
        status: i.status,
        user: {
          name: u ? fullName(u) : "Deleted account",
          email: u?.email ?? "—",
        },
        createdAt: new Date(i.createdAt).toISOString(),
      };
    });

    const payload: AdminIssueList = { openCount, rows };
    return NextResponse.json(payload);
  } catch (err) {
    return errorResponse(err);
  }
}
