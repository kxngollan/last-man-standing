import { forwardRef } from "react";
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
  variant?: "primary" | "ghost";
  busy?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", busy, disabled }: ButtonProps) {
  const { colors } = useTheme();
  const off = disabled || busy;
  const primary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? colors.accent : "transparent",
          borderColor: primary ? "transparent" : colors.rule2,
          opacity: off ? 0.5 : pressed ? 0.9 : 1,
        },
      ]}
    >
      {busy && <ActivityIndicator size="small" color={primary ? colors.accentInk : colors.ink} />}
      <Text
        style={{
          color: primary ? colors.accentInk : colors.ink,
          fontSize: Type.sm,
          fontWeight: Weight.bold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  help?: string;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, help, style, ...props },
  ref
) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: Space.xxs }}>
      <Text style={{ color: colors.ink, fontSize: Type.sm, fontWeight: Weight.semibold }}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          {
            backgroundColor: colors.paper,
            borderWidth: 1,
            borderColor: error ? colors.out : colors.rule2,
            borderRadius: Radius.input,
            paddingHorizontal: Space.sm,
            minHeight: 44,
            color: colors.ink,
            fontSize: Type.base,
          },
          style,
        ]}
      />
      {(error || help) && (
        <Text style={{ color: error ? colors.outInk : colors.muted, fontSize: Type.xs }}>
          {error || help}
        </Text>
      )}
    </View>
  );
});

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
