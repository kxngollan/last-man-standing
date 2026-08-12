import { Drawer } from "expo-router/drawer";
import { usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { Radius, Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * The signed-in shell.
 *
 * The links mirror components/portal/AppBar.tsx one for one — same order, same
 * words ("Standings", "Make pick", "My picks") — so someone who plays on the
 * site doesn't have to relearn anything on their phone. Admin only appears for
 * admins, exactly as it does in the web account menu.
 */

const NAV = [
  { href: "/", label: "Standings" },
  { href: "/make-selection", label: "Make pick" },
  { href: "/team", label: "My picks" },
  { href: "/table", label: "Table" },
  { href: "/fixtures", label: "Fixtures" },
] as const;

const ACCOUNT = [
  { href: "/profile", label: "Profile" },
  { href: "/referrals", label: "Refer a friend" },
  { href: "/settings", label: "Settings" },
] as const;

function DrawerContent({ navigation }: { navigation: { closeDrawer: () => void } }) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const { user, signOut } = useSession();

  function go(href: string) {
    navigation.closeDrawer();
    router.push(href as never);
  }

  function link(item: { href: string; label: string }) {
    // "/" only matches itself; the rest match their own subtree.
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return (
      <Pressable
        key={item.href}
        onPress={() => go(item.href)}
        accessibilityRole="link"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          styles.link,
          {
            backgroundColor: active ? colors.accentWash : pressed ? colors.paper2 : "transparent",
          },
        ]}
      >
        <Text
          style={{
            color: active ? colors.accentInk : colors.ink,
            fontSize: Type.base,
            fontWeight: active ? Weight.bold : Weight.medium,
          }}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={["top", "bottom"]}>
      {/* `flex: 1` on the ScrollView itself, not just its content container.
          Without it the scroller grows to fit its content on native and shoves
          the pinned foot below the screen — while react-native-web quietly
          lays it out correctly, so the bug only shows on a real device. */}
      <ScrollView style={styles.scroller} contentContainerStyle={styles.drawer}>
        <View style={styles.brand}>
          <View style={[styles.mark, { backgroundColor: colors.accent }]} />
          <Text
            style={{
              color: colors.muted,
              fontSize: Type.xs,
              fontWeight: Weight.bold,
              letterSpacing: 1.2,
            }}
          >
            LAST MAN STANDING
          </Text>
        </View>

        <View style={styles.group}>{NAV.map(link)}</View>

        <View style={[styles.rule, { backgroundColor: colors.rule }]} />

        <View style={styles.group}>
          {ACCOUNT.map(link)}
          {user?.isAdmin && link({ href: "/admin", label: "Admin" })}
        </View>
      </ScrollView>

      {/* The account foot sits OUTSIDE the scroller, so it is pinned to the
          bottom of the drawer whatever the nav does. A flex spacer inside the
          ScrollView only looks pinned while the links happen to be shorter
          than the screen — add the admin link, a small phone, or a large text
          size and Log out drops below the fold, which is exactly where nobody
          looks for it. */}
      <View style={[styles.foot, { borderTopColor: colors.rule, backgroundColor: colors.paper }]}>
        <View style={{ paddingHorizontal: Space.sm, gap: 2, marginBottom: Space.xs }}>
          {user?.name ? (
            <Text style={{ color: colors.ink, fontSize: Type.sm, fontWeight: Weight.semibold }}>
              {user.name}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: Type.xs }} numberOfLines={1}>
            {user?.email ?? ""}
          </Text>
        </View>
        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => [
            styles.link,
            styles.logout,
            {
              borderColor: colors.rule2,
              backgroundColor: pressed ? colors.outWash : "transparent",
            },
          ]}
        >
          <Text style={{ color: colors.outInk, fontSize: Type.base, fontWeight: Weight.semibold }}>
            Log out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Drawer
      drawerContent={(props) => (
        <DrawerContent navigation={props.navigation as unknown as { closeDrawer: () => void }} />
      )}
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.paper },
        drawerStyle: { backgroundColor: colors.paper },
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Standings" }} />
      <Drawer.Screen name="make-selection" options={{ title: "Make pick" }} />
      <Drawer.Screen name="team" options={{ title: "My picks" }} />
      <Drawer.Screen name="table" options={{ title: "Table" }} />
      <Drawer.Screen name="fixtures" options={{ title: "Fixtures" }} />
      <Drawer.Screen name="profile" options={{ title: "Profile" }} />
      <Drawer.Screen name="referrals" options={{ title: "Refer a friend" }} />
      <Drawer.Screen name="settings" options={{ title: "Settings" }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  scroller: { flex: 1 },
  drawer: { padding: Space.sm, gap: Space.xxs },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
    padding: Space.sm,
    marginBottom: Space.xs,
  },
  mark: { width: 20, height: 20, borderRadius: 6 },
  group: { gap: 2 },
  link: {
    paddingVertical: Space.sm,
    paddingHorizontal: Space.sm,
    borderRadius: Radius.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  rule: { height: 1, marginVertical: Space.sm },
  logout: { borderWidth: 1, alignItems: "center" },
  foot: { borderTopWidth: 1, paddingTop: Space.sm, paddingHorizontal: Space.sm, paddingBottom: Space.xs },
});
