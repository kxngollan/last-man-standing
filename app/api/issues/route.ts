import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { IssueReport } from "@/models/IssueReport";
import { issueSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { readJson, errorResponse } from "@/lib/api";

// Bug/issue reports from players (signed-in only).
export async function POST(request: Request) {
  try {
    const user = await requireUser();

    if (!rateLimit(`issues:${user.id}`, 5, 24 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "That’s a lot of reports for one day — thank you. Try again tomorrow." },
        { status: 429 }
      );
    }

    const body = await readJson(request);
    const parsed = issueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 }
      );
    }

    await connectDB();
    await IssueReport.create({
      userId: user.id,
      category: parsed.data.category,
      message: parsed.data.message,
      page: parsed.data.page ?? "",
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
