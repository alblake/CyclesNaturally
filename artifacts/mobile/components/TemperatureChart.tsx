import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Circle, Path, Text as SvgText, G } from 'react-native-svg';

import { useCycle } from '@/context/CycleContext';
import { useColors } from '@/hooks/useColors';
import {
  addDays,
  analyzeTemps,
  diffDays,
  parseLocalDate,
  todayStr,
} from '@/utils/cycleCalculations';

const CHART_HEIGHT = 220;
const PAD = { top: 16, right: 12, bottom: 32, left: 38 };

interface TemperatureChartProps {
  numDays?: number;
  containerHorizontalPadding?: number;
}

export function TemperatureChart({
  numDays = 30,
  containerHorizontalPadding = 16 * 2 + 20 * 2,
}: TemperatureChartProps) {
  const colors = useColors();
  const { tempEntries, prediction } = useCycle();

  const today = todayStr();
  const startDate = useMemo(() => addDays(today, -(numDays - 1)), [today, numDays]);

  const points = useMemo(() => {
    const arr: { idx: number; temp: number; date: string }[] = [];
    let cur = startDate;
    let i = 0;
    while (cur <= today) {
      const t = tempEntries[cur];
      if (t !== undefined) arr.push({ idx: i, temp: t, date: cur });
      cur = addDays(cur, 1);
      i++;
    }
    return arr;
  }, [startDate, today, tempEntries]);

  const allTemps = points.map(p => p.temp);
  const dataMin = allTemps.length > 0 ? Math.min(...allTemps) : 97;
  const dataMax = allTemps.length > 0 ? Math.max(...allTemps) : 99;
  const yMin = Math.floor(Math.min(96.8, dataMin - 0.2) * 10) / 10;
  const yMax = Math.ceil(Math.max(99.2, dataMax + 0.2) * 10) / 10;

  const chartWidth = Math.max(280, Dimensions.get('window').width - containerHorizontalPadding);
  const innerW = chartWidth - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;

  const xForIdx = (idx: number) => PAD.left + (idx / Math.max(numDays - 1, 1)) * innerW;
  const yForTemp = (t: number) => PAD.top + ((yMax - t) / (yMax - yMin)) * innerH;

  const analysis = useMemo(() => analyzeTemps(tempEntries, prediction), [tempEntries, prediction]);

  let pathStr = '';
  points.forEach((p, i) => {
    const x = xForIdx(p.idx);
    const y = yForTemp(p.temp);
    pathStr += i === 0 ? `M${x},${y}` : ` L${x},${y}`;
  });

  const yLabels: number[] = [];
  for (let v = Math.ceil(yMin); v <= Math.floor(yMax); v++) yLabels.push(v);

  let ovulationX: number | null = null;
  if (prediction) {
    const ovIdx = diffDays(prediction.ovulationDate, startDate);
    if (ovIdx >= 0 && ovIdx <= numDays - 1) ovulationX = xForIdx(ovIdx);
  }

  const todayX = xForIdx(numDays - 1);

  if (points.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.muted + '50', borderColor: colors.border },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          No temperatures logged yet
        </Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Tap "Log temperature" on the Today tab to start tracking your basal body temperature.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {yLabels.map(t => {
          const y = yForTemp(t);
          return (
            <G key={t}>
              <Line
                x1={PAD.left}
                x2={chartWidth - PAD.right}
                y1={y}
                y2={y}
                stroke={colors.border}
                strokeWidth={0.5}
              />
              <SvgText
                x={PAD.left - 6}
                y={y + 3}
                fontSize={10}
                fill={colors.mutedForeground}
                textAnchor="end"
              >
                {t}°
              </SvgText>
            </G>
          );
        })}

        {analysis.coverline !== null && (
          <G>
            <Line
              x1={PAD.left}
              x2={chartWidth - PAD.right}
              y1={yForTemp(analysis.coverline)}
              y2={yForTemp(analysis.coverline)}
              stroke={colors.accent}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <SvgText
              x={chartWidth - PAD.right}
              y={yForTemp(analysis.coverline) - 4}
              fontSize={9}
              fill={colors.accent}
              textAnchor="end"
              fontWeight="600"
            >
              Coverline {analysis.coverline.toFixed(1)}°
            </SvgText>
          </G>
        )}

        {ovulationX !== null && (
          <Line
            x1={ovulationX}
            x2={ovulationX}
            y1={PAD.top}
            y2={CHART_HEIGHT - PAD.bottom}
            stroke={colors.ovulation}
            strokeWidth={1.5}
            strokeDasharray="4,3"
          />
        )}

        <Line
          x1={todayX}
          x2={todayX}
          y1={PAD.top}
          y2={CHART_HEIGHT - PAD.bottom}
          stroke={colors.mutedForeground}
          strokeWidth={0.5}
        />

        {pathStr ? (
          <Path
            d={pathStr}
            stroke={colors.primary}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {points.map(p => {
          const isToday = p.date === today;
          return (
            <Circle
              key={p.date}
              cx={xForIdx(p.idx)}
              cy={yForTemp(p.temp)}
              r={isToday ? 5 : 3.5}
              fill={colors.primary}
              stroke={colors.background}
              strokeWidth={1.5}
            />
          );
        })}

        <SvgText
          x={PAD.left}
          y={CHART_HEIGHT - 12}
          fontSize={9}
          fill={colors.mutedForeground}
        >
          {fmtShort(startDate)}
        </SvgText>
        <SvgText
          x={chartWidth - PAD.right}
          y={CHART_HEIGHT - 12}
          fontSize={9}
          fill={colors.mutedForeground}
          textAnchor="end"
        >
          Today
        </SvgText>
        {ovulationX !== null && (
          <SvgText
            x={ovulationX}
            y={CHART_HEIGHT - 12}
            fontSize={9}
            fill={colors.ovulation}
            textAnchor="middle"
            fontWeight="600"
          >
            Ovulation
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

function fmtShort(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  empty: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
});
