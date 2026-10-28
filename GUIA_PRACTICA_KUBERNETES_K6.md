# Práctica paso a paso: Kubernetes y k6

Esta guía permite levantar la aplicación en Minikube, comprobar sus Pods y medir
la API Flask con k6. La rama de trabajo es **`feat/pruebas-carga`**, creada a
partir de `feat/minikube`. Incluye `run_kubernetes.sh`, los manifiestos de
`kubernetes/` y el script `kubernetes/load-test.js`.

Los comandos están escritos para **Git Bash en Windows**. Se ejecutan desde la
raíz de `software-quality-0x43`, donde están `README.md` y
`run_kubernetes.sh`. La carpeta `calidad/SoftwareQuality` es otro proyecto.

## 1. Abrir la rama correcta

En una computadora donde todavía no está el repo:

```bash
git clone https://github.com/EnzoFernandezz11/software-quality-0x43.git
cd software-quality-0x43
git switch --track origin/feat/pruebas-carga
```

Si ya tenés el repo clonado:

```bash
cd /ruta/a/software-quality-0x43
git fetch origin
git switch feat/pruebas-carga
git pull --ff-only
```

Si la rama aún no existe localmente, reemplazá `git switch feat/pruebas-carga`
por `git switch --track origin/feat/pruebas-carga`. Comprobá dónde estás:

```bash
git branch --show-current
ls run_kubernetes.sh kubernetes/load-test.js
```

El primer comando debe mostrar `feat/pruebas-carga` y el segundo, ambos archivos.

## 2. Verificar las herramientas y la configuración

```bash
docker info
minikube version
k6 version
```

`docker info` tiene que conectar con Docker Desktop; ver solamente la versión
del cliente Docker no alcanza. El proyecto necesita espacio para descargar
imágenes y construir Flask y Next.js.

Si no existe `.env`, `run_kubernetes.sh` lo copia de `.env.example`. Antes de
arrancar, revisá en `.env` los valores `POSTGRES_DB`, `POSTGRES_USER`,
`POSTGRES_PASSWORD` y `FLASK_SECRET_KEY`. Son valores de desarrollo. **No
agregues `.env` al commit.**

## 3. Levantar la aplicación

En la primera terminal:

```bash
bash run_kubernetes.sh
```

El script inicia el perfil `soft-eng` de Minikube, construye las imágenes,
despliega PostgreSQL, Flask, Next.js y pgAdmin, y espera a que estén listos.
Después abre los puertos locales `3000` (dashboard), `5000` (API) y `5050`
(pgAdmin). El primer arranque puede tardar varios minutos.

Esperá hasta que los servicios estén listos y aparezca `Forwarding from`.
**Dejá abierta esta terminal**: si la cerrás, se cierran los accesos locales.

## 4. Comprobar el despliegue y la API

Abrí una segunda terminal en la raíz del mismo repo:

```bash
minikube -p soft-eng kubectl -- -n soft-eng get deployments,pods,services
curl -f 'http://localhost:5000/api/dashboard/history?limit=1'
```

Al inicio debe haber cuatro Pods de aplicación listos: `postgres`,
`flask-backend`, `frontend-dashboard` y `pgadmin`. La consulta HTTP debe
responder sin error; un historial vacío es válido si aún no hay mediciones.

Si falla, revisá el estado y los mensajes antes de seguir:

```bash
minikube -p soft-eng kubectl -- -n soft-eng get pods
minikube -p soft-eng kubectl -- -n soft-eng get events --sort-by=.metadata.creationTimestamp
minikube -p soft-eng kubectl -- -n soft-eng logs deployment/flask-backend
```

## 5. Medir la API con k6

Con la primera terminal todavía abierta, ejecutá en la segunda:

```bash
k6 run kubernetes/load-test.js
```

La prueba dura dos minutos: sube a 5 usuarios virtuales, luego a 20 y vuelve
a 0. Cada usuario solicita `GET /api/dashboard/history?limit=1` y espera un
segundo antes de repetir. Un usuario virtual no equivale a un Pod.

Al finalizar, registrá:

| Dato de k6 | Qué observar |
| --- | --- |
| `http_req_duration` (p95) | Tiempo máximo del 95 % de las solicitudes observadas. |
| `http_req_failed` | Proporción de solicitudes fallidas. |
| `http_reqs` | Total de solicitudes y tasa aproximada. |
| `checks` | Porcentaje de respuestas HTTP 200. |

Una mayor latencia o más errores bajo carga indica degradación; para conocer
la causa hay que mirar también los Pods, logs y recursos. k6 **no crea Pods ni
configura escalado automático**.

## 6. Mostrar diez Pods si la consigna lo pide

El despliegue inicial tiene cuatro Pods. Para mostrar diez sin modificar Flask,
creá seis Pods livianos de demostración:

```bash
minikube -p soft-eng kubectl -- -n soft-eng create deployment pods-demo --image=busybox:1.36 -- sleep 3600
minikube -p soft-eng kubectl -- -n soft-eng scale deployment/pods-demo --replicas=6
minikube -p soft-eng kubectl -- -n soft-eng rollout status deployment/pods-demo
minikube -p soft-eng kubectl -- -n soft-eng get pods -o wide
```

Comprobá que los seis `pods-demo` y los cuatro Pods de la app estén listos.
Esto demuestra réplicas y el estado que mantiene Kubernetes; **no demuestra
que la aplicación escale automáticamente**. El despliegue de demostración se
crea en el clúster local y no modifica los archivos del repo. Flask mantiene
una sola réplica porque usa caché en memoria y ejecuta migraciones al arrancar.

Si la consigna exige específicamente un *HorizontalPodAutoscaler* (HPA), hace
falta configurar métricas y elegir un componente apto para varias réplicas; los
comandos anteriores no sustituyen esa configuración.

## 7. Guardar evidencia y terminar

Para la entrega, conservá la salida o una captura de `get pods` con los diez
Pods listos y el resumen final de k6 con sus métricas. Anotá también la rama
utilizada y qué endpoint se probó.

Cuando termines la demostración, quitá únicamente sus seis Pods:

```bash
minikube -p soft-eng kubectl -- -n soft-eng delete deployment pods-demo
```

En la primera terminal, `Ctrl+C` cierra los `port-forward`. Para detener el
clúster conservando su base de datos:

```bash
minikube stop -p soft-eng
```

No uses `minikube delete` para apagar normalmente: elimina el clúster y sus
datos locales.
