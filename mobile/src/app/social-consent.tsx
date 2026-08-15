import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { Button, Checkbox, Field, Lede, Muted, Screen, Title } from "@/components/ui";
import { BuntingArt } from "@/components/football-art";
import { MIN_AGE, PARENTAL_CONSENT_AGE, needsGuardian, parseDob } from "@/lib/dob";
import { useSession } from "@/lib/session";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * The one question Google can't answer for us.
 *
 * Signing in with Google proves an address; it says nothing about age, and the
 * game has a floor of 13 and a guardian's tick under 16. So an address we've
 * never seen comes back from /api/mobile/auth/social as a 409 rather than a new
 * account, and this screen collects the missing part before asking again.
 *
 * Deliberately not a sign-up form. Everything else — name, email, password —
 * either came from Google or doesn't apply, and re-asking for a password would
 * defeat the point of the button they just pressed.
 */
export default function SocialConsent() {
  const { pendingSocial, completeSocial, cancelSocial } = useSession();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [dob, setDob] = useState("");
  const [parentalConsent, setParentalConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  // Nothing to confirm — reloaded onto this route, or the sign-in finished from
  // somewhere else. Declarative rather than an effect: a redirect fired after
  // render would show this form for a frame first, asking a question there is
  // no longer anything to do with the answer to.
  if (!pendingSocial) return <Redirect href="/sign-in" />;

  const parsed = parseDob(dob);
  const guardian = needsGuardian(parsed?.age ?? null);

  async function submit() {
    setServerError("");
    const next: Record<string, string> = {};

    if (!dob.trim()) next.dob = "Enter your date of birth.";
    else if (!parsed) next.dob = "Use DD/MM/YYYY.";
    else if (parsed.age < MIN_AGE) next.dob = `You must be ${MIN_AGE} or older to play.`;
    // The box is only on screen for the band it applies to, so this can only
    // fire when it was there to be ticked.
    if (guardian && !parentalConsent) {
      next.parentalConsent = "Please confirm a parent or guardian has given you permission.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed) return;

    setBusy(true);
    try {
      await completeSocial(parsed.iso, parentalConsent);
      // No navigation: the token lands in the session and the root layout's
      // guard swaps the stack over on its own.
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Couldn’t finish signing you in. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function abandon() {
    cancelSocial();
    router.replace("/sign-in");
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.safe}
      >
        <Screen style={{ maxWidth: 480, alignSelf: "center", width: Math.min(width, 480) }}>
          <BuntingArt width={Math.min(width, 480) - Space.md * 2} />

          <View style={styles.brand}>
            <View style={[styles.mark, { backgroundColor: colors.accent }]} />
            <Muted style={{ fontWeight: Weight.bold, letterSpacing: 1.2, fontSize: Type.xs }}>
              LAST MAN STANDING
            </Muted>
          </View>

          <Title>One last thing</Title>
          <Lede style={{ marginBottom: Space.sm }}>
            We&rsquo;ll set up your account with{" "}
            <Lede style={{ color: colors.ink, fontWeight: Weight.semibold }}>
              {pendingSocial.email}
            </Lede>
            . There&rsquo;s an age limit on the game, so we need your date of birth first.
          </Lede>

          <Field
            label="Date of birth"
            value={dob}
            onChangeText={setDob}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="DD / MM / YYYY"
            maxLength={10}
            autoFocus
            error={errors.dob}
            help={`You must be ${MIN_AGE} or older to play.`}
          />

          {guardian && (
            <Checkbox
              label="A parent or guardian has given me permission to play."
              checked={parentalConsent}
              onChange={setParentalConsent}
              error={errors.parentalConsent}
              help={`Asked of players under ${PARENTAL_CONSENT_AGE}.`}
            />
          )}

          {serverError !== "" && (
            <Lede style={{ color: colors.outInk }} accessibilityRole="alert">
              {serverError}
            </Lede>
          )}

          <Button
            label={busy ? "Creating account…" : "Create account"}
            onPress={submit}
            busy={busy}
          />
          <Button label="Cancel" onPress={abandon} variant="ghost" disabled={busy} />
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: Space.xs, marginBottom: Space.md },
  mark: { width: 22, height: 22, borderRadius: 6 },
});
