import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User/User";
import { updateReferralSchema } from "@/lib/validation";
import {
  ensureReferralHandle,
  handleProblemMessage,
  setReferralHandle,
} from "@/lib/referral";
import { readJson, errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";

/** Change your referral link, and opt in or out of the public board. */
export async function PATCH(request: Request) {
  try {
    const me = await requireUser();

    if (!(await rateLimit(`referral:${me.id}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many changes. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = updateReferralSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 }
      );
    }

    const { referralHandle, hideFromBoard } = parsed.data;

    if (referralHandle !== undefined) {
      const result = await setReferralHandle(me.id, referralHandle);
      if (result === "unknown-user") {
        return NextResponse.json({ error: "Unknown account." }, { status: 404 });
      }
      if (result === "taken") {
        return NextResponse.json({ error: "That link is already taken." }, { status: 409 });
      }
      if (result !== "ok") {
        return NextResponse.json({ error: handleProblemMessage(result) }, { status: 400 });
      }
    }

    if (hideFromBoard !== undefined) {
      await connectDB();
      await User.updateOne({ _id: me.id }, { hideFromReferralBoard: hideFromBoard });
    }

    return NextResponse.json({ referralHandle: await ensureReferralHandle(me.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
