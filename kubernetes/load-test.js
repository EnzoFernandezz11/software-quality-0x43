import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';
const profiles = {
  smoke: [{ duration: '30s', target: 1 }],
  average: [{ duration: '30s', target: 10 }, { duration: '2m', target: 10 }, { duration: '30s', target: 0 }],
  stress: [{ duration: '30s', target: 30 }, { duration: '2m', target: 30 }, { duration: '30s', target: 0 }],
  soak: [{ duration: '30s', target: 10 }, { duration: '10m', target: 10 }, { duration: '30s', target: 0 }],
  breakpoint: [{ duration: '5m', target: 60 }],
  spike: [{ duration: '1s', target: 60 }, { duration: '30s', target: 60 }, { duration: '1s', target: 0 }],
};
const profile = __ENV.PROFILE || 'smoke';
if (!profiles[profile]) throw new Error(`Perfil desconocido: ${profile}`);
export const options = {
  stages: profiles[profile],
  noConnectionReuse: true,
  tags: { profile, run_id: __ENV.RUN_ID || 'local' },
};
export default function () {
  const response = http.get(`${baseUrl}/api/dashboard/history?limit=1`);
  check(response, { 'history responds with 200': (res) => res.status === 200 });
  sleep(1);
}
