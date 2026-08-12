import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { api, type PickSummary, type PortalState } from "@/api/client";
import { Card, Lede, Muted, Pill, Title } from "@/components/ui";
import { Crest } from "@/components/crest";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/useApi";
import { Space, Text as Type, useTheme } from "@/theme";

type Dashboard = PortalState & { summary: PickSummary | null };

/** Result wording and colour, matching the web's status pills. */
function resultPill(result: string): { label: string; tone: "safe" | "out" | "wild" } {
  switch (result) {
    case "win":
      return { label: "Won", tone: "safe" };
    case "safe":
      return { label: "Safe", tone: "safe" };
    case "draw":
      return { label: "Drew", tone: "out" };
    case "loss":
      return { label: "Lost", tone: "out" };
    case "postponed":
      return { label: "Postponed", tone: "wild" };
    default:
      return { label: "Pending", tone: "wild" };
  }
}

/** Every pick you've made this game, newest first — the web's "My picks". */
export default function MyPicksScreen() {
  const { token } = useSession();
  const { colors } = useTheme();
  const { data, error, refreshing, refresh } = useApi<Dashboard>(
    () => (token ? api.game(token) : null),
    [token]
  );

  const history = [...(data?.history ?? [])].reverse();

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

      {data?.entry && (
        <Card style={{ gap: Space.xxs }}>
          <Muted>Survived</Muted>
          <Title style={{ fontSize: Type.xl }}>
            {data.entry.survivedWeeks} {data.entry.survivedWeeks === 1 ? "week" : "weeks"}
          </Title>
          {data.entry.wildcardUsed && <Pill tone="wild" label="Wildcard used" />}
        </Card>
      )}

      {history.map((pick) => {
        const { label, tone } = resultPill(pick.result);
        return (
          <Card key={`${pick.gameWeek}-${pick.matchday}`} style={styles.row}>
            <Crest uri={pick.crest} tla={pick.tla} size={32} />
            <View style={{ flex: 1 }}>
              <Muted>Week {pick.gameWeek}</Muted>
              <Lede style={{ color: colors.ink, fontSize: Type.md }}>
                {pick.teamName ?? "No pick"}
              </Lede>
            </View>
            <View style={{ alignItems: "flex-end", gap: Space.xxs }}>
              <Pill tone={tone} label={label} />
              {pick.isWildcard && <Pill tone="wild" label="Wildcard" />}
            </View>
          </Card>
        );
      })}

      {history.length === 0 && error === "" && (
        <Muted>No picks yet. Make your first one from “Make pick”.</Muted>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Space.md, gap: Space.xs, paddingBottom: Space.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: Space.sm },
});
