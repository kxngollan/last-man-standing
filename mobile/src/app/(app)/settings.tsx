import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { request, ApiError } from "@/api/client";
import { Button, Card, Field, Lede, Muted, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { Space, Text as Type, useTheme } from "@/theme";

/**
 * Your name and password — the two things the web settings page lets you
 * change, against the same endpoints.
 *
 * Changing a password ends every other session by design, this one included,
 * so we sign out afterwards and let them back in with the new one rather than
 * leaving a token that's about to start failing.
 */
export default function SettingsScreen() {
  const { token, user, signOut } = useSession();
  const { colors } = useTheme();

  const [first, setFirst] = useState(user?.name?.split(" ")[0] ?? "");
  const [last, setLast] = useState(user?.name?.split(" ").slice(1).join(" ") ?? "");
  const [savingName, setSavingName] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

      <Card style={{ gap: Space.xxs }}>
        <Muted>Signed in as</Muted>
        <Lede style={{ color: colors.ink }}>{user?.email}</Lede>
        {/* Signing out lives in the sidebar. One place for it means you always
            know where it is, and it isn't sitting under a password form where
            a mis-tap is expensive. */}
        <Muted>Log out from the menu, top left.</Muted>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Space.md, gap: Space.md, paddingBottom: Space.xxl },
});
