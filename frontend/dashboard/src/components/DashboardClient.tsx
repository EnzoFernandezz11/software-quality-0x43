'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, Clock3, Settings2, Thermometer } from 'lucide-react';

import { TemperatureChart } from '@/components/charts/TemperatureChart';
import { MotionTimelineChart } from '@/components/charts/MotionTimelineChart';
import { SensorComparisonChart } from '@/components/charts/SensorComparisonChart';
import { AccessNotifications } from '@/components/widgets/AccessNotifications';
import { ActivityFeed } from '@/components/widgets/ActivityFeed';
import { AlertBadge } from '@/components/widgets/AlertBadge';
import { LatestReadingCard } from '@/components/widgets/LatestReadingCard';
import { getRoomConfig, getSecurityAudits } from '@/services/sensors.service';
import { formatDateTime, formatMode, formatTemperature } from '@/lib/utils';
import { useAccessMonitoring } from '@/hooks/useAccessMonitoring';
import { useSensorPolling } from '@/hooks/useSensorPolling';
import type { AccessAudit, RoomConfig } from '@/types/sensor.types';

/* ── KPI card — compact, equal-width, premium typography ── */
type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

function MetricCard({ label, value, detail, icon: Icon }: MetricCardProps) {
  return (
    <article className="group rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-border">
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">{label}</p>
        <span className="rounded-lg bg-primary/8 p-1.5 text-primary transition-colors group-hover:bg-primary/12">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="kpi-value mt-2">{value}</p>
      <p className="kpi-detail mt-1">{detail}</p>
    </article>
  );
}

export function DashboardClient() {
  const { data, latestReadings, alerts, isLoading, error, lastUpdatedAt } =
    useSensorPolling(3000);
  const [audits, setAudits] = useState<AccessAudit[]>([]);
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);

  /* ── Access monitoring: detect new PIN attempts & mode changes ── */
  const { events, latestAudits, latestConfig, dismissEvent } =
    useAccessMonitoring(3000);

  useEffect(() => {
    let mounted = true;

    async function loadSupportData() {
      const [auditRows, config] = await Promise.all([getSecurityAudits(), getRoomConfig()]);

      if (mounted) {
        setAudits(auditRows);
        setRoomConfig(config);
      }
    }

    if (latestAudits.length === 0 || !latestConfig) {
      void loadSupportData();
    }

    return () => {
      mounted = false;
    };
  }, [latestAudits.length, latestConfig]);

  /* ── MOCK removed: User can now use the KeypadSimulator widget ── */

  // Derive display values: prefer real-time hook data over initial load data
  const displayAudits = latestAudits.length > 0 ? latestAudits : audits;
  const displayConfig = latestConfig ?? roomConfig;

  const latest = latestReadings[0] ?? data[0] ?? null;
  const averageFiltered =
    latestReadings.length > 0
      ? latestReadings.reduce((sum, reading) => sum + reading.filtered_temperature, 0) /
        latestReadings.length
      : null;

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
        {/* ── Header — original branded title ── */}
        <header className="flex items-center gap-3 pb-1">
          <div className="dashboard-icon-ring">
            <Thermometer className="size-5" />
          </div>
          <div>
            <h1 className="dashboard-title">
              Smart<span className="dashboard-title-accent">Office</span>
            </h1>
            <p className="section-label" style={{ fontSize: '0.6rem', marginTop: '2px' }}>
              Panel de control IoT
            </p>
          </div>
        </header>

        {/* ── Error banner ── */}
        {error ? (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger-fg)',
              border: '1px solid var(--color-danger-fg)',
            }}
          >
            {error.message}
          </div>
        ) : null}

        {/* ── Row 1: 4 KPI cards ── */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Promedio filtrado"
            value={formatTemperature(averageFiltered)}
            detail="Último ciclo recibido"
            icon={Thermometer}
          />
          <MetricCard
            label="Movimiento"
            value={latest?.motion_detected ? 'Activo' : 'Inactivo'}
            detail={latest?.sensor_id ?? 'Sin sensor'}
            icon={Activity}
          />
          <MetricCard
            label="Modo de sala"
            value={formatMode(displayConfig?.current_mode)}
            detail={`Objetivo ${formatTemperature(displayConfig?.target_temperature)}`}
            icon={Settings2}
          />
          <MetricCard
            label="Última actualización"
            value={lastUpdatedAt ? formatDateTime(lastUpdatedAt) : 'Esperando…'}
            detail="Polling cada 3 s"
            icon={Clock3}
          />
        </section>

        {/* ── Loading state ── */}
        {isLoading ? (
          <section className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            Cargando datos del backend…
          </section>
        ) : null}

        {/* ── Row 2: Latest reading + Alert badge ── */}
        {latest ? (
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <LatestReadingCard reading={latest} />
            <AlertBadge alert={alerts[0] ?? null} />
          </section>
        ) : null}

        {/* ── Row 3: Temperature chart + Motion heatmap (equal 50/50) ── */}
        <section className="grid gap-4 xl:grid-cols-2">
          <TemperatureChart data={data} />
          <MotionTimelineChart data={data} />
        </section>

        {/* ── Row 4: Sensor comparison (60%) + Bitácora (40%) ── */}
        <section className="grid gap-4 xl:grid-cols-[3fr_2fr]">
          <SensorComparisonChart data={data} />
          <ActivityFeed audits={displayAudits} />
        </section>

      </div>

      {/* ── Access notifications (fixed-position toasts + modal) ── */}
      <AccessNotifications events={events} onDismiss={dismissEvent} />
    </>
  );
}
