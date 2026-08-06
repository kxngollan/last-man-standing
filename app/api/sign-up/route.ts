import { NextResponse } from "next/server";
import { connectDB } from "@/database/connect";
import { User } from "@/models/User";
import { VerificationToken } from "@/models/VerificationToken";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { isOldEnough } from "@/lib/age";
import { createVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import { readJson, errorResponse } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { SITE_URL } from "@/lib/site";

export async function POST(request: Request) {
  try {
    // Unauthenticated endpoint that hashes a password (CPU) and sends an
    // email — metered per IP against bots and mailbox bombing.
    if (!(await rateLimit(`signup:${clientIp(request)}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many sign-up attempts. Please try again later." },
        { status: 429 }
      );
    }

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

    const { firstName, lastName, email, password, dob } = parsed.data;
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

    let user;
    try {
      user = await User.create({
        firstName,
        lastName,
        // `name` mirrors the split fields — the auth session and legacy code read it.
        name: `${firstName} ${lastName}`,
        email: emailLc,
        passwordHash,
        dob: dobDate,
        emailVerified: false,
        // Never at signup — ADMIN_EMAILS grants admin at email verification,
        // once inbox ownership is proven (lib/adminEmails.ts).
        isAdmin: false,
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

    // Send the confirmation link. If it can't be sent, roll the account back
    // so the player can simply sign up again — with no resend flow, an
    // unverified account with no email would be permanently locked out.
    try {
      const token = await createVerificationToken(String(user._id));
      await sendVerificationEmail(emailLc, `${SITE_URL}/verify?token=${token}`);
    } catch (err) {
      await VerificationToken.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
      throw err;
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
