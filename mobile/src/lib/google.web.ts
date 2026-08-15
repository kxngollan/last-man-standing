/**
 * Google sign-in on Expo Web: not offered.
 *
 * Metro picks this file over google.ts for the web bundle. The native library
 * touches its TurboModule at import time, so merely importing it in a browser
 * throws before any Platform check could run — hence a whole separate module
 * rather than a guard inside one.
 *
 * Nothing is lost. The web build is a convenience for development; the real
 * website already has Google sign-in through Auth.js, and every caller here
 * checks `googleAvailable` before showing the button.
 */

export const googleAvailable = false;

export interface GoogleCredential {
  idToken: string;
  firstName: string | null;
  lastName: string | null;
}

export async function googleSignIn(): Promise<GoogleCredential | null> {
  throw new Error("Google sign-in isn’t available in the web build.");
}

export async function googleSignOut(): Promise<void> {}
