import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, ApiError, type MobileUser } from "@/api/client";
import {
  biometricKind,
  biometricLabel,
  clearGuard,
  guardToken,
  isBiometricEnabled,
  prompt,
  unguardToken,
} from "./biometrics";

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

interface SessionValue {
  token: string | null;
  user: MobileUser | null;
  /** True until the stored token has been looked for — the splash waits on this. */
  loading: boolean;
  /** There's a token behind biometrics and we haven't opened it yet. */
  locked: boolean;
  signIn: (email: string, password: string) => Promise<void>;
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

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    await writeToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setLocked(false);
  }, []);

  const signOut = useCallback(async () => {
    await writeToken(null);
    // Leaving a guarded token behind would send the next launch to a lock
    // screen for a session that's been deliberately ended.
    await clearGuard();
    setToken(null);
    setUser(null);
    setLocked(false);
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
      signOut,
      unlock,
      enableBiometrics,
      disableBiometrics,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
