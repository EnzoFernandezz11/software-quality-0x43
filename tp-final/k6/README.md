# Medición del canary del frontend

Los scripts de la [issue #23](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/23) corren desde la raíz del repositorio con k6. Para la navegación también hace falta Chrome o Chromium. Las pruebas reales usan el Ingress de la #22, las dos imágenes de la #21 y la gate aprobada de la #25.

## Alcance y trazabilidad de la evidencia

La [issue #23](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/23) aporta mediciones y capturas para las actividades 3.1 y 3.2 de la consigna: contrastar el peso configurado con el reparto observado y evaluar una hipótesis de rendimiento antes de decidir sobre la candidata. La actividad 3.4 requiere presentar evidencia interpretada, videos de hasta tres minutos y el veredicto final del equipo; este directorio aporta insumos para esa presentación. La promoción o rollback corresponde a la #22; el README general y la presentación se coordinan con la #24.

La candidata `1.1.0` se construyó desde `acdca2896a16239c60d0fea21b6816a66b16857a`; la estable `1.0.0`, desde `89517031be1ead063cc66712e09061daa3e57d25`. El perfil aislado utilizado fue `terrasense-tp23`, namespace `terrasense`. Nacho dio el [GO de la gate #25](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/25#issuecomment-6986489015) para medir esa candidata en ese perfil. La configuración y comprobaciones previas están en [canary-previo](../evidencias/reportes/canary-previo/README.md). El GO permite medir; no constituye una decisión de promoción.

### Experimentos y evidencia

| Experimento | Resultado observado | Evidencia |
| --- | --- | --- |
| Smoke HTTP, peso 0 % | 10 respuestas 200 de la estable sin errores; `X-Canary: always` respondió con la candidata. | [Puesta a punto](../evidencias/reportes/canary-previo/README.md) |
| Reparto, peso 10 % | 1.801 respuestas; 185 canary (10,27 %), p95 canary 5,71 ms, sin errores ni descartes. | [JSON](../evidencias/reportes/canary-23/reparto-10.json) · [dashboard](../evidencias/reportes/canary-23/reparto-10.html) |
| Reparto, peso 50 % | 1.801 respuestas; 897 canary (49,81 %), p95 canary 4,79 ms y estable 4,52 ms, sin errores ni descartes. | [JSON](../evidencias/reportes/canary-23/reparto-50.json) · [dashboard](../evidencias/reportes/canary-23/reparto-50.html) |
| Chromium, peso 50 % | 20/20 checks, sin fallas HTTP en 360 respuestas; capturas de ambas versiones. | [Estable](../evidencias/capturas/canary-23/dashboard-1.0.0.png) · [canary](../evidencias/capturas/canary-23/dashboard-1.1.0.png) · [registro](../evidencias/reportes/canary-23/navegacion-50.txt) |
| HPA del backend | 2 → 6 réplicas bajo carga; 17.760 solicitudes, 93,47/s, 1.540 fallas (8,67 %), 739 descartes y p95 14,47 s. | [Video](../evidencias/videos/hpa-escala.mp4) · [leyenda y límites](../evidencias/reportes/hpa/leyenda.md) · [resumen k6](../evidencias/reportes/hpa/k6.txt) |

El estrés A/B se realizó al 50 %, durante dos minutos por nivel ([JSON](../evidencias/reportes/canary-23/estres.json) · [dashboard](../evidencias/reportes/canary-23/estres.html)). Cada etapa fue comparable según el [protocolo](protocolo-estres.md) y cumplió la hipótesis; no hubo errores, respuestas de versión desconocida ni iteraciones descartadas.

| Objetivo (solicitudes/s) | Completadas estable / canary | Tasa total efectiva (solicitudes/s) | p95 estable / canary (ms) |
| ---: | ---: | ---: | ---: |
| 10 | 579 / 622 | 10,008 | 4,84 / 4,94 |
| 20 | 1.195 / 1.205 | 20,000 | 4,52 / 4,48 |
| 40 | 2.402 / 2.399 | 40,008 | 4,14 / 4,44 |
| 80 | 4.836 / 4.765 | 80,008 | 3,57 / 3,74 |

Los datos son favorables para que el responsable del rollout (#22) evalúe la promoción dentro de la carga ensayada. Se midió la respuesta HTTP del documento del frontend; la navegación en Chromium aporta una comprobación separada de datos y assets, no una medición completa de experiencia real. En este perfil no se promovió ni se revirtió y el peso quedó en 50 %. La promoción se aplicó después en el perfil `terrasense` ([bitácora, etapa 3](../rollout/bitacora.md#etapa-3--promoción)).

El video del HPA dura 2:48 y está acelerado a 1,25×, indicado en pantalla. Las fallas fueron 1.399 HTTP 503 y 141 HTTP 502; la carga prevista no se sostuvo completamente. La observación no demuestra cumplimiento de SLO ni una causa única de los errores. El ensayo de HPA es contexto del backend compartido y no demuestra capacidad para 10.000 sensores; consultar también el ensayo de capacidad [#13](../../tp-k8s/README.md).

## Smoke y reparto

Para el perfil aislado, desde la raíz del repositorio y sin modificar `/etc/hosts`, preparar la resolución de k6 HTTP:

```bash
export MINIKUBE_PROFILE=terrasense-tp23
INGRESS_IP=$(minikube -p "$MINIKUBE_PROFILE" ip)
printf '{"hosts":{"terrasense.local":"%s","api.terrasense.local":"%s"}}\n' "$INGRESS_IP" "$INGRESS_IP" > /tmp/terrasense-k6-dns.json
```

El destino predeterminado es `http://terrasense.local/dashboard`. Usar `URL` para apuntar a un entorno de prueba local. Cada iteración HTTP pide el documento una vez, sin seguir redirecciones y sin conservar cookies entre iteraciones. Se exige HTTP 200 y el smoke además comprueba que `X-App-Version` corresponda a una de las dos versiones.

```bash
reportes="tp-final/evidencias/reportes/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$reportes"
k6 run --config /tmp/terrasense-k6-dns.json -e REPORT_JSON="$reportes/smoke.json" tp-final/k6/smoke.js
```

Repetir el reparto en al menos dos pesos diferentes ya aplicados en el Ingress. `WEIGHT` registra el peso esperado en el JSON. Usar la tasa y duración acordadas. Este comando es un ejemplo para un peso de 10 %.

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_HOST=127.0.0.1 K6_WEB_DASHBOARD_EXPORT="$reportes/reparto-10.html" \
  k6 run --config /tmp/terrasense-k6-dns.json -e WEIGHT=10 -e RATE=10 -e DURATION_SECONDS=180 \
  -e REPORT_JSON="$reportes/reparto-10.json" tp-final/k6/reparto.js
```

El dashboard escucha solo en `127.0.0.1`. Activarlo como en los comandos y abrir en el mismo equipo el enlace local que imprime k6 para ver las curvas durante la prueba. No es necesario publicarlo ni exponerlo a la red. Los HTML se guardan al cerrar la corrida. Si k6 queda esperando al final, cerrar la pestaña del dashboard. Para exportar en modo desatendido, usar `K6_WEB_DASHBOARD_PORT=-1`.

El JSON informa las visitas, errores, p95 y tasa efectiva globales y por versión. La tasa efectiva divide las solicitudes completadas entre los segundos programados. El reparto de la candidata usa como denominador la suma de respuestas de `1.0.0` y `1.1.0`. Las respuestas con otro valor, sin header o sin respuesta HTTP quedan como `desconocida` y sus errores cuentan en el total global. Las métricas sin muestras se presentan como `null` para latencia y porcentaje de error.

## Panel en Chromium

Ejecutar en una corrida aparte. El archivo `--config` de k6 HTTP no configura el DNS del navegador. Este wrapper temporal aplica la resolución a Chrome sin editar `/etc/hosts`; cambiar `CHROME_BIN` si el ejecutable está en otra ruta. Elegir un peso que permita observar ambos paneles y guardar capturas en un directorio nuevo por lote. `VISITS` permite ajustar el lote entre 1 y 20 visitas. Usar `K6_BROWSER_HEADLESS=false` para abrir Chromium visiblemente si hay sesión gráfica.

```bash
export INGRESS_IP=$(minikube -p "$MINIKUBE_PROFILE" ip)
export CHROME_BIN=/usr/bin/google-chrome
cat > /tmp/terrasense-chrome <<'EOF'
#!/bin/sh
exec "$CHROME_BIN" "--host-resolver-rules=MAP terrasense.local $INGRESS_IP, MAP api.terrasense.local $INGRESS_IP" "$@"
EOF
chmod 700 /tmp/terrasense-chrome
export K6_BROWSER_EXECUTABLE_PATH=/tmp/terrasense-chrome
capturas="tp-final/evidencias/capturas/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$capturas"
K6_BROWSER_HEADLESS=false k6 run -e CAPTURE_DIR="$capturas" -e VISITS=20 \
  tp-final/k6/navegacion.js
```

Cada visita abre un contexto independiente. El script guarda la primera captura válida de cada versión tras verificar HTTP 200, el header del documento, un encabezado visible, la primera actualización de datos de la API y las respuestas de JS y CSS. El selector predeterminado es `h1.dashboard-title`. Registrar fallos de recursos, distinguiendo estado HTTP, MIME incorrecto y fallos de red. Si una versión falta o alguna visita falla, k6 lo señala al terminar.

## Estrés A/B

Dejar el [protocolo](protocolo-estres.md) versionado antes de medir. Confirmar peso canary de 50 % en el Ingress, réplicas y recursos equivalentes y pods listos. Ejecutar con el mismo destino para las dos versiones.

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_HOST=127.0.0.1 K6_WEB_DASHBOARD_EXPORT="$reportes/estres.html" \
  k6 run --config /tmp/terrasense-k6-dns.json -e REPORT_JSON="$reportes/estres.json" tp-final/k6/estres.js
```

Los niveles programan 10, 20, 40 y 80 solicitudes/s durante dos minutos cada uno. Las solicitudes pendientes pueden terminar al comenzar el siguiente nivel y quedan atribuidas al nivel que las inició. El JSON registra el objetivo, la tasa efectiva, las iteraciones descartadas y la evaluación A/B en cada nivel. El código de salida de k6 refleja los thresholds absolutos, incluido el umbral de error global. Leer `hipotesisAB` en el JSON para evaluar el p95 relativo, el reparto, la muestra mínima y las respuestas sin versión reconocida. El [protocolo](protocolo-estres.md#controles-incorporados-después-de-la-corrida-documentada) explica cuándo la etapa queda inconclusa. Guardar junto a los reportes el comando, fecha, peso, imágenes y revisiones, recursos, réplicas y observaciones del generador y el clúster.

## Video del HPA

En una corrida aparte, con la API y el HPA del backend activos, usar la carga sostenida documentada en el [TP4](../../tp-k8s/README.md). Mostrar el avance de la carga y el cambio de réplicas en terminales separadas.

```bash
export MINIKUBE_PROFILE=terrasense-tp23
minikube -p "$MINIKUBE_PROFILE" kubectl -- -n terrasense get hpa,pods -w
```

```bash
INGRESS_IP=$(minikube -p "$MINIKUBE_PROFILE" ip) \
  SPIKE_RPS=100 HOLD_DURATION=3m k6 run tp-k8s/k6/e2-spike.js
```

Guardar el video de hasta tres minutos en `tp-final/evidencias/videos/` o enlazarlo en el README del TP. Registrar la carga y el cambio de réplicas observado, y agregar una leyenda.
