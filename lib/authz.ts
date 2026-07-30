import { auth } from "@/auth";
import { GameError } from "@/lib/game/errors";

export interface SessionUser {
  id: string;
  isAdmin: boolean;
  name?: string | null;
  email?: string | null;
}

/** Return the signed-in user, or throw a 401. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) throw new GameError("You need to be signed in.", 401);
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
