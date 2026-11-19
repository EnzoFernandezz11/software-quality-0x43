# Bitácora del rollout del dashboard 1.1.0

Registro de cada etapa del [plan](plan.md). Los criterios del plan no se modifican después de medir. Un resultado que no se midió queda como **pendiente**, nunca con valores de ejemplo.

Las horas salen de [`eventos.txt`](../evidencias/reportes/rollout/eventos.txt), que `rollout.sh` escribe en cada cambio de peso o de réplicas. Las horas de las etapas 1 y 2 salen de los dashboards HTML de k6 (inicio y fin de cada corrida, −03:00), porque esas etapas se corrieron con `rollout.sh` desde una copia temporal y sus líneas de `eventos.txt` no quedaron en el repo. Las métricas salen de los JSON de `reparto.js` (#23).

## Precondiciones

| Ítem | Estado | Evidencia |
|---|---|---|
| Imágenes `terrasense-front:1.0.0` (`front-v1.0.0`, `8951703`) y `1.1.0` (`front-v1.1.0`, `acdca28`) | construidas y cargadas en Minikube | registros de #21 en `tp-final/evidencias/reportes/imagenes/` |
| Gate de calidad de la candidata `acdca28` (#25) | aprobada el 18/11, después de la etapa 0. Pasaron los linters y Horusec sobre `acdca28`, Nacho revisó los hallazgos y dio el GO para medir. El GO es para el perfil `terrasense-tp23`, donde se hicieron las mediciones | [GO en #25](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/25#issuecomment-6986489015) · [linters](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106) · [Horusec](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473114) |
| Despliegue con ambas versiones y los dos Ingress | verificado | salida de `tp-final/deploy.sh` |
| Afinidad, header y comportamiento al bajar el peso | verificado | [`verificacion-afinidad.txt`](../evidencias/reportes/rollout/verificacion-afinidad.txt) |

## Etapas

Por etapa: hora de inicio y fin, revisión de Git, peso configurado, visitas por versión, reparto observado, errores y p95 por versión, iteraciones descartadas, estado de los pods, decisión y enlace al reporte.

### Etapa 0 · peso 0 + header `X-Canary: always`

- Hora: 2026-11-18 13:37 (−03:00) · revisión `edba94f` · peso 0 · 2/2 pods `front-stable` (`1.0.0`) y 2/2 `front-canary` (`1.1.0`) listos.
- Resultado ([`etapa0.txt`](../evidencias/reportes/rollout/etapa0.txt)):
  - con `X-Canary: always`, el documento responde 200 con `X-App-Version: 1.1.0` y `<meta name="app-version" content="1.1.0">`; los 9 recursos JS/CSS de la página responden 200 con `1.1.0`;
  - con la cookie `canary=always`: 10 de 10 requests con 200 y `1.1.0`;
  - con `X-Canary: never`: 200 y `1.0.0`;
  - sin header ni cookie (`rollout.sh muestra 200`): 200 de 200 con HTTP 200 y `1.0.0`, o sea que nadie ve la candidata.
  - Captura del panel `1.1.0` completo, con banner, fondo verde y datos de la API: [`etapa0-panel-1.1.0.png`](../evidencias/capturas/etapa0-panel-1.1.0.png). Tomada con Chrome headless sobre el Service `front-canary` (`kubectl port-forward`), porque Chrome no permite agregar el header desde la línea de comandos.
- Decisión: la etapa 0 cumple su criterio. No se abre tráfico hasta que la gate de #25 esté aprobada, como indica el plan.

### Dónde se hizo cada etapa

Las etapas 1 y 2 se midieron el 18/11 en el perfil `terrasense-tp23`, con los scripts de k6 de #23 y los pesos aplicados con `rollout.sh`. Es el perfil donde se dio el GO de la gate. Los reportes están en el [README de la medición](../evidencias/reportes/canary-23/README.md).

La etapa 3 se aplicó en el perfil `terrasense`, con las mismas versiones (tags `front-v1.0.0` y `front-v1.1.0`) y los mismos manifiestos de `tp-final/k8s/`.

### Etapa 1 · peso 10 %

| Hora | Revisión | Peso | Visitas 1.0.0 / 1.1.0 | Reparto observado | Errores 1.0.0 / 1.1.0 | p95 1.0.0 / 1.1.0 | Descartadas | Pods | Decisión | Reporte |
|---|---|---|---|---|---|---|---|---|---|---|
| 18/11 14:59:33–15:02:33 | imágenes `8951703` / `acdca28` | 10 % | 1.616 / 185 | 10,27 % | 0 / 0 | 5,16 / 5,71 ms | 0 | 2/2 stable · 2/2 canary | cumple, se avanza al 50 % | [JSON](../evidencias/reportes/canary-23/reparto-10.json) |

Contra el plan: el reparto cae dentro de 7–13 %, hay 185 visitas del canary (el mínimo era 100), 0 % de errores y p95 de 5,71 ms, muy por debajo de los 300 ms.

### Etapa 2 · peso 50 %

| Hora | Revisión | Peso | Visitas 1.0.0 / 1.1.0 | Reparto observado | Errores 1.0.0 / 1.1.0 | p95 1.0.0 / 1.1.0 | Descartadas | Pods | Decisión | Reporte |
|---|---|---|---|---|---|---|---|---|---|---|
| 18/11 15:03:11–15:06:11 | imágenes `8951703` / `acdca28` | 50 % | 904 / 897 | 49,81 % | 0 / 0 | 4,52 / 4,79 ms | 0 | 2/2 stable · 2/2 canary | cumple, se promueve | [JSON](../evidencias/reportes/canary-23/reparto-50.json) |

Contra el plan: el reparto cae dentro de 45–55 % y el p95 del canary es un 6 % mayor que el de la estable, por debajo del 10 % que permite el plan.

- **Navegación en Chromium (20 visitas):** 20 de 20 cargas correctas y 0 de 360 pedidos fallidos, con captura de las dos versiones ([registro](../evidencias/reportes/canary-23/navegacion-50.txt) · [1.0.0](../evidencias/capturas/canary-23/dashboard-1.0.0.png) · [1.1.0](../evidencias/capturas/canary-23/dashboard-1.1.0.png)).
- **Estrés A/B (15:07:34–15:15:34):** a 10, 20, 40 y 80 requests/s, ninguna de las dos versiones tuvo errores. El p95 del canary nunca superó al de la estable en más de un 8 %; a 80 requests/s fue de 3,74 ms contra 3,57 ms. Por lo que dice el plan, no hay regresión de la 1.1.0 ([JSON](../evidencias/reportes/canary-23/estres.json)).

### Etapa 3 · promoción

- **Hora:** 2026-11-18, de 16:12:18 a 16:12:22 (−03:00), en el perfil `terrasense`, desde el commit `db095ca` ([`eventos.txt`](../evidencias/reportes/rollout/eventos.txt)).
- **Acción aplicada:** `rollout.sh promover`. Primero `front-stable` pasó a la imagen `1.1.0`, después el peso del canary quedó en 0 y al final `front-canary` bajó a 0 pods.
- **Verificación final:** `rollout.sh muestra 200` dio 200 de 200 con HTTP 200 y versión `1.1.0`. Quedaron 2/2 pods de `front-stable` con la `1.1.0` y ninguno del canary ([`promocion.txt`](../evidencias/reportes/rollout/promocion.txt)).
- **Manifiestos:** en este commit, `stable/deployment.yaml` declara `terrasense-front:1.1.0`, `canary/deployment.yaml` tiene 0 réplicas y el Ingress canary tiene peso 0. Si alguien corre `deploy.sh` desde cero, levanta directamente este estado final.

## Decisión final

**Se promueve la 1.1.0.** Las dos etapas medidas cumplieron todos los criterios del plan: el reparto siguió al peso configurado, no hubo errores, la latencia quedó muy lejos del límite y el estrés no mostró que la versión nueva rinda peor que la vieja. Después de promover, todo el tráfico llega a la 1.1.0 sin errores.

Límites de esta decisión:
- el tráfico fue sintético (k6 y Chromium), no de usuarios reales;
- se midió el documento `/dashboard`, no la capacidad de la API compartida;
- las mediciones (`terrasense-tp23`) y la promoción (`terrasense`) se hicieron en dos perfiles de Minikube. Coinciden los tags de imagen (`front-v1.0.0` → `8951703`, `front-v1.1.0` → `acdca28`; el Dockerfile rechaza un build cuya versión no coincide con el código) y las réplicas y recursos del front (2 pods por versión, 50m–500m CPU, 128–256 Mi, según [`despues-estres.txt`](../evidencias/reportes/canary-23/despues-estres.txt)). Los IDs de imagen son locales de cada perfil y no se comparan.

Si hiciera falta volver atrás: `kubectl -n terrasense rollout undo deployment/front-stable` y devolver el YAML de la estable a `1.0.0`.
