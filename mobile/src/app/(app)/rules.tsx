import { Platform, StyleSheet, View } from "react-native";
import { Card, Lede, Muted, Screen, Title } from "@/components/ui";
import { Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * The official rules of the contest, in the app.
 *
 * Not a nice-to-have: App Store review guideline 5.3.2 requires the official
 * rules of a contest to be presented inside the app, and to say plainly that
 * Apple has nothing to do with running it. 5.3.1 requires the developer to be
 * the sponsor, which is the line under "Who runs this".
 *
 * The wording mirrors SITE_FAQS in lib/site.ts so the phone and the site can't
 * describe the same game differently — if the rules change, they change there
 * and here together.
 */

const RULES: Array<{ heading: string; body: string }> = [
  {
    heading: "How to play",
    body: "Each game week, pick one Premier League team you think will win. If they win, you go through to the next week. If they draw or lose, you are knocked out.",
  },
  {
    heading: "One team, once",
    body: "You can only use each team once per game, so save your strongest sides for the harder weeks. Once a team is used it is gone for the rest of that game.",
  },
  {
    heading: "The deadline",
    body: "Picks lock one hour before the game week's first match kicks off. If you haven't picked by then, a team is chosen for you from the ones you have left.",
  },
  {
    heading: "Your wildcard",
    body: "You get one wildcard per game. Play it alongside your weekly pick and a draw is enough to survive — only a loss knocks you out. You can take it back any time before the deadline.",
  },
  {
    heading: "Winning",
    body: "When a single player is left standing, they win that game. If every remaining player falls in the same week, nobody wins and a new game begins.",
  },
  {
    heading: "Who can enter",
    body: "Anyone aged 13 or over with a confirmed email address. Players under 16 need a parent or guardian's permission. One account per person.",
  },
  {
    heading: "What it costs",
    body: "Nothing. Last Man Standing is free to enter and free to play. There are no entry fees, no stakes, no wagers and nothing to buy inside the app. Winning earns you the top of the standings and bragging rights — there is no cash or other prize.",
  },
  {
    heading: "Fair play",
    body: "Fixtures and results come from football-data.org, an independent provider, and are applied to every player the same way. We may remove an account that is used to enter more than once, that carries an offensive name, or that is used to interfere with the game.",
  },
];

export default function RulesScreen() {
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={styles.head}>
        <Title>Official rules</Title>
        <Lede>
          The whole game in eight lines. Free to enter, 13 and over, no stakes — the last player
          standing wins.
        </Lede>
      </View>

      {RULES.map((rule) => (
        <Card key={rule.heading} style={{ gap: Space.xxs }}>
          <Title style={{ fontSize: Type.md }}>{rule.heading}</Title>
          <Muted>{rule.body}</Muted>
        </Card>
      ))}

      <Card style={{ gap: Space.sm, borderColor: colors.rule2 }}>
        <Muted style={{ fontWeight: Weight.bold, letterSpacing: 1, fontSize: Type.xs }}>
          WHO RUNS THIS
        </Muted>
        <Muted>
          Last Man Standing is run and sponsored by us, the makers of this app. We decide the
          rules, resolve every game week and settle any dispute about a result.
        </Muted>
        {/* Required by App Store review guideline 5.3.2, and true on Android too,
            so it is worded for whichever store the app came from. */}
        <Muted>
          {Platform.OS === "ios"
            ? "Apple is not a sponsor of this contest and is not involved in running it in any manner."
            : "Google is not a sponsor of this contest and is not involved in running it in any manner."}
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: Space.xs, marginBottom: Space.xs },
});
