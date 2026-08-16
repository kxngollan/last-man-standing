import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { Button, Checkbox, Field, Lede, Muted, Screen, Title } from "@/components/ui";
import { BuntingArt, NightMatchArt } from "@/components/football-art";
import { SocialButtons } from "@/components/social";
import { MIN_AGE, PARENTAL_CONSENT_AGE, needsGuardian, parseDob } from "@/lib/dob";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

export default function SignUp() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [parentalConsent, setParentalConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Derived from what's typed, so correcting a mistyped year takes the extra
  // question away again.
  const guardian = needsGuardian(parseDob(dob)?.age ?? null);

  async function submit() {
    setServerError("");
    const next: Record<string, string> = {};

    if (!first.trim()) next.first = "Enter your first name.";
    if (!last.trim()) next.last = "Enter your last name.";
    if (!email.trim()) next.email = "Enter your email.";
    if (password.length < 8) next.password = "Use at least 8 characters.";

    const parsed = parseDob(dob);
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
      await api.signup({
        firstName: first.trim(),
        lastName: last.trim(),
        email: email.trim(),
        password,
        dob: parsed.iso,
        parentalConsent,
      });
      setDone(true);
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Couldn’t create your account. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  // The account exists but is unverified, so there's no session to hand out —
  // the link in their inbox is the next step, not a button here.
  if (done) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
        <Screen style={{ justifyContent: "center", maxWidth: 480, alignSelf: "center", width: Math.min(width, 480) }}>
          <View style={[styles.tick, { backgroundColor: colors.safeWash }]}>
            <Muted style={{ color: colors.safeInk, fontSize: Type.lg, fontWeight: Weight.bold }}>
              ✓
            </Muted>
          </View>
          <NightMatchArt width={Math.min(width, 480) - Space.md * 4} />
          <Title>Check your inbox</Title>
          <Lede>
            We&rsquo;ve sent a confirmation link to <Muted style={{ color: colors.ink }}>{email.trim()}</Muted>.
            Open it to verify your account, then log in and join the next game.
          </Lede>
          <Link href="/sign-in" asChild>
            <Button label="Back to log in" onPress={() => {}} />
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
        <Screen style={{ maxWidth: 480, alignSelf: "center", width: Math.min(width, 480) }}>
          <BuntingArt width={Math.min(width, 480) - Space.md * 2} />

          <View style={styles.brand}>
            <View style={[styles.mark, { backgroundColor: colors.accent }]} />
            <Muted style={{ fontWeight: Weight.bold, letterSpacing: 1.2, fontSize: Type.xs }}>
              LAST MAN STANDING
            </Muted>
          </View>

          <Title>Create your account</Title>
          <Lede style={{ marginBottom: Space.sm }}>
            One team a week. Win and you go through — draw or lose and you&rsquo;re out.
          </Lede>

          <View style={styles.names}>
            <View style={{ flex: 1 }}>
              <Field
                label="First name"
                value={first}
                onChangeText={setFirst}
                autoComplete="given-name"
                error={errors.first}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Last name"
                value={last}
                onChangeText={setLast}
                autoComplete="family-name"
                error={errors.last}
              />
            </View>
          </View>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            error={errors.email}
            help="We'll send a confirmation link here."
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            error={errors.password}
            help="At least 8 characters."
          />

          <Field
            label="Date of birth"
            value={dob}
            onChangeText={setDob}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="DD / MM / YYYY"
            maxLength={10}
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

          {/* A social sign-in skips the form entirely — the provider already
              knows the name and has proved the address, so only the age gate is
              left, and that's asked on /social-consent rather than here. */}
          <SocialButtons onError={setServerError} />

          <Link href="/sign-in" style={{ marginTop: Space.xs }}>
            <Muted style={{ textAlign: "center" }}>
              Already have an account? <Muted style={{ color: colors.accent }}>Log in</Muted>
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
  names: { flexDirection: "row", gap: Space.xs },
  tick: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
