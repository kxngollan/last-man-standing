import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError } from "@/api/client";
import { Button, Muted } from "@/components/ui";
import { googleAvailable } from "@/lib/google";
import { useSession } from "@/lib/session";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * "Continue with Google", and everything that follows from tapping it.
 *
 * Both /sign-in and /sign-up offer it and both need identical behaviour, so the
 * whole interaction lives here rather than being written twice: the outcome of
 * a social sign-in is three-way, and the two screens getting that fork subtly
 * different is exactly the sort of drift that only shows up in the one case
 * nobody tested.
 *
 * Renders nothing when there are no client IDs for this platform (see
 * lib/google.ts) — a button that can only fail is worse than no button, and on
 * Expo Web there's no native module to call at all.
 */
export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const { signInWithGoogle } = useSession();
  const { colors } = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!googleAvailable) return null;

  async function press() {
    onError("");
    setBusy(true);
    try {
      const outcome = await signInWithGoogle();
      // "signed-in" needs nothing: the token lands in the session and the root
      // layout's guard swaps the stack over, the same as a password login.
      // "cancelled" needs nothing either — they changed their mind, and an
      // error message would be an accusation.
      if (outcome.status === "needs-consent") router.push("/social-consent");
    } catch (err) {
      onError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "We couldn’t sign you in with Google. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: Space.md }}>
      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: colors.rule }]} />
        <Muted style={{ fontSize: Type.xs, fontWeight: Weight.semibold }}>OR</Muted>
        <View style={[styles.rule, { backgroundColor: colors.rule }]} />
      </View>
      <Button
        label={busy ? "Opening Google…" : "Continue with Google"}
        onPress={press}
        variant="ghost"
        busy={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  rule: { flex: 1, height: 1 },
});
