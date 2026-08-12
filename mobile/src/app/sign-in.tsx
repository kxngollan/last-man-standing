import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { Button, Field, Lede, Muted, Title } from "@/components/ui";
import { BuntingArt, FloodlitPitchArt } from "@/components/football-art";
import { useSession } from "@/lib/session";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * The app's front door — the same words and the same shape as the web's
 * /login, because a player arriving from the site should recognise it.
 *
 * The credential check happens server-side in attemptLogin(), the same
 * function the website calls, so the rate limits and the "confirm your email
 * first" case behave identically here.
 */
export default function SignIn() {
  const { signIn } = useSession();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // No navigation here: the token lands in the session and the root
      // layout's guard swaps the stack over on its own.
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn’t log you in. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { maxWidth: 480, width: Math.min(width, 480) }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* The same bunting that hangs over the website's auth panel. */}
          <BuntingArt width={Math.min(width, 480) - Space.lg * 2} />

          <View style={styles.brand}>
            <View style={[styles.mark, { backgroundColor: colors.accent }]} />
            <Muted style={{ fontWeight: Weight.bold, letterSpacing: 1.2, fontSize: Type.xs }}>
              LAST MAN STANDING
            </Muted>
          </View>

          <Title>Welcome back</Title>
          <Lede style={{ marginBottom: Space.lg }}>
            Log in to make your pick before the deadline.
          </Lede>

          <View style={{ gap: Space.md }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="next"
              error={error ? " " : undefined}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error || undefined}
            />
            <Button label={busy ? "Logging in…" : "Log in"} onPress={submit} busy={busy} />
          </View>

          <Link href="/sign-up" style={{ marginTop: Space.lg }}>
            <Muted style={{ textAlign: "center" }}>
              New here? <Muted style={{ color: colors.accent, fontWeight: Weight.semibold }}>Create an account</Muted>
            </Muted>
          </Link>

          <Muted style={{ marginTop: Space.md, textAlign: "center" }}>
            One team. One week. Outlast everyone.
          </Muted>

          {/* Pitch plan closing the page, the way the web panel does. Quiet
              line art — it sits under the fold of attention, not over it. */}
          <View style={{ opacity: 0.5, alignItems: "center", marginTop: Space.md }}>
            <FloodlitPitchArt width={Math.min(width, 480) - Space.lg * 4} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignSelf: "center",
    padding: Space.lg,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: Space.xs, marginBottom: Space.xl },
  mark: { width: 22, height: 22, borderRadius: 6 },
});
