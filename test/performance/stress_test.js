import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // ramp up to 20 users
    { duration: '1m', target: 100 },  // increase load
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% requests under 800ms
  },
};

const BASE_URL = 'https://localhost:3001';

export default function () {
  // Example: test public endpoint
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1); // Simulate real user think time
}
