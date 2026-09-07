'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatChartTime } from '@/lib/utils';
import type { SensorComparisonChartProps } from '@/types/sensor.types';

const COLORS = ['var(--color-chart-filtered)', 'var(--color-chart-motion)', 'var(--color-chart-raw)', 'var(--color-chart-alert)'];

export function SensorComparisonChart({ data }: SensorComparisonChartProps) {
  const orderedData = data.slice().reverse();
  const sensorIds = Array.from(new Set(orderedData.map((reading) => reading.sensor_id)));
  const timestamps = Array.from(new Set(orderedData.map((reading) => reading.created_at)));

  const chartData = timestamps.map((timestamp) => {
    const point: Record<string, string | number> = {
      time: formatChartTime(timestamp),
    };

    for (const sensorId of sensorIds) {
      const reading = orderedData.find(
        (item) => item.created_at === timestamp && item.sensor_id === sensorId,
      );

      if (reading) {
        point[sensorId] = Number(reading.filtered_temperature.toFixed(1));
      }
    }

    return point;
  });

  return (
    <section className="rounded-xl border border-border/40 bg-card p-6 shadow-sm">
      <div className="mb-1">
        <p className="section-label">Comparación multi-sensor</p>
      </div>
      <h2 className="card-title mb-4">Comparación de sensores</h2>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={290}>
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
              formatter={(value, name) => [`${value} °C`, String(name)]}
              labelFormatter={(label) => `Hora ${label}`}
            />
            <Legend />
            {sensorIds.map((sensorId, index) => (
              <Line
                key={sensorId}
                type="monotone"
                dataKey={sensorId}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[290px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Sin datos para comparar sensores.
        </div>
      )}
    </section>
  );
}
