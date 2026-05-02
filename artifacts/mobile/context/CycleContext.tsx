import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CycleEntry,
  CyclePrediction,
  DayInfo,
  TempEntries,
  getAverageCycleLength,
  getAveragePeriodLength,
  getCyclePredictions,
  getDayInfo,
  todayStr,
} from '@/utils/cycleCalculations';

const STORAGE_KEY = '@cycle_tracker_v1';
const TEMP_STORAGE_KEY = '@cycle_tracker_temps_v1';

interface CycleContextType {
  cycles: CycleEntry[];
  isLoading: boolean;
  avgCycleLength: number;
  avgPeriodLength: number;
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

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const [cycles, setCycles] = useState<CycleEntry[]>([]);
  const [tempEntries, setTempEntries] = useState<TempEntries>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(TEMP_STORAGE_KEY),
    ]).then(([cyclesData, tempsData]) => {
      if (cyclesData) {
        try { setCycles(JSON.parse(cyclesData)); } catch {}
      }
      if (tempsData) {
        try { setTempEntries(JSON.parse(tempsData)); } catch {}
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

  const avgCycleLength = getAverageCycleLength(cycles);
  const avgPeriodLength = getAveragePeriodLength(cycles);
  const prediction = getCyclePredictions(cycles);

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
