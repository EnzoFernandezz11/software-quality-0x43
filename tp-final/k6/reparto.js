import { configurar, llegada, medir, resumen } from './medicion.js';

const tasa = Number(__ENV.RATE ?? 10);
const segundos = Number(__ENV.DURATION_SECONDS ?? 120);
const peso = __ENV.WEIGHT === undefined ? null : Number(__ENV.WEIGHT);

if (![tasa, segundos].every((n) => Number.isInteger(n) && n > 0) ||
    (peso !== null && (!/^\d+$/.test(__ENV.WEIGHT) || peso > 100))) {
  throw new Error('RATE y DURATION_SECONDS deben ser enteros positivos. WEIGHT debe estar entre 0 y 100.');
}

export const options = configurar({ reparto: llegada(tasa, segundos) });
export default medir;

export function handleSummary(data) {
  return resumen(data, { reparto: { tasa, segundos } }, { peso });
}
