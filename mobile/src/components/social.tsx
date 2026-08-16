import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError } from "@/api/client";
import { Button, Muted } from "@/components/ui";
import { googleAvailable } from "@/lib/google";
import {
  AppleButtonStyle,
  AppleButtonType,
  AppleButtonView,
  appleAvailable,
} from "@/lib/apple";
import { useSession, type SocialOutcome } from "@/lib/session";
import { Radius, Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * "Continue with Google" and "Continue with Apple", and everything that follows
 * from tapping either.
 *
 * Both /sign-in and /sign-up offer these and both need identical behaviour, so
 * the whole interaction lives here rather than being written twice: the outcome
 * of a social sign-in is three-way, and the two screens getting that fork subtly
 * different is exactly the sort of drift that only shows up in the one case
 * nobody tested.
 *
 * Each button is dropped when its provider can't work here — no client IDs for
 * this platform (lib/google.ts), or an OS that doesn't offer Sign in with Apple
 * (lib/apple.ts). A button that can only fail is worse than no button. With
 * neither available, on Expo Web for instance, even the divider goes.
 */

/** The three-way fork, in one place. */
function useSocialPress(onError: (message: string) => void, provider: "Google" | "Apple") {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const press = useCallback(
    async (run: () => Promise<SocialOutcome>) => {
      onError("");
      setBusy(true);
      try {
        const outcome = await run();
        // "signed-in" needs nothing: the token lands in the session and the
        // root layout's guard swaps the stack over, the same as a password
        // login. "cancelled" needs nothing either — they changed their mind,
        // and an error message would be an accusation.
        if (outcome.status === "needs-consent") router.push("/social-consent");
      } catch (err) {
        onError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : `We couldn’t sign you in with ${provider}. Please try again.`
        );
      } finally {
        setBusy(false);
      }
    },
    [onError, provider, router]
  );

  return { busy, press };
}

export function SocialButtons({ onError }: { onError: (message: string) => void }) {
  const { signInWithGoogle, signInWithApple } = useSession();
  const { colors, scheme } = useTheme();

  const google = useSocialPress(onError, "Google");
  const apple = useSocialPress(onError, "Apple");

  // Apple's answer comes from the OS rather than from configuration, so it has
  // to be asked for. Undefined until it replies — rendering the button and then
  // pulling it away would shift everything under the player's thumb.
  const [appleReady, setAppleReady] = useState(false);
  useEffect(() => {
    let live = true;
    void appleAvailable().then((ok) => {
      if (live) setAppleReady(ok);
    });
    return () => {
      live = false;
    };
  }, []);

  const showApple = appleReady && AppleButtonView !== null;
  if (!googleAvailable && !showApple) return null;

  return (
    <View style={{ gap: Space.md }}>
      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: colors.rule }]} />
        <Muted style={{ fontSize: Type.xs, fontWeight: Weight.semibold }}>OR</Muted>
        <View style={[styles.rule, { backgroundColor: colors.rule }]} />
      </View>

      {googleAvailable && (
        <Button
          label={google.busy ? "Opening Google…" : "Continue with Google"}
          onPress={() => google.press(signInWithGoogle)}
          variant="ghost"
          busy={google.busy}
        />
      )}

      {showApple && (
        // Apple's own control, drawn by the OS — see lib/apple.ts for why it
        // isn't our Button. Sized to match the one above it: the same height
        // and corner, so the pair reads as one stack rather than two.
        <AppleButtonView
          buttonType={AppleButtonType}
          buttonStyle={scheme === "dark" ? AppleButtonStyle.dark : AppleButtonStyle.light}
          cornerRadius={Radius.input}
          style={styles.apple}
          onPress={() => apple.press(signInWithApple)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  rule: { flex: 1, height: 1 },
  // Apple's button ignores most styling; height and width are the two it takes.
  apple: { width: "100%", height: 48 },
});
