import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchBodyTemperatureSamples,
  getHealthAvailability,
  HealthAvailability,
  requestHealthAuthorization,
  writeBodyTemperature,
} from '@/services/healthKit';
import {
  CycleEntry,
  CyclePrediction,
  DayInfo,
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_PERIOD_LENGTH,
  TempEntries,
  getAverageCycleLength,
  getAveragePeriodLength,
  getCyclePredictions,
  getDayInfo,
  todayStr,
} from '@/utils/cycleCalculations';

const STORAGE_KEY = '@cycle_tracker_v1';
const TEMP_STORAGE_KEY = '@cycle_tracker_temps_v1';
const SETTINGS_STORAGE_KEY = '@cycle_tracker_settings_v1';
const HEALTH_STORAGE_KEY = '@cycle_tracker_health_v1';

interface CycleSettings {
  userCycleLength: number;
  userPeriodLength: number;
}

interface HealthState {
  connected: boolean;
  lastSyncAt: number | null;
}

interface CycleContextType {
  cycles: CycleEntry[];
  isLoading: boolean;
  avgCycleLength: number;
  avgPeriodLength: number;
  userCycleLength: number;
  userPeriodLength: number;
  setUserCycleLength: (n: number | ((prev: number) => number)) => void;
  setUserPeriodLength: (n: number | ((prev: number) => number)) => void;
  prediction: CyclePrediction | null;
  activeCycle: CycleEntry | null;
  startPeriod: (date?: string) => void;
  endPeriod: (date?: string) => void;
  setCycleEnd: (id: string, endDate: string) => void;
  deleteCycle: (id: string) => void;
  getDayInfo: (dateStr: string) => DayInfo;

  tempEntries: TempEntries;
  setTemp: (date: string, tempF: number) => void;
  removeTemp: (date: string) => void;

  healthAvailability: HealthAvailability;
  healthConnected: boolean;
  healthSyncing: boolean;
  healthLastSyncAt: number | null;
  healthError: string | null;
  connectHealth: () => Promise<boolean>;
  disconnectHealth: () => void;
  syncFromHealth: () => Promise<number>;
}

const CycleContext = createContext<CycleContextType | null>(null);

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  const r = Math.round(n);
  return Math.max(min, Math.min(max, r));
}

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const [cycles, setCycles] = useState<CycleEntry[]>([]);
  const [tempEntries, setTempEntries] = useState<TempEntries>({});
  const [settings, setSettings] = useState<CycleSettings>({
    userCycleLength: DEFAULT_CYCLE_LENGTH,
    userPeriodLength: DEFAULT_PERIOD_LENGTH,
  });
  const [isLoading, setIsLoading] = useState(true);

  const healthAvailability = getHealthAvailability();
  const [health, setHealth] = useState<HealthState>({ connected: false, lastSyncAt: null });
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const tempEntriesRef = useRef<TempEntries>({});
  tempEntriesRef.current = tempEntries;
  const healthRef = useRef<HealthState>(health);
  healthRef.current = health;
  // Guards against concurrent syncs (avoids stale-closure issue with healthSyncing state).
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(TEMP_STORAGE_KEY),
      AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
      AsyncStorage.getItem(HEALTH_STORAGE_KEY),
    ]).then(([cyclesData, tempsData, settingsData, healthData]) => {
      if (cyclesData) {
        try { setCycles(JSON.parse(cyclesData)); } catch {}
      }
      if (tempsData) {
        try { setTempEntries(JSON.parse(tempsData)); } catch {}
      }
      if (settingsData) {
        try {
          const parsed = JSON.parse(settingsData) as Partial<CycleSettings>;
          setSettings({
            userCycleLength: clampInt(
              parsed.userCycleLength ?? DEFAULT_CYCLE_LENGTH,
              MIN_CYCLE_LENGTH,
              MAX_CYCLE_LENGTH,
            ),
            userPeriodLength: clampInt(
              parsed.userPeriodLength ?? DEFAULT_PERIOD_LENGTH,
              MIN_PERIOD_LENGTH,
              MAX_PERIOD_LENGTH,
            ),
          });
        } catch {}
      }
      if (healthData) {
        try {
          const parsed = JSON.parse(healthData) as Partial<HealthState>;
          setHealth({
            connected: !!parsed.connected,
            lastSyncAt: typeof parsed.lastSyncAt === 'number' ? parsed.lastSyncAt : null,
          });
        } catch {}
      }
      setIsLoading(false);
    });
  }, []);

  const persistCycles = useCallback((updated: CycleEntry[]) => {
    setCycles(updated);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const persistTemps = useCallback((updated: TempEntries) => {
    setTempEntries(updated);
    AsyncStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const setUserCycleLength = useCallback(
    (n: number | ((prev: number) => number)) => {
      setSettings(prev => {
        const value = typeof n === 'function' ? n(prev.userCycleLength) : n;
        const next: CycleSettings = {
          ...prev,
          userCycleLength: clampInt(value, MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH),
        };
        AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const setUserPeriodLength = useCallback(
    (n: number | ((prev: number) => number)) => {
      setSettings(prev => {
        const value = typeof n === 'function' ? n(prev.userPeriodLength) : n;
        const next: CycleSettings = {
          ...prev,
          userPeriodLength: clampInt(value, MIN_PERIOD_LENGTH, MAX_PERIOD_LENGTH),
        };
        AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const startPeriod = useCallback(
    (date?: string) => {
      const startDate = date || todayStr();
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
      persistCycles([...cycles, { id, startDate }]);
    },
    [cycles, persistCycles],
  );

  const endPeriod = useCallback(
    (date?: string) => {
      const endDate = date || todayStr();
      const now = todayStr();
      const sorted = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
      const active = sorted.find(c => !c.endDate && c.startDate <= now);
      if (!active) return;
      persistCycles(cycles.map(c => (c.id === active.id ? { ...c, endDate } : c)));
    },
    [cycles, persistCycles],
  );

  const setCycleEnd = useCallback(
    (id: string, endDate: string) => {
      const cycle = cycles.find(c => c.id === id);
      if (!cycle) return;
      if (endDate < cycle.startDate) return;
      persistCycles(cycles.map(c => (c.id === id ? { ...c, endDate } : c)));
    },
    [cycles, persistCycles],
  );

  const deleteCycle = useCallback(
    (id: string) => {
      persistCycles(cycles.filter(c => c.id !== id));
    },
    [cycles, persistCycles],
  );

  const persistHealth = useCallback((updated: HealthState) => {
    setHealth(updated);
    AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const setTemp = useCallback(
    (date: string, tempF: number) => {
      const previous = tempEntries[date];
      persistTemps({ ...tempEntries, [date]: tempF });
      // Mirror manual entries back to Apple Health, but only when the value
      // actually changed. This prevents duplicate HealthKit samples when the
      // user re-saves the same value or when a sync triggers an effective no-op.
      if (
        healthRef.current.connected &&
        healthAvailability.supported &&
        previous !== tempF
      ) {
        // Use 7am local time as the timestamp for the BBT reading.
        const [y, m, d] = date.split('-').map(Number);
        const when = new Date(y, (m ?? 1) - 1, d ?? 1, 7, 0, 0);
        writeBodyTemperature(tempF, when).catch(() => {});
      }
    },
    [tempEntries, persistTemps, healthAvailability.supported],
  );

  const syncFromHealth = useCallback(async (): Promise<number> => {
    if (!healthRef.current.connected || !healthAvailability.supported) return 0;
    if (syncInFlightRef.current) return 0; // Re-entrancy guard.
    syncInFlightRef.current = true;
    setHealthSyncing(true);
    setHealthError(null);
    try {
      // Wider window on first connect (1 year) so we backfill historical BBT
      // data; subsequent syncs only need to cover any missed days.
      const isFirstSync = healthRef.current.lastSyncAt === null;
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - (isFirstSync ? 365 : 60));
      const samples = await fetchBodyTemperatureSamples(start, end);
      let added = 0;
      // Use a functional state update so we don't clobber a manual setTemp
      // that may have happened concurrently while sync was awaiting Health.
      setTempEntries(prev => {
        const merged: TempEntries = { ...prev };
        for (const s of samples) {
          // Don't overwrite values the user has already entered manually.
          if (merged[s.date] === undefined) {
            merged[s.date] = Math.round(s.tempF * 100) / 100;
            added += 1;
          }
        }
        if (added > 0) {
          AsyncStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(merged));
        }
        return added > 0 ? merged : prev;
      });
      persistHealth({ connected: true, lastSyncAt: Date.now() });
      return added;
    } catch (e: any) {
      setHealthError(e?.message || 'Sync failed');
      return 0;
    } finally {
      syncInFlightRef.current = false;
      setHealthSyncing(false);
    }
  }, [healthAvailability.supported, persistHealth]);

  const connectHealth = useCallback(async (): Promise<boolean> => {
    if (!healthAvailability.supported) {
      setHealthError(healthAvailability.reason || 'Apple Health is not available.');
      return false;
    }
    setHealthError(null);
    const ok = await requestHealthAuthorization();
    if (!ok) {
      setHealthError('Permission was not granted. Open Settings → Privacy → Health to enable access.');
      return false;
    }
    // The auto-sync useEffect below will fire once `health.connected` flips
    // to true, so we don't kick off a second sync from here.
    persistHealth({ connected: true, lastSyncAt: null });
    return true;
  }, [healthAvailability.supported, healthAvailability.reason, persistHealth]);

  const disconnectHealth = useCallback(() => {
    persistHealth({ connected: false, lastSyncAt: null });
    setHealthError(null);
  }, [persistHealth]);

  // Auto-sync on mount when already connected.
  useEffect(() => {
    if (!isLoading && health.connected && healthAvailability.supported) {
      syncFromHealth().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, health.connected, healthAvailability.supported]);

  const removeTemp = useCallback(
    (date: string) => {
      const next = { ...tempEntries };
      delete next[date];
      persistTemps(next);
    },
    [tempEntries, persistTemps],
  );

  const avgCycleLength = getAverageCycleLength(cycles, settings.userCycleLength);
  const avgPeriodLength = getAveragePeriodLength(cycles, settings.userPeriodLength);
  const prediction = getCyclePredictions(cycles, avgCycleLength);

  const now = todayStr();
  const sortedCycles = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const activeCycle = sortedCycles.find(c => !c.endDate && c.startDate <= now) ?? null;

  const getDayInfoFn = useCallback(
    (dateStr: string): DayInfo => {
      return getDayInfo(dateStr, cycles, prediction, avgCycleLength, avgPeriodLength);
    },
    [cycles, prediction, avgCycleLength, avgPeriodLength],
  );

  return (
    <CycleContext.Provider
      value={{
        cycles,
        isLoading,
        avgCycleLength,
        avgPeriodLength,
        userCycleLength: settings.userCycleLength,
        userPeriodLength: settings.userPeriodLength,
        setUserCycleLength,
        setUserPeriodLength,
        prediction,
        activeCycle,
        startPeriod,
        endPeriod,
        setCycleEnd,
        deleteCycle,
        getDayInfo: getDayInfoFn,
        tempEntries,
        setTemp,
        removeTemp,
        healthAvailability,
        healthConnected: health.connected,
        healthSyncing,
        healthLastSyncAt: health.lastSyncAt,
        healthError,
        connectHealth,
        disconnectHealth,
        syncFromHealth,
      }}
    >
      {children}
    </CycleContext.Provider>
  );
}

export function useCycle() {
  const ctx = useContext(CycleContext);
  if (!ctx) throw new Error('useCycle must be used within CycleProvider');
  return ctx;
}
