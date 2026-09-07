'use client';

import { formatChartTime } from '@/lib/utils';
import type { MotionTimelineChartProps } from '@/types/sensor.types';

/**
 * 2D Heatmap for motion detection and thermal alerts.
 * Rows: Motion / Thermal Alert
 * Columns: time slots from sensor readings
 * Colors: green (inactive) → red (active)
 */
export function MotionTimelineChart({ data }: MotionTimelineChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .map((reading) => ({
      time: formatChartTime(reading.created_at),
      motion: reading.motion_detected ? 1 : 0,
      alert: reading.thermal_alert_status ? 1 : 0,
    }));

  // Limit columns for readability
  const slots = chartData.slice(-24);

  const rows = [
    { key: 'motion' as const, label: 'Movimiento' },
    { key: 'alert' as const, label: 'Alerta térmica' },
  ];

  return (
    <section className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
      <div className="mb-1">
        <p className="section-label">Mapa de calor</p>
      </div>
      <h2 className="card-title mb-5">Movimiento y alerta térmica</h2>

      {slots.length > 0 ? (
        <div className="space-y-4">
          {/* Heatmap grid */}
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
                  {row.label}
                </span>
                <div className="flex flex-1 gap-[2px]">
                  {slots.map((slot, i) => {
                    const active = slot[row.key] === 1;
                    return (
                      <div
                        key={i}
                        className="group relative flex-1 rounded-sm transition-all hover:scale-y-125"
                        style={{
                          height: '2rem',
                          minWidth: '6px',
                          backgroundColor: active
                            ? row.key === 'alert'
                              ? 'var(--color-danger-fg)'
                              : 'var(--color-chart-motion)'
                            : 'var(--muted)',
                          opacity: active ? 1 : 0.5,
                        }}
                      >
                        {/* Tooltip on hover */}
                        <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:opacity-100 whitespace-nowrap">
                          {slot.time} — {active ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Time axis labels */}
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0" />
            <div className="flex flex-1 justify-between text-[10px] text-muted-foreground">
              {slots.length > 0 && <span>{slots[0].time}</span>}
              {slots.length > 6 && <span>{slots[Math.floor(slots.length / 2)].time}</span>}
              {slots.length > 1 && <span>{slots[slots.length - 1].time}</span>}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-sm" style={{ backgroundColor: 'var(--muted)', opacity: 0.5 }} />
              Inactivo
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-chart-motion)' }} />
              Movimiento
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-sm" style={{ backgroundColor: 'var(--color-danger-fg)' }} />
              Alerta
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-[180px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Sin datos de movimiento.
        </div>
      )}
    </section>
  );
}
