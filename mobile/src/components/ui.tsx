import { forwardRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { Radius, Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * The web's primitives, natively.
 *
 * These are deliberate ports of `.lms-btn`, `.lms-field` and the card surface
 * in app/ui.css — same proportions, same 44pt minimum tap target, same pill
 * radius — so a screen built here lands where the site would put it. Every
 * value comes from the theme; nothing is inlined.
 */

/**
 * Every screen's outer shell.
 *
 * `flexGrow: 1` is the whole point: without it a ScrollView's content box is
 * only as tall as its content, so a short screen leaves the paper colour
 * stopping halfway down and the layout reads as floating in dead space. With
 * it, short screens fill the viewport and long ones still scroll.
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  style,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewProps["style"];
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[
        { flexGrow: 1, padding: Space.md, paddingBottom: Space.xl, gap: Space.sm },
        style,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Title({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[{ color: colors.ink, fontSize: Type.xl, fontWeight: Weight.bold }, style]}
    />
  );
}

export function Lede({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[{ color: colors.ink2, fontSize: Type.sm, lineHeight: Type.sm * 1.5 }, style]}
    />
  );
}

export function Muted({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  return <Text {...props} style={[{ color: colors.muted, fontSize: Type.sm }, style]} />;
}

export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.paper2,
          borderRadius: Radius.card,
          borderWidth: 1,
          borderColor: colors.rule,
          padding: Space.md,
        },
        style,
      ]}
    />
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** `danger` is for the irreversible ones — deleting an account, and nothing else yet. */
  variant?: "primary" | "ghost" | "danger";
  busy?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", busy, disabled }: ButtonProps) {
  const { colors } = useTheme();
  const off = disabled || busy;

  // Filled buttons carry their own ink; the ghost borrows the page's.
  const fill =
    variant === "primary" ? colors.accent : variant === "danger" ? colors.out : "transparent";
  const ink =
    variant === "primary" ? colors.accentInk : variant === "danger" ? colors.onDisc : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: fill,
          borderColor: variant === "ghost" ? colors.rule2 : "transparent",
          opacity: off ? 0.5 : pressed ? 0.9 : 1,
        },
      ]}
    >
      {busy && <ActivityIndicator size="small" color={ink} />}
      <Text style={{ color: ink, fontSize: Type.sm, fontWeight: Weight.bold }}>{label}</Text>
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  help?: string;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, help, style, secureTextEntry, ...props },
  ref
) {
  const { colors } = useTheme();

  /**
   * Masked fields get a reveal toggle. It lives inside the input's own box so
   * the field keeps its single 44pt row — hence absolute positioning and the
   * reserved right padding rather than a wrapping row that would double the
   * borders. Reveal state is per-field and resets on unmount, so nothing is
   * left legible on a screen the user has walked away from.
   */
  const [revealed, setRevealed] = useState(false);
  const maskable = secureTextEntry === true;

  return (
    <View style={{ gap: Space.xxs }}>
      <Text style={{ color: colors.ink, fontSize: Type.sm, fontWeight: Weight.semibold }}>
        {label}
      </Text>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          secureTextEntry={maskable && !revealed}
          {...props}
          style={[
            {
              backgroundColor: colors.paper,
              borderWidth: 1,
              borderColor: error ? colors.out : colors.rule2,
              borderRadius: Radius.input,
              paddingHorizontal: Space.sm,
              paddingRight: maskable ? Space.xxl : Space.sm,
              minHeight: 44,
              color: colors.ink,
              fontSize: Type.base,
            },
            style,
          ]}
        />
        {maskable && (
          <Pressable
            onPress={() => setRevealed((on) => !on)}
            hitSlop={Space.xs}
            accessibilityRole="switch"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            accessibilityState={{ checked: revealed }}
            style={({ pressed }) => [
              { position: "absolute", right: Space.sm, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text
              style={{ color: colors.accent, fontSize: Type.sm, fontWeight: Weight.semibold }}
            >
              {revealed ? "Hide" : "Show"}
            </Text>
          </Pressable>
        )}
      </View>
      {(error || help) && (
        <Text style={{ color: error ? colors.outInk : colors.muted, fontSize: Type.xs }}>
          {error || help}
        </Text>
      )}
    </View>
  );
});

/**
 * First load, before there's anything to show.
 *
 * `flex: 1` is what makes it centred rather than merely indented: Screen's
 * content box already grows to fill the viewport, so a flexible child claims
 * whatever height is left over and centres inside it. On a screen that renders
 * a heading first, that's the space under the heading — which is where the
 * content is about to appear anyway.
 *
 * Deliberately silent. A spinner already says "wait"; a caption underneath only
 * says it again, more slowly. Screen readers get the label instead, since a
 * spinning view announces nothing on its own.
 */
export function Spinner({ label = "Loading" }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.spinner}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

/** A game-state pill — alive, out, wildcard. Icon-free here; label carries it. */
export function Pill({ label, tone = "safe" }: { label: string; tone?: "safe" | "out" | "wild" }) {
  const { colors } = useTheme();
  const wash = { safe: colors.safeWash, out: colors.outWash, wild: colors.wildWash }[tone];
  const ink = { safe: colors.safeInk, out: colors.outInk, wild: colors.wildInk }[tone];
  return (
    <View
      style={{
        backgroundColor: wash,
        borderRadius: Radius.pill,
        paddingHorizontal: Space.sm,
        paddingVertical: Space.xxs,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: ink, fontSize: Type.xs, fontWeight: Weight.bold }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  spinner: { flex: 1, alignItems: "center", justifyContent: "center", padding: Space.xl },
  button: {
    minHeight: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xs,
  },
});
