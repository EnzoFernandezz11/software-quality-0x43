import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const baseUrl = (__ENV.BASE_URL || 'http://api.terrasense.local').replace(/\/$/, '');
http.setResponseCallback(http.expectedStatuses(201));

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 2, duration: '30s' },
  },
  thresholds: {
    'http_req_failed{name:telemetry}': ['rate<0.01'],
    'http_req_duration{name:telemetry}': ['p(95)<300'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
  tags: { profile: 'smoke', run_id: __ENV.RUN_ID || 'manual' },
};

export default function () {
  const iteration = exec.scenario.iterationInTest;
  const payload = {
    sensor_id: `esp32-${String((iteration % 2000) + 1).padStart(4, '0')}`,
    raw_temperature: 22 + (iteration % 60) / 20,
    motion_detected: iteration % 10 < 3,
  };
  const response = http.post(`${baseUrl}/api/telemetry`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'telemetry' },
  });
  check(response, { 'telemetry returned 201': (res) => res.status === 201 });
  sleep(1);
}
