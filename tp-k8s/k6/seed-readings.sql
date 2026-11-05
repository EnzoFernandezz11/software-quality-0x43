-- Carga lecturas sintéticas en sensor_readings para las pruebas de carga.
-- Cantidad por defecto: 50000; se cambia con psql -v rows=N.
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
    'seed-esp32-' || (n % 5 + 1),
    now() - make_interval(secs => n * 30),
    round((22 + 4 * sin(n / 120.0) + random() * 2)::numeric, 2),
    round((22 + 4 * sin(n / 120.0) + 1)::numeric, 2),
    random() < 0.3,
    random() < 0.05,
    (ARRAY['Oficina', 'Laboratorio', 'Sala de servidores', 'Depósito', 'Recepción'])[n % 5 + 1]
FROM generate_series(1, :rows) AS n;

SELECT count(*) AS total_lecturas FROM sensor_readings;
