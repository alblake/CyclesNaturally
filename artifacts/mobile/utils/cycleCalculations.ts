export interface CycleEntry {
  id: string;
  startDate: string;
  endDate?: string;
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr(): string {
  return formatLocalDate(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function diffDays(a: string, b: string): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  return Math.round((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24));
}

export function getAverageCycleLength(cycles: CycleEntry[]): number {
  if (cycles.length < 2) return 28;
  const sorted = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = diffDays(sorted[i].startDate, sorted[i - 1].startDate);
    if (len >= 15 && len <= 45) lengths.push(len);
  }
  const recent = lengths.slice(-3);
  if (recent.length === 0) return 28;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}

export function getAveragePeriodLength(cycles: CycleEntry[]): number {
  const withEnd = cycles.filter(c => c.endDate);
  if (withEnd.length === 0) return 5;
  const lengths = withEnd
    .map(c => diffDays(c.endDate!, c.startDate) + 1)
    .filter(l => l >= 1 && l <= 14);
  const recent = lengths.slice(-3);
  if (recent.length === 0) return 5;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}

export interface CyclePrediction {
  nextPeriodStart: string;
  ovulationDate: string;
  fertileStart: string;
  fertileEnd: string;
  currentCycleDay: number | null;
  daysUntilNextPeriod: number | null;
  daysUntilOvulation: number | null;
}

export function getCyclePredictions(cycles: CycleEntry[]): CyclePrediction | null {
  if (cycles.length === 0) return null;
  const sorted = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lastCycle = sorted[0];
  const avgLength = getAverageCycleLength(cycles);

  const nextPeriodStart = addDays(lastCycle.startDate, avgLength);
  const ovulationDate = addDays(lastCycle.startDate, avgLength - 14);
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);

  const today = todayStr();
  const daysSinceStart = diffDays(today, lastCycle.startDate);
  const currentCycleDay =
    daysSinceStart >= 0 && daysSinceStart < avgLength + 7 ? daysSinceStart + 1 : null;

  const daysUntilNextPeriod = diffDays(nextPeriodStart, today);
  const daysUntilOvulation = diffDays(ovulationDate, today);

  return {
    nextPeriodStart,
    ovulationDate,
    fertileStart,
    fertileEnd,
    currentCycleDay,
    daysUntilNextPeriod,
    daysUntilOvulation,
  };
}

export type DayStatus = 'period' | 'fertile' | 'ovulation' | 'predictedPeriod' | 'normal';

export interface DayInfo {
  status: DayStatus;
  cycleDay: number | null;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export function getDayInfo(
  dateStr: string,
  cycles: CycleEntry[],
  prediction: CyclePrediction | null,
  avgCycleLength: number,
  avgPeriodLength: number,
): DayInfo {
  const today = todayStr();
  const isToday = dateStr === today;
  const isPast = dateStr < today;
  const isFuture = dateStr > today;

  for (const cycle of cycles) {
    const end = cycle.endDate || addDays(cycle.startDate, avgPeriodLength - 1);
    if (dateStr >= cycle.startDate && dateStr <= end) {
      const cycleDay = diffDays(dateStr, cycle.startDate) + 1;
      return { status: 'period', cycleDay, isPast, isToday, isFuture };
    }
  }

  if (prediction) {
    if (dateStr === prediction.ovulationDate) {
      const last = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      const cycleDay = last ? diffDays(dateStr, last.startDate) + 1 : null;
      return { status: 'ovulation', cycleDay, isPast, isToday, isFuture };
    }
    if (dateStr >= prediction.fertileStart && dateStr <= prediction.fertileEnd) {
      const last = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      const cycleDay = last ? diffDays(dateStr, last.startDate) + 1 : null;
      return { status: 'fertile', cycleDay, isPast, isToday, isFuture };
    }
    const predEnd = addDays(prediction.nextPeriodStart, avgPeriodLength - 1);
    if (dateStr >= prediction.nextPeriodStart && dateStr <= predEnd) {
      return { status: 'predictedPeriod', cycleDay: null, isPast, isToday, isFuture };
    }
  }

  return { status: 'normal', cycleDay: null, isPast, isToday, isFuture };
}
