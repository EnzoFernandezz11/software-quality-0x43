import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const rate = Number(__ENV.SPIKE_RPS || 400);
const preAllocatedVUs = Number(__ENV.PRE_ALLOCATED_VUS || 200);
const maxVUs = Number(__ENV.MAX_VUS || 1000);
const errors502 = new Counter('telemetry_http_502');
const errors503 = new Counter('telemetry_http_503');
const errors504 = new Counter('telemetry_http_504');
const transportErrors = new Counter('telemetry_transport_errors');
const otherErrors = new Counter('telemetry_other_non_201');

if (!Number.isInteger(rate) || rate < 1 || !Number.isInteger(preAllocatedVUs) ||
    preAllocatedVUs < 1 || !Number.isInteger(maxVUs) || maxVUs < preAllocatedVUs) {
  throw new Error('SPIKE_RPS y los VUs deben ser enteros positivos; MAX_VUS >= PRE_ALLOCATED_VUS');
}

export const options = {
  tags: { profile: 'e2-spike', run_id: __ENV.RUN_ID || 'local' },
  ...(__ENV.INGRESS_IP ? { hosts: { 'api.terrasense.local': __ENV.INGRESS_IP } } : {}),
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs,
      maxVUs,
      stages: [
        { target: rate, duration: __ENV.RAMP_DURATION || '5s' },
        { target: rate, duration: __ENV.HOLD_DURATION || '30s' },
        { target: 0, duration: __ENV.DOWN_DURATION || '5s' },
      ],
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  const sensor = String(Math.floor(Math.random() * 2000) + 1).padStart(4, '0');
  const response = http.post(
    `${__ENV.BASE_URL || 'http://api.terrasense.local'}/api/telemetry`,
    JSON.stringify({ sensor_id: `esp32-${sensor}`, raw_temperature: 23.5, motion_detected: true }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'telemetry' }, timeout: '30s' },
  );
  errors502.add(response.status === 502 ? 1 : 0);
  errors503.add(response.status === 503 ? 1 : 0);
  errors504.add(response.status === 504 ? 1 : 0);
  transportErrors.add(response.status === 0 ? 1 : 0);
  otherErrors.add(![0, 201, 502, 503, 504].includes(response.status) ? 1 : 0);
  check(response, { 'telemetry responde 201': (r) => r.status === 201 });
}
