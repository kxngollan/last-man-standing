import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

/**
 * Sign in with Apple, native.
 *
 * The same shape as google.ts and for the same reason: the phone does the whole
 * dance and comes away with an ID token, and /api/mobile/auth/social checks it
 * against Apple's published keys before issuing one of our own bearer tokens.
 *
 * Two things about Apple that Google doesn't do to you:
 *
 *  1. The name arrives ONCE. Apple gives `fullName` on the very first consent
 *     and never again — not on any later sign-in, and not after the app is
 *     deleted and reinstalled. It isn't in the ID token either. So the name is
 *     passed up separately, and the server treats it as a fallback.
 *
 *  2. The audience is the BUNDLE ID. A token minted on a device names
 *     com.footballlms, not the Services ID the website signs in with —
 *     so the server's MOBILE_APPLE_CLIENT_IDS has to list the bundle id, and
 *     listing the Services ID there would accept nothing.
 *
 * There is an `apple.web.ts` beside this one, for the same reason google has a
 * stub: Metro picks it for the web bundle, where the native module is absent.
 */

/**
 * Apple's own button, re-exported from here rather than imported at the call
 * site — the call site is shared with Google's and must stay importable on web,
 * where this native module doesn't exist. The split lives in one file.
 *
 * It has to be Apple's button and not one of ours. The Human Interface
 * Guidelines are specific about the mark, the wording and the proportions of
 * "Sign in with Apple", and review does look; a hand-rolled lookalike is a
 * findable reason to be sent back.
 */
export const AppleButtonView = AppleAuthentication.AppleAuthenticationButton;
export const AppleButtonType = AppleAuthentication.AppleAuthenticationButtonType.CONTINUE;
export const AppleButtonStyle = {
  light: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK,
  dark: AppleAuthentication.AppleAuthenticationButtonStyle.WHITE,
};

export interface AppleCredential {
  idToken: string;
  /**
   * Single use, and only good for about five minutes. Not needed to sign in —
   * the server spends it on a refresh token so that deleting the account can
   * revoke this app at Apple, which App Review requires.
   */
  authorizationCode: string | null;
  /** Present on the first consent only. Null every time after that. */
  firstName: string | null;
  lastName: string | null;
}

/**
 * Whether to offer the button at all.
 *
 * iOS only — Apple ships no Android implementation, and the web flow isn't
 * this. Unlike Google's, this can't be settled from configuration alone: the
 * OS decides, and it says no below iOS 13. Callers hold the answer in state
 * rather than importing a constant.
 */
export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Null means the player backed out, which isn't an error and shouldn't read as one. */
export async function appleSignIn(): Promise<AppleCredential | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Only reachable with a misconfigured entitlement — the token is the whole
    // point of the call, and there's nothing to fall back to without it.
    if (!credential.identityToken) {
      throw new Error("Apple didn’t return a sign-in token. Please try again.");
    }

    return {
      idToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      firstName: credential.fullName?.givenName ?? null,
      lastName: credential.fullName?.familyName ?? null,
    };
  } catch (err) {
    // Backing out of the sheet arrives as an error; it isn't one.
    if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw err instanceof Error ? err : new Error("Apple sign-in failed. Please try again.");
  }
}
