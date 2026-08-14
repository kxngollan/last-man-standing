import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { API_URL } from "@/api/client";
import { Radius, Weight, useTheme } from "@/theme";

/**
 * A club's badge, with the three-letter code standing in when there isn't one.
 *
 * Two things make the fallback worth the code. Crests come from an external
 * service (crests.football-data.org) and a phone on a train will fail to load
 * them, and the API returns `crest: null` for clubs it has no badge for — in
 * either case a row with a hole in it reads as broken, where "ARS" reads as a
 * team. `onError` covers the first case, the null check the second.
 */
export function Crest({
  uri,
  tla,
  size = 24,
}: {
  uri?: string | null;
  tla?: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  // Badges we host ourselves come through as a path ("/crests/ARS.png"), which
  // the website can render as-is and a phone cannot. Resolving it here rather
  // than storing an absolute URL keeps the server free to change domain without
  // a database full of stale hostnames.
  const src = uri?.startsWith("/") ? `${API_URL}${uri}` : uri;

  if (!src || failed) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            borderRadius: Radius.pill,
            backgroundColor: colors.paper3,
          },
        ]}
      >
        <Text
          style={{
            color: colors.neutral,
            fontSize: Math.max(8, size * 0.34),
            fontWeight: Weight.bold,
          }}
          numberOfLines={1}
        >
          {(tla ?? "—").slice(0, 3)}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: src }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      // Badges are all shapes; contain keeps them whole rather than cropping.
      contentFit="contain"
      // Kept across launches: the same 20 badges appear on every screen, and
      // re-fetching them on mobile data would be wasteful.
      cachePolicy="memory-disk"
      transition={120}
      accessibilityLabel={tla ? `${tla} crest` : undefined}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});

export default Crest;
