import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const response = http.get(`${baseUrl}/api/dashboard/history?limit=1`);
  check(response, { 'history responds with 200': (res) => res.status === 200 });
  sleep(1);
}
