import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarGrid } from '@/components/CalendarGrid';
import { useCycle } from '@/context/CycleContext';
import { useColors } from '@/hooks/useColors';
import { DayInfo, addDays, parseLocalDate } from '@/utils/cycleCalculations';

const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function fmtDateLong(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${MONTH_SHORT_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    cycles,
    prediction,
    avgCycleLength,
    avgPeriodLength,
    activeCycle,
    startPeriod,
    setCycleEnd,
    deleteCycle,
  } = useCycle();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [sheet, setSheet] = useState<{ date: string; info: DayInfo } | null>(null);

  const sortedCyclesDesc = useMemo(
    () => [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [cycles],
  );

  const handleDayPress = (dateStr: string, info: DayInfo) => {
    if (info.isFuture) return;
    Haptics.selectionAsync();
    setSheet({ date: dateStr, info });
  };

  const sheetActions = useMemo(() => {
    if (!sheet) return [];

    const containingCycle =
      sheet.info.status === 'period'
        ? sortedCyclesDesc.find(c => {
            const end = c.endDate || addDays(c.startDate, avgPeriodLength - 1);
            return sheet.date >= c.startDate && sheet.date <= end;
          })
        : undefined;

    const actions: {
      label: string;
      destructive?: boolean;
      onPress: () => void;
    }[] = [];

    if (containingCycle) {
      if (containingCycle.startDate === sheet.date) {
        actions.push({
          label: 'Delete this cycle',
          destructive: true,
          onPress: () => deleteCycle(containingCycle.id),
        });
      } else {
        actions.push({
          label: 'Set as period end',
          onPress: () => setCycleEnd(containingCycle.id, sheet.date),
        });
        actions.push({
          label: 'Delete this cycle',
          destructive: true,
          onPress: () => deleteCycle(containingCycle.id),
        });
      }
    } else {
      // Pick the most recent open cycle whose start is before this date
      const openCycle = sortedCyclesDesc.find(
        c => !c.endDate && c.startDate < sheet.date,
      );
      if (openCycle) {
        actions.push({
          label: 'Set as period end',
          onPress: () => setCycleEnd(openCycle.id, sheet.date),
        });
      }
      actions.push({
        label: 'Mark as period start',
        onPress: () => startPeriod(sheet.date),
      });
    }
    return actions;
  }, [sheet, sortedCyclesDesc, avgPeriodLength, deleteCycle, setCycleEnd, startPeriod]);

  const handleSheetAction = (onPress: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
    setSheet(null);
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.foreground }]}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.7}>
          <Feather name="chevron-right" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <CalendarGrid year={year} month={month} onDayPress={handleDayPress} />
      </View>

      <Text style={[styles.tapHint, { color: colors.mutedForeground }]}>
        Tap any day to log period start, set end date, or delete
      </Text>

      <Modal
        visible={sheet !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSheet(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSheet(null)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={e => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {sheet ? fmtDateLong(sheet.date) : ''}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              What would you like to do?
            </Text>

            <View style={styles.modalActions}>
              {sheetActions.map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor: a.destructive
                        ? colors.period + '14'
                        : colors.primary,
                      borderColor: a.destructive ? colors.period + '40' : 'transparent',
                      borderWidth: a.destructive ? 1 : 0,
                    },
                  ]}
                  onPress={() => handleSheetAction(a.onPress)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.modalBtnText,
                      { color: a.destructive ? colors.period : '#FFFFFF' },
                    ]}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setSheet(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.legend}>
        <LegendItem color={colors.period} label="Period" />
        <LegendItem color={colors.fertile} label="Fertile" />
        <LegendItem color={colors.ovulation} label="Ovulation" />
        <LegendItem color={colors.predictedPeriod} label="Predicted" />
      </View>

      {prediction ? (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {activeCycle
              ? `Day ${prediction.currentCycleDay ?? '—'} of your cycle`
              : 'Cycle Overview'}
          </Text>
          <View style={styles.summaryRow}>
            <SummaryItem
              icon="droplet"
              label="Next period"
              value={
                prediction.daysUntilNextPeriod === null
                  ? '—'
                  : prediction.daysUntilNextPeriod <= 0
                    ? 'Due now'
                    : `${prediction.daysUntilNextPeriod}d`
              }
              color={colors.period}
            />
            <SummaryItem
              icon="sun"
              label="Ovulation"
              value={
                prediction.daysUntilOvulation === null
                  ? '—'
                  : prediction.daysUntilOvulation === 0
                    ? 'Today'
                    : prediction.daysUntilOvulation > 0
                      ? `${prediction.daysUntilOvulation}d`
                      : `${Math.abs(prediction.daysUntilOvulation)}d ago`
              }
              color={colors.ovulation}
            />
            <SummaryItem
              icon="activity"
              label="Cycle"
              value={`${avgCycleLength}d`}
              color={colors.fertile}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Welcome</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Head to the Today tab to log your first period and start seeing predictions here.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const colors = useColors();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function SummaryItem({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryIconBg, { backgroundColor: color + '22' }]}>
        <Feather name={icon as never} size={18} color={color} />
      </View>
      <Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  navBtn: { padding: 8 },
  monthTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  calendarCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
  },
  tapHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 10,
    marginHorizontal: 24,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    gap: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 14,
  },
  modalActions: {
    gap: 10,
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  modalCancelBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
    marginHorizontal: 16,
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
  legendLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 6,
  },
  summaryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  emptyCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
});
