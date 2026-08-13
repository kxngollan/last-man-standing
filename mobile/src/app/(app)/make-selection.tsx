import { useCallback, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { api, ApiError, type PickSummary, type PortalState } from '@/api/client'
import { Button, Lede, Muted, Pill, Screen, Spinner, Title } from '@/components/ui'
import { Crest } from '@/components/crest'
import { DeadlinePill } from '@/components/countdown'
import { TopPicks } from '@/components/top-picks'
import { useSession } from '@/lib/session'
import { useApi } from '@/lib/useApi'
import { Radius, Space, Text as Type, Weight, useTheme } from '@/theme'

type Dashboard = PortalState & { summary: PickSummary | null }

/**
 * Make pick — Workbench, the same family the web app uses for this screen.
 *
 * The shape is the point. Twenty clubs as full-width rows is ~1,200pt of
 * scrolling, so anything past about the letter C is off-screen and the ones
 * near the bottom of the alphabet may as well not exist. A two-column grid of
 * compact tiles puts ten clubs in view at once and halves the reach to the
 * last one. The summary stays pinned above the grid so the answer to "what am
 * I on, and how long have I got" never scrolls away while you browse.
 */
export default function MakeSelectionScreen() {
  const { token } = useSession()
  const { colors } = useTheme()
  const [saving, setSaving] = useState<number | null>(null)

  const { data, error, refreshing, refresh } = useApi<Dashboard>(() => (token ? api.game(token) : null), [token])

  const pick = useCallback(
    async (teamApiId: number, teamName: string) => {
      if (!token || data?.locked) return
      setSaving(teamApiId)
      try {
        await api.makePick(token, teamApiId)
        await refresh()
      } catch (err) {
        Alert.alert(
          'Couldn’t make that pick',
          err instanceof ApiError ? err.message : `We couldn’t put you on ${teamName}.`
        )
      } finally {
        setSaving(null)
      }
    },
    [token, data?.locked, refresh]
  )

  const toggleWildcard = useCallback(async () => {
    if (!token) return
    try {
      await api.wildcard(token, !data?.myPick?.isWildcard)
      await refresh()
    } catch (err) {
      Alert.alert('Couldn’t change the wildcard', err instanceof ApiError ? err.message : 'Please try again.')
    }
  }, [token, data?.myPick?.isWildcard, refresh])

  const teams = data?.teams ?? []
  const remaining = teams.filter((t) => !t.used).length

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error !== '' && (
        <View style={[styles.notice, { borderColor: colors.out, backgroundColor: colors.outWash }]}>
          <Lede style={{ color: colors.outInk }}>{error}</Lede>
        </View>
      )}

      {!data && error === '' && <Spinner label='Loading the teams' />}

      {data && (
        <View style={[styles.summary, { backgroundColor: colors.paper2, borderColor: colors.rule }]}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Muted>Week {data.pickGameWeek} · your pick</Muted>
              <Title style={{ fontSize: Type.md }}>{data.myPick?.teamName ?? 'Nothing yet'}</Title>
            </View>
            {data.locked ? <Pill tone='out' label='Locked' /> : <Muted>{remaining} teams left</Muted>}
          </View>

          <DeadlinePill deadline={data.deadline} />

          {!data.locked && (
            <Muted>
              {data.myPick?.teamApiId
                ? 'Tap another club to switch. You can change it until the deadline.'
                : 'Tap a club to pick them.'}
            </Muted>
          )}

          {data.entry && !data.entry.wildcardUsed && !data.locked && data.myPick?.teamApiId && (
            <Button
              variant='ghost'
              label={data.myPick.isWildcard ? 'Take back wildcard' : 'Play wildcard & a draw survives'}
              onPress={toggleWildcard}
            />
          )}
        </View>
      )}

      {/* Two columns of tiles. `flexWrap` rather than FlatList numColumns:
          the list is twenty items on one screen, so the virtualisation would
          cost more than it saves and would fight the outer scroll. */}
      <View style={styles.grid}>
        {teams.map((team) => {
          const chosen = data?.myPick?.teamApiId === team.apiId
          // Your current pick counts as "used" — exclude it, or the club you're
          // on renders greyed out and unpickable. Same guard the web applies.
          const spent = team.used && !chosen
          const disabled = spent || !!data?.locked || saving !== null

          return (
            <Pressable
              key={team.apiId}
              onPress={() => void pick(team.apiId, team.name)}
              disabled={disabled}
              accessibilityRole='button'
              accessibilityLabel={`${team.name}, ${team.venue === 'H' ? 'home to' : 'away to'} ${team.opponent}`}
              accessibilityState={{ selected: chosen, disabled }}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: chosen ? colors.accentWash : colors.paper2,
                  borderColor: chosen ? colors.accent : colors.rule,
                  borderWidth: chosen ? 1.5 : 1,
                  opacity: spent ? 0.4 : pressed ? 0.85 : 1
                }
              ]}
            >
              <Crest uri={team.crest} tla={team.tla} size={34} />
              <Text
                style={{
                  color: chosen ? colors.accentInk : colors.ink,
                  fontSize: Type.sm,
                  fontWeight: Weight.semibold,
                  textAlign: 'center'
                }}
                numberOfLines={1}
              >
                {team.shortName}
              </Text>
              <Muted style={{ fontSize: Type.xs, textAlign: 'center' }} numberOfLines={1}>
                {team.venue === 'H' ? 'v' : '@'} {team.opponent}
              </Muted>

              {chosen && <Pill tone='safe' label='Picked' />}
              {spent && <Pill tone='out' label='Used' />}
            </Pressable>
          )
        })}
      </View>

      <TopPicks summary={data?.summary} limit={5} />

      {/* Gated on `data` so this reads as "the week has no fixtures" rather than
          appearing for the second before the first response lands. */}
      {data && teams.length === 0 && <Muted>No teams to pick from yet.</Muted>}
    </Screen>
  )
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: Radius.card, padding: Space.sm },
  summary: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Space.sm,
    gap: Space.xs
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xs },
  tile: {
    // Two per row, accounting for the gap between them.
    width: '48.5%',
    borderRadius: Radius.card,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.xs,
    alignItems: 'center',
    gap: Space.xxs,
    minHeight: 108,
    justifyContent: 'center'
  }
})
