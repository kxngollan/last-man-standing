import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Everything static lives in app.json. This file exists for one thing Expo's
 * JSON can't do: fail the build when the app is about to be packaged pointing at
 * nowhere.
 *
 * src/api/client.ts falls back to localhost so the simulators work with no setup.
 * That fallback is right in development and catastrophic in a release — a store
 * reviewer would open the app, every screen would fail to load, and the app
 * would be rejected under App Store guideline 2.1 for a backend that isn't
 * running. Worse, it would be plain HTTP, which iOS App Transport Security and
 * Android's cleartext policy both block outright.
 *
 * So a release build has to name a real https server, and if it hasn't, this
 * throws now — at build time, where a missing variable is a one-line fix —
 * rather than shipping an app that opens to five empty screens.
 *
 * Set it once per environment and it stays set:
 *
 *     eas env:create --name EXPO_PUBLIC_API_URL --value https://your-domain \
 *       --environment production --visibility plaintext
 */

// EAS sets EAS_BUILD_PROFILE to the profile named in `eas build --profile`.
// Absent for `expo start`, which is exactly when the localhost fallback is
// wanted.
const RELEASE_PROFILES = ["production", "preview"];

/**
 * Whether this run is packaging something that could reach a user.
 *
 * The EAS profile catches cloud builds. NODE_ENV catches the rest — a local
 * release build (`expo run:ios --configuration Release`) and `expo export` both
 * set it to "production" without any EAS variable in sight, and those would
 * otherwise slip past the check entirely.
 */
function isRelease(profile: string | undefined): boolean {
  if (profile && RELEASE_PROFILES.includes(profile)) return true;
  return process.env.NODE_ENV === "production";
}

function assertApiUrl(profile: string | undefined): void {
  if (!isRelease(profile)) return;

  const url = process.env.EXPO_PUBLIC_API_URL;
  const which = profile ? `the "${profile}" profile` : "a production bundle";
  if (!url) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is not set, and this is ${which}.\n` +
        "Without it the app ships pointing at http://localhost:3000 and every screen fails.\n" +
        "Set it in eas.json's build profile, or with:\n" +
        "  eas env:create --name EXPO_PUBLIC_API_URL --value https://your-domain " +
        `--environment ${profile === "preview" ? "preview" : "production"} --visibility plaintext`
    );
  }
  if (!url.startsWith("https://")) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is "${url}", which isn't https.\n` +
        "iOS App Transport Security and Android's cleartext policy both block plain HTTP, " +
        "so the app would be unable to reach its own server on either platform."
    );
  }
}

/**
 * Google sign-in's iOS half needs a custom URL scheme, and the scheme is not a
 * free choice: Google redirects back to the app through the client ID with its
 * dotted parts reversed, so it has to be derived from the ID rather than typed
 * beside it. Two places holding the same string is two places to get it wrong,
 * and the failure — Google's sheet opening and then never coming back — gives
 * no hint which of them is stale.
 *
 * So `extra.googleClientIds.ios` in app.json is the single copy, and the plugin
 * argument is computed from it here. That's the one thing the JSON can't do,
 * which is what this file is for.
 *
 * Android needs nothing equivalent: it matches the app by signing certificate
 * (the SHA-1 fingerprints registered in the Cloud console), not by scheme.
 */
const GOOGLE_PLUGIN = "@react-native-google-signin/google-signin";

function iosUrlScheme(clientId: string): string {
  return `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, "")}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  assertApiUrl(process.env.EAS_BUILD_PROFILE);

  const iosClientId = (config.extra?.googleClientIds as { ios?: string } | undefined)?.ios;

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      // Absent the iOS ID there's nothing to configure — the app drops the
      // Google button rather than failing to build (see src/lib/google.ts).
      ...(iosClientId ? [[GOOGLE_PLUGIN, { iosUrlScheme: iosUrlScheme(iosClientId) }]] : []),
    ],
  } as ExpoConfig;
};
