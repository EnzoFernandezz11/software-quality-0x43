# Iniciar la app con Kubernetes y Minikube

Esta configuración de desarrollo ejecuta los mismos cuatro servicios que
`docker/docker-compose.yml`: PostgreSQL, Flask, el dashboard Next.js y pgAdmin.
Kubernetes administra los contenedores; Minikube usa Docker para ejecutar el nodo
local. Se reutilizan los Dockerfiles existentes, sin publicar imágenes en un registry.

## Inicio automático

Con Docker y Minikube instalados, ejecutá desde la raíz del repo:

```bash
bash run_kubernetes.sh
```

El script crea `.env` si falta, inicia el clúster, construye las imágenes, despliega
los cuatro servicios y espera a que estén listos. En cada ejecución reconstruye
las imágenes y reinicia Flask y Next.js para tomar los cambios. Luego detiene
los servicios de Docker Compose de este repo, conservando sus datos, y abre
los puertos del dashboard (3000), Flask (5000) y pgAdmin (5050).

La consola muestra cada etapa y la salida de los builds. Mientras espera los
servicios, muestra los pods y los eventos de advertencia cada 5 segundos. Si un
servicio no arranca, imprime el detalle de sus pods y las últimas líneas de logs.
`python3 -m unittest discover -s kubernetes` ejecuta solamente las pruebas
simuladas del script; para iniciar la app usá `bash run_kubernetes.sh`.

Dejá la terminal abierta y entrá a http://localhost:3000 cuando aparezca
`Forwarding from`. Ctrl+C cierra los puertos; el clúster sigue activo. Para
apagarlo conservando la base, ejecutá `minikube stop -p soft-eng`.

Si un puerto está ocupado por otra app o un túnel se interrumpe, el script termina
con un error y cierra sus otros túneles. No instala herramientas ni libera espacio
en disco. Para revisar los pasos o ejecutarlos a mano, seguí las instrucciones siguientes.

## 1. Verificar las herramientas

```bash
minikube version
docker info
docker system df
df -h /
```

Instalá Docker y Minikube antes de continuar y asegurate de que ambos comandos
estén disponibles en tu `PATH`.
No hace falta instalar `kubectl` por separado: `minikube kubectl --` lo descarga
y usa una versión compatible con el clúster.

Para instalar Minikube, seguí la
[instalación oficial](https://minikube.sigs.k8s.io/docs/start/) correspondiente
a tu sistema operativo y arquitectura.
Si Docker falla por permisos en tu terminal habitual, revisá la
[configuración del driver Docker](https://minikube.sigs.k8s.io/docs/drivers/docker/).
Ejecutá Minikube con tu usuario, sin `sudo`.

**Espacio disponible:** revisá el espacio del almacenamiento de Docker antes de
construir las imágenes; puede estar en una partición distinta a la del repo. La
[guía oficial de Minikube](https://minikube.sigs.k8s.io/docs/start/) pide al menos
20 GB libres. `docker system df` permite ver el consumo; no borres volúmenes que
contengan datos que quieras conservar.

## 2. Preparar las variables

Abrí una terminal Bash o Zsh en la carpeta donde clonaste el repositorio (la que
contiene `README.md`, `.env.example`, `docker/` y `kubernetes/`). Todos los
comandos siguientes se ejecutan desde esa raíz:

```bash
# Copia únicamente si todavía no existe; no pisa tus valores.
test -f .env || cp .env.example .env
```

Revisá `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` y `FLASK_SECRET_KEY`.
Usá valores simples `CLAVE=valor`, sin comillas ni interpolaciones, para esas
variables: `kubectl --from-env-file` no expande `${VARIABLE}` como Compose.
La URL `DATABASE_URL` del archivo se ignora en Flask dentro del clúster; se arma
con `POSTGRES_*`, usando el servicio `postgres:5432`.

Esta base es nueva e independiente del volumen de Docker Compose. Los datos
anteriores no se copian automáticamente.

## 3. Crear el clúster local

```bash
minikube start -p soft-eng --driver=docker --cpus=2 --memory=3072
minikube -p soft-eng status
```

La primera ejecución descarga Kubernetes e imágenes, así que puede demorar varios
minutos. Reservamos 3 GiB para el clúster; cerrá programas si falta RAM, sobre todo
durante el build del frontend.

Definí esta función en **cada terminal** donde vayas a usar los comandos `k`:

```bash
k() { minikube -p soft-eng kubectl -- --context=soft-eng "$@"; }
k get nodes
```

`k` es una abreviatura de kubectl que apunta explícitamente al clúster de este repo.

## 4. Construir las imágenes dentro de Minikube

Desde la raíz del repo:

```bash
minikube -p soft-eng image build -t soft-eng-flask:local -f docker/flask.Dockerfile .
minikube -p soft-eng image build -t soft-eng-dashboard:local \
  -f docker/nextjs.Dockerfile .
```

El Dockerfile usa por defecto `http://localhost:5000/api` para el frontend.
El sufijo `/api` es necesario para las llamadas del dashboard. Next.js incorpora
esta URL al compilar: cambiar una variable del pod después no modifica el bundle.
`localhost` corresponde al navegador de tu computadora; en el paso 6 exponemos la API.

## 5. Desplegar los servicios

```bash
k apply -f kubernetes/namespace.yaml
k -n soft-eng create secret generic app-env --from-env-file=.env \
  --dry-run=client -o yaml | k apply -f -
k apply -f kubernetes/app.yaml
k -n soft-eng rollout status deployment/postgres --timeout=300s
k -n soft-eng rollout status deployment/flask-backend --timeout=300s
k -n soft-eng rollout status deployment/frontend-dashboard --timeout=300s
k -n soft-eng rollout status deployment/pgadmin --timeout=300s
k -n soft-eng get pods,svc,pvc
```

Flask espera a PostgreSQL y ejecuta `flask db upgrade` con el comando del Dockerfile
antes de iniciar. PostgreSQL guarda los datos en un volumen persistente de Minikube.
Los Secrets se crean desde tu `.env`; no guardes su YAML en Git.

## 6. Abrir la aplicación

Si tenés Compose usando los puertos 3000, 5000 o 5050, primero detenelo desde
la raíz con `docker compose -f docker/docker-compose.yml stop`. Esto conserva sus datos.

En una terminal, definí `k` como en el paso 3 y dejá corriendo:

```bash
k -n soft-eng port-forward service/flask-backend 5000:5000
```

En otra terminal, definí `k` y dejá corriendo:

```bash
k -n soft-eng port-forward service/frontend-dashboard 3000:3000
```

Abrí:

- Dashboard: http://localhost:3000
- Swagger de Flask: http://localhost:5000/apidocs/
- Comprobación de API: `curl -f http://localhost:5000/api/dashboard/history`

Para pgAdmin, en otra terminal con `k` definido:

```bash
k -n soft-eng port-forward service/pgadmin 5050:80
```

Abrí http://localhost:5050 e ingresá con `admin@softeng.com` / `admin`
(credenciales locales de desarrollo, iguales a Compose). Registrá PostgreSQL
con host `postgres`, puerto `5432` y la base, usuario y contraseña de tu `.env`.
Los registros de servidores de pgAdmin se pierden si se reemplaza su pod;
los datos de PostgreSQL sí persisten.

Los `port-forward` se cierran con Ctrl+C. Si un pod se reemplaza, volvé a ejecutar
su `port-forward`. Estos puertos se publican solamente en tu computadora; para
conectar el ESP32 desde la red necesitás una exposición de la API adicional.

## 7. Uso diario y cambios

Para apagar el clúster conservando los datos:

```bash
minikube stop -p soft-eng
```

Para volver a usarlo:

```bash
minikube start -p soft-eng
```

Después repetí los `port-forward` del paso 6. No hace falta reconstruir las
imágenes ni desplegar de nuevo si el código y la configuración no cambiaron.

Si cambiás código, repetí el build correspondiente del paso 4 y reiniciá ese servicio:

```bash
k -n soft-eng rollout restart deployment/flask-backend
# Si cambiaste el frontend:
k -n soft-eng rollout restart deployment/frontend-dashboard
```

Si cambiás `.env`, repetí la creación del Secret del paso 5 y reiniciá Flask.
Cambiar credenciales de PostgreSQL en `.env` no cambia las de una base ya
inicializada: hay que modificarlas dentro de PostgreSQL.

Para inspeccionar problemas:

```bash
k -n soft-eng get pods
k -n soft-eng logs deployment/flask-backend
k -n soft-eng logs deployment/flask-backend -c wait-postgres
k -n soft-eng get events --sort-by=.metadata.creationTimestamp
```

`ErrImageNeverPull` significa que falta construir una imagen dentro del perfil
`soft-eng` (paso 4). `ImagePullBackOff` requiere revisar el acceso al registry.
Si un rollout excede su tiempo de espera, revisá los eventos y logs antes de repetirlo.

**Borrado de datos:** `minikube delete -p soft-eng`, borrar el namespace `soft-eng`
o borrar el PVC `postgres-data` elimina los datos de esta instalación. Para apagar
normalmente, usá `minikube stop`.

Esto es un entorno local de desarrollo: Flask usa su servidor de desarrollo,
hay una sola réplica del backend por su caché en memoria y no se configura HTTPS.
