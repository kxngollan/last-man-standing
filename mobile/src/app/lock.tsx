import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Lede, Muted, Title } from "@/components/ui";
import { BuntingArt } from "@/components/football-art";
import { biometricKind, biometricLabel, type BiometricKind } from "@/lib/biometrics";
import { useSession } from "@/lib/session";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * The door for someone who's already signed in.
 *
 * Deliberately not a password form: there's a valid token sitting in the
 * keychain, and this screen only exists to ask the phone whether to open it.
 * "Use password instead" signs out, which is the honest description of what it
 * does — the guarded token is discarded and they start again.
 */
export default function Lock() {
  const { unlock, signOut } = useSession();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const [kind, setKind] = useState<BiometricKind>("none");
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  // One automatic attempt per mount. Without this the prompt reappears on
  // every re-render after a cancel, which reads as the app arguing.
  const tried = useRef(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const k = await biometricKind();
      if (!live) return;
      setKind(k);

      if (tried.current) return;
      tried.current = true;
      const ok = await unlock();
      if (live) {
        setBusy(false);
        setFailed(!ok);
      }
    })();
    return () => {
      live = false;
    };
  }, [unlock]);

  async function retry() {
    setBusy(true);
    setFailed(false);
    const ok = await unlock();
    setBusy(false);
    setFailed(!ok);
  }

  const label = biometricLabel(kind);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <View style={[styles.body, { maxWidth: 480, width: Math.min(width, 480) }]}>
        <BuntingArt width={Math.min(width, 480) - Space.lg * 2} />

        <View style={styles.brand}>
          <View style={[styles.mark, { backgroundColor: colors.accent }]} />
          <Muted style={{ fontWeight: Weight.bold, letterSpacing: 1.2, fontSize: Type.xs }}>
            LAST MAN STANDING
          </Muted>
        </View>

        <Title>Welcome back</Title>
        <Lede style={{ marginBottom: Space.lg }}>
          {failed
            ? `${label} didn’t open your session. Try again, or log in with your password.`
            : `Confirm it’s you with ${label} to pick up where you left off.`}
        </Lede>

        <View style={{ gap: Space.sm }}>
          <Button
            label={busy ? "Waiting…" : `Unlock with ${label}`}
            onPress={() => void retry()}
            busy={busy}
          />
          <Button label="Use password instead" variant="ghost" onPress={() => void signOut()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: "center", alignSelf: "center", padding: Space.lg },
  brand: { flexDirection: "row", alignItems: "center", gap: Space.xs, marginBottom: Space.xl },
  mark: { width: 22, height: 22, borderRadius: 6 },
});
