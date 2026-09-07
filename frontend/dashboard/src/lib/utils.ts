import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) {
    return 'Sin fecha';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatChartTime(iso?: string | null): string {
  if (!iso) {
    return '--:--';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatTemperature(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--.- °C';
  }

  return `${value.toFixed(1)} °C`;
}

export function formatBooleanStatus(value: boolean): string {
  return value ? 'Detectado' : 'Sin actividad';
}

export function formatMode(mode?: string): string {
  if (!mode) {
    return 'Sin modo';
  }

  const labels: Record<string, string> = {
    Normal: 'Normal',
    Meeting: 'Reunion',
    'Energy Saving': 'Ahorro de energia',
  };

  return labels[mode] ?? mode;
}
