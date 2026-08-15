import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, ApiError, type LoginResponse, type MobileUser } from "@/api/client";
import {
  biometricKind,
  biometricLabel,
  clearGuard,
  guardToken,
  isBiometricEnabled,
  prompt,
  unguardToken,
} from "./biometrics";
import { googleSignIn, googleSignOut } from "./google";

/**
 * Who's signed in, and the token every request carries.
 *
 * The token is a 30-day bearer JWT from /api/mobile/auth/login — the phone has
 * no cookie jar, so this is the phone's equivalent of the web's session cookie.
 * It goes in the keychain on native. On web SecureStore doesn't exist, so it
 * falls back to localStorage, which is the honest trade for Expo Web: less
 * safe, but the alternative is not working at all.
 *
 * With biometric unlock on, that token moves to a keychain entry the OS won't
 * open without a face or a fingerprint, and the app starts up `locked` rather
 * than signed in. Biometrics never replace the password — they only decide
 * whether an existing token comes back out.
 */

const TOKEN_KEY = "lms.session.token";

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (token) globalThis.localStorage?.setItem(TOKEN_KEY, token);
      else globalThis.localStorage?.removeItem(TOKEN_KEY);
    } catch {
      // Private browsing with storage denied — they'll sign in again next launch.
    }
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * A Google sign-in that got as far as a verified token but no further, because
 * there's no account for the address yet.
 *
 * The server answers that with a 409 rather than registering silently: it still
 * needs a date of birth for the age gate. So the proof of the address is held
 * here while /social-consent asks the question, and the second call carries
 * both at once — which is why there's never a moment where a consent exists
 * for an address nobody has proved they own.
 */
interface PendingSocial {
  provider: "google";
  email: string;
  idToken: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * What came of tapping the Google button. Cancelling is the common case, not a
 * failure, so it can't be an exception — the screen would have to catch it and
 * decide it wasn't really an error, which is how "we couldn't log you in"
 * ends up on screen after someone deliberately hit Back.
 */
export type SocialOutcome =
  | { status: "signed-in" }
  | { status: "cancelled" }
  | { status: "needs-consent" };

interface SessionValue {
  token: string | null;
  user: MobileUser | null;
  /** True until the stored token has been looked for — the splash waits on this. */
  loading: boolean;
  /** There's a token behind biometrics and we haven't opened it yet. */
  locked: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Native Google sign-in. Throws only on real failures — see SocialOutcome. */
  signInWithGoogle: () => Promise<SocialOutcome>;
  /** Set only between a `needs-consent` outcome and the answer to it. */
  pendingSocial: PendingSocial | null;
  /** Answer the age gate and finish the sign-in that raised it. */
  completeSocial: (dob: string, parentalConsent: boolean) => Promise<void>;
  /** Walk away from that question, throwing the held token away with it. */
  cancelSocial: () => void;
  signOut: () => Promise<void>;
  /** Ask for the face/finger and, if it's given, restore the session. */
  unlock: () => Promise<boolean>;
  /** Move the current token behind biometrics. False if declined or unavailable. */
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pendingSocial, setPendingSocial] = useState<PendingSocial | null>(null);

  // Restore on launch. A token that no longer works — expired, or the account's
  // password changed since — is thrown away rather than kept around to fail
  // every subsequent request.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (await isBiometricEnabled()) {
          // Stop here rather than prompting. A biometric sheet raised during
          // cold start, while the splash is still up, gets swallowed by iOS —
          // so the lock screen asks once it's actually on screen.
          if (live) setLocked(true);
          return;
        }

        const stored = await readToken();
        if (!live || !stored) return;
        try {
          const me = (await api.me(stored)) as unknown as MobileUser;
          if (live) {
            setToken(stored);
            setUser(me);
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) await writeToken(null);
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  /** Every door out of signed-out ends here, whatever proved the identity. */
  const adopt = useCallback(async (result: LoginResponse) => {
    await writeToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setLocked(false);
    setPendingSocial(null);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await adopt(await api.login(email, password));
    },
    [adopt]
  );

  const signInWithGoogle = useCallback(async (): Promise<SocialOutcome> => {
    const credential = await googleSignIn();
    if (!credential) return { status: "cancelled" };

    try {
      await adopt(
        await api.social({
          provider: "google",
          idToken: credential.idToken,
          firstName: credential.firstName,
          lastName: credential.lastName,
        })
      );
      return { status: "signed-in" };
    } catch (err) {
      // Not a refusal — the server is asking a question, and we have to hold
      // the token to be able to answer it.
      if (err instanceof ApiError && err.status === 409 && err.data.needsConsent === true) {
        setPendingSocial({
          provider: "google",
          email: typeof err.data.email === "string" ? err.data.email : "",
          idToken: credential.idToken,
          firstName: credential.firstName,
          lastName: credential.lastName,
        });
        return { status: "needs-consent" };
      }
      throw err;
    }
  }, [adopt]);

  const completeSocial = useCallback(
    async (dob: string, parentalConsent: boolean) => {
      if (!pendingSocial) throw new ApiError(0, "That sign-in has expired. Please try again.");
      await adopt(
        await api.social({
          provider: pendingSocial.provider,
          idToken: pendingSocial.idToken,
          dob,
          parentalConsent,
          firstName: pendingSocial.firstName,
          lastName: pendingSocial.lastName,
        })
      );
    },
    [adopt, pendingSocial]
  );

  const cancelSocial = useCallback(() => {
    setPendingSocial(null);
    // The Google session outlives ours, so without this the next attempt picks
    // the same account straight back up and lands on the same question.
    void googleSignOut();
  }, []);

  const signOut = useCallback(async () => {
    await writeToken(null);
    // Leaving a guarded token behind would send the next launch to a lock
    // screen for a session that's been deliberately ended.
    await clearGuard();
    // Google keeps its own session. Left alone, "log out" would put the account
    // picker one silent tap away from signing the same person back in — and on
    // a shared phone, nobody else could ever reach their own account.
    await googleSignOut();
    setToken(null);
    setUser(null);
    setLocked(false);
    setPendingSocial(null);
  }, []);

  /**
   * The lock screen's one job. Every failure path ends the same way — unlocked
   * but signed out — because the alternative is a screen with no way off it.
   */
  const unlock = useCallback(async () => {
    const kind = await biometricKind();
    if (kind === "none") {
      // Biometrics were turned off at the OS level since we stored the token,
      // which means the guarded entry can never be opened again.
      await clearGuard();
      setLocked(false);
      return false;
    }

    if (!(await prompt(`Unlock with ${biometricLabel(kind)}`))) return false;

    const stored = await unguardToken();
    if (!stored) {
      await clearGuard();
      setLocked(false);
      return false;
    }

    try {
      const me = (await api.me(stored)) as unknown as MobileUser;
      setToken(stored);
      setUser(me);
      setLocked(false);
      return true;
    } catch (err) {
      // The right face, but a dead token. Only a password fixes that.
      if (err instanceof ApiError && err.status === 401) await clearGuard();
      setLocked(false);
      return false;
    }
  }, []);

  const enableBiometrics = useCallback(async () => {
    if (!token) return false;
    const kind = await biometricKind();
    if (kind === "none") return false;

    // Android authenticates on the write itself, so asking here as well would
    // prompt twice for one switch. iOS only prompts on reads, so it needs this
    // to confirm it's the account holder holding the phone.
    if (Platform.OS === "ios" && !(await prompt(`Turn on ${biometricLabel(kind)}`))) {
      return false;
    }

    try {
      await guardToken(token);
    } catch {
      return false;
    }
    // The unguarded copy would make the lock decorative.
    await writeToken(null);
    return true;
  }, [token]);

  const disableBiometrics = useCallback(async () => {
    if (token) await writeToken(token);
    await clearGuard();
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      locked,
      signIn,
      signInWithGoogle,
      pendingSocial,
      completeSocial,
      cancelSocial,
      signOut,
      unlock,
      enableBiometrics,
      disableBiometrics,
    }),
    [
      token,
      user,
      loading,
      locked,
      signIn,
      signInWithGoogle,
      pendingSocial,
      completeSocial,
      cancelSocial,
      signOut,
      unlock,
      enableBiometrics,
      disableBiometrics,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
