import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InsightCard } from '@/components/InsightCard';
import { TemperatureChart } from '@/components/TemperatureChart';
import { useCycle } from '@/context/CycleContext';
import { useColors } from '@/hooks/useColors';
import { analyzeTemps, diffDays } from '@/utils/cycleCalculations';

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cycles, avgCycleLength, avgPeriodLength, prediction, tempEntries } = useCycle();

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

  const tempCount = Object.keys(tempEntries).length;
  const tempAnalysis = useMemo(
    () => analyzeTemps(tempEntries, prediction),
    [tempEntries, prediction],
  );

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

          {/* BBT chart */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { color: colors.primary }]}>
                  BASAL BODY TEMPERATURE
                </Text>
                <Text style={[styles.cardTitle, { color: colors.foreground, marginTop: 2 }]}>
                  Last 30 days
                </Text>
              </View>
              {tempCount > 0 && (
                <View style={[styles.countBadge, { backgroundColor: colors.muted + '60' }]}>
                  <Text style={[styles.countBadgeText, { color: colors.foreground }]}>
                    {tempCount} {tempCount === 1 ? 'reading' : 'readings'}
                  </Text>
                </View>
              )}
            </View>

            <TemperatureChart numDays={30} />

            {tempCount > 0 && (
              <View style={styles.legendRow}>
                <LegendDot color={colors.primary} label="Temperature" />
                <LegendDot color={colors.ovulation} label="Ovulation" dashed />
                {tempAnalysis.coverline !== null && (
                  <LegendDot color={colors.accent} label="Coverline" dashed />
                )}
              </View>
            )}

            {tempAnalysis.thermalShiftConfirmed && tempAnalysis.shiftConfirmedDate && (
              <View
                style={[
                  styles.confirmBox,
                  {
                    backgroundColor: colors.fertile + '15',
                    borderColor: colors.fertile + '40',
                  },
                ]}
              >
                <Feather name="check-circle" size={16} color={colors.fertile} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.confirmTitle, { color: colors.fertile }]}>
                    Ovulation confirmed
                  </Text>
                  <Text style={[styles.confirmText, { color: colors.mutedForeground }]}>
                    Three sustained days above coverline starting{' '}
                    {tempAnalysis.shiftConfirmedDate}
                  </Text>
                </View>
              </View>
            )}

            {tempAnalysis.preOvAvg !== null && tempAnalysis.postOvAvg !== null && (
              <View style={styles.tempStatsRow}>
                <TempStat
                  label="Pre-ovulation"
                  value={`${tempAnalysis.preOvAvg.toFixed(2)}°F`}
                  color={colors.mutedForeground}
                />
                <TempStat
                  label="Post-ovulation"
                  value={`${tempAnalysis.postOvAvg.toFixed(2)}°F`}
                  color={colors.accent}
                />
                <TempStat
                  label="Shift"
                  value={`+${(tempAnalysis.postOvAvg - tempAnalysis.preOvAvg).toFixed(2)}°F`}
                  color={colors.ovulation}
                />
              </View>
            )}

            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              Body temperature rises 0.4–0.6°F after ovulation due to progesterone. A sustained
              shift above your coverline confirms ovulation occurred.
            </Text>
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

function LegendDot({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.legendItem}>
      {dashed ? (
        <View style={[styles.legendLine, { borderColor: color }]} />
      ) : (
        <View style={[styles.legendDot, { backgroundColor: color }]} />
      )}
      <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function TempStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useColors();
  return (
    <View style={styles.tempStat}>
      <Text style={[styles.tempStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.tempStatValue, { color }]}>{value}</Text>
    </View>
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
    gap: 12,
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
  cardLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
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
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLine: {
    width: 14,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  confirmBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  confirmText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  tempStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  tempStat: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  tempStatLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  tempStatValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
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
