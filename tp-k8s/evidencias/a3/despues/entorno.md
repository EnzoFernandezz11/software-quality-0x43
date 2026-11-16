# Actividad 3: medición después de optimizar

Fecha: 5 de noviembre de 2026. Código medido: commit `912149d` de
`feat/13-baselines-k6`. Incluye el índice de `sensor_readings.created_at` y
la consulta acotada de `find_recent_with_motion`. La migración Alembic
`b7c9e2f4a601` y el índice se verificaron en PostgreSQL antes de medir.
Los scripts de `tp-k8s/k6/` son idénticos a los usados antes (`git diff
430401a HEAD -- tp-k8s/k6` sin diferencias).

## Entorno y preparación

- Mismo equipo y perfil aislado `terrasense-a3` descritos en
  [antes/entorno.md](../antes/entorno.md): Intel Core i5-10210U, 14 GiB RAM,
  Ubuntu 26.04.1, Docker 29.1.3, Minikube 1.39.0 y Kubernetes 1.37.0.
- Namespace `terrasense`; 4 CPU y 6144 MiB para Minikube. Backend con 2
  réplicas fijas, `requests` de 100m CPU / 192Mi y `limits` de 500m CPU /
  384Mi por pod. `kubectl get hpa` no encontró recursos.
- Despliegue mediante `MINIKUBE_PROFILE=terrasense-a3 SKIP_HOSTS=1 bash
  tp-k8s/deploy.sh`, sin cambiar manifiestos. k6 desde el host contra
  `http://api.terrasense.local` vía Ingress, con el hostname asignado a
  `192.168.49.2` en la configuración local de k6.
- Antes de **cada** perfil: `TRUNCATE sensor_readings RESTART IDENTITY` y
  ejecución de `tp-k8s/k6/seed-readings.sql` con `rows=50000`. La tabla
  comenzó con 50.000 lecturas de 2.000 sensores, distribuidas en unos
  12,5 min. Los archivos `*-seed.txt` muestran el conteo inicial.
- Antes de `stress` se recrearon los dos pods del backend, porque la corrida
  `load` los dejó reiniciando. Se esperó a que ambos estuvieran listos y se
  verificó `/health/ready` por el Ingress. No se cambiaron imágenes,
  recursos ni scripts entre perfiles.

## Resultados

| Perfil | Hora UTC | POST completados | RPS observado | p95 | p99 | Error HTTP | Descartadas | Salida k6 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Smoke | 17:58:03–17:58:35 | 60 | 1,95 | 33 ms | 77 ms | 0 % | 0 | 0 |
| Load | 19:13:42–19:18:43 | 18.582 | 61,94 | 17.507 ms | 23.098 ms | 59,04 % | 1.519 | 99 |
| Stress | 19:19:43–19:25:58 | 48.039 | 128,27 | 19.790 ms | 29.972 ms | 75,91 % | 32.684 | 99 |

El código 99 indica umbrales incumplidos. Los valores sin redondear están en
`*-summary.json`; `*-meta.json` tiene el identificador de corrida, horarios,
salida y volumen inicial. `*-k8s.txt` muestrea pods y recursos cada 15 s. Las
series `*-rps-series.json` y `*-p95-series.json` son exportaciones directas de
Prometheus. En Grafana, el p95 y el porcentaje de fallas están separados por
estado HTTP; una curva de fallas al 100 % no equivale al porcentaje total.
El SLO usa los valores agregados del resumen k6. No había HPA: se mantuvieron dos réplicas
configuradas y hubo lapsos con cero listas durante `load` y `stress`.

Los eventos de Kubernetes registraron fallas de `liveness` por timeout y
reinicios de ambos backs durante las corridas optimizadas. `lastState` fue
`Completed`, no `OOMKilled`. El muestreo muestra CPU del backend cerca del
límite de 500m. Prometheus registró respuestas 201, 502 y 503. En `stress`,
la primera muestra de p95 de 201 (≈ 3,89 s) aparece a los 15 s y la primera
muestra de 503 a los 45 s, todavía en el tramo de 67 req/s.

## Repetición de `load`

La primera corrida optimizada (`load-intento1-*`, 17:58:55–18:04:00 UTC)
completó 19.442 POST a 63,86 RPS, con p95 10.775 ms, p99 18.788 ms,
22,61 % de errores, 659 iteraciones descartadas y salida 99. Minikube quedó
detenido después por una causa no determinada; las series de Prometheus de
esa corrida se perdieron al reiniciarlo. Los JSON de la primera exportación
quedaron vacíos y se descartaron. Se conservan resumen, metadatos, consola y
muestreo de pods. Se repitió `load` con los mismos 50.000 registros iniciales,
scripts y límites para dejar las series visualizables de la tabla. Ambas
corridas incumplieron el SLO; la diferencia entre ellas muestra variación
considerable bajo saturación.
