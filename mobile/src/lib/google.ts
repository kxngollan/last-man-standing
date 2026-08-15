import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

/**
 * Google sign-in, native.
 *
 * The phone does the whole dance with Google and comes away with an ID token;
 * everything after that is our server's problem — /api/mobile/auth/social
 * verifies the token against Google's published keys and issues the same
 * bearer token a password login would have. So this file's only job is to
 * produce that ID token, or a clear reason why it couldn't.
 *
 * There is a `google.web.ts` beside this one. The library is native code with
 * no web implementation, and it reaches for the native module at import time —
 * so on Expo Web this module is never bundled at all, and the stub keeps
 * `googleAvailable` false rather than crashing the login screen.
 *
 * IMPORTANT, and the thing that catches everyone: the ID token's audience is
 * not the same client ID on both platforms.
 *
 *   iOS     — aud is the iOS client ID       (server: MOBILE_GOOGLE_CLIENT_IDS)
 *   Android — aud is the WEB client ID       (server: AUTH_GOOGLE_ID)
 *
 * The Android OAuth client never appears in `aud` at all; it only exists so
 * Google can match the app's signing certificate, which is why it needs the
 * SHA-1 fingerprints and no ID here. lib/mobile/socialToken.ts accepts both
 * lists, so both platforms verify — but Android will not mint an ID token at
 * all unless `webClientId` is passed to configure() below.
 */

interface ClientIds {
  ios?: string;
  web?: string;
}

const ids = (Constants.expoConfig?.extra?.googleClientIds ?? {}) as ClientIds;

/**
 * Whether to offer the button at all.
 *
 * Per platform, because the two need different IDs to get as far as a token,
 * and a button that always fails is worse than no button.
 */
export const googleAvailable =
  Platform.OS === "ios" ? Boolean(ids.ios) : Boolean(ids.web);

if (googleAvailable) {
  GoogleSignin.configure({
    // Android returns no idToken without this, and it's harmless on iOS.
    webClientId: ids.web,
    iosClientId: ids.ios,
  });
}

export interface GoogleCredential {
  idToken: string;
  /**
   * Google puts the name in the token as well, so the server doesn't depend on
   * these — they're passed up for parity with Apple, which hands the name to
   * the device once and never again.
   */
  firstName: string | null;
  lastName: string | null;
}

/** Null means the player backed out, which isn't an error and shouldn't read as one. */
export async function googleSignIn(): Promise<GoogleCredential | null> {
  try {
    // Hardcoded true on iOS; on Android it's the difference between a useful
    // prompt and an opaque failure on a device with no Play Services. It
    // rejects on some devices and merely returns false on others, so both.
    if (!(await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }))) {
      throw new Error("Google Play Services isn’t available on this device.");
    }

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;

    const { idToken, user } = response.data;
    // Only reachable with a misconfigured client — the token is the entire
    // point of the call, so there's nothing to fall back to.
    if (!idToken) {
      throw new Error("Google didn’t return a sign-in token. Please try again.");
    }
    return { idToken, firstName: user.givenName, lastName: user.familyName };
  } catch (err) {
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return null;
        case statusCodes.IN_PROGRESS:
          // A second tap while the first sheet is still up.
          return null;
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error("Google Play Services is out of date on this device.");
      }
    }
    throw err instanceof Error ? err : new Error("Google sign-in failed. Please try again.");
  }
}

/**
 * Forget the Google account too, not just our session.
 *
 * Without this, signing out and back in reuses the last account silently, and
 * anyone sharing a phone can't get to the picker to choose their own.
 */
export async function googleSignOut(): Promise<void> {
  if (!googleAvailable) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // Nothing to sign out of, which is the state we wanted anyway.
  }
}
