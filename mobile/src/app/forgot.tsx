import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { Button, Field, Lede, Muted, Screen, Title } from "@/components/ui";
import { BuntingArt } from "@/components/football-art";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * "I've forgotten my password" — the same two steps as the web's /forgot.
 *
 * The reset itself happens on the website: the emailed link opens /reset, and
 * the token is single-use, so there's deliberately no native screen competing
 * for it. This screen's whole job is to get the address to the server and then
 * point at the inbox — the same shape as sign-up's confirmation step.
 */

// Mirrors the web's lib/isEmail. Copied rather than imported because that file
// is server-side app code Metro can't resolve; it's one regex, and the server
// validates again regardless.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Matches the web form's resend gap, so neither door invites the rate limit. */
const RESEND_SECONDS = 30;

export default function Forgot() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const panel = Math.min(width, 480);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // One timeout per remaining second, cleared on unmount — an interval would
  // keep ticking against a screen the player has already left.
  useEffect(() => {
    if (cooldown === 0) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function send() {
    const address = email.trim();
    // Checked here only to save a round trip on an obvious typo; the server is
    // the one that decides.
    if (!EMAIL_RE.test(address)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      await api.forgot(address);
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn’t send the email right now. Please try again shortly."
      );
    } finally {
      setBusy(false);
    }
  }

  // The link is in their inbox now, so there's nothing to do here but offer
  // another one — and only once the cooldown is up.
  if (sent) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
        <Screen style={{ justifyContent: "center", maxWidth: 480, alignSelf: "center", width: panel }}>
          <View style={[styles.tick, { backgroundColor: colors.safeWash }]}>
            <Muted style={{ color: colors.safeInk, fontSize: Type.lg, fontWeight: Weight.bold }}>
              ✓
            </Muted>
          </View>

          <Title>Check your email</Title>
          <Lede>
            We&rsquo;ve sent a password reset link to{" "}
            <Muted style={{ color: colors.ink }}>{email.trim()}</Muted>. It expires in 1 hour.
          </Lede>

          {error !== "" && (
            <Lede style={{ color: colors.outInk }} accessibilityRole="alert">
              {error}
            </Lede>
          )}

          <Button
            label={
              cooldown > 0
                ? `Resend available in ${cooldown}s`
                : busy
                  ? "Sending…"
                  : "Resend email"
            }
            onPress={send}
            variant="ghost"
            busy={busy}
            disabled={cooldown > 0}
          />

          <Link href="/sign-in" asChild>
            <Button label="Back to log in" onPress={() => {}} variant="ghost" />
          </Link>
        </Screen>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
        <Screen style={{ justifyContent: "center", maxWidth: 480, alignSelf: "center", width: panel }}>
          <BuntingArt width={panel - Space.md * 2} />

          <View style={styles.brand}>
            <View style={[styles.mark, { backgroundColor: colors.accent }]} />
            <Muted style={{ fontWeight: Weight.bold, letterSpacing: 1.2, fontSize: Type.xs }}>
              LAST MAN STANDING
            </Muted>
          </View>

          <Title>Reset your password</Title>
          <Lede style={{ marginBottom: Space.md }}>
            Enter your email and we&rsquo;ll send you a reset link.
          </Lede>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            returnKeyType="send"
            onSubmitEditing={send}
            error={error || undefined}
          />

          <Button
            label={busy ? "Sending…" : "Send reset link"}
            onPress={send}
            busy={busy}
          />

          <Link href="/sign-in" style={{ marginTop: Space.md }}>
            <Muted style={{ textAlign: "center" }}>
              Remembered it?{" "}
              <Muted style={{ color: colors.accent, fontWeight: Weight.semibold }}>Log in</Muted>
            </Muted>
          </Link>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: Space.xs, marginBottom: Space.md },
  mark: { width: 22, height: 22, borderRadius: 6 },
  tick: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
