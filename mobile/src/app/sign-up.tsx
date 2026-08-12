import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { Button, Field, Lede, Muted, Screen, Title } from "@/components/ui";
import { BuntingArt, NightMatchArt } from "@/components/football-art";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

const MIN_AGE = 16;

/**
 * Date of birth, typed rather than picked.
 *
 * A native date picker would mean another native dependency and a different
 * control on every platform; a plain numeric field works everywhere and is
 * faster for a date thirty years back, which no spinner is good at. We accept
 * what people actually type — slashes, dots, dashes, or nothing — and turn it
 * into the ISO string the API wants.
 */
function parseDob(raw: string): { iso: string; age: number } | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects the 31st of a 30-day month, and the 29th of a non-leap February —
  // JS would silently roll those forward into the next month.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  const now = new Date();
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day);
  if (beforeBirthday) age--;

  return { iso: date.toISOString().slice(0, 10), age };
}

export default function SignUp() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
