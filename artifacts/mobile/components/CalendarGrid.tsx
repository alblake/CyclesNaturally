import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useCycle } from '@/context/CycleContext';
import { useColors } from '@/hooks/useColors';
import { DayInfo } from '@/utils/cycleCalculations';

const WEEK_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface CalendarGridProps {
  year: number;
  month: number;
  onDayPress?: (dateStr: string, info: DayInfo) => void;
}

export function CalendarGrid({ year, month, onDayPress }: CalendarGridProps) {
  const { getDayInfo } = useCycle();
  const colors = useColors();

  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const result: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      result.push(`${year}-${m}-${dd}`);
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year, month]);

  const weeks = useMemo(() => {
    const w: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [cells]);

  function getBgColor(info: DayInfo): string | undefined {
    switch (info.status) {
      case 'period':
        return colors.period;
      case 'ovulation':
        return colors.ovulation;
      case 'fertile':
        return colors.fertile;
      case 'predictedPeriod':
        return colors.predictedPeriod;
      default:
        return undefined;
    }
  }

  function getTextColor(info: DayInfo): string {
    if (info.status === 'period') return '#FFFFFF';
    if (info.status === 'ovulation') return '#FFFFFF';
    if (info.status === 'fertile') return '#FFFFFF';
    if (info.status === 'predictedPeriod') return colors.accent;
    if (info.isToday) return colors.accent;
    if (info.isPast) return colors.mutedForeground;
    return colors.foreground;
  }

  return (
    <View>
      <View style={styles.row}>
        {WEEK_LABELS.map((label, i) => (
          <View key={i} style={styles.cell}>
            <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((dateStr, di) => {
            if (!dateStr) return <View key={di} style={styles.cell} />;
            const info = getDayInfo(dateStr);
            const bg = getBgColor(info);
            const textColor = getTextColor(info);
            const day = parseInt(dateStr.split('-')[2], 10);
            const isTodayNoStatus = info.isToday && info.status === 'normal';
            return (
              <TouchableOpacity
                key={di}
                style={styles.cell}
                onPress={() => onDayPress?.(dateStr, info)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dayCircle,
                    bg ? { backgroundColor: bg } : undefined,
                    isTodayNoStatus
                      ? { borderWidth: 2, borderColor: colors.accent }
                      : undefined,
                  ]}
                >
                  <Text style={[styles.dayNum, { color: textColor }]}>{day}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
