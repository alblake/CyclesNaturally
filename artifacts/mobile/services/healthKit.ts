import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface HealthTempSample {
  date: string;
  tempF: number;
  startedAt: number;
}

export interface HealthAvailability {
  supported: boolean;
  reason?: string;
}

let AppleHealthKit: any = null;
let loadError: string | null = null;

if (Platform.OS === 'ios') {
  try {
    AppleHealthKit = require('react-native-health').default;
  } catch (e: any) {
    loadError = e?.message || 'Failed to load react-native-health';
  }
}

export function getHealthAvailability(): HealthAvailability {
  if (Platform.OS !== 'ios') {
    return { supported: false, reason: 'Apple Health is only available on iOS.' };
  }
  if (Constants.appOwnership === 'expo') {
    return {
      supported: false,
      reason: 'Apple Health requires a development build. Expo Go cannot access HealthKit.',
    };
  }
  if (!AppleHealthKit) {
    return {
      supported: false,
      reason: loadError || 'HealthKit module not linked. Rebuild the app with EAS.',
    };
  }
  return { supported: true };
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function requestHealthAuthorization(): Promise<boolean> {
  const avail = getHealthAvailability();
  if (!avail.supported || !AppleHealthKit) return false;

  const permissions = {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.BodyTemperature],
      write: [AppleHealthKit.Constants.Permissions.BodyTemperature],
    },
  };

  return new Promise(resolve => {
    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      if (error) {
        console.warn('[HealthKit] initHealthKit error:', error);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

/**
 * Fetch all body temperature samples between startDate and endDate (inclusive).
 * Returns one sample per local calendar date — the EARLIEST reading of that day,
 * which matches BBT methodology ("first reading after waking up").
 */
export async function fetchBodyTemperatureSamples(
  startDate: Date,
  endDate: Date,
): Promise<HealthTempSample[]> {
  const avail = getHealthAvailability();
  if (!avail.supported || !AppleHealthKit) return [];

  const options = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    unit: 'fahrenheit',
    ascending: true,
    limit: 1000,
  };

  return new Promise(resolve => {
    AppleHealthKit.getBodyTemperatureSamples(options, (err: string, results: any[]) => {
      if (err) {
        console.warn('[HealthKit] getBodyTemperatureSamples error:', err);
        resolve([]);
        return;
      }
      if (!Array.isArray(results)) {
        resolve([]);
        return;
      }

      const earliestByDate = new Map<string, HealthTempSample>();
      for (const r of results) {
        const value = typeof r?.value === 'number' ? r.value : null;
        const startStr = r?.startDate || r?.endDate;
        if (value === null || !startStr) continue;
        const startedAt = new Date(startStr).getTime();
        if (!Number.isFinite(startedAt)) continue;
        const dateStr = localDateStr(new Date(startedAt));
        const existing = earliestByDate.get(dateStr);
        if (!existing || startedAt < existing.startedAt) {
          earliestByDate.set(dateStr, {
            date: dateStr,
            tempF: value,
            startedAt,
          });
        }
      }
      resolve(Array.from(earliestByDate.values()));
    });
  });
}

export async function writeBodyTemperature(tempF: number, when: Date): Promise<boolean> {
  const avail = getHealthAvailability();
  if (!avail.supported || !AppleHealthKit) return false;

  const options = {
    value: tempF,
    startDate: when.toISOString(),
    unit: 'fahrenheit',
  };

  return new Promise(resolve => {
    AppleHealthKit.saveBodyTemperature(options, (err: string) => {
      if (err) {
        console.warn('[HealthKit] saveBodyTemperature error:', err);
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}
