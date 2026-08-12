import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, ApiError, type MobileUser } from "@/api/client";

/**
 * Who's signed in, and the token every request carries.
 *
 * The token is a 30-day bearer JWT from /api/mobile/auth/login — the phone has
 * no cookie jar, so this is the phone's equivalent of the web's session cookie.
 * It goes in the keychain on native. On web SecureStore doesn't exist, so it
 * falls back to localStorage, which is the honest trade for Expo Web: less
 * safe, but the alternative is not working at all.
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
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  // Restore on launch. A token that no longer works — expired, or the account's
  // password changed since — is thrown away rather than kept around to fail
  // every subsequent request.
  useEffect(() => {
    let live = true;
    readToken()
      .then(async (stored) => {
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
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    await writeToken(result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    await writeToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, signIn, signOut }),
    [token, user, loading, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
