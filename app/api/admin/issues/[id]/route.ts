import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { IssueReport } from "@/models/Report/IssueReport";
import { readJson, errorResponse } from "@/lib/api";

// Admin triage: flip an issue between open and resolved.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    }

    const body = await readJson<{ status?: string }>(request);
    if (body?.status !== "open" && body?.status !== "resolved") {
      return NextResponse.json({ error: "Status must be open or resolved." }, { status: 400 });
    }

    await connectDB();
    const issue = await IssueReport.findById(id);
    if (!issue) {
      return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    }
    issue.status = body.status;
    await issue.save();
    return NextResponse.json({ ok: true, status: issue.status });
  } catch (err) {
    return errorResponse(err);
  }
}
