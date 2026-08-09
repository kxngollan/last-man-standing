import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { renameUser } from "@/lib/account";
import { updateNameSchema } from "@/lib/validation";
import { readJson, errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Rename yourself. The stored `name` is kept in sync with the split fields,
 * the same way the admin rename does it — the session and legacy accounts both
 * read `name`.
 *
 * Worth knowing: a name is how you appear to everyone, in past games too. There
 * is one name per account, not one per game.
 */
export async function PATCH(request: Request) {
  try {
    const me = await requireUser();

    if (!(await rateLimit(`rename:${me.id}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many changes. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = updateNameSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form." },
        { status: 400 }
      );
    }

    const updated = await renameUser(me.id, parsed.data.firstName, parsed.data.lastName);
    if (!updated) return NextResponse.json({ error: "Unknown account." }, { status: 404 });

    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
