'use client';

import { Activity, MapPin, Thermometer, Waves } from 'lucide-react';

import { formatBooleanStatus, formatDateTime, formatTemperature } from '@/lib/utils';
import type { LatestReadingCardProps } from '@/types/sensor.types';

export function LatestReadingCard({ reading }: LatestReadingCardProps) {
  const hasAlert = reading.thermal_alert_status === true;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border/40 bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-border">
      {/* Top subtle line */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-border/40 transition-colors group-hover:bg-primary/20" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Última lectura</p>
          <h2 className="card-title mt-0.5">{reading.sensor_id}</h2>
        </div>
        <span className="pill-badge">
          {formatDateTime(reading.created_at)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-xl border border-success-bg p-3"
          style={{ backgroundColor: 'var(--color-success-bg)' }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-success-fg)', opacity: 0.8 }}>
            <Thermometer className="size-3.5" />
            Filtrada
          </div>
          <p className="kpi-value mt-1.5 text-xl" style={{ color: 'var(--color-success-fg)' }}>
            {formatTemperature(reading.filtered_temperature)}
          </p>
        </div>

        <div
          className="rounded-xl border border-warning-bg p-3"
          style={{ backgroundColor: 'var(--color-warning-bg)' }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-warning-fg)', opacity: 0.8 }}>
            <Waves className="size-3.5" />
            Cruda
          </div>
          <p className="kpi-value mt-1.5 text-xl" style={{ color: 'var(--color-warning-fg)' }}>
            {formatTemperature(reading.raw_temperature)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground border-t border-border/40 pt-4">
        <div className="flex items-center gap-4">
          <p className="flex items-center gap-1.5 font-medium">
            <Activity className="size-4 text-primary" />
            {formatBooleanStatus(reading.motion_detected)}
          </p>
          <p className="flex items-center gap-1.5 font-medium">
            <MapPin className="size-4 text-primary" />
            {reading.room_location ?? 'Sin ubicación'}
          </p>
        </div>

        {hasAlert ? (
          <span
            className="flex items-center rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm"
            style={{
              backgroundColor: 'var(--color-danger-fg)',
              color: 'white',
            }}
          >
            Alerta Térmica
          </span>
        ) : null}
      </div>
    </article>
  );
}
