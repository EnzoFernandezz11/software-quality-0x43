import { sleep } from 'k6';
import { configurar, medir, resumen } from './medicion.js';

const segundos = 10;
export const options = configurar({
  smoke: { executor: 'constant-vus', vus: 1, duration: segundos + 's' },
}, { smoke: true });

export default function () {
  medir();
  sleep(1);
}

export function handleSummary(data) {
  return resumen(data, { smoke: { segundos } });
}
