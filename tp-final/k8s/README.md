# Canary del dashboard en Minikube

Responsable: Valentino (#22). Despliegue progresivo del frontend de TerraSense con NGINX Ingress: la versión estable `1.0.0` y la candidata `1.1.0` corren al mismo tiempo, y el Ingress decide qué porcentaje de visitas recibe cada una. El backend y PostgreSQL son los del TP4 y están compartidos.

- Plan de rollout (escrito antes de medir): [`../rollout/plan.md`](../rollout/plan.md)
- Bitácora de la ejecución: [`../rollout/bitacora.md`](../rollout/bitacora.md)
- Imágenes y marca de versión (#21): `tp-final/imagenes/README.md`
- Scripts de medición k6 (#23): `tp-final/k6/README.md`

```
terrasense.local ──► Ingress principal (terrasense-ingress) ──► Service front-stable ──► 2 pods 1.0.0   (100 − peso) %
                 └─► Ingress canary  (terrasense-ingress-canary,   ──► Service front-canary ──► 2 pods 1.1.0   peso %
                                      canary-weight: peso)
api.terrasense.local ──► Ingress de la API (terrasense-api) ──► Service back ──► pods back (HPA 2–6)
```

## Levantarlo desde un Minikube limpio

Requisitos: Docker, Minikube, curl, git y Node (lo usa `build-front.sh` para leer la versión de `package.json`). Hacen falta los tags `front-v1.0.0` y `front-v1.1.0` (`git fetch --tags`).

```bash
git clone https://github.com/EnzoFernandezz11/software-quality-0x43.git
cd software-quality-0x43
git fetch --tags
ESTADO=inicial bash tp-final/deploy.sh
```

El script hace todo en orden:
1. Arranca el perfil `terrasense` y habilita `ingress` y `metrics-server`.
2. Construye el back y las dos imágenes del front desde sus tags de Git y las carga en Minikube.
3. Levanta la DB, corre las migraciones y despliega la API, el HPA, `front-stable`, `front-canary` y los tres Ingress.
4. Actualiza `/etc/hosts` (pide sudo).
5. Verifica la API y cada versión del front forzándola con el header `X-Canary`.

Si las imágenes ya están cargadas, `SKIP_BUILD=1` saltea el build. Con `SKIP_HOSTS=1` no toca `/etc/hosts` y solo muestra el comando.

Si el perfil todavía tiene el despliegue del TP4, el script lo migra: borra el Deployment `front`, su Service y el Ingress viejo que incluía la API (ver «Problemas encontrados»).

**Probado** el 2026-11-18 en un perfil de Minikube nuevo (`MINIKUBE_PROFILE=tpfinal-limpio SKIP_HOSTS=1`), con `build-front.sh` de #27. Construyó `front-v1.0.0` (`8951703`) y `front-v1.1.0` (`acdca28`), y las cuatro verificaciones dieron OK (API `/health` y `/health/ready`, front `1.0.0` y `1.1.0`). Valentín repite la prueba como tercero sobre la revisión integrada (#24).

**Qué estado levanta.** Los YAML versionados describen el clúster **después** del rollout: `front-stable` con la `1.1.0`, `front-canary` con 0 réplicas y peso 0. Por eso hay dos modos:

| Comando | Qué queda corriendo | Para qué |
|---|---|---|
| `ESTADO=inicial bash tp-final/deploy.sh` | `front-stable` con `1.0.0` (2 pods), `front-canary` con `1.1.0` (2 pods) y peso 0 | Ver las dos versiones y recorrer el rollout con `rollout.sh` (camino recomendado para reproducir el TP) |
| `bash tp-final/deploy.sh` | Solo la `1.1.0`, tal como quedó al promover | Levantar el estado final sin recorrer el rollout |

`ESTADO=inicial` construye las dos imágenes y reescribe tres líneas de `tp-final/k8s/` (imagen y label de la estable, réplicas del canary y peso), porque el repo tiene que describir lo que corre en el clúster y `rollout.sh promover` lee las versiones de esos archivos. Al terminar el recorrido con `rollout.sh promover`, los YAML vuelven a ser idénticos a los versionados. Para descartar el cambio sin recorrerlo: `git restore tp-final/k8s`. `rollout.sh` agrega líneas a `tp-final/evidencias/reportes/rollout/eventos.txt`; si no se quiere conservar esa corrida, también `git restore` sobre ese archivo.

En los dos modos el canary queda **con peso 0**: nadie lo ve salvo con el header o la cookie.

## Operar el rollout

```bash
bash tp-final/rollout/rollout.sh estado         # peso (clúster y YAML), imágenes, pods y una muestra de 100 requests
bash tp-final/rollout/rollout.sh peso 10        # mueve el 10 % de las visitas a la 1.1.0
bash tp-final/rollout/rollout.sh muestra 200    # 200 requests sin cookies, contadas por X-App-Version
bash tp-final/rollout/rollout.sh rollback       # peso 0 y canary a 0 réplicas
bash tp-final/rollout/rollout.sh promover       # stable pasa a 1.1.0; canary a peso 0 y 0 réplicas
bash tp-final/rollout/rollout.sh replicas 2     # vuelve a levantar el canary (por ejemplo, tras un rollback)
```

Cada comando hace tres cosas:
- aplica el cambio al clúster;
- reescribe el YAML correspondiente, para que el repo describa el estado real (Anexo A.7);
- deja una línea con hora, peso, imágenes, pods listos y commit en `tp-final/evidencias/reportes/rollout/eventos.txt`.

Además, se niega a dar peso a un canary sin pods y a bajar las réplicas a 0 con peso mayor que 0, porque las dos cosas producirían 503.

Para ver una versión puntual:

```bash
curl -sI -H 'X-Canary: always' http://terrasense.local/dashboard | grep -i x-app-version   # 1.1.0
curl -sI -H 'X-Canary: never'  http://terrasense.local/dashboard | grep -i x-app-version   # 1.0.0
```

En el navegador, la cookie `canary=always` fuerza la candidata, pero solo si el navegador no está fijado a la estable: la cookie de afinidad `terrasense-front` tiene prioridad. Hay que borrar `terrasense-front` y crear `canary=always` en F12 → Application → Cookies, y después recargar. La consola no sirve, porque `terrasense-front` es `HttpOnly` y JavaScript no la puede borrar. Para que vuelva a sortear hay que abrir una ventana de incógnito nueva: borrar solo `canary` no alcanza, porque `terrasense-front` también fija la candidata.

## Qué hace cada archivo y por qué está así

### `base/`: lo que no cambia respecto del TP4

`00-namespace.yaml`, `01-configmap.yaml`, `10-db.yaml`, `20-migrate-job.yaml`, `30-back.yaml` y `60-hpa.yaml` son copias sin cambios de `tp-k8s/k8s/`.

La consigna pide `tp-final/k8s/base/` con namespace, configmaps, db y back. Se copiaron en vez de referenciarlos porque `kubectl apply -k` no permite cargar archivos fuera de la carpeta de la kustomization. Así `tp-final/` se despliega solo. El Secret no se versiona: `deploy.sh` lo crea desde `.env`, igual que en el TP4.

**`50-ingress-api.yaml` (nuevo).** Es la regla `api.terrasense.local → back:5000` que en el TP4 compartía Ingress con el front. Se separó porque el Ingress del front ahora lleva afinidad por cookie, y esa anotación se aplica a **todos** los upstreams del Ingress donde se declara. Si la API siguiera ahí, cada navegador quedaría pegado a un solo pod de `back`, el balanceo dejaría de repartir y el HPA ya no sería comparable con el TP4. La consigna lo advierte en el Anexo A.9.

### `stable/` y `canary/`: dos Deployments y dos Services

| Configuración | Qué hace | Por qué |
|---|---|---|
| `name: front-stable` / `front-canary` | Dos Deployments en lugar del `front` único del TP4 | Para que cada versión tenga sus propios pods y se pueda escalar o revertir por separado. |
| `track: stable` / `track: canary` en `selector` y en los pods | Distingue los pods de cada versión | Cada Service elige solo los pods de su track. Con el selector `app: front` del TP4, un único Service tomaría las dos versiones y el reparto dependería de cuántos pods hay, no del peso (nota técnica de A.5). |
| `version: "1.0.0"` / `"1.1.0"` en los pods | Etiqueta informativa | Se ve con `kubectl get pods -L track,version`, útil en capturas y videos. No forma parte del selector, así que puede cambiar al promover. |
| `image: terrasense-front:1.0.0` / `:1.1.0` | Tag explícito | La consigna no acepta `latest`. El tag sale del `package.json` de cada revisión (#21). |
| `imagePullPolicy: IfNotPresent` | Usa la imagen ya cargada en el nodo | Las imágenes son locales (`minikube image load`). Con `Always` intentaría bajarlas de Docker Hub y daría `ImagePullBackOff` (A.12). |
| `replicas: 2` en **ambos** | Misma capacidad para las dos versiones | NGINX reparte por porcentaje de requests sin mirar cuántos pods hay. Con 2 estables y 1 canary al 50 %, el pod canary recibiría el doble de carga y se saturaría primero por el diseño del experimento, no por la versión (nota de la Actividad 2). Se usan 2 y no 1 para que el reemplazo de un pod no deje a la versión sin servicio. |
| `resources` (50m–500m CPU, 128–256 Mi) y probes **idénticos** | Mismas condiciones | Requisito de la Actividad 2 para que el A/B sea comparable. Son los valores del front del TP4. |
| `containerPort: 3000` y Services en el puerto 3000 | El puerto real del dashboard | Nuestro front es Next.js en modo `standalone` y escucha en el 3000. La guía de la consigna usa 8080 porque supone una SPA servida con NGINX. |
| `readinessProbe` / `livenessProbe` en `/` | Igual que el TP4 | `/` redirige a `/dashboard` y el kubelet acepta los 3xx como éxito. El pod recibe tráfico solo cuando Next.js responde. |
| `strategy.rollingUpdate: maxUnavailable: 0, maxSurge: 1` | Al cambiar la imagen, primero arranca un pod nuevo y después se baja uno viejo | En la promoción la stable cambia de imagen. Así nunca hay menos de 2 pods listos. |
| `lifecycle.preStop: sleep 5` + `terminationGracePeriodSeconds: 30` | Al eliminar un pod, espera 5 s antes de que Next.js reciba el SIGTERM | Kubernetes saca el pod de los endpoints y NGINX se entera unos segundos después. Sin esta espera, NGINX le sigue mandando requests a un pod que ya cerró. Medido: sin `preStop` se perdió 1 de 100 requests al promover, y con `preStop` hubo 0 errores en 963. Es lo mismo que ya tenía el back del TP4. También importa para el video de reemplazo de un pod. |
| `type: ClusterIP` en los Services | Solo accesibles dentro del clúster | Desde afuera se entra por el Ingress, que es el que reparte. |

### `ingress.yaml`: Ingress principal

| Configuración | Qué hace | Por qué |
|---|---|---|
| `host: terrasense.local`, `path: /`, `pathType: Prefix` → `front-stable:3000` | Toda visita al panel va a la estable, salvo la parte que desvía el canary | Es la regla base. El canary se engancha a ella. |
| `ingressClassName: nginx` | Lo procesa el controller de `minikube addons enable ingress` | Hay un único Ingress Controller y lee los dos Ingress del front. |
| `affinity: "cookie"` | La primera respuesta deja una cookie y las siguientes requests del mismo navegador van al mismo pod | Un panel no es una sola request. Next.js pide 9 JS/CSS con hash en el nombre, y 2 de ellos solo existen en la 1.1.0. Sin la cookie, el HTML de una versión puede pedirle su CSS a un pod de la otra y recibir 404. Medido al 50 %: 20 de 20 cargas mezclaron versiones sin cookie, y 0 de 20 con cookie. |
| `session-cookie-name: "terrasense-front"` | Nombre de la cookie | Para reconocerla y borrarla al probar en el navegador. |
| `session-cookie-max-age: "3600"` | La cookie dura 1 h | Un productor no cambia de versión mientras usa el panel. Es también el tiempo máximo que alguien puede quedar fijado al canary después de bajar el peso (ver plan). |
| `proxy-body-size: "1m"` | Límite del cuerpo de las requests | Viene del TP4. Se configura en el principal porque el canary lo ignora (A.2). |

### `canary/ingress-canary.yaml`: Ingress canary

| Configuración | Qué hace | Por qué |
|---|---|---|
| `canary: "true"` | El controller no lo trata como una regla nueva sino como backend alternativo de la principal | Sin esta anotación, dos Ingress con el mismo host y path serían una regla duplicada y el webhook la rechazaría. |
| Mismo `host`, `path` y `pathType` que el principal | Condición para que se enganche | Si difieren, el canary no se aplica y no da ningún error visible (A.12). |
| `canary-weight: "0"` | Porcentaje de visitas que van a `front-canary` | Arranca en 0: desplegado pero invisible. Lo mueve `rollout.sh peso`, que también actualiza este archivo. |
| `canary-by-header: "X-Canary"` | Con `X-Canary: always` la request va siempre al canary, con `never` nunca, con cualquier otro valor decide el peso | Sirve para la etapa 0 (probar la 1.1.0 sin exponerla), para el estrés del canary aislado y para que `deploy.sh` verifique cada versión. Precedencia: header → cookie → peso. |
| `canary-by-cookie: "canary"` | Lo mismo desde el navegador con la cookie `canary=always` | Para que QA navegue el panel nuevo antes de abrirlo. Es un opcional de la consigna que no cuesta nada. |
| `affinity` + `session-cookie-*` | La misma afinidad que el principal | Es una de las pocas anotaciones que el canary **no** hereda del principal (A.2). Por defecto el canary es *sticky*: quien cayó en la 1.1.0 se queda en la 1.1.0. |

### `../deploy.sh` y `../rollout/`

- **`deploy.sh`.** Es el `tp-k8s/deploy.sh` del TP4 adaptado:
  - las versiones del front salen de las imágenes declaradas en los YAML;
  - construye cada una con `build-front.sh` desde su tag;
  - carga las imágenes con `minikube -p <perfil> image load`, porque `build-front.sh --load` usaría el perfil activo, que puede ser otro;
  - migra el despliegue del TP4;
  - aplica el Ingress canary **después** del principal;
  - verifica cada versión con el header.
- **`rollout/rollout.sh`.** Opera las etapas como se explicó arriba. Promover sigue el Anexo A.7: primero la stable pasa a la imagen nueva (peso 100 no es promoción), después el peso baja a 0 y recién al final el canary queda en 0 réplicas.
- **`rollout/reemplazo-pod.sh`.** Elimina un pod del front con tráfico continuo y cuenta las respuestas. Es la prueba del video 2.
- **`rollout/verificar-afinidad.sh`.** Es la prueba previa que justifica la afinidad y el procedimiento de rollback. Su salida está en `tp-final/evidencias/reportes/rollout/verificacion-afinidad.txt`.

## Videos para la presentación (máx. 3 min cada uno)

Grabar con la terminal y el navegador lado a lado, fuente grande y `date` visible antes de cada paso (Anexo C). Guardar en `tp-final/evidencias/videos/`, o enlazar desde el README si pesan más de 100 MB.

**1. Cambio de peso.**
- Izquierda: `bash tp-final/rollout/rollout.sh peso 10`, después `rollout.sh muestra 100`, después `rollout.sh peso 50` y otra vez `muestra 100`.
- Derecha: una ventana de incógnito nueva por visita a `http://terrasense.local/dashboard`, donde se ve aparecer el banner verde de la 1.1.0 cada vez más seguido.
- Leyenda: «el porcentaje observado sigue al configurado; cada navegador queda en una sola versión».

**2. Reemplazo de un pod.**
- Arriba: `kubectl -n terrasense get pods -l app=front -L track,version -w`.
- Abajo: `bash tp-final/rollout/reemplazo-pod.sh`. Manda una request cada 0,1 s, elimina un pod de `front-stable`, espera a que el reemplazo esté listo y cuenta las respuestas por código y versión. Prueba del 2026-11-18: 188 de 188 con 200, reemplazo en 13 s ([`reemplazo-pod-stable.txt`](../evidencias/reportes/rollout/reemplazo-pod-stable.txt)).
- Leyenda: «el Deployment crea un pod nuevo, que entra al Service recién cuando su readiness pasa; con 2 réplicas y `preStop`, la muestra no registra errores».
- Ojo: el pod eliminado puede aparecer unos segundos como `Error` antes de desaparecer. Es el código de salida de Next.js al recibir la señal de apagado, no una falla: la muestra no registra errores.

## Problemas encontrados

| Problema | Causa | Resolución |
|---|---|---|
| Con el canary al 50 % y sin cookie, el panel carga JS/CSS de las dos versiones y algunos dan 404 | Next.js nombra los recursos con hash y cada request se sortea por separado | Afinidad por cookie en los dos Ingress del front. La API va en un Ingress propio para no quedar afectada |
| Con peso 0, un navegador que ya estaba en la 1.1.0 la sigue viendo | La afinidad del canary es *sticky* por defecto | El rollback incluye bajar `front-canary` a 0 réplicas: medido, ese navegador vuelve a la 1.0.0 con 200 |
| 1 de 100 requests falló al promover | El front del TP4 no tenía `preStop`: Next.js cerraba antes de que NGINX lo sacara de los endpoints | `preStop: sleep 5` en ambos Deployments. Resultado: 0 de 963 |
| `kubectl apply` no puede convertir `front` en `front-stable` | `spec.selector` es inmutable y además cambia el nombre | `deploy.sh` borra el `front` del TP4 antes de crear los nuevos |
| El webhook rechaza dos Ingress no-canary con `api.terrasense.local` | El Ingress del TP4 ya tenía la API | `deploy.sh` borra el Ingress viejo si incluye la API antes de aplicar `terrasense-api` |
| El build de la `1.0.0` falló una vez descargando la fuente Inter | `next/font/google` baja la tipografía durante el build, y un corte de red lo hace fallar | Reintentar. El build necesita salida a internet |
