# Medición del canary del frontend

Los scripts de la [issue #23](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/23) corren desde la raíz del repositorio con k6. Para la navegación también hace falta Chrome o Chromium. Las pruebas reales usan el Ingress de la #22, las dos imágenes de la #21 y la gate aprobada de la #25. Confirmar con Valentino los pesos, las duraciones y los criterios del rollout antes de las corridas.

## Smoke y reparto

El destino predeterminado es `http://terrasense.local/dashboard`. Usar `URL` para apuntar a un entorno de prueba local. Cada iteración HTTP pide el documento una vez, sin seguir redirecciones y sin conservar cookies entre iteraciones. Se exige HTTP 200 y el smoke además comprueba que `X-App-Version` corresponda a una de las dos versiones.

```bash
reportes="tp-final/evidencias/reportes/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$reportes"
k6 run -e REPORT_JSON="$reportes/smoke.json" tp-final/k6/smoke.js
```

Repetir el reparto en al menos dos pesos diferentes ya aplicados en el Ingress. `WEIGHT` registra el peso esperado en el JSON. Usar la tasa y duración acordadas. Este comando es un ejemplo para un peso de 10 %.

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="$reportes/reparto-10.html" \
  k6 run -e WEIGHT=10 -e RATE=10 -e DURATION_SECONDS=180 \
  -e REPORT_JSON="$reportes/reparto-10.json" tp-final/k6/reparto.js
```

Abrir el enlace local que imprime k6 para ver las curvas. Los HTML se guardan al cerrar la corrida. Si k6 queda esperando al final, cerrar la pestaña del dashboard. Para exportar en modo desatendido, usar `K6_WEB_DASHBOARD_PORT=-1`.

El JSON informa las visitas, errores, p95 y tasa efectiva globales y por versión. La tasa efectiva divide las solicitudes completadas entre los segundos programados. El reparto de la candidata usa como denominador la suma de respuestas de `1.0.0` y `1.1.0`. Las respuestas con otro valor, sin header o sin respuesta HTTP quedan como `desconocida` y sus errores cuentan en el total global. Las métricas sin muestras se presentan como `null` para latencia y porcentaje de error.

## Panel en Chromium

Ejecutar en una corrida aparte. Elegir un peso que permita observar ambos paneles y guardar capturas en un directorio nuevo por lote. `VISITS` permite ajustar el lote entre 1 y 20 visitas. Usar `K6_BROWSER_HEADLESS=false` para abrir Chromium visiblemente si hay sesión gráfica.

```bash
capturas="tp-final/evidencias/capturas/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$capturas"
K6_BROWSER_HEADLESS=false k6 run -e CAPTURE_DIR="$capturas" -e VISITS=20 \
  tp-final/k6/navegacion.js
```

Cada visita abre un contexto independiente. El script guarda la primera captura válida de cada versión tras verificar HTTP 200, el header del documento, un encabezado visible, la primera actualización de datos de la API y las respuestas de JS y CSS. El selector predeterminado es `h1.dashboard-title`. Registrar fallos de recursos, distinguiendo estado HTTP, MIME incorrecto y fallos de red. Si una versión falta o alguna visita falla, k6 lo señala al terminar.

## Estrés A/B

Dejar el [protocolo](protocolo-estres.md) versionado antes de medir. Confirmar peso canary de 50 % en el Ingress, réplicas y recursos equivalentes y pods listos. Ejecutar con el mismo destino para las dos versiones.

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="$reportes/estres.html" \
  k6 run -e REPORT_JSON="$reportes/estres.json" tp-final/k6/estres.js
```

Los niveles programan 10, 20, 40 y 80 solicitudes/s durante dos minutos cada uno. Las solicitudes pendientes pueden terminar al comenzar el siguiente nivel y quedan atribuidas al nivel que las inició. El JSON registra el objetivo, la tasa efectiva, las iteraciones descartadas y la evaluación A/B en cada nivel. El código de salida de k6 refleja los thresholds absolutos. Leer también `hipotesisAB` en el JSON para evaluar el p95 relativo, el reparto y la muestra mínima. Guardar junto a los reportes el comando, fecha, peso, imágenes y revisiones, recursos, réplicas y observaciones del generador y el clúster.

## Video del HPA

En una corrida aparte, con la API y el HPA del backend activos, usar la carga sostenida documentada en el [TP4](../../tp-k8s/README.md). Mostrar el avance de la carga y el cambio de réplicas en terminales separadas.

```bash
minikube -p terrasense kubectl -- -n terrasense get hpa -w
```

```bash
SPIKE_RPS=100 HOLD_DURATION=3m k6 run tp-k8s/k6/e2-spike.js
```

Guardar el video de hasta tres minutos en `tp-final/evidencias/videos/` o enlazarlo en el README del TP. Registrar la carga y el cambio de réplicas observado, y agregar una leyenda.
