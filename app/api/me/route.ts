import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { deleteOwnAccount, renameUser } from "@/lib/account";
import { deleteAccountSchema, updateNameSchema } from "@/lib/validation";
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

/**
 * Delete your own account. The web twin of the app's DELETE /api/mobile/me —
 * Play wants a deletion route reachable from a browser, without installing
 * anything, so this is the one its policy review follows.
 *
 * The caller signs out straight afterwards. It would happen on its own once the
 * session's claims went stale and the jwt callback failed to find the account,
 * but waiting out a TTL to leave a page that no longer has an owner is a worse
 * few minutes than just ending it.
 */
export async function DELETE(request: Request) {
  try {
    const me = await requireUser();

    if (!(await rateLimit(`delete-account:${me.id}`, 5, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = deleteAccountSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Type DELETE to confirm." },
        { status: 400 }
      );
    }

    const result = await deleteOwnAccount(me.id);
    if (result === "unknown-user") {
      return NextResponse.json({ error: "Unknown account." }, { status: 404 });
    }
    if (result === "is-admin") {
      return NextResponse.json(
        { error: "Admin accounts can’t be deleted here. Get in touch and we’ll do it for you." },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
