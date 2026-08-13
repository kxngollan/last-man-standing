import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

/**
 * Face ID, Touch ID, and Android fingerprint — a lock on the stored session
 * token, not a way of proving who you are to the server.
 *
 * There is no biometric credential the API could verify: a face is only ever
 * checked by the phone that owns it. So all this does is decide whether the
 * 30-day JWT already in the keychain may be handed back to the app. The token
 * remains the only thing /api/mobile trusts, and email + password remains the
 * only way to obtain one.
 *
 * Requires a development build. Face ID doesn't work in Expo Go, and neither
 * does SecureStore's requireAuthentication.
 */

/** The biometric-locked copy of the token. Reading it raises the prompt. */
const GUARDED_KEY = "lms.session.token.guarded";

/**
 * Whether biometric unlock is switched on — stored unguarded on purpose. The
 * app has to know whether to show the lock screen *before* it can ask for a
 * face, and this flag on its own opens nothing.
 */
const PREF_KEY = "lms.session.biometric";

/**
 * A separate keychain service from the plain token entry, and the same options
 * on every call: SecureStore matches entries on service, so a read that omits
 * this simply doesn't find the value.
 */
const GUARDED: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainService: "lms.session.guarded",
  authenticationPrompt: "Unlock Last Man Standing",
};

export type BiometricKind = "face" | "fingerprint" | "none";

/**
 * What this device can do *and* has enrolled — both halves matter. A phone with
 * a fingerprint reader and no finger registered can't authenticate anyone.
 */
export async function biometricKind(): Promise<BiometricKind> {
  if (Platform.OS === "web") return "none";
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hardware || !enrolled) return "none";

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "face";
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "fingerprint";
    return "none";
  } catch {
    // Expo Go, or a platform without the native module — treat it as absent
    // rather than letting it take down the screen asking.
    return "none";
  }
}

/**
 * The name the player knows it by. "Touch ID" and "Face ID" are Apple's names
 * and belong on Apple hardware only — a Pixel offered "Touch ID" reads as a
 * bug, and rightly so.
 */
export function biometricLabel(kind: BiometricKind): string {
  if (kind === "none") return "Biometric unlock";
  if (Platform.OS === "ios") return kind === "face" ? "Face ID" : "Touch ID";
  return kind === "face" ? "Face unlock" : "Fingerprint";
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return (await SecureStore.getItemAsync(PREF_KEY)) === "1";
  } catch {
    return false;
  }
}

/**
 * Raise the prompt. Callers care only whether it came back successful, and a
 * throw — no hardware, invalid context — is just another way of saying no.
 */
export async function prompt(reason: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      // The honest escape hatch: refusing the prompt drops you to the password
      // form, which is where a failed unlock has to lead anyway.
      cancelLabel: "Use password",
      fallbackLabel: "Enter passcode",
      // Class 3 only on Android. A 2D face unlock — a photo, in practice — is
      // not enough to stand between someone else and this account.
      biometricsSecurityLevel: "strong",
      requireConfirmation: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

/** Move a live token behind biometrics. Prompts on Android: writes need auth. */
export async function guardToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(GUARDED_KEY, token, GUARDED);
  await SecureStore.setItemAsync(PREF_KEY, "1");
}

/**
 * Read it back. This is the call that raises the Face ID sheet on iOS.
 *
 * Null covers every way this can fail — cancelled, or the key invalidated
 * because a fingerprint was added since it was written — because they all have
 * the same remedy: sign in with a password again.
 */
export async function unguardToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(GUARDED_KEY, GUARDED);
  } catch {
    return null;
  }
}

export async function clearGuard(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PREF_KEY);
  } catch {
    // Nothing to clear.
  }
  try {
    await SecureStore.deleteItemAsync(GUARDED_KEY, GUARDED);
  } catch {
    // Already gone, or unreadable — either way it is no longer a way in.
  }
}
