import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, type LeagueTable } from "@/api/client";
import { Card, Lede, Muted } from "@/components/ui";
import { Crest } from "@/components/crest";
import { useApi } from "@/lib/useApi";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

/** The Premier League table. Public — no token needed, same as the web. */
export default function TableScreen() {
  const { colors } = useTheme();
  const { data, error, refreshing, refresh } = useApi<LeagueTable>(() => api.table(), []);

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
          <View style={[styles.head, { borderBottomColor: colors.rule }]}>
            <Text style={[styles.pos, { color: colors.muted, fontSize: Type.xs }]}>#</Text>
            <Text style={[styles.club, { color: colors.muted, fontSize: Type.xs }]}>Club</Text>
            <Text style={[styles.num, { color: colors.muted, fontSize: Type.xs }]}>P</Text>
            <Text style={[styles.num, { color: colors.muted, fontSize: Type.xs }]}>GD</Text>
            <Text style={[styles.num, { color: colors.muted, fontSize: Type.xs }]}>Pts</Text>
          </View>

          {data.rows.map((row) => (
            <View key={row.tla} style={[styles.row, { borderBottomColor: colors.rule }]}>
              <Text style={[styles.pos, { color: colors.muted, fontSize: Type.sm }]}>
                {row.position}
              </Text>
              <View style={styles.club}>
                <Crest uri={row.crest} tla={row.tla} size={22} />
                <Text
                  style={{ color: colors.ink, fontSize: Type.sm, fontWeight: Weight.medium }}
                  numberOfLines={1}
                >
                  {row.shortName}
                </Text>
              </View>
              <Text style={[styles.num, { color: colors.ink2, fontSize: Type.sm }]}>
                {row.played}
              </Text>
              <Text style={[styles.num, { color: colors.ink2, fontSize: Type.sm }]}>
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </Text>
              <Text
                style={[
                  styles.num,
                  { color: colors.ink, fontSize: Type.sm, fontWeight: Weight.bold },
                ]}
              >
                {row.points}
              </Text>
            </View>
          ))}

          <Muted style={{ marginTop: Space.sm }}>Season {data.season}</Muted>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Space.md, paddingBottom: Space.xxl },
  head: { flexDirection: "row", alignItems: "center", paddingBottom: Space.xs, borderBottomWidth: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Space.sm,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  pos: { width: 28 },
  club: { flex: 1, flexDirection: "row", alignItems: "center", gap: Space.xs },
  num: { width: 42, textAlign: "right" },
});
