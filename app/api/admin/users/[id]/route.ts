import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User";
import { adminUserUpdateSchema } from "@/lib/validation";
import { fullName, nameParts } from "@/lib/displayName";
import { readJson, errorResponse } from "@/lib/api";
import type { AdminUserRow } from "@/lib/game/portalTypes";

// Admin edits to one player: rename and/or set email verification.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Unknown player." }, { status: 404 });
    }

    const body = await readJson(request);
    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "Unknown player." }, { status: 404 });
    }

    const { firstName, lastName, emailVerified } = parsed.data;
    if (firstName !== undefined || lastName !== undefined) {
      // A rename may touch only one half — fill the other from what we have
      // (legacy accounts get their `name` split on the fly).
      const current = nameParts(user);
      user.firstName = firstName ?? current.first;
      user.lastName = lastName ?? current.last;
      user.name = fullName(user);
    }
    if (emailVerified !== undefined) user.emailVerified = emailVerified;
    await user.save();

    const { first, last } = nameParts(user);
    const row: AdminUserRow = {
      id: String(user._id),
      firstName: first,
      lastName: last,
      email: user.email,
      emailVerified: user.emailVerified,
      isAdmin: user.isAdmin,
      createdAt: new Date(user.createdAt).toISOString(),
    };
    return NextResponse.json(row);
  } catch (err) {
    return errorResponse(err);
  }
}
