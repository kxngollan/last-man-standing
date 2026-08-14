import { auth } from "@/auth";
import { GameError } from "@/lib/game/errors";

export interface SessionUser {
  id: string;
  isAdmin: boolean;
  name?: string | null;
  email?: string | null;
}

/**
 * Return the signed-in user, or throw a 401.
 *
 * An account that signed up with Google or Apple and hasn't given a date of
 * birth yet is refused: proxy.ts holds it at /welcome, and without this the API
 * would be a way round the age gate for the one window where a real session
 * exists but the age check hasn't been applied. `allowPendingOnboarding` is for
 * /api/me/dob itself, which is how the gate gets satisfied.
 */
export async function requireUser(
  opts: { allowPendingOnboarding?: boolean } = {}
): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) throw new GameError("You need to be signed in.", 401);
  if (session.user.needsOnboarding && !opts.allowPendingOnboarding) {
    throw new GameError("Finish setting up your account first.", 403);
  }
  return {
    id: session.user.id,
    isAdmin: !!session.user.isAdmin,
    name: session.user.name,
    email: session.user.email,
  };
}

/** Return the signed-in admin, or throw 401/403. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new GameError("Admins only.", 403);
  return user;
}
