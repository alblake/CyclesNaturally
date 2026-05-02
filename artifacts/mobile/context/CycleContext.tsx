import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CycleEntry,
  CyclePrediction,
  DayInfo,
  getAverageCycleLength,
  getAveragePeriodLength,
  getCyclePredictions,
  getDayInfo,
  todayStr,
} from '@/utils/cycleCalculations';

const STORAGE_KEY = '@cycle_tracker_v1';

interface CycleContextType {
  cycles: CycleEntry[];
  isLoading: boolean;
  avgCycleLength: number;
  avgPeriodLength: number;
  prediction: CyclePrediction | null;
  activeCycle: CycleEntry | null;
  startPeriod: (date?: string) => void;
  endPeriod: (date?: string) => void;
  deleteCycle: (id: string) => void;
  getDayInfo: (dateStr: string) => DayInfo;
}

const CycleContext = createContext<CycleContextType | null>(null);

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const [cycles, setCycles] = useState<CycleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) {
        try {
          setCycles(JSON.parse(data));
        } catch {}
      }
      setIsLoading(false);
    });
  }, []);

  const persist = useCallback((updated: CycleEntry[]) => {
    setCycles(updated);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const startPeriod = useCallback(
    (date?: string) => {
      const startDate = date || todayStr();
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 6);
      persist([...cycles, { id, startDate }]);
    },
    [cycles, persist],
  );

  const endPeriod = useCallback(
    (date?: string) => {
      const endDate = date || todayStr();
      const now = todayStr();
      const sorted = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
      const active = sorted.find(c => !c.endDate && c.startDate <= now);
      if (!active) return;
      persist(cycles.map(c => (c.id === active.id ? { ...c, endDate } : c)));
    },
    [cycles, persist],
  );

  const deleteCycle = useCallback(
    (id: string) => {
      persist(cycles.filter(c => c.id !== id));
    },
    [cycles, persist],
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
        deleteCycle,
        getDayInfo: getDayInfoFn,
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
