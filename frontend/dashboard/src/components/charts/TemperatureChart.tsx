'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatChartTime } from '@/lib/utils';
import type { TemperatureChartProps } from '@/types/sensor.types';

export function TemperatureChart({ data }: TemperatureChartProps) {
  const chartData = data
    .slice()
    .reverse()
    .map((reading) => ({
      time: formatChartTime(reading.created_at),
      raw: Number(reading.raw_temperature.toFixed(1)),
      filtered: Number(reading.filtered_temperature.toFixed(1)),
      sensor: reading.sensor_id,
    }));

  return (
    <section className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
      <div className="mb-1">
        <p className="section-label">Salida del algoritmo</p>
      </div>
      <h2 className="card-title mb-4">Temperatura cruda vs filtrada</h2>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} width={38} unit="°C" />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                borderColor: 'var(--border)',
                background: 'var(--card)',
                color: 'var(--card-foreground)',
              }}
              formatter={(value, name) => [`${value} °C`, name === 'raw' ? 'Cruda' : 'Filtrada']}
              labelFormatter={(label) => `Hora ${label}`}
            />
            <Line
              type="monotone"
              dataKey="raw"
              stroke="var(--color-chart-raw)"
              strokeWidth={2}
              dot={false}
              name="Cruda"
            />
            <Line
              type="monotone"
              dataKey="filtered"
              stroke="var(--color-chart-filtered)"
              strokeWidth={2}
              dot={false}
              name="Filtrada"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Sin datos de temperatura.
        </div>
      )}
    </section>
  );
}
