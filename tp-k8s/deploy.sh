#!/usr/bin/env bash
# Despliega TerraSense (DB + API + dashboard + Ingress) en un Minikube local.
#
#   bash tp-k8s/deploy.sh
#
# Variables opcionales:
#   MINIKUBE_PROFILE  perfil de Minikube            (default: terrasense)
#   MINIKUBE_CPUS     CPUs del nodo al crearlo      (default: 4)
#   MINIKUBE_MEMORY   RAM del nodo en MiB al crearlo (default: 6144)
#   SKIP_BUILD=1      no reconstruye las imágenes (usa las que ya están en Minikube)
#   SKIP_HOSTS=1      no toca /etc/hosts (solo muestra el comando a ejecutar)
#
# Siempre opera sobre el contexto del perfil de Minikube: nunca sobre otro clúster.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO_ROOT="$(pwd)"
K8S_DIR="$REPO_ROOT/tp-k8s/k8s"

PROFILE="${MINIKUBE_PROFILE:-terrasense}"
CPUS="${MINIKUBE_CPUS:-4}"
MEMORY="${MINIKUBE_MEMORY:-6144}"
NS="terrasense"
API_HOST="api.terrasense.local"
FRONT_HOST="terrasense.local"
BACK_IMAGE="terrasense-back:local"
FRONT_IMAGE="terrasense-front:local"
API_URL_FOR_BROWSER="http://${API_HOST}/api"

k() { minikube -p "$PROFILE" kubectl -- --context="$PROFILE" "$@"; }
kn() { k -n "$NS" "$@"; }
step() { printf '\n\033[1m[%s] %s\033[0m\n' "$1" "$2"; }

diagnose() {
    local selector="$1"
    echo "---- Diagnóstico ($selector) ----" >&2
    kn get pods -l "$selector" -o wide >&2 || true
    kn describe pods -l "$selector" >&2 || true
    kn logs -l "$selector" --all-containers=true --tail=80 >&2 || true
    kn get events --sort-by=.metadata.creationTimestamp 2>/dev/null | tail -n 15 >&2 || true
}

wait_rollout() {
    local kind_name="$1" selector="$2"
    if ! kn rollout status "$kind_name" --timeout=300s; then
        echo "Falló el arranque de $kind_name" >&2
        diagnose "$selector"
        exit 1
    fi
}

# Lee KEY=valor del .env sin ejecutarlo (sin comillas ni interpolación).
env_value() {
    local key="$1" line
    line="$(grep -E "^${key}=" .env | tail -n 1 || true)"
    line="${line#*=}"
    line="${line%\"}"; line="${line#\"}"
    printf '%s' "$line"
}

# ---------------------------------------------------------------------------
step 1/8 "Verificando herramientas"
for tool in docker minikube curl; do
    command -v "$tool" >/dev/null 2>&1 || { echo "Falta $tool en el PATH." >&2; exit 1; }
done
docker info >/dev/null 2>&1 || { echo "Docker no responde (¿está iniciado? ¿tu usuario tiene permisos?)." >&2; exit 1; }

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Se creó .env a partir de .env.example (valores de desarrollo)."
fi
PG_USER="$(env_value POSTGRES_USER)"
PG_PASSWORD="$(env_value POSTGRES_PASSWORD)"
SECRET_KEY="$(env_value FLASK_SECRET_KEY)"
for pair in "POSTGRES_USER:$PG_USER" "POSTGRES_PASSWORD:$PG_PASSWORD" "FLASK_SECRET_KEY:$SECRET_KEY"; do
    if [ -z "${pair#*:}" ] || [[ "${pair#*:}" == *'${'* ]]; then
        echo "Definí ${pair%%:*} en .env con un valor literal (sin \${...})." >&2
        exit 1
    fi
done

# ---------------------------------------------------------------------------
step 2/8 "Iniciando Minikube (perfil $PROFILE)"
if minikube -p "$PROFILE" status >/dev/null 2>&1; then
    echo "El perfil $PROFILE ya está corriendo."
else
    minikube start -p "$PROFILE" --driver=docker --cpus="$CPUS" --memory="$MEMORY"
fi
minikube -p "$PROFILE" addons enable metrics-server
minikube -p "$PROFILE" addons enable ingress

# ---------------------------------------------------------------------------
step 3/8 "Construyendo imágenes y cargándolas en Minikube"
# Se construye con el Docker del host y se carga con `minikube image load`:
# `minikube image build --build-opt` no pasa build-args con el runtime containerd,
# y el front NECESITA el build-arg con la URL del Ingress.
if [ "${SKIP_BUILD:-0}" = "1" ]; then
    echo "SKIP_BUILD=1: se usan las imágenes existentes."
else
    docker build -t "$BACK_IMAGE" -f docker/flask.Dockerfile .
    docker build -t "$FRONT_IMAGE" -f docker/nextjs.Dockerfile \
        --build-arg "NEXT_PUBLIC_API_URL=${API_URL_FOR_BROWSER}" .
    for image in "$BACK_IMAGE" "$FRONT_IMAGE"; do
        echo "Cargando $image en Minikube..."
        minikube -p "$PROFILE" image load --daemon=true --overwrite=true "$image"
    done
fi
images="$(minikube -p "$PROFILE" image ls)"
for image in "$BACK_IMAGE" "$FRONT_IMAGE"; do
    if ! printf '%s\n' "$images" | grep -Eq "(^|/)${image}$"; then
        echo "No existe la imagen $image en Minikube. Revisá la salida del build." >&2
        exit 1
    fi
done

# ---------------------------------------------------------------------------
step 4/8 "Namespace, ConfigMap y Secret"
k apply -f "$K8S_DIR/00-namespace.yaml"
k apply -f "$K8S_DIR/01-configmap.yaml"
kn create secret generic terrasense-secrets \
    --from-literal=POSTGRES_USER="$PG_USER" \
    --from-literal=POSTGRES_PASSWORD="$PG_PASSWORD" \
    --from-literal=FLASK_SECRET_KEY="$SECRET_KEY" \
    --dry-run=client -o yaml | k apply -f -

# ---------------------------------------------------------------------------
step 5/8 "Base de datos (StatefulSet + PVC)"
k apply -f "$K8S_DIR/10-db.yaml"
wait_rollout statefulset/db app=db

# ---------------------------------------------------------------------------
step 6/8 "Migraciones (Job)"
kn delete job db-migrate --ignore-not-found --wait=true
k apply -f "$K8S_DIR/20-migrate-job.yaml"
if ! kn wait --for=condition=complete job/db-migrate --timeout=300s; then
    echo "Fallaron las migraciones." >&2
    diagnose job-name=db-migrate
    exit 1
fi

# ---------------------------------------------------------------------------
step 7/8 "API, dashboard e Ingress"
existing="$(kn get deployment back front -o name 2>/dev/null || true)"
k apply -f "$K8S_DIR/30-back.yaml" -f "$K8S_DIR/40-front.yaml"
# El tag :local se reutiliza: si los Deployments ya existían, hay que reiniciarlos
# para que tomen la imagen recién cargada (en el primer despliegue no hace falta).
if [ "${SKIP_BUILD:-0}" != "1" ] && [ -n "$existing" ]; then
    # shellcheck disable=SC2086
    kn rollout restart $existing
fi
wait_rollout deployment/back app=back
wait_rollout deployment/front app=front
k apply -f "$K8S_DIR/hpa.yaml"

# El webhook del controlador rechaza Ingress mientras no está listo.
k -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s
k apply -f "$K8S_DIR/50-ingress.yaml"

# ---------------------------------------------------------------------------
step 8/8 "DNS local (/etc/hosts) y verificación"
IP="$(minikube -p "$PROFILE" ip)"
HOSTS_LINE="$IP $API_HOST $FRONT_HOST"
if grep -Eq "^${IP//./\\.}[[:space:]]+${API_HOST//./\\.}[[:space:]]+${FRONT_HOST//./\\.}([[:space:]]|$)" /etc/hosts; then
    echo "/etc/hosts ya apunta a $IP."
elif [ "${SKIP_HOSTS:-0}" = "1" ]; then
    echo "SKIP_HOSTS=1. Para resolver los dominios, ejecutá:"
    echo "  sudo sed -i.bak '/terrasense\\.local/d' /etc/hosts && echo '$HOSTS_LINE' | sudo tee -a /etc/hosts"
else
    echo "Se actualiza /etc/hosts (pide sudo; queda copia en /etc/hosts.bak): $HOSTS_LINE"
    sudo sed -i.bak '/terrasense\.local/d' /etc/hosts
    echo "$HOSTS_LINE" | sudo tee -a /etc/hosts >/dev/null
fi

# Verifica a través del Ingress (con --resolve no depende de /etc/hosts).
check() {
    local url="$1" host="$2"
    for _ in $(seq 1 30); do
        # Los primeros intentos pueden dar 404 hasta que el controlador sincroniza el Ingress.
        if curl -fs -o /dev/null --max-time 3 --resolve "${host}:80:${IP}" "$url"; then
            echo "OK  $url"
            return 0
        fi
        sleep 2
    done
    echo "FALLA  $url" >&2
    return 1
}
ok=1
check "http://${API_HOST}/health" "$API_HOST" || ok=0
check "http://${API_HOST}/health/ready" "$API_HOST" || ok=0
check "http://${FRONT_HOST}/" "$FRONT_HOST" || ok=0

echo
kn get pods,svc,ingress,pvc -o wide
echo
if [ "$ok" = "1" ]; then
    echo "Listo:"
else
    echo "Desplegado, pero alguna verificación falló (ver arriba)." >&2
fi
echo "  Dashboard: http://${FRONT_HOST}"
echo "  API:       http://${API_HOST}/health  ·  Swagger: http://${API_HOST}/apidocs/"
echo "  kubectl:   alias k='minikube -p $PROFILE kubectl -- --context=$PROFILE -n $NS'"
echo "  Apagar:    minikube stop -p $PROFILE   (conserva datos)   ·   Borrar todo: minikube delete -p $PROFILE"
[ "$ok" = "1" ]
