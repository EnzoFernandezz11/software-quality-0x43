-- Carga lecturas sintéticas de 2000 sensores para las pruebas de carga.
-- Cantidad por defecto: 50000 (~12,5 min a 67 lecturas/s); se cambia con psql -v rows=N.
-- Los sensor_id empiezan con "seed-" para poder borrarlas sin tocar datos reales:
--   DELETE FROM sensor_readings WHERE sensor_id LIKE 'seed-%';

\if :{?rows}
\else
\set rows 50000
\endif

INSERT INTO sensor_readings (
    sensor_id,
    created_at,
    raw_temperature,
    filtered_temperature,
    motion_detected,
    thermal_alert_status,
    room_location
)
SELECT
    'seed-esp32-' || lpad((((n - 1) % 2000) + 1)::text, 4, '0'),
    now() - make_interval(secs => ((:rows - n)::double precision * 30.0 / 2000.0)),
    round((22 + 4 * sin(n / 120.0) + (n % 7) / 10.0)::numeric, 2),
    round((22 + 4 * sin(n / 120.0) + 1)::numeric, 2),
    n % 10 < 3,
    n % 20 = 0,
    (ARRAY['Oficina', 'Laboratorio', 'Sala de servidores', 'Depósito', 'Recepción'])[n % 5 + 1]
FROM generate_series(1, :rows) AS n;

SELECT count(*) AS total_lecturas FROM sensor_readings;
