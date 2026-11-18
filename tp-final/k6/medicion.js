import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';

const url = __ENV.URL || 'http://terrasense.local/dashboard';
const versiones = ['1.0.0', '1.1.0', 'desconocida'];
const visitas = new Counter('visitas');
const errores = new Rate('errores');
const latencia = new Trend('latencia', true);
const limites = { error: 0.01, p95Ms: 300, factorP95: 1.10, muestra: 200, repartoMin: 45, repartoMax: 55 };

http.setResponseCallback(http.expectedStatuses(200));

export function llegada(rate, segundos, inicio = 0) {
  return {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1s',
    duration: segundos + 's',
    startTime: inicio + 's',
    preAllocatedVUs: 30,
    maxVUs: 400,
    gracefulStop: '6s',
  };
}

export function configurar(scenarios, { smoke = false, estres = false } = {}) {
  const thresholds = smoke ? { checks: ['rate==1'] } : {};
  for (const nombre of Object.keys(scenarios)) {
    const etapa = 'scenario:' + nombre;
    if (!smoke) thresholds['dropped_iterations{' + etapa + '}'] = [estres ? 'count==0' : 'count>=0'];

    // k6 incluye estas submétricas en el resumen cuando se declaran como thresholds.
    for (const version of [null, ...versiones]) {
      const filtro = version ? etapa + ',version:' + version : etapa;
      thresholds['visitas{' + filtro + '}'] = ['count>=0'];
      thresholds['errores{' + filtro + '}'] = [
        estres && version && version !== 'desconocida' ? 'rate<' + limites.error : 'rate<=1',
      ];
      thresholds['latencia{' + filtro + '}'] = [
        estres && version === '1.1.0' ? 'p(95)<' + limites.p95Ms : 'p(95)>=0',
      ];
    }
  }

  return { scenarios, thresholds, noCookiesReset: false, summaryTrendStats: ['med', 'p(95)', 'p(99)'] };
}

export function medir() {
  const res = http.get(url, { redirects: 0, timeout: '5s' });
  const header = res.headers['X-App-Version'];
  const reconocida = header === '1.0.0' || header === '1.1.0';
  const tags = { version: reconocida ? header : 'desconocida' };

  visitas.add(1, tags);
  errores.add(res.status !== 200, tags);
  latencia.add(res.timings.duration, tags);
  if (exec.scenario.name === 'smoke') {
    check(res, { 'documento HTTP 200': (r) => r.status === 200, 'versión reconocida': () => reconocida });
  }
}

function estadisticas(metrics, filtro, segundos) {
  const total = metrics['visitas{' + filtro + '}']?.values.count || 0;
  return {
    total,
    rps: total / segundos,
    errores: metrics['errores{' + filtro + '}']?.values.passes || 0,
    porcentajeError: total ? metrics['errores{' + filtro + '}'].values.rate * 100 : null,
    p95Ms: total ? metrics['latencia{' + filtro + '}'].values['p(95)'] : null,
  };
}

function evaluarAB(stable, canary, repartoCanary, descartadas, deficit) {
  const motivos = [];
  if (stable.total < limites.muestra || canary.total < limites.muestra) motivos.push('muestra insuficiente');
  if (repartoCanary === null || repartoCanary < limites.repartoMin || repartoCanary > limites.repartoMax) {
    motivos.push('reparto fuera de 45/55 a 55/45');
  }
  if (descartadas > 0) motivos.push('iteraciones descartadas');
  if (deficit > 1) motivos.push('no se completó la carga prevista');
  if (motivos.length) return { estado: 'inconcluso', motivos };

  if (stable.porcentajeError >= limites.error * 100) motivos.push('errores de 1.0.0 ≥ 1 %');
  if (canary.porcentajeError >= limites.error * 100) motivos.push('errores de 1.1.0 ≥ 1 %');
  if (canary.p95Ms >= limites.p95Ms) motivos.push('p95 de 1.1.0 ≥ 300 ms');
  if (canary.p95Ms > stable.p95Ms * limites.factorP95) motivos.push('p95 de 1.1.0 supera en más del 10 % al de 1.0.0');
  return { estado: motivos.length ? 'no cumple' : 'cumple', motivos };
}

export function resumen(data, perfiles, { estres = false, peso = null } = {}) {
  const etapas = Object.entries(perfiles).map(([nombre, { segundos, tasa = null }]) => {
    const filtro = 'scenario:' + nombre;
    const global = estadisticas(data.metrics, filtro, segundos);
    const porVersion = Object.fromEntries(versiones.map((version) =>
      [version, estadisticas(data.metrics, filtro + ',version:' + version, segundos)]));
    const stable = porVersion['1.0.0'];
    const canary = porVersion['1.1.0'];
    const reconocidas = stable.total + canary.total;
    const porcentajeCanary = reconocidas ? canary.total * 100 / reconocidas : null;
    const descartadas = data.metrics['dropped_iterations{' + filtro + '}']?.values.count || 0;
    const objetivo = tasa === null ? null : tasa * segundos;

    return {
      nombre,
      duracionObjetivoS: segundos,
      tasaObjetivoRps: tasa,
      solicitudesObjetivo: objetivo,
      global,
      porVersion,
      reparto: {
        denominadorRespuestasReconocidas: reconocidas,
        porcentajeCanary,
        diferenciaCanaryPuntos: peso !== null && porcentajeCanary !== null ? porcentajeCanary - peso : null,
      },
      iteracionesDescartadas: descartadas,
      ...(estres ? { hipotesisAB: evaluarAB(stable, canary, porcentajeCanary, descartadas, objetivo - global.total) } : {}),
    };
  });

  const salida = JSON.stringify({ url, pesoCanaryConfigurado: peso, etapas }, null, 2) + '\n';
  if (__ENV.REPORT_JSON) {
    const lineas = etapas.map(({ nombre, global, reparto, iteracionesDescartadas, hipotesisAB }) =>
      nombre + ': ' + global.total + ' visitas, ' + reparto.denominadorRespuestasReconocidas +
      ' identificadas, ' + global.errores + ' errores, ' + iteracionesDescartadas + ' descartadas' +
      (hipotesisAB ? ', A/B ' + hipotesisAB.estado : ''));
    return { stdout: '\n' + lineas.join('\n') + '\nReporte: ' + __ENV.REPORT_JSON + '\n', [__ENV.REPORT_JSON]: salida };
  }
  return { stdout: '\n' + salida };
}
