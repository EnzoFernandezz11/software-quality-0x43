# Medición del canary: 18/11/2026

Corrida en `terrasense-tp23`, namespace `terrasense`, con GO de #25 para la candidata `acdca28`. Los scripts se ejecutaron desde el árbol `aa0921590ecdd98ff856b3d0751332ece51f20ec`; `tp-final/k6/` no cambió entre ese commit y el HEAD posterior. k6 v2.3.0 y Google Chrome 157.0.8103.38. La prueba mide GET del documento `/dashboard`; no demuestra capacidad de la API compartida.

Ambos frontends tenían 2 réplicas listas, requests de 50m CPU y 128 MiB y limits de 500m CPU y 256 MiB. El backend volvió a 2/2, HPA 2 % / 60 %, antes de abrir el peso 10 tras la prueba HPA. Los IDs reales de imágenes, ReplicaSets, pods, HPA y consumo final están en [después del estrés](despues-estres.txt); hay cinco observaciones de recursos durante el estrés. Los IDs son locales. En etapa 0 el smoke recibió 10/10 respuestas de la estable; normal y `never` devolvieron 1.0.0, `always` devolvió 1.1.0. Una [navegación con cookie canary](etapa0-browser.txt) comprobó datos, JS y CSS y guardó la [captura](../../capturas/canary-23/etapa0-canary.png).

| Peso | Total | Estable | Candidata | Canary reconocido | Errores | Descartes | p95 estable / canary |
|---|---:|---:|---:|---:|---:|---:|---:|
| 10 % | 1801 | 1616 | 185 | 10,27 % | 0 | 0 | 5,16 / 5,71 ms |
| 50 % | 1801 | 904 | 897 | 49,81 % | 0 | 0 | 4,52 / 4,79 ms |

Ambas muestras cumplen los criterios del plan. Al 50 % el p95 canary es aproximadamente 6,1 % mayor que el estable, dentro del máximo de 10 %. Las 20 visitas de Chromium tuvieron 20 checks correctos y 0/360 solicitudes HTTP fallidas; se guardaron [estable](../../capturas/canary-23/dashboard-1.0.0.png) y [candidata](../../capturas/canary-23/dashboard-1.1.0.png). Las capturas muestran datos y versiones diferenciadas.

| Estrés, objetivo req/s | Completadas | Req/s efectivos | Estable / canary | Canary reconocido | p95 estable / canary | Resultado A/B |
|---|---:|---:|---:|---:|---:|---|
| 10 | 1201 | 10,008 | 579 / 622 | 51,79 % | 4,84 / 4,94 ms | Cumple |
| 20 | 2400 | 20,000 | 1195 / 1205 | 50,21 % | 4,52 / 4,48 ms | Cumple |
| 40 | 4801 | 40,008 | 2402 / 2399 | 49,97 % | 4,14 / 4,44 ms | Cumple |
| 80 | 9601 | 80,008 | 4836 / 4765 | 49,63 % | 3,57 / 3,74 ms | Cumple |

En cada nivel hubo 0 errores, respuestas desconocidas y descartes; las muestras y el reparto satisfacen la comparabilidad del protocolo. Una solicitud adicional en tres niveles está dentro del margen temporal de una iteración. No se observó regresión superior al 10 % hasta la carga medida; no se afirma que 80 req/s sea el límite de la plataforma.

## Reproducción y archivos

El Ingress se resolvió mediante un archivo de configuración k6 con los dos hosts hacia la IP del perfil; Chromium usó un wrapper de Chrome con reglas de resolución equivalentes, sin editar `/etc/hosts`. Los cambios de peso se aplicaron con `rollout.sh peso 10` y `peso 50` desde una copia temporal, preservando los YAML del workspace. Comandos de los escenarios, desde la raíz y con `CONFIG` y rutas de salida definidas para el entorno:

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_HOST=127.0.0.1 K6_WEB_DASHBOARD_PORT=5665 K6_WEB_DASHBOARD_EXPORT="$HTML" \
  k6 run --config "$CONFIG" -e WEIGHT="$PESO" -e RATE=10 -e DURATION_SECONDS=180 -e REPORT_JSON="$JSON" tp-final/k6/reparto.js
K6_BROWSER_HEADLESS=false K6_BROWSER_EXECUTABLE_PATH="$CHROME_WRAPPER" \
  k6 run --config "$CONFIG" -e CAPTURE_DIR="$CAPTURAS" -e VISITS=20 tp-final/k6/navegacion.js
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_HOST=127.0.0.1 K6_WEB_DASHBOARD_PORT=5665 K6_WEB_DASHBOARD_EXPORT="$HTML" \
  k6 run --config "$CONFIG" -e REPORT_JSON="$JSON" tp-final/k6/estres.js
```

Repartos: [10 % JSON](reparto-10.json), [HTML](reparto-10.html); [50 % JSON](reparto-50.json), [HTML](reparto-50.html). Estrés: [JSON](estres.json), [HTML](estres.html). [Salida de navegación](navegacion-50.txt). Los tres HTML se abrieron y muestran las gráficas; algunos rótulos de ejes se recortan visualmente en la exportación de k6. Los JSON son la fuente de cifras por versión y nivel.

Al terminar la medición se observó peso canary **50 %**. No se realizó promoción ni rollback en este perfil; la promoción se aplicó después en el perfil `terrasense` ([bitácora, etapa 3](../../../rollout/bitacora.md#etapa-3--promoción)).
