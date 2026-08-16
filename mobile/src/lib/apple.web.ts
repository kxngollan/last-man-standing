/**
 * Sign in with Apple on Expo Web: not offered.
 *
 * Metro picks this file over apple.ts for the web bundle. Apple's native module
 * has no web implementation, and the browser-based flow is a different thing
 * entirely — the real website already has it through Auth.js.
 *
 * Every caller awaits `appleAvailable()` before showing the button, so the
 * false here is the whole stub.
 */

/** Nothing to render. Callers gate on `appleAvailable()`, which is false here. */
export const AppleButtonView = null;
export const AppleButtonType = 0;
export const AppleButtonStyle = { light: 0, dark: 0 };

export interface AppleCredential {
  idToken: string;
  authorizationCode: string | null;
  firstName: string | null;
  lastName: string | null;
}

export async function appleAvailable(): Promise<boolean> {
  return false;
}

export async function appleSignIn(): Promise<AppleCredential | null> {
  throw new Error("Apple sign-in isn’t available in the web build.");
}
