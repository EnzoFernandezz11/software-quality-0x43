import type { AccessAudit, RoomConfig, SensorReading } from '../types/sensor.types';

const DEFAULT_MOCK_CONFIG: RoomConfig = {
  id: 1,
  room_name: "Sala Principal A",
  base_temp_limit: 25.0,
  inertia_time_minutes: 15,
  target_temperature: 22.0,
  current_mode: "Meeting",
};

export const getMockRoomConfig = (): RoomConfig => {
  if (typeof window === 'undefined') return DEFAULT_MOCK_CONFIG;
  const stored = localStorage.getItem('mock_room_config');
  if (stored) {
    try {
      return JSON.parse(stored) as RoomConfig;
    } catch {
      return DEFAULT_MOCK_CONFIG;
    }
  }
  localStorage.setItem('mock_room_config', JSON.stringify(DEFAULT_MOCK_CONFIG));
  return DEFAULT_MOCK_CONFIG;
};

export const updateMockRoomConfig = (data: Partial<RoomConfig>): RoomConfig => {
  const current = getMockRoomConfig();
  const updated = { ...current, ...data };
  if (typeof window !== 'undefined') {
    localStorage.setItem('mock_room_config', JSON.stringify(updated));
  }
  return updated;
};

// Internal dynamic metrics simulator
const getFilteredTemp = (offset: number) => {
  const period = 120000; // 2 minute cycle
  const time = Date.now();
  const sine = Math.sin(((time + offset) % period) / period * 2 * Math.PI);
  const temp = 23.0 + sine * 2.0; // oscillates between 21°C and 25°C
  return parseFloat(temp.toFixed(2));
};

const getRawTemp = (filtered: number) => {
  const noise = (Math.random() - 0.5) * 0.5;
  return parseFloat((filtered + noise).toFixed(2));
};

const getMotionDetected = (offset: number) => {
  // Motion active for 6 seconds every 24 seconds
  const sec = Math.floor((Date.now() + offset) / 1000) % 24;
  return sec < 6;
};

export const getMockLiveMetrics = (): SensorReading[] => {
  const config = getMockRoomConfig();
  const nowStr = new Date().toISOString();

  // Sensor A
  const filteredA = getFilteredTemp(0);
  const rawA = getRawTemp(filteredA);
  const motionA = getMotionDetected(0);
  const readingA: SensorReading = {
    id: Date.now(),
    sensor_id: "ESP32-Office-A",
    raw_temperature: rawA,
    filtered_temperature: filteredA,
    motion_detected: motionA,
    created_at: nowStr,
    room_location: config.room_name,
    thermal_alert_status: filteredA > config.base_temp_limit,
  };

  // Sensor B (slightly offset in phase and temperature)
  const filteredB = getFilteredTemp(40000) - 1.2;
  const rawB = getRawTemp(filteredB);
  const motionB = getMotionDetected(12000);
  const readingB: SensorReading = {
    id: Date.now() + 1,
    sensor_id: "ESP32-Office-B",
    raw_temperature: rawB,
    filtered_temperature: filteredB,
    motion_detected: motionB,
    created_at: nowStr,
    room_location: config.room_name,
    thermal_alert_status: filteredB > config.base_temp_limit,
  };

  return [readingA, readingB];
};

export const getMockHistory = (limit = 48): SensorReading[] => {
  const config = getMockRoomConfig();
  const readings: SensorReading[] = [];
  const now = Date.now();

  for (let i = 0; i < limit; i++) {
    // Generate data back in time (30 second intervals)
    const timeMs = now - i * 30000;
    const nowStr = new Date(timeMs).toISOString();

    // Alternate A and B readings to simulate both being logged
    const isSensorA = i % 2 === 0;
    const offset = isSensorA ? 0 : 40000;
    const tempDiff = isSensorA ? 0 : -1.2;
    const motionOffset = isSensorA ? 0 : 12000;
    const sensorName = isSensorA ? "ESP32-Office-A" : "ESP32-Office-B";

    const period = 120000;
    const sine = Math.sin(((timeMs + offset) % period) / period * 2 * Math.PI);
    const filtered = parseFloat((23.0 + sine * 2.0 + tempDiff).toFixed(2));
    const raw = parseFloat((filtered + (Math.random() - 0.5) * 0.4).toFixed(2));
    
    const sec = Math.floor((timeMs + motionOffset) / 1000) % 24;
    const motion = sec < 6;

    readings.push({
      id: now - i,
      sensor_id: sensorName,
      raw_temperature: raw,
      filtered_temperature: filtered,
      motion_detected: motion,
      created_at: nowStr,
      room_location: config.room_name,
      thermal_alert_status: filtered > config.base_temp_limit,
    });
  }

  return readings;
};

let mockAudits: AccessAudit[] = [];

const initializeMockAudits = () => {
  if (mockAudits.length > 0) return;
  const now = Date.now();
  mockAudits = [
    {
      id: 101,
      pin_entered: "****",
      is_success: true,
      strategy_used: "RFID",
      created_at: new Date(now - 120000).toISOString(),
      current_mode: "Normal",
    },
    {
      id: 102,
      pin_entered: "5678",
      is_success: false,
      strategy_used: "PIN",
      created_at: new Date(now - 350000).toISOString(),
      current_mode: "Normal",
    },
    {
      id: 103,
      pin_entered: "1234",
      is_success: true,
      strategy_used: "PIN",
      created_at: new Date(now - 600000).toISOString(),
      current_mode: "Normal",
    },
    {
      id: 104,
      pin_entered: "****",
      is_success: true,
      strategy_used: "RFID_CARD",
      created_at: new Date(now - 900000).toISOString(),
      current_mode: "Energy Saving",
    },
  ];
};

export const getMockSecurityAudits = (): AccessAudit[] => {
  initializeMockAudits();

  // Dynamically append new audits occasionally (30% chance every time it is called if at least 15s elapsed)
  if (mockAudits.length > 0) {
    const lastAuditTime = new Date(mockAudits[0].created_at).getTime();
    if (Date.now() - lastAuditTime > 15000 && Math.random() > 0.7) {
      const isSuccess = Math.random() > 0.3;
      const strategy = Math.random() > 0.5 ? "RFID" : "PIN";
      const config = getMockRoomConfig();
      const newAudit: AccessAudit = {
        id: Date.now(),
        pin_entered: isSuccess ? "****" : Math.floor(1000 + Math.random() * 9000).toString(),
        is_success: isSuccess,
        strategy_used: strategy,
        created_at: new Date().toISOString(),
        current_mode: config.current_mode,
      };
      mockAudits = [newAudit, ...mockAudits].slice(0, 50);
    }
  }

  return mockAudits;
};
