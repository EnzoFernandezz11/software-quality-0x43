'use client';

import { useEffect, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getHistory } from '@/services/sensors.service';
import { formatBooleanStatus, formatDateTime, formatTemperature } from '@/lib/utils';
import type { SensorReading } from '@/types/sensor.types';

export default function HistoryPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getHistory({ startDate, endDate, limit });
      setRows(result);
    } catch {
      setError('No se pudo obtener el historial.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
    // The first load should run once with the initial filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-medium text-primary">Consulta historica</p>
        <h1 className="text-3xl font-semibold">Historial de sensores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lecturas persistidas en PostgreSQL y servidas por el backend.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_140px_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium">
            Desde
            <input
              type="datetime-local"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Hasta
            <input
              type="datetime-local"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Limite
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <div className="flex gap-2">
            <Button type="button" onClick={() => void loadHistory()} disabled={isLoading}>
              <Search className="size-4" />
              Buscar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setLimit(20);
                void getHistory({ limit: 20 }).then(setRows);
              }}
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/70 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Sensor</th>
                <th className="px-4 py-3 font-medium">Ubicacion</th>
                <th className="px-4 py-3 font-medium">Cruda</th>
                <th className="px-4 py-3 font-medium">Filtrada</th>
                <th className="px-4 py-3 font-medium">Movimiento</th>
                <th className="px-4 py-3 font-medium">Alerta</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                  <td className="px-4 py-3 font-medium">{row.sensor_id}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.room_location ?? 'Sin ubicacion'}
                  </td>
                  <td className="px-4 py-3 text-amber-700">
                    {formatTemperature(row.raw_temperature)}
                  </td>
                  <td className="px-4 py-3 text-emerald-700">
                    {formatTemperature(row.filtered_temperature)}
                  </td>
                  <td className="px-4 py-3">{formatBooleanStatus(row.motion_detected)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.thermal_alert_status
                          ? 'rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700'
                          : 'rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                      }
                    >
                      {row.thermal_alert_status ? 'Activa' : 'Normal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLoading ? (
          <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            Cargando historial...
          </div>
        ) : null}

        {!isLoading && rows.length === 0 ? (
          <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            No hay lecturas para los filtros seleccionados.
          </div>
        ) : null}
      </section>
    </div>
  );
}
