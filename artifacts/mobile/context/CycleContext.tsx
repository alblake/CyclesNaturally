import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface CycleSettings {
  userCycleLength: number;
  userPeriodLength: number;
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

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(TEMP_STORAGE_KEY),
      AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
    ]).then(([cyclesData, tempsData, settingsData]) => {
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

  const setTemp = useCallback(
    (date: string, tempF: number) => {
      persistTemps({ ...tempEntries, [date]: tempF });
    },
    [tempEntries, persistTemps],
  );

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
