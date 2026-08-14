import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, ApiError, type IssueCategory } from "@/api/client";
import { Button, Card, Field, Muted, Screen, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { Radius, Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * Report a problem — the app's half of the website's "blow the whistle" dialog,
 * posting to the same /issues endpoint and the same admin queue.
 *
 * It exists for one reason beyond politeness: a player picks their own first and
 * last name and every other player sees it on the standings, which makes those
 * names user-generated content. Apple guideline 1.2 expects an app showing UGC
 * to give players a way to report what they find objectionable, and "email
 * support" is not that way. Hence "Player's name" in the list below — it is the
 * category that answers 1.2, and the rest come along because a single form is
 * easier to find than four.
 *
 * A modal would mirror the web more closely, but the drawer already gives every
 * account destination a screen of its own, and a reviewer looking for the
 * reporting mechanism finds a menu item faster than a button inside a dialog.
 */

const CATEGORIES = [
  { key: "bug", label: "Bug" },
  { key: "scores", label: "Wrong result" },
  { key: "account", label: "Account" },
  { key: "player", label: "Player’s name" },
  { key: "other", label: "Other" },
] as const satisfies readonly { key: IssueCategory; label: string }[];

/** What to ask for, per category, so the report arrives actionable. */
const PROMPT: Record<IssueCategory, string> = {
  bug: "What were you doing, and what happened instead?",
  scores: "Which match, and what should the result have been?",
  account: "What can’t you do? Don’t include your password.",
  player: "Which player, and what’s wrong with their name?",
  other: "Tell us what happened.",
};

export default function ReportScreen() {
  const { token } = useSession();
  const { colors } = useTheme();
  const router = useRouter();

  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const ready = category !== null && message.trim().length > 0 && !!token;

  async function send() {
    if (!token || category === null || !ready) return;
    setSending(true);
    try {
      await api.reportIssue(token, {
        category,
        message: message.trim(),
        // The web sends the pathname the player was on. Here that would always
        // be this screen, so it says where the report came from instead — the
        // useful half of the same context.
        page: "mobile",
      });
      setCategory(null);
      setMessage("");
      Alert.alert("Got it — we’re on it", "Thanks for flagging it. We’ll take a look.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        "Couldn’t send that",
        err instanceof ApiError ? err.message : "Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <Card style={{ gap: Space.sm }}>
        <Title style={{ fontSize: Type.md }}>Report an issue</Title>
        <Muted>
          Something broken, a result that looks wrong, or a player’s name that shouldn’t be on
          the boards — tell us here and it goes straight to us.
        </Muted>

        <View style={styles.cats} accessibilityRole="radiogroup">
          {CATEGORIES.map((c) => {
            const on = category === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                disabled={sending}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: sending }}
                style={({ pressed }) => [
                  styles.cat,
                  {
                    backgroundColor: on ? colors.accentWash : "transparent",
                    borderColor: on ? colors.accent : colors.rule2,
                    opacity: sending ? 0.5 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: on ? colors.accentInk : colors.ink,
                    fontSize: Type.sm,
                    fontWeight: on ? Weight.bold : Weight.medium,
                  }}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field
          label="What happened?"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          maxLength={2000}
          editable={!sending}
          textAlignVertical="top"
          style={{ minHeight: 120, paddingTop: Space.sm }}
          help={category ? PROMPT[category] : "Pick what it’s about first."}
        />

        <Button
          label="Send report"
          onPress={() => void send()}
          busy={sending}
          disabled={!ready}
        />
        <Muted style={{ fontSize: Type.xs }}>
          Five reports a day, per account. We read every one, and we’ll act on a name that
          breaks the rules — see Rules for what that means.
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cats: { flexDirection: "row", flexWrap: "wrap", gap: Space.xs },
  cat: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm,
    minHeight: 44,
    justifyContent: "center",
  },
});
