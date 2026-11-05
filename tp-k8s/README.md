# TP4: Confiabilidad y resiliencia en Kubernetes (HPA + k6)

**Gestión de la Calidad del Software** · UNC - FCEFyN · 2026

Somos el equipo SRE de **TerraSense S.A.** El objetivo es migrar la plataforma IoT (ESP32 → API Flask → PostgreSQL, más el dashboard Next.js) desde Docker Compose a **Minikube**, sumarle autoescalado con HPA y someterla a pruebas de carga y de fallas. Con esa evidencia se da un veredicto **go / no-go** sobre si soporta **2.000 sensores reportando cada 30 s (≈ 67 req/s de escritura)**.

Seguimiento: issue general [#15](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/15) con las sub-issues #11 a #14.

```text
tp-k8s/
|-- deploy.sh        # Levanta todo en un Minikube limpio
|-- k8s/             # Manifiestos (namespace, config, db, back, front, ingress, hpa…)
|   |-- examples/    # Plantillas que NO se aplican (Secret)
|   +-- monitoring/  # Prometheus + Grafana para k6 (opcional)
|-- k6/              # Scripts de pruebas de carga y fallas
|-- evidencias/      # Capturas de pantalla y salidas de k6 / kubectl
+-- README.md        # Este informe
```

---

## Arquitectura

```text
                 ┌──────── Minikube · namespace "terrasense" ─────────────────────────┐
                 │                                          HPA (#12)                 │
                 │                                             │ escala               │
 ESP32 / k6 ─────┼─► Ingress ── api.terrasense.local ──► Service back:5000 ─► Pods back ──SQL──► Service db:5432
 (POST /api/...) │   NGINX                                                            │          │
                 │     │                                                              │   StatefulSet db + PVC
 Navegador ──────┼─────┴───── terrasense.local ───────► Service front:3000 ─► Pod front │          ▲
 (HTTP)          │                                                                    │   Job db-migrate
                 └────────────────────────────────────────────────────────────────────┘
```

El dashboard es una **SPA**: sus componentes son `'use client'` y hacen `fetch` desde el **navegador del usuario**, que está fuera del clúster. Por eso no llama al back por el DNS interno de Kubernetes, sino a `http://api.terrasense.local/api` a través del Ingress. Next.js deja esa URL fija en el bundle al compilar, así que `deploy.sh` construye la imagen con `--build-arg NEXT_PUBLIC_API_URL=http://api.terrasense.local/api`.

| Manifiesto | Recursos | Notas |
|---|---|---|
| `00-namespace.yaml` | Namespace `terrasense` | Namespace dedicado al proyecto |
| `01-configmap.yaml` | ConfigMap `terrasense-config` | Host, puerto y nombre de la DB, modo de Flask, `GUNICORN_CMD_ARGS` |
| `examples/secret.example.yaml` | Secret `terrasense-secrets` (plantilla) | `deploy.sh` lo crea desde `.env`, así no se commitean credenciales |
| `10-db.yaml` | StatefulSet + Service `db` | PostgreSQL 16 con `volumeClaimTemplates` (PVC de 1 Gi) |
| `20-migrate-job.yaml` | Job `db-migrate` | `flask db upgrade` una vez por despliegue |
| `30-back.yaml` | Deployment + Service `back` (ClusterIP) | gunicorn, readiness/liveness, requests/limits, preStop |
| `40-front.yaml` | Deployment + Service `front` (ClusterIP) | Next.js standalone |
| `50-ingress.yaml` | Ingress `terrasense-ingress` | Plantilla del Anexo C |

---

## 1. Instrucciones de despliegue

### Requisitos

- Linux con **Docker** y **Minikube** (probado con Minikube v1.39 y driver docker). `kubectl` no hace falta porque se usa `minikube kubectl --`.
- **4 CPU y 6 GB de RAM libres** para el nodo, y unos 20 GB de disco para Docker.
- **k6** ≥ 1.0 para las pruebas. `k6/browser` necesita además Chromium o Google Chrome.

### Levantar todo

```bash
git clone git@github.com:EnzoFernandezz11/software-quality-0x43.git
cd software-quality-0x43
bash tp-k8s/deploy.sh
```

El script es idempotente y se puede volver a correr. Hace lo siguiente:

1. Verifica las herramientas. Si no existe `.env`, lo crea desde `.env.example`.
2. Crea el perfil de Minikube `terrasense` (4 CPU / 6 GB) y habilita los addons `ingress` y `metrics-server`.
3. Construye las imágenes `terrasense-back:local` y `terrasense-front:local` con el Docker del host y las carga en Minikube.
4. Crea el namespace, el ConfigMap y el Secret (este último desde `POSTGRES_USER`, `POSTGRES_PASSWORD` y `FLASK_SECRET_KEY` de `.env`).
5. Levanta PostgreSQL, corre las migraciones y después la API, el dashboard y el Ingress, esperando que cada paso quede listo. Si algo falla, imprime `describe`, logs y eventos.
6. Agrega `<minikube ip> api.terrasense.local terrasense.local` a `/etc/hosts` (pide `sudo` y deja una copia en `/etc/hosts.bak`).
7. Verifica `/health`, `/health/ready` y el dashboard **a través del Ingress**.

Variables opcionales:

| Variable | Default | Uso |
|---|---|---|
| `MINIKUBE_PROFILE` | `terrasense` | Nombre del perfil |
| `MINIKUBE_CPUS` / `MINIKUBE_MEMORY` | `4` / `6144` | Recursos del nodo; solo aplican al crear el perfil |
| `SKIP_BUILD=1` | — | Reusa las imágenes ya cargadas (despliegue rápido) |
| `SKIP_HOSTS=1` | — | No toca `/etc/hosts`; muestra el comando para hacerlo a mano |

### Verificar

```bash
alias k='minikube -p terrasense kubectl -- --context=terrasense -n terrasense'
k get pods,svc,ingress,pvc
k top pods                                   # metrics-server funcionando

curl http://api.terrasense.local/health        # {"status":"ok"}
curl http://api.terrasense.local/health/ready  # {"database":"up","status":"ok"}
curl -X POST http://api.terrasense.local/api/telemetry \
  -H 'Content-Type: application/json' \
  -d '{"sensor_id":"esp32-0001","raw_temperature":23.5,"motion_detected":true}'   # 201
```

En el navegador: dashboard en <http://terrasense.local> y Swagger en <http://api.terrasense.local/apidocs/>.

### Uso diario

```bash
minikube stop -p terrasense      # apaga el nodo y conserva la base (PVC)
minikube start -p terrasense     # lo vuelve a levantar; no hace falta redesplegar
bash tp-k8s/deploy.sh            # tras cambiar código: reconstruye y reinicia back/front
minikube delete -p terrasense    # borra TODO, incluidos los datos
```

Si cambia la IP del nodo (por ejemplo, después de `minikube delete`), volvé a correr `deploy.sh` para actualizar `/etc/hosts`.

### Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `ErrImageNeverPull` | La imagen no está en el nodo: correr `deploy.sh` sin `SKIP_BUILD` |
| `404` o `Connection refused` en `*.terrasense.local` | Falta el addon ingress, el Ingress no se aplicó o `/etc/hosts` apunta a otra IP (`minikube -p terrasense ip`) |
| `k top pods` dice `metrics not available yet` | metrics-server tarda alrededor de 1 minuto en juntar la primera muestra |
| Pod `back` en `Init:0/1` | Espera a que la DB acepte conexiones (`k logs deploy/back -c wait-db`) |

---

## 2. Decisiones de diseño (Actividad 1)

- **gunicorn en lugar del servidor de desarrollo de Flask.** `python main.py` levanta Werkzeug, que no está pensado para producción y daría mediciones poco representativas. En Kubernetes la API corre con `gunicorn main:app` y su configuración (workers, threads, timeouts) sale de `GUNICORN_CMD_ARGS` en el ConfigMap, así que se puede ajustar sin reconstruir la imagen. Docker Compose sigue usando el servidor de desarrollo.
- **Probes separadas por responsabilidad.**
  - `livenessProbe` → `GET /health`: no toca la base. Si PostgreSQL se pone lento, Kubernetes no reinicia todos los backs en cascada.
  - `readinessProbe` → `GET /health/ready`: hace `SELECT 1`. Si la DB no responde, el pod sale del balanceo pero no se reinicia.
  - Antes se usaba `/api/dashboard/history`, que hace un `count(*)` de toda la tabla cada 5 s por pod.
- **requests/limits en todos los contenedores.** Son indispensables para el HPA, que calcula el % de CPU sobre `requests.cpu`. El back arranca con `requests 100m/192Mi` y `limits 500m/384Mi` (perfil "nominal"); en reposo, con 2 workers de gunicorn, consume unos 138 Mi. #12 ajusta estos valores para el experimento E2.
- **ConfigMap vs Secret.** Lo no sensible va en el ConfigMap versionado. Usuario, contraseña y secret key van en un Secret que se genera desde `.env`, que no se commitea; en el repo queda solo una plantilla en `examples/`.
- **PostgreSQL como StatefulSet** (Anexo de la consigna), con `PGDATA` en un subdirectorio del volumen. Verificado: los datos sobreviven a `kubectl delete pod db-0`.
- **Reconexión a la DB** con `pool_pre_ping`. Mientras PostgreSQL se reinicia, los backs pasan a *not ready* y el Ingress responde 503. Cuando vuelve, no quedan conexiones muertas en el pool (ver Aprendizaje).
- **Cortes de servicio más suaves.** El back usa `RollingUpdate` con `maxUnavailable: 0` y un `preStop: sleep 5`, para que el Ingress saque el pod de sus endpoints antes de que gunicorn deje de aceptar conexiones. Esto incide directamente en el experimento E1.
- **Imagen del back más chica y sin root.** El Dockerfile copiaba todo el monorepo (front, firmware, reportes); ahora copia solo `backend/flask/final_project` y corre con un usuario sin privilegios.

---

## 3. Evidencia visual

**Despliegue (A1):** el dashboard servido por el Ingress (`http://terrasense.local`) muestra datos reales leídos desde la API (`http://api.terrasense.local`).

![Dashboard vía Ingress](evidencias/a1-dashboard-via-ingress.png)

Para A3, las curvas de carga, errores y latencia están separadas por corrida:

| Perfil | Antes de optimizar | Después de optimizar |
|---|---|---|
| Load: solicitudes/s y errores | [Captura](evidencias/a3/antes/load-rps-errores.png) | [Captura](evidencias/a3/despues/load-rps-errores.png) |
| Load: p95 por estado HTTP | [Captura](evidencias/a3/antes/load-p95.png) | [Captura](evidencias/a3/despues/load-p95.png) |
| Stress: solicitudes/s y errores | [Captura](evidencias/a3/antes/stress-rps-errores.png) | [Captura](evidencias/a3/despues/stress-rps-errores.png) |
| Stress: p95 por estado HTTP | [Captura](evidencias/a3/antes/stress-p95.png) | [Captura](evidencias/a3/despues/stress-p95.png) |

Las capturas son del dashboard Grafana existente. Las series exportadas de
Prometheus y los resúmenes de k6 permanecen en
[`evidencias/a3/antes/`](evidencias/a3/antes/) y
[`evidencias/a3/despues/`](evidencias/a3/despues/). En este dashboard,
Grafana separa tanto el p95 como el porcentaje de fallas por estado HTTP:
una línea de fallas al 100 % corresponde a respuestas 5xx de ese estado,
**no** al porcentaje total de la corrida. Para decidir los SLO se usan el
p95 y el porcentaje agregados del resumen k6.

> _Pendiente: #12 y #14._

- [ ] `kubectl get hpa` escalando los pods bajo carga (#12)
- [ ] Evidencia del colapso: `OOMKilled` o `CrashLoopBackOff` (#12)
- [ ] `falla-ux.png` generada por `k6/browser` durante la caída de la API (#14)

---

## 4. Pruebas de carga (Actividad 3)

Se probaron los mismos scripts de `tp-k8s/k6/` contra el Ingress y con 50.000
lecturas de 2.000 sensores precargadas **antes de cada corrida**. El entorno
fue un Minikube aislado con 4 CPU y 6144 MiB; el backend mantuvo 2 réplicas
fijas y límites de 500m CPU / 384Mi por pod. No había HPA: el escalado de #12
todavía no integra este experimento. Hardware, versiones y procedimiento:
[`antes/entorno.md`](evidencias/a3/antes/entorno.md) y
[`despues/entorno.md`](evidencias/a3/despues/entorno.md).

Los SLO de la issue son **menos de 1 % de errores HTTP** y **p95 menor a
300 ms** para `POST /api/telemetry`. `load` intenta 67 req/s durante 5 min;
`stress` sube de 67 a 450 req/s durante 6 min. RPS es el promedio de
solicitudes completadas, no la tasa objetivo. En la columna de réplicas,
`2 / 0` significa dos configuradas y un mínimo observado de cero listas.

| Código | Perfil | RPS observado | p95 (ms) | p99 (ms) | Error HTTP | Descartadas | Réplicas / mín. listas | ¿SLO? |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Antes | Smoke | 0,72 | 1.991 | 2.072 | 0 % | 0 | 2 / 2 | No: p95 |
| Después | Smoke | 1,95 | 33 | 77 | 0 % | 0 | 2 / 2 | Sí |
| Antes | Load | 63,99 | 6.611 | 10.470 | 100 % | 903 | 2 / 0 | No |
| Después | Load | 61,94 | 17.507 | 23.098 | 59,04 % | 1.519 | 2 / 0 | No |
| Antes | Stress | 215,01 | 1.606 | 5.920 | 100 % | 3.320 | 2 / 0 | No |
| Después | Stress | 128,27 | 19.790 | 29.972 | 75,91 % | 32.684 | 2 / 0 | No |

El cambio en `find_recent_with_motion` y el índice de `created_at` hicieron
que `smoke` pasara de p95 1.991 ms a 33 ms. En `load` y `stress` hubo respuestas
201 después de optimizar, donde antes todas fallaban, pero **la latencia
agregada empeoró** porque quedaron solicitudes esperando durante intervalos
largos de saturación. En las corridas anteriores los pods llegaron a
`OOMKilled`; en las posteriores Kubernetes los reinició al fallar `liveness`
por tiempo de espera, con CPU cerca del límite de 500m y momentos sin ninguna
réplica lista. No se puede atribuir el resultado solo a la consulta SQL.

La primera corrida optimizada de `load` registró 22,61 % de errores, p95
10.775 ms y 659 iteraciones descartadas. El perfil Minikube quedó detenido
después y se perdieron sus series temporales de Prometheus. Se conserva su
resumen (`load-intento1-*`) y se repitió con el mismo seed, scripts y límites
para obtener las curvas de la tabla. Ambas corridas incumplieron los SLO.

---

## 5. Análisis de resiliencia (Actividad 4)

> _Pendiente: #12 (E2) y #14 (E1)._

---

## 6. Veredicto go / no-go

**NO-GO para 2.000 sensores cada 30 s con este despliegue.** La tasa nominal
exige ≈ 67 escrituras/s. Después de optimizar, `load` completó 61,94 req/s
de promedio, con 59,04 % de errores, p95 de 17,51 s y 1.519 iteraciones
descartadas; los umbrales eran < 1 % y < 300 ms. `smoke` sí cumplió, pero
solo prueba una carga de 2 VUs.

El **punto de quiebre ya está en el tramo inicial de 67 req/s**, antes de la
primera subida de `stress` a 120 req/s: la primera muestra de p95 para
respuestas 201 fue ≈ 3,89 s a los 15 s y la serie de errores 503 aparece a
los 45 s. La rampa terminó con 75,91 % de errores y 32.684 iteraciones
descartadas. Por eso estos datos no permiten fijar una capacidad estable por
encima de 67 req/s. Para cambiar el veredicto hacen falta nuevas mediciones
con los ajustes de recursos y HPA de #12, conservando los mismos scripts y
criterios de aceptación.

---

## 7. Aprendizaje

Complicaciones que fuimos encontrando y cómo las resolvimos.

| Problema | Solución |
|---|---|
| `minikube image build --build-opt build-arg=…` no le pasa el build-arg al build cuando el runtime del nodo es containerd (en la práctica anterior hubo que sacarlo), y el front necesita la URL del Ingress al compilar | Se construye con el Docker del host (`docker build --build-arg`) y se carga en el nodo con `minikube image load` |
| La readinessProbe anterior consultaba `/api/dashboard/history`, que hace un `count(*)` de la tabla entera | Endpoints `/health` (sin DB) y `/health/ready` (`SELECT 1`) |
| La imagen del back copiaba todo el monorepo | `COPY` solo de `backend/flask/final_project` |
| **Después de reiniciar el pod de PostgreSQL, la API devolvía HTTP 500** en los primeros requests (`psycopg2.OperationalError: server closed the connection unexpectedly`). El pool de SQLAlchemy reusaba conexiones que habían muerto con el pod. Medido: 2 de 30 POST fallaron | `SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}`: valida cada conexión antes de usarla y descarta las muertas. Repetido el experimento: 30 de 30 con 201 y 0 errores |

Prevenciones que aplicamos de entrada:

- `PGDATA` en un subdirectorio del volumen, porque `initdb` exige un directorio vacío y algunos provisioners crean `lost+found`.
- `deploy.sh` espera a que el `ingress-nginx-controller` esté listo antes de aplicar el Ingress; si no, el webhook de admisión puede rechazarlo.

---

## Herramientas adicionales

- `k6/seed-readings.sql`: carga lecturas sintéticas para que la tabla tenga un tamaño realista. Uso:
  ```bash
  k exec -i db-0 -- sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v rows=50000' < tp-k8s/k6/seed-readings.sql
  ```
- `k8s/monitoring/` + `k6/run-in-cluster.sh`: Prometheus y Grafana para ver las métricas de k6. Corre los perfiles del `load-test.js` de la práctica anterior como Jobs dentro del clúster; los scripts del TP los define #13.
