import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { api, API_URL, request, ApiError } from "@/api/client";
import { Button, Card, Field, Lede, Muted, Title } from "@/components/ui";
import {
  biometricKind,
  biometricLabel,
  isBiometricEnabled,
  type BiometricKind,
} from "@/lib/biometrics";
import { useSession } from "@/lib/session";
import { Space, Text as Type, useTheme } from "@/theme";

/**
 * Your name and password — the two things the web settings page lets you
 * change, against the same endpoints — plus biometric unlock, which is
 * phone-only and so has no counterpart on the site.
 *
 * Changing a password ends every other session by design, this one included,
 * so we sign out afterwards and let them back in with the new one rather than
 * leaving a token that's about to start failing.
 *
 * Deleting the account lives here too, at the bottom, because both app stores
 * require it to be reachable from inside the app rather than by asking us.
 */
export default function SettingsScreen() {
  const { token, user, signOut, enableBiometrics, disableBiometrics } = useSession();
  const { colors } = useTheme();
  const router = useRouter();

  const [first, setFirst] = useState(user?.name?.split(" ")[0] ?? "");
  const [last, setLast] = useState(user?.name?.split(" ").slice(1).join(" ") ?? "");
  const [savingName, setSavingName] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Typing the word is the gate. Case-insensitive here because the request
  // sends the literal "DELETE" the server wants either way — the point of the
  // field is deliberation, not spelling.
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);
  const confirmed = confirmDelete.trim().toUpperCase() === "DELETE";

  // "none" hides the row entirely — a switch that can't be switched is worse
  // than no switch.
  const [kind, setKind] = useState<BiometricKind>("none");
  const [bioOn, setBioOn] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([biometricKind(), isBiometricEnabled()]).then(([k, on]) => {
      if (!live) return;
      setKind(k);
      setBioOn(on);
    });
    return () => {
      live = false;
    };
  }, []);

  async function toggleBiometrics(on: boolean) {
    setBioBusy(true);
    try {
      if (on) {
        // Only reflect it in the UI if the keychain actually took it — a switch
        // that flips on a declined prompt is a lie about where the token is.
        const ok = await enableBiometrics();
        setBioOn(ok);
        if (!ok) {
          Alert.alert(
            `Couldn’t turn on ${biometricLabel(kind)}`,
            "Your session is still saved the usual way. Try again, or check your device settings."
          );
        }
      } else {
        await disableBiometrics();
        setBioOn(false);
      }
    } finally {
      setBioBusy(false);
    }
  }

  async function saveName() {
    if (!token) return;
    setSavingName(true);
    try {
      await request("/me", {
        method: "PATCH",
        token,
        body: { firstName: first.trim(), lastName: last.trim() },
      });
      Alert.alert("Saved", "Your name has been updated.");
    } catch (err) {
      Alert.alert("Couldn’t save", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (!token) return;
    if (next.length < 8) {
      Alert.alert("Too short", "Use at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    try {
      await request("/me/password", {
        method: "POST",
        token,
        body: { currentPassword: current, newPassword: next },
      });
      Alert.alert("Password changed", "Every device has been signed out. Log in again.", [
        { text: "OK", onPress: () => void signOut() },
      ]);
    } catch (err) {
      Alert.alert("Couldn’t change it", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  /**
   * Two gates before anything happens: the typed word, then the OS dialog. The
   * dialog is the one that gets read, so it names what goes rather than asking
   * "are you sure".
   */
  function askToDelete() {
    Alert.alert(
      "Delete your account?",
      "Your picks, your entries and your referrals go with it, on every device. This can’t be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void reallyDelete() },
      ]
    );
  }

  async function reallyDelete() {
    if (!token) return;
    setDeleting(true);
    try {
      await api.deleteAccount(token);
      // The token died with the account, so this isn't ending a session — it's
      // clearing the keychain and the biometric guard off this phone, and it
      // unmounts this screen on the way out.
      await signOut();
    } catch (err) {
      setDeleting(false);
      Alert.alert(
        "Couldn’t delete it",
        err instanceof ApiError ? err.message : "Please try again."
      );
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: Space.sm }}>
        <Title style={{ fontSize: Type.md }}>Your name</Title>
        <Muted>This is how other players see you — as “{first} {last.charAt(0)}.”</Muted>
        <Field label="First name" value={first} onChangeText={setFirst} />
        <Field label="Last name" value={last} onChangeText={setLast} />
        <Button label="Save name" onPress={() => void saveName()} busy={savingName} />
      </Card>

      <Card style={{ gap: Space.sm }}>
        <Title style={{ fontSize: Type.md }}>Password</Title>
        <Muted>Changing it signs out every other device.</Muted>
        <Field
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete="current-password"
        />
        <Field
          label="New password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          help="At least 8 characters."
        />
        <Button
          label="Change password"
          onPress={() => void savePassword()}
          busy={savingPassword}
        />
      </Card>

      {kind !== "none" && (
        <Card style={{ gap: Space.sm }}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Title style={{ fontSize: Type.md }}>{biometricLabel(kind)}</Title>
              <Muted>
                Open the app with {biometricLabel(kind)} instead of typing your password.
              </Muted>
            </View>
            <Switch
              value={bioOn}
              onValueChange={(on) => void toggleBiometrics(on)}
              disabled={bioBusy || !token}
              trackColor={{ true: colors.accent, false: colors.rule2 }}
              thumbColor={colors.paper}
            />
          </View>
          <Muted style={{ fontSize: Type.xs }}>
            Your login stays on this phone. Adding a fingerprint or face to the device
            switches this off, and you’ll log in with your password once more.
          </Muted>
        </Card>
      )}

      <Card style={{ gap: Space.xxs }}>
        <Muted>Signed in as</Muted>
        <Lede style={{ color: colors.ink }}>{user?.email}</Lede>
        {/* Signing out lives in the sidebar. One place for it means you always
            know where it is, and it isn't sitting under a password form where
            a mis-tap is expensive. */}
        <Muted>Log out from the menu, top left.</Muted>
      </Card>

      {/* The policy opens in the system browser rather than a screen of its own:
          it's a long legal document that changes on the website's schedule, and
          a copy in the bundle would be the stale one. */}
      <Card style={{ gap: Space.sm }}>
        <Title style={{ fontSize: Type.md }}>Rules and privacy</Title>
        <Muted>
          How the game is decided, and what we collect to run it. Free to play, 13 and over, no
          stakes — there is nothing to pay for in this app.
        </Muted>
        <Button label="Official rules" variant="ghost" onPress={() => router.push("/rules")} />
        <Button
          label="Privacy policy"
          variant="ghost"
          onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/policy`)}
        />
        {/* Reachable from the drawer too. Duplicated here on purpose: settings
            is where someone looks for it, and where a reviewer checking
            guideline 1.2 looks for it. */}
        <Button
          label="Report an issue"
          variant="ghost"
          onPress={() => router.push("/report")}
        />
      </Card>

      <Card style={{ gap: Space.sm, borderColor: colors.out }}>
        <Title style={{ fontSize: Type.md, color: colors.out }}>Delete account</Title>
        <Muted>
          Deletes your account and everything in it — your picks, your entries, your referrals
          and your name off the boards. Games you played stay, without you in them. It can’t be
          undone, and it happens straight away.
        </Muted>
        <Field
          label="Type DELETE to confirm"
          value={confirmDelete}
          onChangeText={setConfirmDelete}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
        />
        <Button
          label="Delete my account"
          variant="danger"
          onPress={askToDelete}
          busy={deleting}
          disabled={!confirmed || !token}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Space.md, gap: Space.md, paddingBottom: Space.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: Space.md },
  rowText: { flex: 1, gap: Space.xxs },
});
