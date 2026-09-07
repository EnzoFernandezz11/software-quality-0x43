'use client';

import { useCallback, useEffect, useState } from 'react';

import { getLiveMetrics } from '../services/sensors.service';
import type { Alert, AlertSeverity, SensorReading } from '../types/sensor.types';

const DEFAULT_TEMP_LIMIT = 27;
const DEFAULT_MAX_POINTS = 48;

function deriveAlert(reading: SensorReading, tempLimit = DEFAULT_TEMP_LIMIT): Alert {
  const temp = reading.filtered_temperature;
  const diff = temp - tempLimit;

  let severity: AlertSeverity = 'low';
  if (diff > 5) {
    severity = 'high';
  } else if (diff > 2) {
    severity = 'medium';
  }

  return {
    sensor_id: reading.sensor_id,
    message: `Temperatura ${temp.toFixed(1)} °C supera el umbral de ${tempLimit} °C`,
    severity,
    triggered_at: reading.created_at,
    temperature_at_trigger: temp,
  };
}

function prependUniqueReadings(
  current: SensorReading[],
  incoming: SensorReading[],
  maxPoints: number,
): SensorReading[] {
  const byId = new Map<number, SensorReading>();

  for (const reading of [...incoming, ...current]) {
    if (!byId.has(reading.id)) {
      byId.set(reading.id, reading);
    }
  }

  return Array.from(byId.values()).slice(0, maxPoints);
}

export interface UseSensorPollingResult {
  data: SensorReading[];
  latestReadings: SensorReading[];
  alerts: Alert[];
  isLoading: boolean;
  error: Error | null;
  lastUpdatedAt: string | null;
  refresh: () => Promise<void>;
}

export function useSensorPolling(
  intervalMs = 5000,
  tempLimit = DEFAULT_TEMP_LIMIT,
  maxPoints = DEFAULT_MAX_POINTS,
): UseSensorPollingResult {
  const [data, setData] = useState<SensorReading[]>([]);
  const [latestReadings, setLatestReadings] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const readings = await getLiveMetrics();
      setLatestReadings(readings);
      setData((current) => prependUniqueReadings(current, readings, maxPoints));
      setAlerts(
        readings
          .filter((reading) => reading.thermal_alert_status === true)
          .map((reading) => deriveAlert(reading, tempLimit)),
      );
      setLastUpdatedAt(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('No se pudieron obtener metricas'));
    } finally {
      setIsLoading(false);
    }
  }, [maxPoints, tempLimit]);

  useEffect(() => {
    refresh();
    const intervalId = window.setInterval(refresh, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs, refresh]);

  return { data, latestReadings, alerts, isLoading, error, lastUpdatedAt, refresh };
}
