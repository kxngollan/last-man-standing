import { RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { request } from "@/api/client";
import { Button, Card, Lede, Muted, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { useApi } from "@/lib/useApi";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

interface Referrals {
  handle: string;
  url: string;
  count: number;
  board: { rows: Array<{ rank: number; name: string; count: number; you: boolean }> };
}

/** Your invite link and the leaderboard it feeds. */
export default function ReferralsScreen() {
  const { token } = useSession();
  const { colors } = useTheme();
  const { data, error, refreshing, refresh } = useApi<Referrals>(
    () => (token ? request<Referrals>("/referrals", { token }) : null),
    [token]
  );

  async function share() {
    if (!data) return;
    // The OS sheet — the natural way to hand a link to someone on a phone,
    // rather than the web's copy-to-clipboard.
    await Share.share({
      message: `Join my Last Man Standing game: ${data.url}`,
      url: data.url,
    });
  }

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
          <Card style={{ gap: Space.xs }}>
            <Muted>Your link</Muted>
            <Lede style={{ color: colors.ink, fontSize: Type.md }}>{data.url}</Lede>
            <Button label="Share link" onPress={() => void share()} />
          </Card>

          <Card style={{ gap: Space.xxs }}>
            <Muted>Players you&rsquo;ve brought in</Muted>
            <Title style={{ fontSize: Type.xl }}>{data.count}</Title>
            <Muted>They count once they confirm their email.</Muted>
          </Card>

          {data.board?.rows?.length > 0 && (
            <Card style={{ gap: Space.xs }}>
              <Muted style={{ fontWeight: Weight.bold }}>Leaderboard</Muted>
              {data.board.rows.slice(0, 10).map((row) => (
                <View key={`${row.rank}-${row.name}`} style={styles.row}>
                  <Lede style={{ color: row.you ? colors.accent : colors.ink }}>
                    {row.rank}. {row.name}
                    {row.you ? " (you)" : ""}
                  </Lede>
                  <Muted>{row.count}</Muted>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Space.md, gap: Space.md, paddingBottom: Space.xxl },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
