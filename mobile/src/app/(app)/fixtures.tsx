import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, type FixturesWeek } from "@/api/client";
import { Button, Card, Lede, Muted, Spinner } from "@/components/ui";
import { Crest } from "@/components/crest";
import { useApi } from "@/lib/useApi";
import { Radius, Space, Text as Type, Weight, useTheme } from "@/theme";

/** "Sat 15:00" in the phone's own zone — kickoffs come back as ISO. */
function kickoff(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A game week's fixtures, with the same week-stepping the web view has. */
export default function FixturesScreen() {
  const { colors } = useTheme();
  const [matchday, setMatchday] = useState<number | undefined>(undefined);
  const { data, error, refreshing, refresh } = useApi<FixturesWeek>(
    () => api.fixtures(matchday),
    [matchday]
  );

  const current = data?.matchday ?? 0;

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

      {!data && error === "" && <Spinner label="Loading fixtures" />}

      {data && (
        <>
          <View style={styles.stepper}>
            <View style={{ flex: 1 }}>
              <Button
                variant="ghost"
                label="Previous"
                disabled={current <= 1}
                onPress={() => setMatchday(current - 1)}
              />
            </View>
            <Muted style={{ fontWeight: Weight.bold }}>Week {current}</Muted>
            <View style={{ flex: 1 }}>
              <Button
                variant="ghost"
                label="Next"
                disabled={current >= data.totalMatchdays}
                onPress={() => setMatchday(current + 1)}
              />
            </View>
          </View>

          {data.fixtures.map((fixture) => (
            <View
              key={fixture.apiId}
              style={[styles.fixture, { backgroundColor: colors.paper2, borderColor: colors.rule }]}
            >
              <View style={styles.teams}>
                <View style={styles.side}>
                  <Crest uri={fixture.home.crest} tla={fixture.home.tla} size={22} />
                  <Text
                    style={{ color: colors.ink, fontSize: Type.sm, fontWeight: Weight.medium }}
                    numberOfLines={1}
                  >
                    {fixture.home.shortName}
                  </Text>
                </View>
                <View style={styles.side}>
                  <Crest uri={fixture.away.crest} tla={fixture.away.tla} size={22} />
                  <Text
                    style={{ color: colors.ink, fontSize: Type.sm, fontWeight: Weight.medium }}
                    numberOfLines={1}
                  >
                    {fixture.away.shortName}
                  </Text>
                </View>
              </View>

              {/* Scores sit in their own narrow column so each number lines up
                  with its team. A kickoff time can't share it — it's a phrase,
                  not a digit, and 28pt wide it wraps to three lines. */}
              {fixture.homeScore !== null && (
                <View style={styles.score}>
                  <Text style={{ color: colors.ink, fontWeight: Weight.bold }}>
                    {fixture.homeScore}
                  </Text>
                  <Text style={{ color: colors.ink, fontWeight: Weight.bold }}>
                    {fixture.awayScore}
                  </Text>
                </View>
              )}

              <View style={styles.when}>
                <Muted style={styles.status}>
                  {fixture.homeScore === null ? kickoff(fixture.kickoff) : fixture.statusLabel}
                </Muted>
              </View>
            </View>
          ))}

          {data.fixtures.length === 0 && <Muted>No fixtures for this week.</Muted>}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow so the first-load Spinner has a full-height box to centre in.
  scroll: { flexGrow: 1, padding: Space.md, gap: Space.xs, paddingBottom: Space.xxl },
  stepper: { flexDirection: "row", alignItems: "center", gap: Space.sm, marginBottom: Space.xs },
  fixture: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Space.sm,
    gap: Space.sm,
  },
  teams: { flex: 1, gap: Space.xs },
  side: { flexDirection: "row", alignItems: "center", gap: Space.xs },
  score: { width: 28, alignItems: "center", gap: Space.sm },
  when: { width: 96, alignItems: "flex-end" },
  status: { textAlign: "right", fontSize: Type.xs },
});
