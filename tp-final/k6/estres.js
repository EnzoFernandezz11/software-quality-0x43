import { configurar, llegada, medir, resumen } from './medicion.js';

const segundos = 120;
const perfiles = {
  etapa1: { tasa: 10, segundos },
  etapa2: { tasa: 20, segundos },
  etapa3: { tasa: 40, segundos },
  etapa4: { tasa: 80, segundos },
};
const scenarios = Object.fromEntries(Object.entries(perfiles).map(([nombre, { tasa }], i) =>
  [nombre, llegada(tasa, segundos, i * segundos)]));

export const options = configurar(scenarios, { estres: true });
export default medir;

export function handleSummary(data) {
  return resumen(data, perfiles, { estres: true, peso: 50 });
}
