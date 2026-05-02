import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCycle } from '@/context/CycleContext';
import { useColors } from '@/hooks/useColors';
import {
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_PERIOD_LENGTH,
  PregnancyTone,
  getPregnancyChance,
  parseLocalDate,
  todayStr,
} from '@/utils/cycleCalculations';

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MIN_TEMP = 95.0;
const MAX_TEMP = 101.0;
const DEFAULT_TEMP = 98.0;

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
}

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    cycles,
    activeCycle,
    startPeriod,
    endPeriod,
    deleteCycle,
    prediction,
    avgCycleLength,
    avgPeriodLength,
    tempEntries,
    setTemp,
    removeTemp,
    userCycleLength,
    userPeriodLength,
    setUserCycleLength,
    setUserPeriodLength,
    healthAvailability,
    healthConnected,
    healthSyncing,
    healthLastSyncAt,
    healthError,
    connectHealth,
    disconnectHealth,
    syncFromHealth,
  } = useCycle();

  const adjustCycleLen = (delta: number) => {
    Haptics.selectionAsync();
    setUserCycleLength(prev => prev + delta);
  };
  const adjustPeriodLen = (delta: number) => {
    Haptics.selectionAsync();
    setUserPeriodLength(prev => prev + delta);
  };

  const today = todayStr();
  const todayTemp = tempEntries[today];
  const todayChance = getPregnancyChance(today, cycles, prediction, avgCycleLength, avgPeriodLength);

  const [draftTemp, setDraftTemp] = useState<number>(todayTemp ?? DEFAULT_TEMP);
  const [editingTemp, setEditingTemp] = useState(todayTemp === undefined);

  useEffect(() => {
    if (todayTemp !== undefined) {
      setDraftTemp(todayTemp);
      setEditingTemp(false);
    } else {
      setDraftTemp(DEFAULT_TEMP);
      setEditingTemp(true);
    }
  }, [todayTemp]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const sortedCycles = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const handleStartPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startPeriod();
  };
  const handleEndPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    endPeriod();
  };
  const handleDelete = (id: string) => {
    Alert.alert('Delete Cycle', 'Remove this cycle entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCycle(id) },
    ]);
  };

  const adjustTemp = (delta: number) => {
    Haptics.selectionAsync();
    const next = Math.round((draftTemp + delta) * 10) / 10;
    setDraftTemp(Math.max(MIN_TEMP, Math.min(MAX_TEMP, next)));
  };

  const saveTemp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTemp(today, draftTemp);
    setEditingTemp(false);
  };

  const removeTodayTemp = () => {
    Alert.alert('Remove Reading', 'Remove today\u2019s temperature?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeTemp(today);
          setDraftTemp(DEFAULT_TEMP);
          setEditingTemp(true);
        },
      },
    ]);
  };

  const isFertileNow =
    prediction &&
    prediction.daysUntilOvulation !== null &&
    prediction.daysUntilOvulation >= -1 &&
    prediction.daysUntilOvulation <= 5;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: topPad + 20,
        paddingBottom: Platform.OS === 'web' ? 34 + 84 : insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Today</Text>

      {/* Status & period button card */}
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: activeCycle ? colors.period + '14' : colors.card,
            borderColor: activeCycle ? colors.period + '60' : colors.border,
          },
        ]}
      >
        {prediction?.currentCycleDay && (
          <Text style={[styles.cycleDayText, { color: activeCycle ? colors.period : colors.mutedForeground }]}>
            {activeCycle
              ? `Day ${prediction.currentCycleDay} \u00b7 Period in progress`
              : `Day ${prediction.currentCycleDay} of your cycle`}
          </Text>
        )}

        {!prediction && (
          <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>
            Log your first period to begin tracking your cycle
          </Text>
        )}

        {isFertileNow && !activeCycle && (
          <View style={[styles.fertileAlert, { backgroundColor: colors.fertile + '18' }]}>
            <Feather name="sun" size={15} color={colors.fertile} />
            <Text style={[styles.fertileAlertText, { color: colors.fertile }]}>
              {prediction!.daysUntilOvulation === 0
                ? 'Today is your estimated ovulation day'
                : prediction!.daysUntilOvulation! > 0
                  ? `Ovulation estimated in ${prediction!.daysUntilOvulation} days`
                  : 'You may be in your fertile window'}
            </Text>
          </View>
        )}

        {activeCycle ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.period }]}
            onPress={handleEndPeriod}
            activeOpacity={0.8}
          >
            <Feather name="check-circle" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>End Period</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleStartPeriod}
            activeOpacity={0.8}
          >
            <Feather name="droplet" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Start Period</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pregnancy chance card */}
      {prediction && (
        <View
          style={[
            styles.chanceCard,
            {
              backgroundColor: chanceTint(todayChance.tone, colors),
              borderColor: chanceBorder(todayChance.tone, colors),
            },
          ]}
        >
          <View style={styles.chanceHeader}>
            <View style={styles.chanceHeaderText}>
              <Text style={[styles.tempLabel, { color: colors.mutedForeground }]}>
                CHANCE OF CONCEPTION TODAY
              </Text>
              <Text style={[styles.tempTitle, { color: colors.foreground }]}>
                {todayChance.label}
              </Text>
            </View>
            <View
              style={[
                styles.chanceBadge,
                { backgroundColor: chanceColor(todayChance.tone, colors) },
              ]}
            >
              <Text style={styles.chanceBadgeText}>
                {todayChance.percent}%
              </Text>
            </View>
          </View>
          <Text style={[styles.chanceDescription, { color: colors.mutedForeground }]}>
            {chanceDescription(todayChance.tone)}
          </Text>
          <Text style={[styles.chanceFootnote, { color: colors.mutedForeground }]}>
            Per-act estimate based on Wilcox et al. (1995). Not contraception advice.
          </Text>
        </View>
      )}

      {/* Temperature card */}
      <View style={[styles.tempCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.tempHeader}>
          <View style={styles.tempHeaderText}>
            <Text style={[styles.tempLabel, { color: colors.mutedForeground }]}>
              BASAL BODY TEMPERATURE
            </Text>
            <Text style={[styles.tempTitle, { color: colors.foreground }]}>
              {editingTemp ? 'Log temperature' : "Today\u2019s reading"}
            </Text>
          </View>
          {todayTemp !== undefined && !editingTemp && (
            <View style={[styles.tempCheck, { backgroundColor: colors.fertile + '22' }]}>
              <Feather name="check" size={14} color={colors.fertile} />
            </View>
          )}
        </View>

        {editingTemp ? (
          <>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: colors.secondary }]}
                onPress={() => adjustTemp(-0.1)}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={20} color={colors.foreground} />
              </TouchableOpacity>

              <View style={styles.tempValueWrap}>
                <Text style={[styles.tempValue, { color: colors.foreground }]}>
                  {draftTemp.toFixed(1)}
                </Text>
                <Text style={[styles.tempUnit, { color: colors.mutedForeground }]}>°F</Text>
              </View>

              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: colors.secondary }]}
                onPress={() => adjustTemp(0.1)}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.tempSaveBtn, { backgroundColor: colors.primary }]}
              onPress={saveTemp}
              activeOpacity={0.8}
            >
              <Feather name="thermometer" size={16} color="#FFFFFF" />
              <Text style={styles.tempSaveText}>
                {todayTemp !== undefined ? 'Update reading' : 'Save reading'}
              </Text>
            </TouchableOpacity>

            {todayTemp !== undefined && (
              <TouchableOpacity onPress={() => setEditingTemp(false)} activeOpacity={0.7}>
                <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.tempHint, { color: colors.mutedForeground }]}>
              Take your temperature first thing in the morning, before getting out of bed.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.tempDisplayRow}>
              <Text style={[styles.tempDisplay, { color: colors.foreground }]}>
                {todayTemp!.toFixed(1)}
              </Text>
              <Text style={[styles.tempDisplayUnit, { color: colors.mutedForeground }]}>°F</Text>
            </View>
            <View style={styles.tempActions}>
              <TouchableOpacity
                style={[styles.smallBtn, { borderColor: colors.border }]}
                onPress={() => setEditingTemp(true)}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={13} color={colors.foreground} />
                <Text style={[styles.smallBtnText, { color: colors.foreground }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallBtn, { borderColor: colors.border }]}
                onPress={removeTodayTemp}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={13} color={colors.mutedForeground} />
                <Text style={[styles.smallBtnText, { color: colors.mutedForeground }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Apple Health note */}
        {Platform.OS !== 'web' && (
          <View style={[styles.healthNote, { backgroundColor: colors.muted + '60' }]}>
            <Feather name="heart" size={13} color={colors.accent} />
            <Text style={[styles.healthNoteText, { color: colors.mutedForeground }]}>
              Apple Health auto-sync available after publishing to App Store
            </Text>
          </View>
        )}
      </View>

      {prediction && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Upcoming</Text>

          <PredictionRow
            label="Next period"
            dateLabel={fmtDate(prediction.nextPeriodStart)}
            badge={
              prediction.daysUntilNextPeriod !== null
                ? prediction.daysUntilNextPeriod <= 0
                  ? 'Due now'
                  : `${prediction.daysUntilNextPeriod}d`
                : ''
            }
            dotColor={colors.period}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <PredictionRow
            label="Fertile window"
            dateLabel={`${fmtDate(prediction.fertileStart)} \u2013 ${fmtDate(prediction.fertileEnd)}`}
            badge={
              prediction.daysUntilOvulation === 0
                ? 'Now'
                : prediction.daysUntilOvulation !== null && prediction.daysUntilOvulation > 0
                  ? `in ${Math.max(0, prediction.daysUntilOvulation - 5)}\u2013${prediction.daysUntilOvulation}d`
                  : prediction.daysUntilOvulation !== null && prediction.daysUntilOvulation < -1
                    ? 'Past'
                    : 'Now'
            }
            dotColor={colors.fertile}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <PredictionRow
            label="Ovulation"
            dateLabel={fmtDate(prediction.ovulationDate)}
            badge={
              prediction.daysUntilOvulation === null
                ? ''
                : prediction.daysUntilOvulation === 0
                  ? 'Today'
                  : prediction.daysUntilOvulation > 0
                    ? `${prediction.daysUntilOvulation}d`
                    : `${Math.abs(prediction.daysUntilOvulation)}d ago`
            }
            dotColor={colors.ovulation}
          />
        </View>
      )}

      {/* Apple Health card */}
      <View style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.healthHeader}>
          <View style={styles.healthHeaderText}>
            <Text style={[styles.tempLabel, { color: colors.mutedForeground }]}>
              APPLE HEALTH
            </Text>
            <Text style={[styles.tempTitle, { color: colors.foreground }]}>
              {healthConnected ? 'Connected' : 'Auto-log your morning temp'}
            </Text>
          </View>
          <View
            style={[
              styles.healthDot,
              {
                backgroundColor: healthConnected
                  ? '#34C759'
                  : healthAvailability.supported
                    ? colors.mutedForeground
                    : colors.border,
              },
            ]}
          />
        </View>

        {!healthAvailability.supported && (
          <Text style={[styles.healthDescription, { color: colors.mutedForeground }]}>
            {healthAvailability.reason}
          </Text>
        )}

        {healthAvailability.supported && !healthConnected && (
          <Text style={[styles.healthDescription, { color: colors.mutedForeground }]}>
            Pull your basal body temperature directly from Apple Health each morning. Readings from
            connected thermometers and wearables sync automatically.
          </Text>
        )}

        {healthConnected && (
          <Text style={[styles.healthDescription, { color: colors.mutedForeground }]}>
            {healthLastSyncAt
              ? `Last synced ${formatRelativeTime(healthLastSyncAt)}.`
              : 'Waiting for first sync\u2026'}
            {' '}New temperatures from Apple Health will appear here automatically.
          </Text>
        )}

        {healthError && (
          <Text style={[styles.healthError, { color: colors.period }]}>
            {healthError}
          </Text>
        )}

        <View style={styles.healthActions}>
          {healthAvailability.supported && !healthConnected && (
            <TouchableOpacity
              style={[styles.healthPrimaryBtn, { backgroundColor: colors.primary }]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                await connectHealth();
              }}
              activeOpacity={0.8}
            >
              <Feather name="heart" size={16} color="#FFFFFF" />
              <Text style={styles.healthPrimaryBtnText}>Connect Apple Health</Text>
            </TouchableOpacity>
          )}

          {healthConnected && (
            <>
              <TouchableOpacity
                style={[
                  styles.healthSecondaryBtn,
                  { borderColor: colors.border, opacity: healthSyncing ? 0.5 : 1 },
                ]}
                onPress={async () => {
                  if (healthSyncing) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const added = await syncFromHealth();
                  if (added > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                disabled={healthSyncing}
                activeOpacity={0.8}
              >
                {healthSyncing
                  ? <ActivityIndicator size="small" color={colors.foreground} />
                  : <Feather name="refresh-cw" size={16} color={colors.foreground} />}
                <Text style={[styles.healthSecondaryBtnText, { color: colors.foreground }]}>
                  {healthSyncing ? 'Syncing\u2026' : 'Sync now'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.healthLinkBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  disconnectHealth();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.healthLinkBtnText, { color: colors.mutedForeground }]}>
                  Disconnect
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Cycle settings card */}
      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.settingsHeader}>
          <Text style={[styles.tempLabel, { color: colors.mutedForeground }]}>
            CYCLE SETTINGS
          </Text>
          <Text style={[styles.tempTitle, { color: colors.foreground }]}>
            Your typical cycle
          </Text>
          <Text style={[styles.settingsSubtitle, { color: colors.mutedForeground }]}>
            {cycles.length >= 2
              ? 'Predictions are now based on your logged cycles \u2014 these settings only apply until enough data is recorded.'
              : 'Adjust these so predictions match your body. We\u2019ll learn from your logs over time.'}
          </Text>
        </View>

        <SettingStepper
          label="Cycle length"
          unit="days"
          value={userCycleLength}
          min={MIN_CYCLE_LENGTH}
          max={MAX_CYCLE_LENGTH}
          onDec={() => adjustCycleLen(-1)}
          onInc={() => adjustCycleLen(1)}
          colors={colors}
        />

        <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 4 }]} />

        <SettingStepper
          label="Period length"
          unit="days"
          value={userPeriodLength}
          min={MIN_PERIOD_LENGTH}
          max={MAX_PERIOD_LENGTH}
          onDec={() => adjustPeriodLen(-1)}
          onInc={() => adjustPeriodLen(1)}
          colors={colors}
        />
      </View>

      {sortedCycles.length > 0 && (
        <View style={styles.historySection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 20 }]}>
            History
          </Text>
          {sortedCycles.map((cycle, i) => {
            const duration = cycle.endDate
              ? `${Math.round(
                  (parseLocalDate(cycle.endDate).getTime() -
                    parseLocalDate(cycle.startDate).getTime()) /
                    86400000,
                ) + 1} days`
              : 'Ongoing';
            return (
              <TouchableOpacity
                key={cycle.id}
                style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onLongPress={() => handleDelete(cycle.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.historyDot, { backgroundColor: colors.period }]} />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyDate, { color: colors.foreground }]}>
                    {fmtDate(cycle.startDate)}
                    {cycle.endDate ? ` \u2192 ${fmtDate(cycle.endDate)}` : ''}
                  </Text>
                  <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
                    {duration}
                    {i < sortedCycles.length - 1 ? ` \u00b7 Cycle ${sortedCycles.length - i}` : ''}
                  </Text>
                </View>
                <Feather name="more-horizontal" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Long press to delete</Text>
        </View>
      )}
    </ScrollView>
  );
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function chanceColor(tone: PregnancyTone, colors: ReturnType<typeof useColors>): string {
  switch (tone) {
    case 'peak': return colors.ovulation;
    case 'high': return colors.fertile;
    case 'moderate': return colors.fertile;
    case 'low': return colors.mutedForeground;
    case 'verylow':
    default: return colors.mutedForeground;
  }
}

function chanceTint(tone: PregnancyTone, colors: ReturnType<typeof useColors>): string {
  switch (tone) {
    case 'peak': return colors.ovulation + '14';
    case 'high': return colors.fertile + '14';
    case 'moderate': return colors.fertile + '0E';
    case 'low': return colors.card;
    case 'verylow':
    default: return colors.card;
  }
}

function chanceBorder(tone: PregnancyTone, colors: ReturnType<typeof useColors>): string {
  switch (tone) {
    case 'peak': return colors.ovulation + '50';
    case 'high': return colors.fertile + '50';
    case 'moderate': return colors.fertile + '30';
    default: return colors.border;
  }
}

function chanceDescription(tone: PregnancyTone): string {
  switch (tone) {
    case 'peak':
      return 'You\u2019re at or very near ovulation. This is the highest-fertility day of your cycle.';
    case 'high':
      return 'You\u2019re close to ovulation. Conception is significantly more likely on this day.';
    case 'moderate':
      return 'You\u2019re in the fertile window \u2014 sperm can survive long enough to meet the egg.';
    case 'low':
      return 'Conception is unlikely today, but not impossible. Sperm can survive a few days.';
    case 'verylow':
    default:
      return 'Conception is very unlikely today, well outside your fertile window.';
  }
}

function SettingStepper({
  label,
  unit,
  value,
  min,
  max,
  onDec,
  onInc,
  colors,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onDec: () => void;
  onInc: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.settingHint, { color: colors.mutedForeground }]}>
          {`${min}\u2013${max} ${unit}`}
        </Text>
      </View>
      <View style={styles.settingStepper}>
        <TouchableOpacity
          style={[
            styles.smallStepperBtn,
            { backgroundColor: colors.secondary, opacity: atMin ? 0.4 : 1 },
          ]}
          onPress={onDec}
          disabled={atMin}
          activeOpacity={0.7}
        >
          <Feather name="minus" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.settingValueWrap}>
          <Text style={[styles.settingValue, { color: colors.foreground }]}>{value}</Text>
          <Text style={[styles.settingUnit, { color: colors.mutedForeground }]}>{unit}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.smallStepperBtn,
            { backgroundColor: colors.secondary, opacity: atMax ? 0.4 : 1 },
          ]}
          onPress={onInc}
          disabled={atMax}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PredictionRow({
  label,
  dateLabel,
  badge,
  dotColor,
}: {
  label: string;
  dateLabel: string;
  badge: string;
  dotColor: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.predRow}>
      <View style={[styles.predDot, { backgroundColor: dotColor }]} />
      <View style={styles.predInfo}>
        <Text style={[styles.predLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.predDate, { color: colors.mutedForeground }]}>{dateLabel}</Text>
      </View>
      {badge ? (
        <View style={[styles.predBadge, { backgroundColor: dotColor + '20' }]}>
          <Text style={[styles.predBadgeText, { color: dotColor }]}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statusCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 14,
    marginBottom: 16,
  },
  cycleDayText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  noDataText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 21,
  },
  fertileAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  fertileAlertText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  tempCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 16,
    marginBottom: 16,
  },
  tempHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tempHeaderText: { flex: 1, gap: 2 },
  tempLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
  },
  tempTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  tempCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tempValue: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
  },
  tempUnit: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
  },
  tempSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  tempSaveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  linkText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  tempHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    textAlign: 'center',
  },
  tempDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  tempDisplay: {
    fontSize: 56,
    fontFamily: 'Inter_700Bold',
  },
  tempDisplayUnit: {
    fontSize: 22,
    fontFamily: 'Inter_500Medium',
  },
  tempActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  smallBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  healthNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  healthNoteText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 16,
  },
  divider: { height: 1, marginVertical: 14 },
  predRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  predDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  predInfo: { flex: 1 },
  predLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  predDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  predBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  predBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  healthCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  healthHeaderText: { flex: 1, gap: 2 },
  healthDot: { width: 10, height: 10, borderRadius: 5 },
  healthDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  healthError: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    lineHeight: 17,
  },
  healthActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  healthPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  healthPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  healthSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  healthSecondaryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  healthLinkBtn: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  healthLinkBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  chanceCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  chanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chanceHeaderText: { flex: 1, gap: 2 },
  chanceBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chanceBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  chanceDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
  },
  chanceFootnote: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 4,
  },
  settingsCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 14,
    marginBottom: 16,
  },
  settingsHeader: { gap: 4 },
  settingsSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingInfo: { flex: 1 },
  settingLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  settingHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  settingStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallStepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    minWidth: 56,
    justifyContent: 'center',
  },
  settingValue: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  settingUnit: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  historySection: { gap: 8 },
  historyItem: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyInfo: { flex: 1 },
  historyDate: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  historyMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
});
