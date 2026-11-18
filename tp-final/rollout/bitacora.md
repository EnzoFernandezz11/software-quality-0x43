# Bitácora del rollout del dashboard 1.1.0

Registro de cada etapa del [plan](plan.md). Los criterios del plan no se modifican después de medir. Un resultado que no se midió queda como **pendiente**, nunca con valores de ejemplo.

Las horas salen de [`eventos.txt`](../evidencias/reportes/rollout/eventos.txt), que `rollout.sh` escribe en cada cambio de peso o de réplicas. Las métricas salen de los JSON de `reparto.js` (#23).

## Precondiciones

| Ítem | Estado | Evidencia |
|---|---|---|
| Imágenes `terrasense-front:1.0.0` (`front-v1.0.0`, `8951703`) y `1.1.0` (`front-v1.1.0`, `acdca28`) | construidas y cargadas en Minikube | registros de #21 en `tp-final/evidencias/reportes/imagenes/` |
| Gate de calidad de la candidata `acdca28` (#25) | aprobada el 18/11, después de la etapa 0. Pasaron los linters y Horusec sobre `acdca28`, Nacho revisó los hallazgos y dio el GO para medir. El GO es para el perfil `terrasense-tp23`, donde Enzo hizo las mediciones | [GO en #25](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/25#issuecomment-6986489015) · [linters](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106) · [Horusec](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473114) |
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

### Etapa 1 · peso 10 %

| Hora | Revisión | Peso | Visitas 1.0.0 / 1.1.0 | Reparto observado | Errores 1.0.0 / 1.1.0 | p95 1.0.0 / 1.1.0 | Descartadas | Pods | Decisión | Reporte |
|---|---|---|---|---|---|---|---|---|---|---|
| pendiente | | 10 % | | | | | | | | |

### Etapa 2 · peso 50 %

| Hora | Revisión | Peso | Visitas 1.0.0 / 1.1.0 | Reparto observado | Errores 1.0.0 / 1.1.0 | p95 1.0.0 / 1.1.0 | Descartadas | Pods | Decisión | Reporte |
|---|---|---|---|---|---|---|---|---|---|---|
| pendiente | | 50 % | | | | | | | | |

- Navegación en Chromium (`navegacion.js`, 20 visitas): pendiente
- Estrés A/B (#23): pendiente; resultado por nivel en el reporte de Enzo

### Etapa 3 · promoción o rollback

- Hora: pendiente
- Acción aplicada: pendiente
- Verificación final (`rollout.sh muestra 200` y pods): pendiente
- Estado de los manifiestos en el commit final: pendiente

## Decisión final

Pendiente.
