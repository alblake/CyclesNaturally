export interface HealthTempSample {
  date: string;
  tempF: number;
  startedAt: number;
}

export interface HealthAvailability {
  supported: boolean;
  reason?: string;
}

export function getHealthAvailability(): HealthAvailability {
  return {
    supported: false,
    reason: 'Apple Health is only available on iOS devices.',
  };
}

export async function requestHealthAuthorization(): Promise<boolean> {
  return false;
}

export async function fetchBodyTemperatureSamples(
  _startDate: Date,
  _endDate: Date,
): Promise<HealthTempSample[]> {
  return [];
}

export async function writeBodyTemperature(_tempF: number, _when: Date): Promise<boolean> {
  return false;
}
