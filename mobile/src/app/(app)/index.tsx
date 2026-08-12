import { useCallback } from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import { useRouter } from "expo-router";
import { api, type PickSummary, type PortalState } from "@/api/client";
import { Card, Lede, Muted, Pill, Screen, Title } from "@/components/ui";
import { Crest } from "@/components/crest";
import { DeadlinePill } from "@/components/countdown";
import { TopPicks } from "@/components/top-picks";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/useApi";
import { Radius, Space, Text as Type, Weight, useTheme } from "@/theme";

type Dashboard = PortalState & { summary: PickSummary | null };

/**
 * How long until picks lock, said the way a person would.
 *
 * "Fri 21 Aug, 20:00" makes you do the arithmetic; "Locks in 3 days" doesn't.
 * Both are shown — the countdown carries the urgency, the date carries the
 * detail — because the deadline is the one fact this game runs on.
 */
function untilDeadline(iso: string | null): { urgency: string; when: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const ms = date.getTime() - Date.now();
  const when = date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (ms <= 0) return { urgency: "Locked", when };

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return { urgency: `Locks in ${Math.max(1, Math.round(ms / 60_000))} min`, when };
  if (hours < 24) return { urgency: `Locks in ${hours} ${hours === 1 ? "hour" : "hours"}`, when };
  const days = Math.round(hours / 24);
  return { urgency: `Locks in ${days} ${days === 1 ? "day" : "days"}`, when };
}

/**
 * The dashboard — Stat-Led, matching the web app's family for this route.
 *
 * The screen answers three questions in the order a player asks them: am I
 * still in, what do I have to do, and where do I stand. The middle one used to
 * be missing entirely — the old screen showed your pick but gave you no way to
 * make one, so the primary action lived two taps away behind a hamburger.
 */
export default function DashboardScreen() {
  const { token } = useSession();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, error, refreshing, refresh } = useApi<Dashboard>(
    () => (token ? api.game(token) : null),
    [token]
  );

  const entry = data?.entry;
  const deadline = untilDeadline(data?.deadline ?? null);
  const hasPick = !!data?.myPick?.teamApiId;
  // PortalState carries the pick's name but not its badge, so look the team up
  // in the same payload rather than showing a nameless disc.
  const picked = data?.teams.find((t) => t.apiId === data?.myPick?.teamApiId);
  const tone = entry?.status === "eliminated" ? "out" : entry?.status === "winner" ? "wild" : "safe";

  const goPick = useCallback(() => router.push("/make-selection"), [router]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error !== "" && (
        <Card style={{ borderColor: colors.out }}>
          <Lede style={{ color: colors.outInk }}>{error}</Lede>
        </Card>
      )}

      {data && !data.game && (
        <Card>
          <Lede>No game is running yet. You&rsquo;ll be able to join as soon as one opens.</Lede>
        </Card>
      )}

      {data?.game && (
        <>
          {/* Stat-Led: the number leads, everything else qualifies it. One big
              figure and two small ones — three equal tiles is the templated
              shape Hum bans, and it also buries the fact that matters most. */}
          <View style={styles.statRow}>
            <Card style={styles.statBig}>
              <Muted>Still standing</Muted>
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 56,
                  fontWeight: Weight.bold,
                  lineHeight: 60,
                }}
              >
                {data.players.alive}
              </Text>
              <Muted>of {data.players.total} players</Muted>
            </Card>

            <View style={styles.statSide}>
              <Card style={styles.statSmall}>
                <Muted>Your run</Muted>
                <Title style={{ fontSize: Type.lg }}>{entry?.survivedWeeks ?? 0}w</Title>
              </Card>
              <Card style={styles.statSmall}>
                <Muted>Teams left</Muted>
                <Title style={{ fontSize: Type.lg }}>
                  {data.teams.filter((t) => !t.used).length}
                </Title>
              </Card>
            </View>
          </View>

          {/* The one thing to do this week, as a tappable surface rather than a
              read-only line. Its wording changes with state so it never asks
              for something that's already done. */}
          <Pressable
            onPress={goPick}
            disabled={data.locked}
            accessibilityRole="button"
            accessibilityLabel={hasPick ? "Change your pick" : "Make your pick"}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: hasPick ? colors.paper2 : colors.accentWash,
                borderColor: hasPick ? colors.rule : colors.accent,
                opacity: data.locked ? 0.6 : pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={{ flex: 1, gap: Space.xxs }}>
              <Muted>Week {data.pickGameWeek}</Muted>
              {hasPick ? (
                <View style={styles.pickRow}>
                  <Crest uri={picked?.crest} tla={picked?.tla} size={28} />
                  <Title style={{ fontSize: Type.md }}>{data.myPick?.teamName}</Title>
                </View>
              ) : (
                <Title style={{ fontSize: Type.md, color: colors.accentInk }}>
                  {data.locked ? "No pick this week" : "Make your pick"}
                </Title>
              )}
              {/* Live, not computed once at render — under an hour this ticks
                  down by the second, which is when it matters. */}
              <View style={styles.pickRow}>
                <DeadlinePill deadline={data.deadline} />
                {deadline && <Muted style={{ fontSize: Type.xs }}>{deadline.when}</Muted>}
              </View>
            </View>

            {!data.locked && (
              <Text style={{ color: colors.ink, fontSize: Type.lg, fontWeight: Weight.bold }}>
                ›
              </Text>
            )}
          </Pressable>

          {entry && (
            <View style={styles.statusRow}>
              <Pill
                tone={tone}
                label={
                  entry.status === "alive"
                    ? "You're still in"
                    : entry.status === "winner"
                      ? "You won"
                      : "You're out"
                }
              />
              {data.myPick?.isWildcard && <Pill tone="wild" label="Wildcard played" />}
            </View>
          )}

          {/* What everyone else is on. Sits above the standings because it's
              about this week's decision, not the running order. */}
          <TopPicks summary={data.summary} limit={3} />

          {data.standings.length > 0 && (
            <Card style={{ gap: Space.xs }}>
              <Muted style={{ fontWeight: Weight.bold }}>Standings</Muted>
              {data.standings.slice(0, 6).map((row) => (
                <View key={row.userId} style={styles.row}>
                  <Lede style={{ color: row.you ? colors.accent : colors.ink }}>
                    {row.rank}. {row.name}
                    {row.you ? " (you)" : ""}
                  </Lede>
                  <Muted>{row.survivedWeeks}w</Muted>
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      {!data && error === "" && <Muted>Loading your game…</Muted>}

      {/* Signing out lives in the sidebar, next to the account links — not
          stranded at the bottom of a screen you have to scroll to reach. */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: "row", gap: Space.xs },
  statBig: { flex: 1.35, gap: Space.xxs, justifyContent: "center" },
  statSide: { flex: 1, gap: Space.xs },
  statSmall: { flex: 1, gap: Space.xxs, justifyContent: "center" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    padding: Space.md,
    minHeight: 88,
  },
  pickRow: { flexDirection: "row", alignItems: "center", gap: Space.xs },
  statusRow: { flexDirection: "row", gap: Space.xs, flexWrap: "wrap" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
