'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { formatDateTime, formatTemperature } from '@/lib/utils';
import type { AlertBadgeProps, AlertSeverity } from '@/types/sensor.types';

const severityConfig: Record<AlertSeverity, { border: string; bg: string; fg: string; label: string }> = {
  low: {
    border: 'var(--color-warning-fg)',
    bg: 'var(--color-warning-bg)',
    fg: 'var(--color-warning-fg)',
    label: 'Baja',
  },
  medium: {
    border: 'var(--color-warning-fg)',
    bg: 'var(--color-warning-bg)',
    fg: 'var(--color-warning-fg)',
    label: 'Media',
  },
  high: {
    border: 'var(--color-danger-fg)',
    bg: 'var(--color-danger-bg)',
    fg: 'var(--color-danger-fg)',
    label: 'Alta',
  },
};

export function AlertBadge({ alert }: AlertBadgeProps) {
  if (!alert) {
    return (
      <article className="group relative overflow-hidden rounded-xl border border-border/40 bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-border">
        {/* Subtle gradient accent line at the top */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--title-accent-from)] to-[var(--title-accent-to)] opacity-80" />

        <div className="flex h-full flex-col justify-center">
          <div className="flex items-center gap-4">
            {/* Gradient icon ring matching the dashboard title */}
            <div className="dashboard-icon-ring shadow-sm">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="card-title text-sm">Sistema Estable</p>
              <p className="kpi-detail mt-0.5">Operando dentro de parámetros térmicos seguros.</p>
            </div>
          </div>
        </div>
      </article>
    );
  }

  const config = severityConfig[alert.severity];

  return (
    <article
      className="group relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all hover:shadow-md"
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: config.fg, opacity: 0.8 }} />

      <div className="flex items-start gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
          style={{ backgroundColor: config.fg, color: 'white' }}
        >
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="card-title text-sm" style={{ color: config.fg }}>
            Alerta térmica {config.label}
          </p>
          <p className="kpi-detail mt-0.5 font-medium" style={{ color: config.fg, opacity: 0.9 }}>
            {alert.message}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3" style={{ color: config.fg, opacity: 0.85 }}>
        <span className="font-medium">Sensor: {alert.sensor_id}</span>
        <span className="font-medium">Temp: {formatTemperature(alert.temperature_at_trigger)}</span>
        <span className="font-medium text-right sm:text-left">{formatDateTime(alert.triggered_at)}</span>
      </div>
    </article>
  );
}
