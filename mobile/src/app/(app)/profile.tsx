import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { api, type UserProfile } from "@/api/client";
import { Card, Lede, Muted, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/useApi";
import { Space, Text as Type, useTheme } from "@/theme";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={styles.stat}>
      <Muted>{label}</Muted>
      <Title style={{ fontSize: Type.lg }}>{value}</Title>
    </Card>
  );
}

/** Your own record — the same career totals the web profile shows. */
export default function ProfileScreen() {
  const { token, user } = useSession();
  const { colors } = useTheme();
  const { data, error, refreshing, refresh } = useApi<UserProfile>(
    () => (token && user ? api.profile(token, user.id) : null),
    [token, user?.id]
  );

  const stats = data?.stats;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
      }
    >
      {error !== "" && (
        <Card style={{ borderColor: colors.out }}>
          <Lede style={{ color: colors.outInk }}>{error}</Lede>
        </Card>
      )}

      {data && (
        <>
          <View style={{ gap: Space.xxs }}>
            <Title>{data.name}</Title>
            <Muted>
              Member since{" "}
              {new Date(data.memberSince).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Muted>
          </View>

          {stats && (
            <>
              <View style={styles.row}>
                <Stat label="Games" value={stats.gamesPlayed} />
                <Stat label="Wins" value={stats.wins} />
                <Stat label="Best run" value={`${stats.bestRun}w`} />
              </View>
              <View style={styles.row}>
                <Stat label="Picks" value={stats.picksMade} />
                <Stat
                  label="Win rate"
                  value={stats.winRate === null ? "—" : `${Math.round(stats.winRate)}%`}
                />
                <Stat label="Wildcards" value={stats.wildcardsPlayed} />
              </View>

              {stats.favouriteTeam && (
                <Card style={{ gap: Space.xxs }}>
                  <Muted>Most picked</Muted>
                  <Lede style={{ color: colors.ink, fontSize: Type.md }}>
                    {stats.favouriteTeam.name} · {stats.favouriteTeam.count}
                  </Lede>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Space.md, gap: Space.md, paddingBottom: Space.xxl },
  row: { flexDirection: "row", gap: Space.xs },
  stat: { flex: 1, alignItems: "center", gap: Space.xxs },
});
