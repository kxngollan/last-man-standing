import { View, Text, StyleSheet } from "react-native";
import type { PickSummary } from "@/api/client";
import { Crest } from "@/components/crest";
import { Card, Muted } from "@/components/ui";
import { Radius, Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * What the field is backing this week.
 *
 * The same board the website shows on the dashboard and the pick screen, and
 * deliberately the same information: in a survival game the crowd's pick is
 * half the decision — you're choosing whether to follow it or go against it.
 * The player names come capped by the server, so `count` is the real total and
 * the list is only the first few (`+N more` carries the rest).
 */
export function TopPicks({
  summary,
  limit = 3,
  showPlayers = true,
}: {
  summary: PickSummary | null | undefined;
  limit?: number;
  showPlayers?: boolean;
}) {
  const { colors } = useTheme();

  // Nothing picked yet is not an empty state worth drawing — it's just early.
  if (!summary || summary.totalPicks === 0) return null;

  const top = summary.teams.slice(0, limit);
  const max = top[0]?.count ?? 1;

  return (
    <Card style={{ gap: Space.sm }}>
      <View style={{ gap: 2 }}>
        <Muted style={{ fontWeight: Weight.bold }}>Week {summary.gameWeek} picks</Muted>
        <Muted style={{ fontSize: Type.xs }}>
          {summary.totalPicks} {summary.totalPicks === 1 ? "pick" : "picks"} in so far. Everyone
          sees this board.
        </Muted>
      </View>

      <View style={{ gap: Space.sm }}>
        {top.map((team) => (
          <View key={team.teamApiId} style={styles.row}>
            <Crest uri={team.crest} tla={team.tla} size={28} />

            <View style={styles.meta}>
              <Text
                style={{ color: colors.ink, fontSize: Type.sm, fontWeight: Weight.semibold }}
                numberOfLines={1}
              >
                {team.shortName || team.name}
              </Text>

              {showPlayers && team.players.length > 0 && (
                <Muted style={{ fontSize: Type.xs }} numberOfLines={1}>
                  {team.players.join(", ")}
                  {team.count > team.players.length &&
                    ` +${team.count - team.players.length} more`}
                </Muted>
              )}

              {/* Proportional to the most-picked team, with a floor so a single
                  pick still reads as a bar rather than a smudge. */}
              <View style={[styles.bar, { backgroundColor: colors.paper3 }]}>
                <View
                  style={{
                    width: `${Math.max(8, (team.count / max) * 100)}%`,
                    height: "100%",
                    borderRadius: Radius.pill,
                    backgroundColor: colors.accent,
                  }}
                />
              </View>
            </View>

            <Text
              style={{
                color: colors.ink,
                fontSize: Type.md,
                fontWeight: Weight.bold,
                fontVariant: ["tabular-nums"],
              }}
            >
              {team.count}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  meta: { flex: 1, gap: 3 },
  bar: { height: 6, borderRadius: Radius.pill, overflow: "hidden", marginTop: 2 },
});
