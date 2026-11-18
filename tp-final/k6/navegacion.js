import { check } from 'k6';
import { browser } from 'k6/browser';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';

const url = __ENV.URL || 'http://terrasense.local/dashboard';
const directorio = __ENV.CAPTURE_DIR || 'tp-final/evidencias/capturas';
const selector = __ENV.DASHBOARD_SELECTOR || 'h1.dashboard-title';
const visitas = Number(__ENV.VISITS ?? 20);
const capturas = new Counter('capturas_panel');
const guardadas = new Set();

if (!Number.isInteger(visitas) || visitas < 1 || visitas > 20) {
  throw new Error('VISITS debe ser un entero entre 1 y 20.');
}

export const options = {
  scenarios: {
    navegacion: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: visitas,
      maxDuration: '12m',
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    checks: ['rate==1'],
    'capturas_panel{version:1.0.0}': ['count>=1'],
    'capturas_panel{version:1.1.0}': ['count>=1'],
  },
};

function tipoDeRecurso(request) {
  return request.resourceType().toLowerCase();
}

function esRecursoDelPanel(request) {
  return ['script', 'stylesheet'].includes(tipoDeRecurso(request));
}

async function revisarRecurso(response) {
  const request = response.request();
  const estado = response.status();
  const tipo = tipoDeRecurso(request);
  if (estado >= 300 && estado < 400 && estado !== 304) return null; // Cuenta la respuesta final.
  const mime = await response.headerValue('content-type') || '';
  const mimeCorrecto = tipo === 'stylesheet' ? /^text\/css\b/i.test(mime) : /(?:java|ecma)script/i.test(mime);
  const ok = (estado >= 200 && estado < 300 && mimeCorrecto) || estado === 304;
  return { tipo, url: request.url(), ok, estado, mime };
}

export default async function () {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const recursos = [];
  const fallosRed = [];
  let version = null;
  let recursosValidos = false;
  let documentoValido = false;
  let panelVisible = false;
  let captura = null;

  page.on('response', (response) => {
    if (esRecursoDelPanel(response.request())) recursos.push(revisarRecurso(response));
  });
  page.on('requestfailed', (request) => {
    if (esRecursoDelPanel(request)) fallosRed.push({ url: request.url(), tipo: tipoDeRecurso(request) });
  });

  try {
    const documento = await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    version = documento ? await documento.headerValue('x-app-version') : null;
    documentoValido = documento?.status() === 200 && ['1.0.0', '1.1.0'].includes(version);

    if (documentoValido) {
      try {
        await page.locator(selector).waitFor({ state: 'visible', timeout: 5000 });
        panelVisible = true;
      } catch (error) {
        console.warn('Panel no visible: ' + error.message);
      }
    }

    const revisados = (await Promise.all(recursos)).filter(Boolean);
    const fallos = revisados.filter((recurso) => !recurso.ok);
    recursosValidos = fallos.length === 0 && fallosRed.length === 0 &&
      ['script', 'stylesheet'].every((tipo) => revisados.some((recurso) => recurso.tipo === tipo));
    if (!recursosValidos) {
      console.warn(JSON.stringify({ version, fallos, fallosRed, recursosObservados: revisados.length }));
    }

    if (documentoValido && panelVisible && recursosValidos && !guardadas.has(version)) {
      const archivo = directorio + '/dashboard-' + version + '.png';
      await page.screenshot({ path: archivo, fullPage: true });
      guardadas.add(version);
      captura = archivo;
    }
  } catch (error) {
    console.error('Falló la navegación: ' + error.message);
  } finally {
    check(documentoValido && panelVisible && recursosValidos, { 'documento, panel, JS y CSS válidos': (ok) => ok });
    for (const esperada of ['1.0.0', '1.1.0']) {
      capturas.add(captura && version === esperada ? 1 : 0, { version: esperada });
    }
    console.log(JSON.stringify({
      visita: exec.scenario.iterationInTest + 1, version, documentoValido, panelVisible, recursosValidos, captura,
    }));
    await page.close();
  }
}
