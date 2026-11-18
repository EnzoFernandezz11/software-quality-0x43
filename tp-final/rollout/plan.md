# Plan de rollout del dashboard 1.1.0

Responsable: Valentino (#22). Este plan se versiona **antes** de la primera corrida medida. Los resultados van a [bitacora.md](bitacora.md) y no cambian los criterios: si una etapa falla, se aplica la acción de este plan y se documenta.

## Qué se libera

| | Estable | Candidata |
|---|---|---|
| Imagen | `terrasense-front:1.0.0` | `terrasense-front:1.1.0` |
| Revisión de Git | tag `front-v1.0.0` | tag `front-v1.1.0` |
| Cambio visible | panel del TP4 | banner «★ Nuevo panel · versión 1.1.0 ★» y fondo verde |
| Deployment / Service | `front-stable` | `front-canary` |
| Réplicas y recursos | 2 réplicas · 50m–500m CPU · 128–256 Mi | idénticos |

Las imágenes y sus marcas de versión (`X-App-Version`, `<meta name="app-version">`) vienen de #21. El backend y PostgreSQL son compartidos y no cambian.

**Precondición:** la gate de calidad (#25) pasó sobre el commit del que sale `1.1.0`: linters y Horusec en verde. Sin gate aprobada no se abre tráfico (se queda en la etapa 0).

## Cómo se mide

- **Reparto, errores y latencia:** [`tp-final/k6/reparto.js`](../k6/reparto.js) (#23). Cada iteración pide `GET http://terrasense.local/dashboard` sin cookies previas y clasifica la respuesta por `X-App-Version`. El JSON entrega, por versión, las visitas, el % de error y el p95, junto con el % observado del canary.
- **Lo que ve el usuario:** [`tp-final/k6/navegacion.js`](../k6/navegacion.js) abre Chromium en contextos nuevos, verifica que el panel, el JS y el CSS carguen y guarda una captura por versión.
- **Estado del clúster:** `bash tp-final/rollout/rollout.sh estado`. Cada cambio de peso queda registrado con su hora en `tp-final/evidencias/reportes/rollout/eventos.txt`.

Tráfico de cada etapa: `RATE=10` requests/s durante `DURATION_SECONDS=180`, o sea 1.800 requests. Es tráfico sintético. Al 10 % se esperan unas 180 visitas al canary, suficientes para que un solo error no mueva la tasa más de 0,6 puntos (la consigna advierte que con pocas visitas los porcentajes engañan).

## SLOs del release

Son los de la consigna (Anexo A.11) y coinciden con el protocolo de estrés de #23:

| SLO | Umbral | Medido sobre |
|---|---|---|
| Errores del canary | < 1 % de respuestas no-200 | `porVersion["1.1.0"].porcentajeError` |
| Latencia del canary | p95 < 300 ms | `porVersion["1.1.0"].p95Ms` |
| Sin regresión | p95 canary ≤ p95 estable × 1,10 | ambos `p95Ms` (desde la etapa 2) |
| Panel completo | 0 recursos JS/CSS fallidos en Chromium | salida de `navegacion.js` |

**Validez de la muestra** (si no se cumple, la etapa es *inconclusa*, no aprobada):
- al menos 100 visitas reconocidas del canary;
- 0 iteraciones descartadas por k6;
- reparto observado dentro de la tolerancia: ±3 puntos al 10 % y ±5 puntos al 50 %. Son unos 3 desvíos estándar de una binomial con 1.800 visitas: un desvío mayor indica un Ingress mal configurado, no azar.

## Etapas

| Etapa | Peso | Duración | Qué se corre | Criterio para avanzar | Si falla |
|---|---|---|---|---|---|
| 0 | 0 % + header | smoke | `curl -H 'X-Canary: always'` y la cookie `canary=always` en el navegador | La 1.1.0 responde 200 con `X-App-Version: 1.1.0`; el panel, el JS y el CSS cargan; nadie sin header ni cookie la ve | Corregir y reconstruir la imagen. No se abre tráfico |
| 1 | **10 %** | 3 min | `reparto.js` con `WEIGHT=10` | SLOs de errores y p95 del canary; reparto 7–13 %; muestra válida | `rollout.sh rollback` |
| 2 | **50 %** | 3 min + estrés | `reparto.js` con `WEIGHT=50`; `navegacion.js` (20 visitas); estrés A/B de #23 | Todo lo de la etapa 1, reparto 45–55 %, sin regresión de p95 y ambas versiones capturadas completas | `rollout.sh rollback` |
| 3 | promoción | — | `rollout.sh promover` y luego `rollout.sh muestra 200` | 100 % de las respuestas con `1.1.0`; `front-canary` en peso 0 y 0 réplicas | `kubectl rollout undo deployment/front-stable` |

**Por qué 10 → 50 y no 10 → 25 → 50 → 100:**
- La consigna pide al menos dos pesos.
- El 10 % limita el impacto si la candidata está rota.
- El 50 % es el único peso donde el A/B de #23 compara las versiones con muestras parecidas.
- No hay etapa al 100 %: con peso 100 la estable sigue declarada con la versión vieja, así que no es una promoción (Anexo A.12). La promoción real es la etapa 3.

**Cómo leer el estrés A/B en la etapa 2:**
- Si en un nivel comparable el canary rompe un SLO y la estable no (errores ≥ 1 % o p95 > 1,10 × estable), es una regresión de la 1.1.0: **rollback**.
- Si las dos versiones se degradan igual al mismo nivel, es un límite de la plataforma (nodo, generador o API compartida) y no bloquea la promoción. Queda registrado como deuda.
- Un nivel *inconcluso* no cuenta ni a favor ni en contra.

**Repetición:** una etapa inconclusa se repite una vez con el mismo peso. Si vuelve a quedar inconclusa, no se avanza y se aplica rollback, porque no hay evidencia para promover.

## Operación

```bash
bash tp-final/rollout/rollout.sh estado          # antes de cada etapa
bash tp-final/rollout/rollout.sh peso 10         # etapa 1
bash tp-final/rollout/rollout.sh peso 50         # etapa 2
bash tp-final/rollout/rollout.sh promover        # etapa 3
bash tp-final/rollout/rollout.sh rollback        # en cualquier etapa, si falla un criterio
```

El script aplica cada cambio en el clúster y además lo escribe en `tp-final/k8s/canary/ingress-canary.yaml` o en `stable/deployment.yaml`, para que el repositorio refleje el estado final. Rollback y promoción bajan primero el peso a 0 y después las réplicas del canary: al revés, las requests que le tocan al canary reciben 503.

## Verificaciones previas que condicionan el plan

Las corrió [`verificar-afinidad.sh`](verificar-afinidad.sh) antes de este plan. La salida está en [`verificacion-afinidad.txt`](../evidencias/reportes/rollout/verificacion-afinidad.txt). No son mediciones de las etapas: simulan cargas de página con curl para decidir cómo operar.

1. **Sin afinidad, la página se rompe.** Al 50 % y sin cookies, las 20 cargas de `/dashboard` mezclaron JS/CSS de las dos versiones y 12 tuvieron al menos un recurso con 404. Con la cookie de afinidad: 0 mezclas y 0 errores en 20 cargas. Por eso los dos Ingress del front llevan afinidad y la API tiene su propio Ingress.
2. **Peso 0 no saca a quien ya está fijado al canary.** Un navegador que recibió la 1.1.0 sigue en la 1.1.0 aunque el peso baje a 0. Así funciona la afinidad «sticky» del canary en ingress-nginx, y dura lo que la cookie: 1 h. Recién cuando `front-canary` queda en 0 réplicas, esa misma cookie vuelve a la 1.0.0, con HTTP 200 y sin mezcla. **Consecuencia:** el rollback no termina con el peso en 0. Termina cuando el canary queda en 0 réplicas, y `rollout.sh rollback` hace los dos pasos. El tiempo de rollback se mide hasta ese segundo paso.
3. **El header funciona sin tocar el peso.** Con peso 0, `X-Canary: always` devuelve la 1.1.0 y `never` devuelve la 1.0.0. Eso habilita la etapa 0.
4. **Promover sin corte.** Con tráfico continuo durante `rollout.sh promover`, hubo 0 errores en 963 requests, gracias a `maxUnavailable: 0` y al `preStop` del front. Sin el `preStop` (tal como venía del TP4), una prueba previa perdió 1 de 100 requests al reemplazarse los pods.

**Para el navegador:** la cookie `terrasense-front` dura 1 h. Para volver a sortear la versión hay que abrir una ventana de incógnito nueva o borrar esa cookie, porque un F5 ya no alcanza.
