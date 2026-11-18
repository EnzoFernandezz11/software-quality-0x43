# Bitácora del rollout del dashboard 1.1.0

Registro de cada etapa del [plan](plan.md). Los criterios del plan no se modifican después de medir. Un resultado que no se midió queda como **pendiente**, nunca con valores de ejemplo.

Las horas salen de [`eventos.txt`](../evidencias/reportes/rollout/eventos.txt), que `rollout.sh` escribe en cada cambio de peso o de réplicas. Las métricas salen de los JSON de `reparto.js` (#23).

## Precondiciones

| Ítem | Estado | Evidencia |
|---|---|---|
| Imágenes `terrasense-front:1.0.0` (`front-v1.0.0`, `8951703`) y `1.1.0` (`front-v1.1.0`, `acdca28`) | construidas y cargadas en Minikube | registros de #21 en `tp-final/evidencias/reportes/imagenes/` |
| Gate de calidad de la candidata `acdca28` (#25) | linters y Horusec en verde sobre `acdca28`; la clasificación de los 182 hallazgos que reporta Horusec y la aprobación de la gate están pendientes en #25 | [linters](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106) · [Horusec](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473114) |
| Despliegue con ambas versiones y los dos Ingress | verificado | salida de `tp-final/deploy.sh` |
| Afinidad, header y comportamiento al bajar el peso | verificado | [`verificacion-afinidad.txt`](../evidencias/reportes/rollout/verificacion-afinidad.txt) |

## Etapas

Por etapa: hora de inicio y fin, revisión de Git, peso configurado, visitas por versión, reparto observado, errores y p95 por versión, iteraciones descartadas, estado de los pods, decisión y enlace al reporte.

### Etapa 0 · peso 0 + header `X-Canary: always`

- Hora: pendiente
- Resultado: pendiente
- Decisión: pendiente

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
