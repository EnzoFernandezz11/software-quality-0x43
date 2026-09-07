/**
 * Shared frontend contracts.
 *
 * These types intentionally keep the backend field names (`snake_case`) so the
 * frontend maps directly to the Flask API and the PostgreSQL domain language.
 */

export interface SensorReading {
  id: number;
  sensor_id: string;
  raw_temperature: number;
  filtered_temperature: number;
  motion_detected: boolean;
  created_at: string;
  room_location?: string;
  thermal_alert_status?: boolean;
}

export type AlertSeverity = 'low' | 'medium' | 'high';

export interface Alert {
  sensor_id: string;
  message: string;
  severity: AlertSeverity;
  triggered_at: string;
  temperature_at_trigger: number;
}

export type RoomMode = 'Meeting' | 'Energy Saving' | 'Normal';

export interface AccessAudit {
  id: number;
  pin_entered: string;
  is_success: boolean;
  strategy_used: string;
  created_at: string;
  current_mode?: RoomMode;
}

export interface RoomConfig {
  id?: number;
  room_name: string;
  base_temp_limit: number;
  inertia_time_minutes: number;
  target_temperature: number;
  current_mode: RoomMode;
}

export interface LiveRoomStatus {
  current_mode: RoomMode;
  target_temperature: number;
  base_sleep_temperature: number;
}

export interface HistoryFilters {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface TemperatureChartProps {
  data: SensorReading[];
}

export interface MotionTimelineChartProps {
  data: SensorReading[];
}

export interface SensorComparisonChartProps {
  data: SensorReading[];
}

export interface LatestReadingCardProps {
  reading: SensorReading;
}

export interface AlertBadgeProps {
  alert: Alert | null;
}

export interface ActivityFeedProps {
  audits: AccessAudit[];
}
