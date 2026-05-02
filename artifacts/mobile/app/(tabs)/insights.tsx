import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InsightCard } from '@/components/InsightCard';
import { useCycle } from '@/context/CycleContext';
import { useColors } from '@/hooks/useColors';
import { diffDays } from '@/utils/cycleCalculations';

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cycles, avgCycleLength, avgPeriodLength, prediction } = useCycle();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const cycleLengths = (() => {
    if (cycles.length < 2) return [] as number[];
    const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return sorted.slice(1).map((c, i) => diffDays(c.startDate, sorted[i].startDate));
  })();

  const isRegular =
    cycleLengths.length >= 2 &&
    Math.max(...cycleLengths) - Math.min(...cycleLengths) <= 4;

  const daysUntilPeriod = prediction?.daysUntilNextPeriod ?? null;
  const daysUntilOvulation = prediction?.daysUntilOvulation ?? null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topPad + 20,
        paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Insights</Text>

      {cycles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Log your first period in the Today tab to see predictions and insights here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <InsightCard
                title="Avg cycle"
                value={`${avgCycleLength}d`}
                subtitle={
                  cycles.length < 2
                    ? 'Default estimate'
                    : `Based on ${Math.min(cycles.length - 1, 3)} cycles`
                }
                accent
              />
            </View>
            <View style={styles.gridItem}>
              <InsightCard
                title="Avg period"
                value={`${avgPeriodLength}d`}
                subtitle={
                  cycles.filter(c => c.endDate).length === 0
                    ? 'Default estimate'
                    : 'Average length'
                }
              />
            </View>
          </View>

          <View style={styles.grid}>
            {daysUntilPeriod !== null && (
              <View style={styles.gridItem}>
                <InsightCard
                  title="Next period"
                  value={daysUntilPeriod <= 0 ? 'Due' : `${daysUntilPeriod}d`}
                  subtitle={daysUntilPeriod <= 0 ? 'Expected now' : 'Days remaining'}
                />
              </View>
            )}
            {daysUntilOvulation !== null && (
              <View style={styles.gridItem}>
                <InsightCard
                  title="Ovulation"
                  value={
                    daysUntilOvulation === 0
                      ? 'Today'
                      : daysUntilOvulation > 0
                        ? `${daysUntilOvulation}d`
                        : `${Math.abs(daysUntilOvulation)}d ago`
                  }
                  subtitle="Estimated"
                />
              </View>
            )}
          </View>

          {cycleLengths.length >= 2 && (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  Cycle Regularity
                </Text>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isRegular
                        ? colors.fertile + '20'
                        : colors.period + '18',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isRegular ? colors.fertile : colors.period },
                    ]}
                  >
                    {isRegular ? 'Regular' : 'Irregular'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
                {isRegular
                  ? 'Your cycles are within 4 days of each other — predictions should be accurate.'
                  : 'Your cycles vary more than 4 days. Predictions are estimates.'}
              </Text>

              <View style={styles.barsContainer}>
                {cycleLengths.slice(-6).map((len, i) => (
                  <View key={i} style={styles.barWrapper}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: colors.primary,
                          height: Math.max(16, (len / 45) * 72),
                          opacity: 0.4 + (i / Math.max(cycleLengths.length - 1, 1)) * 0.6,
                        },
                      ]}
                    />
                    <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>
                      {len}d
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {prediction && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.fertile + '12',
                  borderColor: colors.fertile + '30',
                },
              ]}
            >
              <Text style={[styles.cardLabel, { color: colors.fertile }]}>Fertile Window</Text>
              <Text style={[styles.fertileRange, { color: colors.foreground }]}>
                {prediction.fertileStart}
              </Text>
              <Text style={[styles.fertileRangeSub, { color: colors.mutedForeground }]}>
                through {prediction.fertileEnd}
              </Text>
              <Text style={[styles.cardBody, { color: colors.mutedForeground, marginTop: 8 }]}>
                6 days of peak fertility: 5 days before ovulation plus ovulation day. These are
                your highest-chance days to conceive.
              </Text>
              <View style={styles.ovRow}>
                <View style={[styles.ovDot, { backgroundColor: colors.ovulation }]} />
                <Text style={[styles.ovLabel, { color: colors.foreground }]}>
                  Estimated ovulation: {prediction.ovulationDate}
                </Text>
              </View>
            </View>
          )}

          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            All predictions are estimates based on your logged history. Consult a healthcare
            provider for medical advice.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  gridItem: { flex: 1 },
  card: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  cardBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 90,
    marginTop: 4,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fertileRange: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  fertileRangeSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: -6,
  },
  ovRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ovDot: { width: 10, height: 10, borderRadius: 5 },
  ovLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginHorizontal: 20,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
});
