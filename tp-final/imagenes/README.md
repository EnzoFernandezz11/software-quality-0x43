# Imágenes del frontend (estable y candidata)

Responsable: Valentín (#21). Las usan el despliegue canary (#22), la medición con k6 (#23) y la gate de calidad (#25).

| Imagen | Revisión de Git | Qué cambia |
|---|---|---|
| `terrasense-front:1.0.0` | tag `front-v1.0.0` | Panel del TP4 con la marca de versión. Es la versión estable. |
| `terrasense-front:1.1.0` | tag `front-v1.1.0` | Banner fijo «★ Nuevo panel · versión 1.1.0 ★» y fondo verde chillón. Es la candidata. |

El SHA, el Image ID y los labels de cada build quedan en [`../evidencias/reportes/imagenes/registro-<versión>.txt`](../evidencias/reportes/imagenes/).

## Cómo se identifica la versión

La versión sale de `frontend/dashboard/package.json`. La revisión de Git define la versión y la imagen no puede quedar etiquetada con otra:

- `next.config.ts` lee `package.json` y expone `NEXT_PUBLIC_APP_VERSION`.
- **Header `X-App-Version`** en **todas** las respuestas: el documento, los recursos JS y CSS, y el redirect de `/` a `/dashboard`. k6 cuenta las visitas con el header del documento. En los recursos permite detectar si uno llegó desde la otra versión (ver «Riesgo conocido» más abajo).
- **`<meta name="app-version" content="…">`** en el HTML, para `k6/browser`.
- **Etiqueta `vX.Y.Z`** en el encabezado del panel (`data-app-version`), para que se vea en todas las capturas.
- El encabezado `h1.dashboard-title` existe en ambas versiones: es el selector que usa `tp-final/k6/navegacion.js` (#23).

`docker/nextjs.Dockerfile` hace dos controles más:
- Si se pasa `--build-arg APP_VERSION`, el build falla cuando no coincide con `package.json`.
- Agrega los labels OCI `org.opencontainers.image.version` y `org.opencontainers.image.revision`, con el SHA de origen.

## Construcción

Se eligió el **camino B** de la consigna (Anexo A.3): construir con el Docker del host y cargar la imagen en Minikube. Es el mismo camino que el TP4 (`tp-k8s/deploy.sh`), porque `minikube image build` no pasa build-args con el runtime containerd y `NEXT_PUBLIC_API_URL` se fija en el bundle durante el build.

```bash
# Desde la raíz del repositorio, con Minikube levantado
tp-final/imagenes/build-front.sh front-v1.0.0 --load
tp-final/imagenes/build-front.sh front-v1.1.0 --load
minikube image ls | grep terrasense-front
```

`build-front.sh <ref>` hace lo siguiente:

1. Resuelve `<ref>` a un SHA y lee la versión de `package.json` **en esa revisión**.
2. Crea un `git worktree` limpio de ese SHA. Lo que no está commiteado no entra en la imagen.
3. Construye `terrasense-front:<versión>` con:
   - `NEXT_PUBLIC_API_URL=http://api.terrasense.local/api` (se cambia con `API_URL=…`);
   - `APP_VERSION` y `GIT_SHA`.
4. Con `--load`, carga la imagen en Minikube.
5. Guarda la salida del build y el registro (SHA, tag, Image ID, labels) en `tp-final/evidencias/reportes/imagenes/`.

Si el SHA no está en ninguna rama remota, avisa: la gate (#25) solo vale para commits publicados con checks.

Las imágenes son locales y no tienen digest de registry: el identificador que se registra es el **Image ID**. En los Deployments se usa `imagePullPolicy: IfNotPresent` (o `Never`), nunca `Always`.

## Verificación

```bash
# Contra la imagen, con docker run en un puerto libre
tp-final/imagenes/verificar-front.sh 1.0.0
tp-final/imagenes/verificar-front.sh 1.1.0

# Contra el clúster (con el canary activo responde cualquiera de las dos versiones)
curl -sI http://terrasense.local/dashboard | grep -i x-app-version
```

`verificar-front.sh` comprueba lo siguiente y guarda el resultado en `tp-final/evidencias/reportes/imagenes/verificacion-<versión>.txt`:
- el header del documento y de un JS y un CSS;
- el `meta`;
- el selector del panel.

Si hay Chromium, guarda además una captura en `tp-final/evidencias/capturas/panel-<versión>.png`.

Con `docker run` el panel no tiene API, así que muestra «Failed to fetch». Esas capturas solo demuestran la diferencia visual entre versiones. Las capturas con datos se toman en el clúster.

## Riesgo conocido para el canary

Next genera nombres con hash para sus recursos (`/_next/static/chunks/*.js|css`). En las dos imágenes, `/dashboard` pide 9 recursos:
- 7 tienen el mismo nombre en ambas versiones;
- 2 son propios de la `1.1.0`: un JS y el CSS.

Lo comprobamos levantando ambas imágenes con `docker run`: si se le piden esos 2 recursos a un pod `1.0.0`, responde **404** `text/plain`.

Con reparto por peso, cada request se sortea por separado. Si el HTML de la `1.1.0` termina pidiendo su CSS a un pod estable, el panel queda sin estilos o roto. Es el caso que describe la consigna (Actividad 1, «una página no es una sola request»). Lo resuelve el despliegue (#22) con afinidad de sesión (Anexo A.9). El header `X-App-Version` de cada recurso permite verificarlo.
