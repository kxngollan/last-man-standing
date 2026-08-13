import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SessionProvider, useSession } from "@/lib/session";
import { useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync();

/**
 * Signed in or not, decided in one place.
 *
 * `Stack.Protected` is the current expo-router way: each group states the
 * condition under which it may be entered, and a failed guard sends the player
 * to the other side — including on a deep link, which a redirect-in-an-effect
 * would have let through for a frame first.
 */
function RootNavigator() {
  const { token, loading, locked } = useSession();
  const { colors } = useTheme();

  // Hold the splash until we know whether there's a stored token, so nobody
  // sees the login screen flash before their session is restored.
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* A guarded token in the keychain and no face yet. Its own state, ahead
          of the signed-out screens: there's a valid session here, it just
          hasn't been opened, so offering a login form would be the wrong ask.
          `locked` is only ever true while `token` is null, so this can't
          compete with the guard above. */}
      <Stack.Protected guard={locked}>
        <Stack.Screen name="lock" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!token && !locked}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        {/* Signing up is a signed-out destination too — inside the same guard,
            so a session that arrives mid-flow can't leave you stranded on a
            form for an account you already have. */}
        <Stack.Screen name="sign-up" options={{ headerShown: false }} />
        {/* Same guard again: forgetting a password is something only a
            signed-out player does, and the reset itself finishes in a browser. */}
        <Stack.Screen name="forgot" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { scheme } = useTheme();
  return (
    // The drawer's swipe-to-open needs this wrapping the whole tree; without
    // it the gesture is silently dead on native.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <RootNavigator />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
