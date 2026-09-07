import type {
  AccessAudit,
  HistoryFilters,
  LiveRoomStatus,
  RoomConfig,
  SensorReading,
} from '../types/sensor.types';

type DashboardLiveResponse = {
  last_reading?: SensorReading | Record<string, never>;
  room_status?: LiveRoomStatus;
};

type HistoryResponse = {
  total: number;
  readings: SensorReading[];
};

type SecurityLogsResponse = {
  logs: AccessAudit[];
};

type ConfigUpdateResponse = {
  status: string;
  message: string;
  config: RoomConfig;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

const assertOk = async (response: Response, action: string): Promise<void> => {
  if (!response.ok) {
    throw new Error(`${action} failed with HTTP ${response.status}`);
  }
};

const isSensorReading = (value: unknown): value is SensorReading => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SensorReading>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.sensor_id === 'string' &&
    typeof candidate.raw_temperature === 'number' &&
    typeof candidate.filtered_temperature === 'number' &&
    typeof candidate.motion_detected === 'boolean' &&
    typeof candidate.created_at === 'string'
  );
};

export const getLiveMetrics = async (): Promise<SensorReading[]> => {
  const response = await fetch(`${API_BASE_URL}/dashboard/live`, {
    cache: 'no-store',
  });
  await assertOk(response, 'getLiveMetrics');

  const body = (await response.json()) as DashboardLiveResponse;
  return isSensorReading(body.last_reading) ? [body.last_reading] : [];
};

export const getHistory = async (filters: HistoryFilters = {}): Promise<SensorReading[]> => {
  const params = new URLSearchParams();
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  if (filters.startDate) params.set('start_date', filters.startDate);
  if (filters.endDate) params.set('end_date', filters.endDate);

  const response = await fetch(`${API_BASE_URL}/dashboard/history?${params}`, {
    cache: 'no-store',
  });
  await assertOk(response, 'getHistory');

  const body = (await response.json()) as HistoryResponse;
  return body.readings;
};

export const getSecurityAudits = async (): Promise<AccessAudit[]> => {
  const response = await fetch(`${API_BASE_URL}/dashboard/security-logs`, {
    cache: 'no-store',
  });
  await assertOk(response, 'getSecurityAudits');

  const body = (await response.json()) as SecurityLogsResponse;
  return body.logs;
};

export const getRoomConfig = async (): Promise<RoomConfig> => {
  const response = await fetch(`${API_BASE_URL}/config`, {
    cache: 'no-store',
  });
  await assertOk(response, 'getRoomConfig');

  return response.json() as Promise<RoomConfig>;
};

export const updateRoomConfig = async (
  configData: Partial<RoomConfig>,
): Promise<RoomConfig> => {
  const response = await fetch(`${API_BASE_URL}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configData),
  });
  await assertOk(response, 'updateRoomConfig');

  const body = (await response.json()) as ConfigUpdateResponse;
  return body.config;
};

export { API_BASE_URL };
