import { NextResponse } from "next/server";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { isOldEnough } from "@/lib/age";
// Email verification is disabled for now — re-enable these (and the block below,
// plus emailVerified: false) when the email sender is turned back on.
// import { createVerificationToken } from "@/lib/verification";
// import { sendVerificationEmail } from "@/lib/email";
import { readJson, errorResponse } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Please check the form.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, email, password, dob } = parsed.data;
    const dobDate = new Date(dob);
    if (Number.isNaN(dobDate.getTime())) {
      return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
    }
    if (!isOldEnough(dobDate)) {
      return NextResponse.json({ error: "You must be 16 or older to sign up." }, { status: 400 });
    }

    await connectDB();
    const emailLc = email.toLowerCase();
    if (await User.findOne({ email: emailLc })) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    let user;
    try {
      user = await User.create({
        name,
        email: emailLc,
        passwordHash,
        dob: dobDate,
        emailVerified: true, // TODO: revert to false once email verification is re-enabled
        isAdmin: adminEmails.includes(emailLc),
      });
    } catch (err: unknown) {
      if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
        return NextResponse.json(
          { error: "An account with that email already exists." },
          { status: 409 }
        );
      }
      throw err;
    }

    // Email verification is disabled for now — accounts are usable immediately.
    // Re-enable to send the confirmation link when the email sender is turned on:
    // const token = await createVerificationToken(String(user._id));
    // const base = process.env.APP_URL ?? "http://localhost:3000";
    // await sendVerificationEmail(emailLc, `${base}/verify?token=${token}`);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
