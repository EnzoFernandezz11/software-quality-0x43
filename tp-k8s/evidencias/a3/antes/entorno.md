# Actividad 3: medición antes de optimizar

Fecha: 5 de noviembre de 2026. Código medido: commit `430401a` de
`feat/13-baselines-k6`, antes de agregar el índice o modificar
`find_recent_with_motion`.

## Entorno fijo

- Equipo: Intel Core i5-10210U, 4 núcleos / 8 hilos, 14 GiB de RAM; Ubuntu 26.04.1.
- Docker 29.1.3; Minikube 1.39.0 con Kubernetes 1.37.0 y driver Docker.
- Perfil aislado `terrasense-a3`: 4 CPU y 6144 MiB de RAM; namespace `terrasense`.
- Backend: 2 réplicas fijas, `requests` de 100m CPU / 192Mi RAM y `limits` de
  500m CPU / 384Mi RAM por pod. No había HPA (`kubectl get hpa` sin recursos).
- Se aplicó `tp-k8s/deploy.sh` sin cambios, con `SKIP_HOSTS=1`. k6 se ejecutó
  desde el host contra el Ingress `http://api.terrasense.local`, mapeando el
  nombre a la IP local de Minikube (192.168.49.2) en la configuración de k6.
- Antes de cada perfil se vació **solo la tabla del perfil aislado** y se volvió
  a ejecutar `seed-readings.sql` con `rows=50000`: 50.000 filas de 2.000
  sensores distribuidas en unos 12,5 minutos. Entre `load` y `stress` se
  recrearon los pods del backend porque ambos habían quedado en
  `CrashLoopBackOff`. No se cambiaron imágenes, recursos ni scripts.

## Resultados de k6

| Perfil | Duración prevista | POST emitidos | RPS observado | p95 | p99 | Error HTTP | Iteraciones descartadas | Salida |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Smoke | 30 s | 23 | 0,72 | 1991 ms | 2072 ms | 0 % | 0 | 99 |
| Load | 5 min, 67 req/s | 19.198 | 63,99 | 6611 ms | 10.470 ms | 100 % | 903 | 99 |
| Stress | 6 min, 67 → 450 req/s | 77.405 | 215,01 | 1606 ms | 5920 ms | 100 % | 3320 | 99 |

SLO de la issue: menos de 1 % de errores y p95 menor a 300 ms. El código de
salida 99 indica que k6 marcó umbrales incumplidos. En `load` y `stress`, las
dos réplicas del backend registraron `OOMKilled` y lapsos sin ninguna réplica
lista; la base terminó con las mismas 50.000 filas precargadas. Prometheus
registró respuestas 502 y 503 durante esas dos pruebas.

Los valores exactos están en `*-summary.json`; `*-meta.json` contiene los
horarios y el código de salida. `*-k8s.txt` registra el estado de los pods
cada 15 s. Los archivos `*-rps-series.json` y `*-p95-series.json` conservan
las series exportadas de Prometheus. Las capturas `*-rps-errores.png` y
`*-p95.png` muestran las curvas de Grafana. El p95 de cada curva de Grafana
está separado por estado HTTP; el p95 agregado usado para el SLO es el del
resumen de k6 de la tabla.
