# Ensayo HPA del backend

18 de noviembre de 2026, perfil aislado `terrasense-tp23`, namespace `terrasense`. Perfil nominal: solicitudes de CPU 100m, límite 500m; HPA de 2 a 6 réplicas con objetivo de 60 %. Se ejecutó `tp-k8s/k6/e2-spike.js` con objetivo de 100 iteraciones/s, rampa de 5 s y meseta de 3 min.

[El video](../../videos/hpa-escala.mp4) fue generado a partir de las muestras de Kubernetes y los eventos `http_reqs` del CSV de k6. El reloj está en UTC y la reproducción está acelerada 5×. Las barras muestran solicitudes HTTP completadas por segundo, no tasa objetivo ni únicamente respuestas exitosas. No es una grabación de pantalla.

Al comenzar había 2 réplicas. Hubo períodos con cero pods listos y sin métrica de CPU. A las 17:32:03 UTC se observaron 2 réplicas actuales, 6 deseadas y 1 pod listo. Al reanudarse la observación a las 17:32:42 UTC se observaron 6 actuales, 6 deseadas y 6 listos. El instante exacto de escalado no se observó: hay un corte de 39 segundos en el registro debido a una edición accidental del script durante su ejecución. El video señala el corte y no une las muestras a través de él.

k6 completó 17.697 solicitudes (85,405/s en el resumen), de las cuales 8.488 fallaron (47,96 %: 1.160 respuestas 502 y 7.328 respuestas 503). Se descartaron 802 iteraciones y el p95 fue 21,15 s. El objetivo de carga no se mantuvo íntegramente; la subida observada no demuestra cumplimiento de los SLO.

`configuracion.txt` y `k6.txt` conservan las salidas originales; `muestras-hpa.jsonl` contiene las muestras hasta el final del intervalo incluido en el video. Los datos brutos completos y el monitoreo posterior se conservaron temporalmente fuera del repositorio.
