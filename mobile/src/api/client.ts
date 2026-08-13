import { Platform } from "react-native";
import type {
  FixturesWeek,
  LeagueTable,
  PickSummary,
  PortalState,
  StandingsPage,
  TeamFixtures,
  UserProfile,
} from "@shared/portalTypes";

/**
 * The app's one door to the server: /api/mobile/*.
 *
 * Those routes are bearer-authorised twins of the web's, and every response
 * shape is the same one the web portal renders from — which is why the types
 * above are imported from the web app rather than copied. They're pure types,
 * so `import type` erases the whole thing at build and Metro never has to
 * resolve outside the app folder. Copies would drift; this can't.
 */

export type { FixturesWeek, LeagueTable, PickSummary, PortalState, StandingsPage, TeamFixtures, UserProfile };

/**
 * Where the server lives.
 *
 * Set EXPO_PUBLIC_API_URL for anything but the simplest case — a physical
 * phone can't reach your Mac's localhost, so it needs the LAN address
 * (http://192.168.x.x:3000).
 *
 * The fallbacks cover the two simulators: 10.0.2.2 is the Android emulator's
 * alias for the host machine's loopback, which is the one detail that trips
 * everyone up, and the iOS simulator shares the host's network outright.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: "http://10.0.2.2:3000",
    default: "http://localhost:3000",
  });

export interface MobileUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  needsOnboarding: boolean;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: MobileUser;
  created?: boolean;
}

/** A refusal from the server, carrying whatever it chose to tell us. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly data: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/mobile${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // No response at all: flight mode, wrong API_URL, dev server not running.
    throw new ApiError(0, "Can’t reach the server. Check your connection.");
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof payload.error === "string" ? payload.error : "Something went wrong. Please try again.";
    throw new ApiError(response.status, message, payload);
  }
  return payload as T;
}

/* ---- Endpoints ---------------------------------------------------------- */

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: { email, password } }),

  /**
   * Create an account. Deliberately returns no token — the address has to be
   * confirmed by email first, so the app shows "check your inbox" and the
   * player signs in afterwards.
   */
  signup: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    /** ISO yyyy-mm-dd. */
    dob: string;
  }) => request<{ ok: true; verificationSent: true }>("/auth/signup", { method: "POST", body: input }),

  /**
   * Ask for a password reset link. Returns `ok` once the email is away; the
   * link inside it opens the website's /reset page, so the app's part of the
   * flow finishes here.
   */
  forgot: (email: string) =>
    request<{ ok: true }>("/auth/forgot", { method: "POST", body: { email } }),

  /**
   * Native Google/Apple sign-in. `dob` is only sent the second time round:
   * an address with no account comes back as a 409 asking to confirm, and the
   * app posts again with a date of birth once the player says yes.
   */
  social: (input: {
    provider: "google" | "apple";
    idToken: string;
    dob?: string;
    firstName?: string | null;
    lastName?: string | null;
  }) => request<LoginResponse>("/auth/social", { method: "POST", body: input }),

  me: (token: string) => request<Record<string, unknown>>("/me", { token }),

  /** Everything the dashboard needs in one call — the same PortalState the web renders. */
  game: (token: string) => request<PortalState & { summary: PickSummary | null }>("/game", { token }),

  picks: (token: string) => request<PickSummary>("/picks", { token }),
  makePick: (token: string, teamApiId: number) =>
    request<{ ok: true }>("/picks", { method: "POST", token, body: { teamApiId } }),
  wildcard: (token: string, on: boolean) =>
    request<{ ok: true }>("/picks/wildcard", { method: "POST", token, body: { on } }),

  standings: (token: string, offset = 0) =>
    request<StandingsPage>(`/standings?offset=${offset}`, { token }),

  table: () => request<LeagueTable>("/table"),
  fixtures: (matchday?: number) =>
    request<FixturesWeek>(matchday ? `/fixtures?matchday=${matchday}` : "/fixtures"),
  teamFixtures: (tla: string) => request<TeamFixtures>(`/fixtures/${encodeURIComponent(tla)}`),

  profile: (token: string, userId: string) =>
    request<UserProfile>(`/profile/${encodeURIComponent(userId)}`, { token }),

  joinGame: (token: string) => request<{ ok: true }>("/games/join", { method: "POST", token }),
};
