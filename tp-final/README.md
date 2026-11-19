# TP Final · TerraSense: del pipeline de CI al despliegue progresivo (Canary)

Gestión de la Calidad del Software · FCEFyN, UNC · 2.º cuatrimestre 2026.
Equipo: Ignacio Verdinelli, Enzo Fernández, Valentino Garbagnoli y Valentín Giosso.

Este README es el informe técnico del TP final. Liberamos la versión `1.1.0` del panel de monitoreo con un **canary del frontend** sobre NGINX Ingress en Minikube, la medimos con k6 y decidimos con criterios fijados de antemano. Además, relacionamos cada práctica del cuatrimestre con la familia ISO/IEC 25000.

| Pregunta | Veredicto | Detalle |
|---|---|---|
| ¿Se promueve el panel `1.1.0`? | **GO, promovida el 18/11** | [§6.1](#61-v110-go) |
| ¿Aguanta la plataforma 10.000 sensores? | **NO-GO** | [§6.2](#62-10000-sensores-no-go) |

**Presentación:** [PDF](presentacion/presentacion.pdf) de la exposición del 19/11. La [versión navegable](presentacion/presentacion.html), con el video de la demo y el GIF del HPA, se abre desde el repo en Chromium o Firefox.

## Índice

0. [Arquitectura](#0-arquitectura)
1. [Instrucciones de despliegue](#1-instrucciones-de-despliegue)
2. [Plan de rollout y bitácora](#2-plan-de-rollout-y-bitácora)
3. [Prueba de estrés](#3-prueba-de-estrés-ab-del-frontend)
4. [Mapa ISO/IEC 25000](#4-mapa-isoiec-25000)
5. [Índice de evidencia](#5-índice-de-evidencia)
6. [Veredicto final](#6-veredicto-final)
7. [Aprendizaje: problemas, resoluciones y pendientes](#7-aprendizaje-problemas-resoluciones-y-pendientes)

Estructura de la carpeta:

```
tp-final/
├── k8s/            base/ (namespace, configmap, db, back, HPA, Ingress de la API) · stable/ · canary/ · ingress.yaml
├── deploy.sh       despliegue completo en un Minikube limpio
├── rollout/        plan.md, bitacora.md y rollout.sh (peso, promover, rollback)
├── imagenes/       build-front.sh y verificar-front.sh (imágenes desde tags de Git)
├── k6/             smoke, reparto, navegación (k6/browser) y estrés A/B
├── ci/             gate de la candidata: linters + Horusec, con enlaces a los workflows
├── evidencias/     capturas/, videos/ y reportes/
├── mapa-iso.md     mapa completo ISO/IEC 25000
├── presentacion/   diapositivas: PDF y HTML navegable
└── README.md       este informe
```

## 0. Arquitectura

```
                     ┌──────────────── Pipeline de CI (TP1 y TP2) ────────────────┐
  código ──► PR ──►  │ Flake8 · ESLint · clang-format ──► gate ──► Horusec (SAST) │ ──► imagen terrasense-front:<versión>
                     └────────────────────────────────────────────────────────────┘     (tag de Git → SHA en labels OCI)

  Minikube (perfil terrasense, namespace terrasense)
  ─────────────────────────────────────────────────
  navegador / k6 ──► terrasense.local ──► Ingress principal (afinidad por cookie) ──► front-stable ──► 2 pods
                                     └──► Ingress canary (canary-weight: w,       ──► front-canary ──► 2 pods
                                          X-Canary, cookie canary)
  ESP32 / k6 ──► api.terrasense.local ──► Ingress de la API (sin afinidad) ──► back (HPA 2–6) ──► PostgreSQL (StatefulSet + PVC)
```

- El canary es **solo del frontend** (Next.js en modo `standalone`, puerto 3000). El backend y la base son los del TP4 y están compartidos.
- La API tiene su propio Ingress porque la afinidad por cookie del front se aplica a todos los upstreams del Ingress donde se declara (Anexo A.9). Si la API siguiera en el mismo Ingress, cada navegador quedaría pegado a un pod de `back`.
- Cada versión del front expone su número en el header `X-App-Version` de **todas** las respuestas y en `<meta name="app-version">`. La `1.1.0` además lleva un banner y un fondo verde, para que en cualquier captura se distinga qué versión vio el usuario ([imágenes](imagenes/README.md)).

## 1. Instrucciones de despliegue

### Requisitos

Docker, Minikube (driver docker), git, curl y Node (lo usa `build-front.sh` para leer la versión del `package.json`). Para medir: k6 y Chrome o Chromium. El build necesita salida a internet (`next/font` descarga la tipografía). El nodo se crea con 4 CPU y 6 GiB; se cambia con `MINIKUBE_CPUS` y `MINIKUBE_MEMORY`.

### Levantar las dos versiones desde cero

```bash
git clone https://github.com/EnzoFernandezz11/software-quality-0x43.git
cd software-quality-0x43
git fetch --tags                          # front-v1.0.0 y front-v1.1.0
ESTADO=inicial bash tp-final/deploy.sh    # pide sudo para /etc/hosts
```

`deploy.sh` hace todo en orden:

1. Verifica las herramientas y crea `.env` desde `.env.example` si no existe.
2. Arranca el perfil `terrasense` y habilita `ingress` y `metrics-server`.
3. Construye el back y las dos imágenes del front **desde sus tags de Git** (`build-front.sh` saca una copia limpia de cada tag) y las carga con `minikube image load`.
4. Crea el namespace, el ConfigMap y el Secret (este último desde `.env`, nunca versionado).
5. Levanta PostgreSQL, corre las migraciones y despliega la API y el HPA.
6. Despliega `front-stable` y `front-canary` y los tres Ingress (el canary después del principal).
7. Agrega `api.terrasense.local` y `terrasense.local` a `/etc/hosts`.
8. Verifica `/health`, `/health/ready` y cada versión del front, forzándola con el header `X-Canary`.

**Por qué `ESTADO=inicial`.** Los YAML de `tp-final/k8s/` describen el clúster **después** del rollout: la estable ya corre la `1.1.0` y el canary tiene 0 réplicas. Con `ESTADO=inicial`, el script los lleva al estado previo (estable `1.0.0`, canary `1.1.0` con 2 réplicas, peso 0) y los aplica. Así se ven las dos versiones y se puede recorrer el rollout. Sin la variable, `deploy.sh` levanta el estado final: solo la `1.1.0`. Detalle en [`k8s/README.md`](k8s/README.md#levantarlo-desde-un-minikube-limpio).

| Variable | Efecto |
|---|---|
| `ESTADO=inicial` | Las dos versiones con peso 0 (ver arriba). Por defecto: `final`. |
| `SKIP_HOSTS=1` | No toca `/etc/hosts`; muestra el comando para hacerlo a mano. |
| `SKIP_BUILD=1` | Usa las imágenes ya cargadas en Minikube. |
| `MINIKUBE_PROFILE` | Perfil de Minikube (por defecto `terrasense`). |

Si `/etc/hosts` no se tocó, se agrega a mano (Anexo D):

```bash
echo "$(minikube -p terrasense ip) api.terrasense.local terrasense.local" | sudo tee -a /etc/hosts
```

### Comprobar ambas versiones

```bash
curl -sI -H 'X-Canary: never'  http://terrasense.local/dashboard | grep -i x-app-version   # 1.0.0
curl -sI -H 'X-Canary: always' http://terrasense.local/dashboard | grep -i x-app-version   # 1.1.0
bash tp-final/rollout/rollout.sh estado      # peso, imágenes, pods y una muestra de 100 requests
```

En el navegador, `http://terrasense.local/dashboard` muestra la estable. Para ver la candidata con peso 0: borrar la cookie `terrasense-front` y crear `canary=always` (F12 → Application → Cookies). Para volver a sortear la versión hace falta una ventana de incógnito nueva, porque la afinidad fija el navegador durante 1 h.

### Recorrer el rollout

```bash
bash tp-final/rollout/rollout.sh peso 10      # etapa 1
bash tp-final/rollout/rollout.sh muestra 200  # requests sin cookies, contadas por X-App-Version
bash tp-final/rollout/rollout.sh peso 50      # etapa 2
bash tp-final/rollout/rollout.sh promover     # etapa 3: la estable pasa a 1.1.0; canary a peso 0 y 0 réplicas
bash tp-final/rollout/rollout.sh rollback     # en cualquier etapa: peso 0 y canary a 0 réplicas
```

Las mediciones de cada etapa se corren con los scripts de [`k6/`](k6/README.md). Cada comando de `rollout.sh` aplica el cambio en el clúster, lo escribe en el YAML (el repo describe el estado real, Anexo A.7) y deja una línea en `evidencias/reportes/rollout/eventos.txt`. Al promover, los YAML vuelven a ser idénticos a los versionados.

**Archivos que cambia una reproducción.** `deploy.sh` regenera los registros de build en `evidencias/reportes/imagenes/` y `rollout.sh` agrega líneas a `eventos.txt`. Para descartar esos cambios: `git restore tp-final/k8s tp-final/evidencias/reportes`.

**Apagar o borrar:** `minikube stop -p terrasense` conserva los datos; `minikube delete -p terrasense` borra todo.

### Prueba como tercero (#24)

Valentín no escribió los manifiestos del canary y verificó las instrucciones como tercero el 18/11/2026, en un perfil nuevo (`tpfinal-tercero`) y desde un clon nuevo del repo, sin `.env`.

| Dato | Valor |
|---|---|
| Revisión probada | `dd7e0a8` (`develop` después de #32) con el `deploy.sh` de esta entrega (`ESTADO=inicial`), que quedó commiteado sin cambios en [`a3f4eef`](https://github.com/EnzoFernandezz11/software-quality-0x43/commit/a3f4eef94a90424e0c08d0f2ee7e3dcee91aad0c). Entre lo probado y la entrega solo cambian documentación, evidencia, videos y la presentación: ningún manifiesto, Dockerfile ni script además de `deploy.sh` |
| Comando | `MINIKUBE_PROFILE=tpfinal-tercero SKIP_HOSTS=1 ESTADO=inicial bash tp-final/deploy.sh` |
| Resultado | OK en 3 min (17:28:51 → 17:31:50, con caché de Docker). Construyó `front-v1.0.0` y `front-v1.1.0`; 2/2 pods de cada versión, los tres Ingress y las cuatro verificaciones en OK: `/health`, `/health/ready`, `X-Canary: never` → `1.0.0` y `X-Canary: always` → `1.1.0`. [Salida completa](evidencias/reportes/reproduccion/deploy-limpio.txt) |
| Recorrido del rollout | Peso 10: 25 de 200 requests a la `1.1.0` (12,5 %). Peso 50: 111 de 200 (55,5 %). Promoción: 200 de 200 con `1.1.0`, y los YAML quedaron idénticos a los versionados. Son muestras rápidas de verificación, no las etapas medidas. [Salida](evidencias/reportes/reproduccion/rollout-limpio.txt) |
| Corrección necesaria | Antes de esta entrega, `deploy.sh` en un Minikube limpio levantaba **solo la `1.1.0`**: los YAML ya estaban en el estado final y la `1.0.0` ni se construía. Se agregó `ESTADO=inicial`. También quedó documentado qué archivos de evidencia cambia una reproducción. |

## 2. Plan de rollout y bitácora

El [plan](rollout/plan.md) se versionó **antes** de la primera corrida medida y los criterios no se cambiaron después de medir. La [bitácora](rollout/bitacora.md) registra cada etapa con hora, peso, métricas y decisión.

### SLOs del release

| SLO | Umbral | Fuente |
|---|---|---|
| Errores del canary | < 1 % de respuestas no-200 | Anexo A.11 de la consigna |
| Latencia del canary | p95 < 300 ms | Anexo A.11; mismo SLO que el TP4 |
| Sin regresión | p95 canary ≤ p95 estable × 1,10 (desde la etapa 2) | Anexo A.11 |
| Panel completo | 0 recursos JS/CSS fallidos en Chromium | Propio, por el riesgo de recursos mezclados |

**Validez de la muestra.** Una etapa sin al menos 100 visitas del canary, con iteraciones descartadas o con el reparto fuera de la tolerancia (±3 puntos al 10 %, ±5 al 50 %, unos 3 desvíos de una binomial con 1.800 visitas) queda *inconclusa*, no aprobada. Cada etapa: 10 requests/s durante 3 min, 1.800 requests.

**Por qué 10 → 50 y no 10 → 25 → 50 → 100.** El 10 % limita el impacto si la candidata está rota. El 50 % es el único peso donde el A/B compara las dos versiones con muestras parecidas. No hay etapa al 100 %, porque con peso 100 la estable sigue declarada con la versión vieja (Anexo A.12): la promoción real es la etapa 3.

### Bitácora

| Etapa | Hora (18/11, −03:00) | Peso | Visitas 1.0.0 / 1.1.0 | Canary observado | Errores | p95 1.0.0 / 1.1.0 | Decisión |
|---|---|---|---|---|---|---|---|
| 0 · smoke | 13:37 | 0 % + header | 200 / 0 sin header; 1.1.0 con `X-Canary` y cookie | 0 % sin header | 0 | — | cumple; se espera el GO de la gate |
| Gate (#25) | 18/11 | — | — | — | — | — | GO para medir `acdca28` ([ci/README.md](ci/README.md#decisión-para-el-rollout-medido)) |
| 1 | 14:59:33–15:02:33 | 10 % | 1.616 / 185 | 10,27 % (7–13 %) | 0 / 0 | 5,16 / 5,71 ms | cumple; se avanza al 50 % |
| 2 | 15:03:11–15:06:11 | 50 % | 904 / 897 | 49,81 % (45–55 %) | 0 / 0 | 4,52 / 4,79 ms (+6,1 %) | cumple; con el A/B y Chromium, se promueve |
| 3 · promoción | 16:12:18–16:12:22 | 0 % | 0 / 200 | — | 0 | — | 200 de 200 con `1.1.0` |

- Las etapas 1 y 2 y el estrés se midieron en el perfil `terrasense-tp23`; la promoción se aplicó en `terrasense`. Coinciden los tags (`front-v1.0.0` → `8951703`, `front-v1.1.0` → `acdca28`) y las réplicas y recursos del front. Los IDs de imagen son locales de cada perfil.
- En la etapa 2, Chromium hizo 20 visitas: 20 de 20 cargas correctas, 0 de 360 pedidos fallidos y captura de las dos versiones.
- Rollback planificado: `rollout.sh rollback` baja primero el peso a 0 y después el canary a 0 réplicas. Los dos pasos hacen falta: con peso 0, un navegador que ya cayó en la `1.1.0` sigue ahí por la afinidad *sticky* del canary; recién con 0 réplicas vuelve a la `1.0.0` ([verificación](evidencias/reportes/rollout/verificacion-afinidad.txt)).

**Decisión: se promueve la `1.1.0`.** Fundamento y límites en [§6.1](#61-v110-go).

## 3. Prueba de estrés A/B del frontend

Protocolo versionado antes de medir: [`k6/protocolo-estres.md`](k6/protocolo-estres.md). Script: [`k6/estres.js`](k6/estres.js).

**Pregunta.** ¿La candidata `1.1.0` introduce una regresión relevante frente a la estable `1.0.0` bajo la misma carga?

**Hipótesis (escrita antes de correr).** Con carga comparable, el p95 de la `1.1.0` es como máximo un 10 % mayor que el de la `1.0.0`, ambas tienen menos de 1 % de errores y el p95 de la `1.1.0` queda por debajo de 300 ms.

**Por qué A/B y por qué el frontend.**
- El riesgo del release es la versión nueva del panel; el backend no cambia. Comparar contra la estable en simultáneo aísla el efecto de la versión: las dos reciben el mismo tráfico, al mismo tiempo y contra la misma API.
- No usamos la línea base del TP4 como referencia del front, porque mide escrituras en la API, otro componente.
- Un front servido por Next.js difícilmente sea el cuello de botella (la consigna lo advierte). Por eso la pregunta no es «dónde se rompe» sino «¿la `1.1.0` rinde peor?».

**Condiciones comparables.** Peso 50 %; 2 réplicas por versión con requests y limits idénticos (50m–500m CPU, 128–256 Mi); mismo script y misma URL; afinidad sin efecto, porque k6 no conserva cookies entre iteraciones. Ritmo de llegada fijo: 10, 20, 40 y 80 requests/s, 2 min por nivel. Thresholds en el script, por nivel: errores < 1 % en cada versión, p95 de la candidata < 300 ms y 0 iteraciones descartadas.

**Resultados** (18/11, 15:07:34–15:15:34, [JSON](evidencias/reportes/canary-23/estres.json) · [dashboard](evidencias/reportes/canary-23/estres.html)):

| Objetivo (req/s) | Completadas estable / canary | Tasa lograda | p95 estable / canary | Diferencia | Resultado |
|---:|---:|---:|---:|---:|---|
| 10 | 579 / 622 | 10,008 | 4,84 / 4,94 ms | +2,1 % | cumple |
| 20 | 1.195 / 1.205 | 20,000 | 4,52 / 4,48 ms | −0,9 % | cumple |
| 40 | 2.402 / 2.399 | 40,008 | 4,14 / 4,44 ms | +7,2 % | cumple |
| 80 | 4.836 / 4.765 | 80,008 | 3,57 / 3,74 ms | +4,8 % | cumple |

En los cuatro niveles hubo 0 errores, 0 respuestas sin versión y 0 iteraciones descartadas, y la tasa lograda coincidió con la programada. Por lo tanto, la carga se generó completa y no hubo saturación del generador.

**Peso de la página** (la consigna pregunta «¿pesa más la v1.1.0?»): la `1.1.0` pesa **+708 B sobre 1,12 MB (+0,06 %)**. El documento crece 246 B por el banner y la cantidad de requests por carga es la misma (1 documento + 9 JS/CSS) ([medición](evidencias/reportes/reproduccion/peso-pagina.txt)).

**Conclusión: se confirma la hipótesis** en las cuatro cargas probadas. La `1.1.0` no muestra regresión: la mayor diferencia de p95 fue +7,2 %, dentro del 10 %, y los p95 absolutos (< 5 ms) quedan casi dos órdenes de magnitud por debajo de los 300 ms. Para la promoción significa que el rendimiento no es motivo de rollback.

**Límites.**
- Se midió el documento `/dashboard`, no los JS/CSS ni el render en el navegador (eso lo cubre la navegación en Chromium, como verificación funcional, no como carga).
- A 80 req/s no apareció el punto de quiebre: no conocemos la capacidad máxima del front, solo que hasta ahí no hay diferencia entre versiones.
- No dice nada sobre la capacidad de la API, que es el límite real del sistema ([§6.2](#62-10000-sensores-no-go)).

## 4. Mapa ISO/IEC 25000

El mapa completo, con todas las cifras y enlaces, está en [`mapa-iso.md`](mapa-iso.md). Resumen por etapa (ISO/IEC 25010:2023):

| Etapa | Característica / subcaracterística | Métrica o evidencia | SQuaRE | Qué no cubre |
|---|---|---|---|---|
| Linters en CI | Mantenibilidad: analizabilidad, modificabilidad | Gate de 3 linters: falla en el PR #4, verde en el PR #2 y en la candidata | 2503n (gate), 2502n (estado por job), 2504n (resultado) | Solo reglas estáticas: ni diseño, ni comportamiento, ni ejecución |
| Horusec (SAST) | Seguridad: confidencialidad, integridad | TP2: 16 hallazgos, 3 verdaderos y 13 falsos positivos. Candidata: 182 alertas clasificadas | 2502n (conteo y severidad), 2504n (clasificación) | No ve el runtime ni el despliegue; sin revisión humana, el conteo no mide riesgo |
| SonarQube (TP3) | Mantenibilidad: analizabilidad, capacidad de prueba | Complejidad cognitiva 143 → 70; cobertura 1,5 % → 20,5 % | 2503n, 2502n, 2504n | Datos de Soporte360, no de TerraSense; la cobertura no prueba que los tests verifiquen lo correcto |
| Docker + K8s + probes | Flexibilidad: instalabilidad; fiabilidad: disponibilidad | `deploy.sh` reproducible desde un Minikube limpio; `pool_pre_ping`: 30/30 POST 201 tras reiniciar PostgreSQL (antes, 2/30 fallos) | 2502n, 2504n | Un nodo local: no demuestra disponibilidad sostenida ni seguridad en producción |
| HPA | Flexibilidad: escalabilidad; eficiencia: utilización de recursos | 2 → 6 réplicas, pero con 8,67 % de errores y p95 de 14,47 s | 2502n, 2504n | Muestra que el escalado reacciona, no que alcance |
| k6 carga (TP4) | Eficiencia: comportamiento temporal, capacidad | `load` a 67 req/s: 59 % de errores, p95 de 17,5 s → NO-GO para 2.000 sensores | 2503n (SLO), 2502n, 2504n (veredicto) | Solo la API con 2 réplicas fijas; no mide sensores reales |
| Pruebas de fallas | Fiabilidad: tolerancia a fallos, recuperabilidad | E1b: 5,8 s de errores y 10 % de fallas; E2: recuperación sola en ~22 s; reemplazo de un pod del front: 188/188 HTTP 200 | 2502n, 2504n (afín a 25045) | E1 a 5 POST/s; no se probó la caída de la base, del nodo ni del Ingress |
| Gate de la candidata | Mantenibilidad y seguridad (indirectas) | 3/3 linters y Horusec sobre el árbol de `acdca28`; GO para medir | 2503n, 2502n, 2504n | No prueba que la `1.1.0` funcione; sin registry, no garantiza que la imagen desplegada sea la analizada |
| Canary | Fiabilidad: disponibilidad durante cambios; adecuación funcional; capacidad de interacción: operabilidad; flexibilidad: reemplazabilidad | Reparto 10,27 % y 49,81 %; 20/20 visitas en Chromium; 200/200 con `1.1.0` tras promover | 2503n (plan), 2502n, 2504n (decisión) | Tráfico sintético: calidad del producto, no en uso. Sin rollback real con una versión rota |
| Estrés A/B | Eficiencia: comportamiento temporal; fiabilidad: ausencia de fallos | Hipótesis cumplida a 10–80 req/s; p95 3,57 vs 3,74 ms a 80 req/s | 2503n (hipótesis), 2502n, 2504n | Solo el documento HTTP; sin punto de quiebre; nada sobre la API |

**Producto vs. uso.** Linters, SAST y mediciones HTTP evalúan la **calidad del producto** (ISO/IEC 25010). La primera vez que observamos algo que vive el usuario fue en E1b del TP4: la captura muestra el banner «Failed to fetch» con las últimas lecturas conservadas ([falla-ux.png](../tp-k8s/evidencias/falla-ux.png)). En el canary, Chromium verificó que las dos versiones cargaban completas, pero con usuarios sintéticos.

**¿Qué cambia cuando el canary expone la `1.1.0` a usuarios reales?**
1. **Pasa a medirse calidad en uso (ISO/IEC 25019):** si los productores encuentran la temperatura de su lote, cuánto tardan, si se equivocan y si alguna alerta de helada pasa desapercibida. Con tráfico sintético eso no se puede medir.
2. **El peso acota el daño:** una falla de la `1.1.0` al 10 % afecta como mucho a uno de cada diez productores, y con la afinidad, siempre a los mismos. El incidente de la pantalla en blanco de 40 minutos fue un *big bang* que afectó a todos; con el canary es un incidente acotado que se corta con `rollout.sh rollback`.

**Características sin cobertura suficiente:**

| Característica | Herramienta | Métrica | Etapa del pipeline |
|---|---|---|---|
| Compatibilidad: interoperabilidad | Pruebas de contrato ESP32 ↔ API ↔ front con esquemas versionados, más una prueba de punta a punta | % de contratos aprobados y fallos por versión | Integración, antes del build de la candidata |
| Protección (*safety*): advertencia de peligro | k6/browser cortando las lecturas durante una alerta de helada | Tiempo hasta el aviso de «dato desactualizado» y % de escenarios con aviso correcto | Aceptación, antes del canary |
| Capacidad de interacción: inclusividad | axe-core en CI, más pruebas manuales con teclado y lector de pantalla | Violaciones por severidad; % de tareas completadas con teclado | Gate del frontend |

## 5. Índice de evidencia

Una línea por evidencia: qué muestra y qué concluimos.

### Pipeline de calidad (TP1, TP2 y gate de la candidata)

| Evidencia | Qué muestra | Qué concluimos |
|---|---|---|
| [Run de linters del PR #4](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/34488208873) | Flake8 falla y la gate global queda en rojo, aunque ESLint y clang-format pasan | La gate bloquea el merge si falla un solo linter |
| [Run de linters del PR #2](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/34296394721) | 3 de 3 linters y la gate en verde | Con el código corregido, el pipeline deja pasar |
| [Informe Horusec del TP2](../RESPUESTAS_TP2_HORUSEC.md) · [SARIF](../evidencia-horusec-tp2.sarif) | 16 hallazgos: 3 verdaderos positivos (entre ellos, la clave por defecto de Flask) y 13 falsos positivos | El SAST encuentra riesgos reales, pero cada alerta necesita revisión |
| [Linters de la candidata](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106) · [Horusec de la candidata](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473114) | Checks sobre el árbol de `acdca28` (el mismo de la imagen `1.1.0`) | La candidata pasó la primera quality gate |
| [Gate y decisión (#25)](ci/README.md) | 182 alertas clasificadas, clave efectiva verificada, GO para medir | La imagen candidata salió del mismo árbol de Git que analizó Actions |

### Imágenes versionadas (#21)

| Evidencia | Qué muestra | Qué concluimos |
|---|---|---|
| [panel-1.0.0.png](evidencias/capturas/panel-1.0.0.png) · [panel-1.1.0.png](evidencias/capturas/panel-1.1.0.png) | Las dos versiones lado a lado: la `1.1.0` con banner y fondo verde. Sin datos, porque se sacaron sin API | Se distinguen de un vistazo |
| [registro-1.0.0.txt](evidencias/reportes/imagenes/registro-1.0.0.txt) · [registro-1.1.0.txt](evidencias/reportes/imagenes/registro-1.1.0.txt) | SHA del commit, tag, Image ID y labels OCI de cada build | Cada imagen se puede rastrear hasta su commit |
| [verificacion-1.0.0.txt](evidencias/reportes/imagenes/verificacion-1.0.0.txt) · [verificacion-1.1.0.txt](evidencias/reportes/imagenes/verificacion-1.1.0.txt) | `X-App-Version` en documento, JS y CSS, el meta y el título: 0 fallos | k6 puede contar visitas por versión |

### Kubernetes, HPA y fallas (TP4 y TP final)

| Evidencia | Qué muestra | Qué concluimos |
|---|---|---|
| [deploy-limpio.txt](evidencias/reportes/reproduccion/deploy-limpio.txt) | Despliegue completo en un perfil nuevo: pods, Services e Ingress de las dos versiones | Un tercero levanta todo siguiendo este README |
| [a1-dashboard-via-ingress.png](../tp-k8s/evidencias/a1-dashboard-via-ingress.png) | El panel servido por el Ingress del TP4 | La migración a K8s funciona de punta a punta |
| [hpa-escala.mp4](evidencias/videos/hpa-escala.mp4) (2:48, ×1,25) · [leyenda](evidencias/reportes/hpa/leyenda.md) · [hpa-escala.gif](evidencias/videos/hpa-escala.gif) (mitad izquierda, 2 cuadros/s, para la presentación) | El HPA pasa de 2 a 6 réplicas bajo 100 iteraciones/s; k6 registra 8,67 % de errores y p95 de 14,47 s | El autoescalado reacciona, pero no alcanza para cumplir los SLO |
| [hpa-escalando.png](../tp-k8s/evidencias/hpa-escalando.png) · [hpa-escalado-grafico.png](../tp-k8s/evidencias/hpa-escalado-grafico.png) | El escalado del TP4 bajo carga sostenida: de 2 a 6 réplicas, con 70,12 % de fallas | En el TP4 el HPA tampoco alcanzó para cumplir los SLO |
| [Gráficos de A3](../tp-k8s/README.md#4-pruebas-de-carga-actividad-3) (`load` y `stress`, antes y después) | Solicitudes/s, errores y p95 de la API | La optimización bajó el p95 de `smoke` de 1.991 a 33 ms, pero `load` sigue en NO-GO |
| [falla-ux.png](../tp-k8s/evidencias/falla-ux.png) · [medición E1b](../tp-k8s/evidencias/e1b-20261105-143848/medicion.txt) | Banner «Failed to fetch» con las últimas lecturas durante la caída de los dos pods de la API; 5,8 s de errores | El panel no queda en blanco: degrada y avisa |
| [e2-pods-no-listos.png](../tp-k8s/evidencias/e2-pods-no-listos.png) · [e2-recuperacion-grafico.png](../tp-k8s/evidencias/e2-recuperacion-grafico.png) | Pico de 400 req/s: pods no listos, 9.779 HTTP 503 y recuperación sola en ~22 s | El sistema se recupera sin intervención, pero no aguanta el pico |
| [reemplazo-pod-stable.txt](evidencias/reportes/rollout/reemplazo-pod-stable.txt) | Se elimina un pod de `front-stable` con tráfico continuo: 188 de 188 HTTP 200, reemplazo en 13 s | Con 2 réplicas y `preStop`, perder un pod no genera errores |

### Canary y estrés

| Evidencia | Qué muestra | Qué concluimos |
|---|---|---|
| [verificacion-afinidad.txt](evidencias/reportes/rollout/verificacion-afinidad.txt) | Sin cookie, al 50 %: 20 de 20 cargas mezclan recursos de las dos versiones y 12 tienen 404. Con cookie: 0 | La afinidad es necesaria para que el canary del front funcione |
| [etapa0.txt](evidencias/reportes/rollout/etapa0.txt) · [etapa0-panel-1.1.0.png](evidencias/capturas/etapa0-panel-1.1.0.png) | Con peso 0, la `1.1.0` responde completa con el header, y nadie sin header la ve | Se puede probar la candidata sin exponerla |
| [reparto-10.json](evidencias/reportes/canary-23/reparto-10.json) · [HTML](evidencias/reportes/canary-23/reparto-10.html) | Peso 10 %: 185 de 1.801 visitas al canary (10,27 %), 0 errores | El reparto sigue al peso configurado |
| [reparto-50.json](evidencias/reportes/canary-23/reparto-50.json) · [HTML](evidencias/reportes/canary-23/reparto-50.html) | Peso 50 %: 897 de 1.801 (49,81 %), p95 +6,1 % | Se cumplen los criterios para promover |
| [dashboard-1.0.0.png](evidencias/capturas/canary-23/dashboard-1.0.0.png) · [dashboard-1.1.0.png](evidencias/capturas/canary-23/dashboard-1.1.0.png) · [navegacion-50.txt](evidencias/reportes/canary-23/navegacion-50.txt) | Lo que vio cada usuario al 50 %, con datos de la API; 20/20 visitas y 0/360 pedidos fallidos | Las dos versiones renderizan completas a través del canary |
| [estres.json](evidencias/reportes/canary-23/estres.json) · [HTML](evidencias/reportes/canary-23/estres.html) | A/B a 10–80 req/s: 0 errores, diferencia máxima de p95 +7,2 % | Se confirma la hipótesis: no hay regresión |
| [peso-pagina.txt](evidencias/reportes/reproduccion/peso-pagina.txt) | Bytes por versión: +708 B (+0,06 %) | La `1.1.0` no pesa más |
| [promocion.txt](evidencias/reportes/rollout/promocion.txt) · [eventos.txt](evidencias/reportes/rollout/eventos.txt) | Promoción en 4 s y 200 de 200 respuestas con `1.1.0` | La promoción se hizo sin corte |
| [cambio-peso.mp4](evidencias/videos/cambio-peso.mp4) (2:50) · [leyenda](evidencias/reportes/rollout/leyenda-videos.md) | Recreación posterior del cambio de peso con `rollout.sh` (peso 0 → 10 → 50, muestras de 100) y ventanas privadas que caen en una u otra versión | Muestra el mecanismo del canary y la afinidad; el reparto medido es el de `reparto-10/50.json` |
| [pods.mp4](evidencias/videos/pods.mp4) (0:45) · [leyenda](evidencias/reportes/rollout/leyenda-videos.md) | Se elimina un pod de `front-stable` con tráfico: 179 de 179 HTTP 200 y reemplazo en 12 s (otra corrida que la de `reemplazo-pod-stable.txt`) | Perder un pod del front no genera errores |

## 6. Veredicto final

### 6.1 v1.1.0: GO

**Se promueve, y ya está promovida** (18/11, 16:12, perfil `terrasense`). Se basa en tres fuentes independientes:

| Fuente | Qué se evaluó | Resultado |
|---|---|---|
| Gate de calidad (#25) | Linters + Horusec sobre el árbol de `acdca28` | 3/3 linters; alertas clasificadas; GO para medir |
| Bitácora del rollout (#22) | Los 4 SLOs del plan, en dos pesos | Errores 0 % (< 1 %); p95 5,71 y 4,79 ms (< 300 ms); regresión +6,1 % (≤ 10 %); panel completo 20/20 |
| Estrés A/B (#23) | Hipótesis de no regresión a 10–80 req/s | Confirmada en los cuatro niveles |

**¿Se cumplieron los SLOs?** Sí, los cuatro, con muestras válidas en las dos etapas. Después de promover, 200 de 200 respuestas fueron HTTP 200 con `1.1.0`.

**Límites:** el tráfico fue sintético; se midió el frontend y no la API compartida; las etapas se midieron en `terrasense-tp23` y la promoción se aplicó en `terrasense`, con los mismos tags y recursos.

### 6.2 10.000 sensores: NO-GO

**Carga requerida.** 10.000 sensores × 1 envío cada 30 s ≈ **333 escrituras/s** en `POST /api/telemetry`, 5 veces la carga actual (2.000 sensores ≈ 67/s).

**Carga medida y SLO que falla.** El veredicto se apoya en que la API **ya incumple los SLO a 67 escrituras/s**, la carga de los 2.000 sensores actuales:

| Ensayo | Carga | Resultado | SLO (< 1 % errores, p95 < 300 ms) |
|---|---|---|---|
| TP4 `load`, después de optimizar ([#13](../tp-k8s/README.md#6-veredicto-go--no-go)) | Objetivo 67 req/s, 2 réplicas fijas | 61,94 req/s logradas, **59,04 % de errores**, **p95 de 17,5 s**, 1.519 iteraciones descartadas | Fallan los dos |
| TP4 `stress` | 67 → 450 req/s | 128 req/s logradas, 75,91 % de errores; el quiebre aparece en el tramo inicial de 67 req/s | Fallan los dos |
| TP final, HPA ([leyenda](evidencias/reportes/hpa/leyenda.md)) | Objetivo 100 it/s, HPA 2 → 6 réplicas | 93,47 req/s, **8,67 % de errores**, **p95 de 14,47 s**, 739 descartadas | Fallan los dos |

Ni con el HPA al máximo (6 réplicas) la API cumple a 93 req/s, que es menos de un tercio de lo que pediría la ampliación. No hay ninguna medición a 333 escrituras/s porque el sistema se rompe mucho antes.

**El canary no cambia este veredicto:** la `1.1.0` es un cambio del frontend, y el cuello de botella es la escritura en la API y la base.

**Qué haría falta para revisarlo:** perfilar la ruta de escritura (consultas, pool de conexiones, gunicorn), escalar la base, probar escrituras por lotes desde los sensores y repetir `load` con los mismos scripts y SLOs a 67, 167 y 333 req/s.

**Una aclaración para el directorio.** El contexto de la consigna da por hecho que los 2.000 sensores ya operan. Nuestras mediciones en Minikube dicen que, con este despliegue, ni esa carga cumple los SLO. Lo informamos tal cual en lugar de suavizarlo.

## 7. Aprendizaje: problemas, resoluciones y pendientes

### Problemas y resoluciones

| Problema | Causa | Resolución |
|---|---|---|
| Al 50 % sin cookie, el panel cargaba JS/CSS de las dos versiones y algunos daban 404 | Next.js nombra los recursos con hash y cada request se sortea por separado (la advertencia de la Actividad 1) | Afinidad por cookie en los dos Ingress del front y la API en un Ingress propio. Medido: 20/20 cargas mezcladas sin cookie, 0/20 con cookie |
| Con peso 0, un navegador que ya estaba en la `1.1.0` la seguía viendo | La afinidad del canary es *sticky* por defecto | El rollback baja también el canary a 0 réplicas; el tiempo de rollback se mide hasta ese paso |
| 1 de 100 requests falló al promover | El front del TP4 no tenía `preStop`: Next.js cerraba antes de que NGINX lo sacara | `preStop: sleep 5` en los dos Deployments. Resultado: 0 de 963 |
| `kubectl apply` no podía convertir `front` en `front-stable` | `spec.selector` es inmutable | `deploy.sh` borra el Deployment del TP4 antes de crear los nuevos |
| El webhook rechazaba dos Ingress no-canary con `api.terrasense.local` | El Ingress del TP4 tenía la API | `deploy.sh` borra el Ingress viejo antes de aplicar `terrasense-api` |
| `deploy.sh` en un Minikube limpio levantaba solo la `1.1.0` | Los YAML quedan en el estado final del rollout, como pide el Anexo A.7 | `ESTADO=inicial` lleva los YAML al estado previo; al promover vuelven al versionado |
| Riesgo de etiquetar una imagen con una versión que no es la de su código, o de meter cambios sin commitear | El tag de Docker y el código podían divergir, y el build tomaba el working tree | La versión sale solo de `package.json`; el Dockerfile rechaza un build cuya versión no coincide, y `build-front.sh` construye desde una copia limpia del tag de Git |
| La gate de Horusec quedaba «verde» con 182 alertas | El workflow permite hallazgos y no tiene política de severidades | Revisión manual de las alertas y verificación de la clave efectiva en el clúster antes del GO (#25) |
| El build falló una vez descargando la tipografía | `next/font/google` baja la fuente durante el build | Reintentar; el build necesita salida a internet |
| `rollout undo` no sirve en un clúster recién creado | No hay historial de ReplicaSets | Para volver a la `1.0.0` en un clúster nuevo: `ESTADO=inicial bash tp-final/deploy.sh` |

Los problemas del TP4 (OOMKilled, liveness bajo saturación, `pool_pre_ping`, HPA sin métricas) están en [su sección de aprendizaje](../tp-k8s/README.md#7-aprendizaje).

### Pendientes y deuda técnica

- **Videos del cambio de peso y del reemplazo de un pod:** los está grabando Valentino.
- **Imágenes sin registry:** se construyen y cargan localmente (camino B del Anexo A.3). Publicarlas desde CI en GHCR garantizaría que la imagen desplegada es exactamente la que pasó la gate.
- **La gate de Horusec no bloquea:** falta una política de severidades en el workflow.
- **Los workflows de build y tests** solo corren en PRs hacia `development` y no forman parte de la gate del release ([ci/README.md](ci/README.md)).
- **Opcionales no hechos:** canary del backend, rollback con una versión rota a propósito y automatización del avance de etapas.
- **Ingress NGINX fue retirado en marzo de 2026.** La migración natural es la Gateway API, con pesos en los `backendRefs` de un `HTTPRoute`; `ingress2gateway` traduce estas mismas anotaciones de canary.
- **Capacidad de la API:** ver [§6.2](#62-10000-sensores-no-go).

### Quién hizo qué

| Bloque | Responsable | Issue |
|---|---|---|
| Imágenes versionadas, integración del informe y presentación | Valentín Giosso | #21, #24 |
| Canary, plan, bitácora y promoción | Valentino Garbagnoli | #22 |
| Medición del reparto, estrés A/B y video del HPA | Enzo Fernández | #23 |
| Gate de la candidata y mapa ISO | Ignacio Verdinelli | #25, #26 |

Cada responsable revisa las cifras y enlaces de su bloque antes de la entrega.
