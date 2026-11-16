import http from 'k6/http';
import { check } from 'k6';
import { browser } from 'k6/browser';
import { Counter, Rate } from 'k6/metrics';

const mode = __ENV.E1_MODE || 'e1a';
const rate = Number(__ENV.RPS || 5);
const duration = Number(__ENV.DURATION_SECONDS || 60);
const failureDelay = Number(__ENV.FAILURE_DELAY_SECONDS || 20);
const uxWait = Number(__ENV.UX_WAIT_SECONDS || 12);
const preAllocatedVUs = Number(__ENV.PRE_ALLOCATED_VUS || 20);
const maxVUs = Number(__ENV.MAX_VUS || 100);
const captures = new Counter('ux_capturas');
const degraded = new Rate('ux_degradada');

if (!['e1a', 'e1b'].includes(mode) ||
    ![rate, duration, failureDelay, uxWait, preAllocatedVUs, maxVUs]
      .every((n) => Number.isInteger(n) && n > 0) ||
    maxVUs < preAllocatedVUs || failureDelay + uxWait + 5 >= duration) {
  throw new Error('Revisá E1_MODE, enteros positivos, MAX_VUS >= PRE_ALLOCATED_VUS y duración > falla + UX + 5 s');
}

export const options = {
  tags: { profile: mode, run_id: __ENV.RUN_ID || 'local' },
  ...(__ENV.INGRESS_IP ? {
    hosts: { 'api.terrasense.local': __ENV.INGRESS_IP, 'terrasense.local': __ENV.INGRESS_IP },
  } : {}),
  scenarios: {
    carga: {
      executor: 'constant-arrival-rate',
      exec: 'telemetry',
      rate,
      timeUnit: '1s',
      duration: `${duration}s`,
      preAllocatedVUs,
      maxVUs,
      gracefulStop: '10s',
    },
    ux: {
      executor: 'shared-iterations',
      exec: 'captureUX',
      vus: 1,
      iterations: 1,
      startTime: `${failureDelay}s`,
      maxDuration: `${duration - failureDelay}s`,
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    'http_req_failed{scenario:carga}': ['rate<0.01'],
    'http_req_duration{scenario:carga}': ['p(95)<300'],
    ux_capturas: ['count==1'],
    ...(mode === 'e1b' ? { ux_degradada: ['rate==1'] } : {}),
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  // El orquestador usa esta marca, no el tiempo de arranque del proceso k6.
  console.log(`E1_START_MS=${Date.now()}`);
}

export function telemetry() {
  const sensor = String(Math.floor(Math.random() * 2000) + 1).padStart(4, '0');
  const response = http.post(
    `${__ENV.BASE_URL || 'http://api.terrasense.local'}/api/telemetry`,
    JSON.stringify({ sensor_id: `esp32-${sensor}`, raw_temperature: 23.5, motion_detected: true }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'telemetry' },
      responseCallback: http.expectedStatuses(201),
      timeout: '5s',
    },
  );
  check(response, { 'telemetry responde 201': (r) => r.status === 201 });
}

export async function captureUX() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(__ENV.FRONT_URL || 'http://terrasense.local', {
      waitUntil: 'domcontentloaded', timeout: 10000,
    });
    // Se observa la SPA real: no se interceptan requests ni se altera la página.
    let visibleFailure = false;
    try {
      await page.waitForFunction(
        () => /getLiveMetrics failed|Failed to fetch|NetworkError|Load failed/.test(document.body.innerText),
        { timeout: uxWait * 1000, polling: 100 },
      );
      visibleFailure = true;
    } catch (_) {
      console.log('No se observó un mensaje de error en el dashboard durante la ventana UX');
    }
    degraded.add(visibleFailure);
    await page.screenshot({
      path: __ENV.SCREENSHOT_PATH || 'tp-k8s/evidencias/falla-ux.png', fullPage: true,
    });
    captures.add(1);
    console.log(`E1_UX ${JSON.stringify({ time: new Date().toISOString(), visibleFailure })}`);
  } finally {
    await page.close();
  }
}
