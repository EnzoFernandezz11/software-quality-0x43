#!/usr/bin/env bash
# Despliega TerraSense con el canary del dashboard en un Minikube local (TP final, #22).
#
#   bash tp-final/deploy.sh
#
# Levanta DB + API + HPA (igual que el TP4) y el dashboard partido en dos:
#   front-stable (terrasense-front:<estable>) y front-canary (terrasense-front:<candidata>),
# con el Ingress principal y el Ingress canary para terrasense.local.
# Las versiones salen de las imágenes declaradas en tp-final/k8s/{stable,canary}/deployment.yaml.
#
# Variables opcionales:
#   MINIKUBE_PROFILE  perfil de Minikube             (default: terrasense)
#   MINIKUBE_CPUS     CPUs del nodo al crearlo       (default: 4)
#   MINIKUBE_MEMORY   RAM del nodo en MiB al crearlo (default: 6144)
#   SKIP_BUILD=1      no construye imágenes (usa las que ya están en Minikube)
#   SKIP_HOSTS=1      no toca /etc/hosts (solo muestra el comando a ejecutar)
#
# Siempre opera sobre el contexto del perfil de Minikube: nunca sobre otro clúster.
# Si encuentra el despliegue del TP4 (Deployment `front` e Ingress con la API),
# lo reemplaza: el selector de un Deployment es inmutable (Anexo A.12).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO_ROOT="$(pwd)"
K8S_DIR="$REPO_ROOT/tp-final/k8s"
BUILD_FRONT="$REPO_ROOT/tp-final/imagenes/build-front.sh"

PROFILE="${MINIKUBE_PROFILE:-terrasense}"
CPUS="${MINIKUBE_CPUS:-4}"
MEMORY="${MINIKUBE_MEMORY:-6144}"
NS="terrasense"
API_HOST="api.terrasense.local"
FRONT_HOST="terrasense.local"
BACK_IMAGE="terrasense-back:local"
API_URL_FOR_BROWSER="http://${API_HOST}/api"

k() { minikube -p "$PROFILE" kubectl -- --context="$PROFILE" "$@"; }
kn() { k -n "$NS" "$@"; }
step() { printf '\n\033[1m[%s] %s\033[0m\n' "$1" "$2"; }

# Versión declarada en un Deployment del front (la del tag de la imagen).
image_version() { sed -nE 's|^ *image: terrasense-front:([0-9][0-9A-Za-z.-]*) *$|\1|p' "$1"; }
STABLE_VERSION="$(image_version "$K8S_DIR/stable/deployment.yaml")"
CANARY_VERSION="$(image_version "$K8S_DIR/canary/deployment.yaml")"
if [ -z "$STABLE_VERSION" ] || [ -z "$CANARY_VERSION" ]; then
    echo "No pude leer la versión de las imágenes en tp-final/k8s/{stable,canary}/deployment.yaml." >&2
    exit 1
fi
FRONT_IMAGES=("terrasense-front:$STABLE_VERSION")
[ "$CANARY_VERSION" != "$STABLE_VERSION" ] && FRONT_IMAGES+=("terrasense-front:$CANARY_VERSION")

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
step 1/9 "Verificando herramientas"
for tool in docker minikube curl git node; do
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
    if [ -z "${pair#*:}" ] || [[ "${pair#*:}" == *\$\{* ]]; then
        echo "Definí ${pair%%:*} en .env con un valor literal (sin \${...})." >&2
        exit 1
    fi
done
echo "Dashboard: estable $STABLE_VERSION · candidata $CANARY_VERSION"

# ---------------------------------------------------------------------------
step 2/9 "Iniciando Minikube (perfil $PROFILE)"
if minikube -p "$PROFILE" status >/dev/null 2>&1; then
    echo "El perfil $PROFILE ya está corriendo."
else
    minikube start -p "$PROFILE" --driver=docker --cpus="$CPUS" --memory="$MEMORY"
fi
minikube -p "$PROFILE" addons enable metrics-server
minikube -p "$PROFILE" addons enable ingress

# ---------------------------------------------------------------------------
step 3/9 "Construyendo imágenes y cargándolas en Minikube"
# Camino B de la consigna (Anexo A.3), igual que el TP4: build en el host y
# `minikube image load`. El front se construye desde el tag de Git front-v<versión>
# con el script de #21, que registra SHA e Image ID en tp-final/evidencias/reportes/imagenes/.
if [ "${SKIP_BUILD:-0}" = "1" ]; then
    echo "SKIP_BUILD=1: se usan las imágenes existentes."
else
    [ -f "$BUILD_FRONT" ] || {
        echo "Falta $BUILD_FRONT (lo agrega #21). Construí las imágenes a mano y usá SKIP_BUILD=1." >&2
        exit 1
    }
    docker build -t "$BACK_IMAGE" -f docker/flask.Dockerfile .
    for image in "${FRONT_IMAGES[@]}"; do
        # La URL de la API queda fija en el bundle del navegador (NEXT_PUBLIC_API_URL).
        API_URL="$API_URL_FOR_BROWSER" bash "$BUILD_FRONT" "front-v${image#terrasense-front:}"
    done
    # Se carga con -p: `build-front.sh --load` usaría el perfil activo, que puede no ser este.
    for image in "$BACK_IMAGE" "${FRONT_IMAGES[@]}"; do
        echo "Cargando $image en Minikube..."
        minikube -p "$PROFILE" image load --daemon=true --overwrite=true "$image"
    done
fi
images="$(minikube -p "$PROFILE" image ls)"
for image in "$BACK_IMAGE" "${FRONT_IMAGES[@]}"; do
    if ! printf '%s\n' "$images" | grep -Eq "(^|/)${image}$"; then
        echo "No existe la imagen $image en Minikube. Revisá la salida del build." >&2
        exit 1
    fi
done

# ---------------------------------------------------------------------------
step 4/9 "Namespace, ConfigMap y Secret"
k apply -f "$K8S_DIR/base/00-namespace.yaml"
k apply -f "$K8S_DIR/base/01-configmap.yaml"
kn create secret generic terrasense-secrets \
    --from-literal=POSTGRES_USER="$PG_USER" \
    --from-literal=POSTGRES_PASSWORD="$PG_PASSWORD" \
    --from-literal=FLASK_SECRET_KEY="$SECRET_KEY" \
    --dry-run=client -o yaml | k apply -f -

# ---------------------------------------------------------------------------
step 5/9 "Base de datos (StatefulSet + PVC)"
k apply -f "$K8S_DIR/base/10-db.yaml"
wait_rollout statefulset/db app=db

# ---------------------------------------------------------------------------
step 6/9 "Migraciones (Job)"
kn delete job db-migrate --ignore-not-found --wait=true
k apply -f "$K8S_DIR/base/20-migrate-job.yaml"
if ! kn wait --for=condition=complete job/db-migrate --timeout=300s; then
    echo "Fallaron las migraciones." >&2
    diagnose job-name=db-migrate
    exit 1
fi

# ---------------------------------------------------------------------------
step 7/9 "API y HPA"
existing_back="$(kn get deployment back -o name 2>/dev/null || true)"
k apply -f "$K8S_DIR/base/30-back.yaml"
if [ "${SKIP_BUILD:-0}" != "1" ] && [ -n "$existing_back" ]; then
    # El tag :local se reutiliza: hay que reiniciar para tomar la imagen recién cargada.
    kn rollout restart deployment/back
fi
wait_rollout deployment/back app=back
k apply -f "$K8S_DIR/base/60-hpa.yaml"

# ---------------------------------------------------------------------------
step 8/9 "Dashboard estable y canary, e Ingress"
# Migración desde el TP4: el Deployment `front` tiene otro selector (inmutable) y
# su Service tomaría los pods de ambas versiones. El Ingress del TP4 tenía la API
# y el front juntos; la API pasa a base/50-ingress-api.yaml (mismo host y path en
# dos Ingress no-canary es rechazado por el webhook del controller).
kn delete deployment/front service/front --ignore-not-found
if kn get ingress terrasense-ingress -o jsonpath='{.spec.rules[*].host}' 2>/dev/null | grep -qw "$API_HOST"; then
    echo "Se reemplaza el Ingress del TP4 (incluía $API_HOST)."
    kn delete ingress terrasense-ingress
fi

k apply -f "$K8S_DIR/stable/" -f "$K8S_DIR/canary/deployment.yaml" -f "$K8S_DIR/canary/service.yaml"
wait_rollout deployment/front-stable app=front,track=stable
wait_rollout deployment/front-canary app=front,track=canary

# El webhook del controlador rechaza Ingress mientras no está listo.
k -n ingress-nginx rollout status deployment/ingress-nginx-controller --timeout=300s
k apply -f "$K8S_DIR/base/50-ingress-api.yaml" -f "$K8S_DIR/ingress.yaml"
# El canary después del principal: necesita la regla principal para engancharse.
k apply -f "$K8S_DIR/canary/ingress-canary.yaml"

# ---------------------------------------------------------------------------
step 9/9 "DNS local (/etc/hosts) y verificación"
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
# Para el front se fuerza cada versión con el header del canary y se lee X-App-Version.
check() {
    local url="$1" host="$2" expected_version="${3:-}" canary_header="${4:-}" got
    for _ in $(seq 1 30); do
        # Los primeros intentos pueden dar 404 hasta que el controlador sincroniza el Ingress.
        if got="$(curl -fsS -o /dev/null --max-time 3 --resolve "${host}:80:${IP}" \
                ${canary_header:+-H "X-Canary: $canary_header"} \
                -w '%header{x-app-version}' "$url" 2>/dev/null)" &&
           { [ -z "$expected_version" ] || [ "$got" = "$expected_version" ]; }; then
            echo "OK  $url${canary_header:+ (X-Canary: $canary_header)}${expected_version:+ -> X-App-Version $got}"
            return 0
        fi
        sleep 2
    done
    echo "FALLA  $url${canary_header:+ (X-Canary: $canary_header)} (esperado: ${expected_version:-HTTP 2xx}, recibido: ${got:-nada})" >&2
    return 1
}
ok=1
check "http://${API_HOST}/health" "$API_HOST" || ok=0
check "http://${API_HOST}/health/ready" "$API_HOST" || ok=0
check "http://${FRONT_HOST}/dashboard" "$FRONT_HOST" "$STABLE_VERSION" never || ok=0
if [ "$(kn get deployment front-canary -o jsonpath='{.spec.replicas}')" != "0" ]; then
    check "http://${FRONT_HOST}/dashboard" "$FRONT_HOST" "$CANARY_VERSION" always || ok=0
fi

echo
kn get pods -L track,version -o wide
echo
kn get svc,ingress
echo
echo "Peso canary: $(kn get ingress terrasense-ingress-canary \
    -o jsonpath='{.metadata.annotations.nginx\.ingress\.kubernetes\.io/canary-weight}') %"
echo
if [ "$ok" = "1" ]; then
    echo "Listo:"
else
    echo "Desplegado, pero alguna verificación falló (ver arriba)." >&2
fi
echo "  Dashboard: http://${FRONT_HOST}/dashboard   (incógnito o borrar la cookie terrasense-front para volver a sortear)"
echo "  API:       http://${API_HOST}/health  ·  Swagger: http://${API_HOST}/apidocs/"
echo "  Rollout:   bash tp-final/rollout/rollout.sh estado | peso <n> | promover | rollback"
echo "  kubectl:   alias k='minikube -p $PROFILE kubectl -- --context=$PROFILE -n $NS'"
echo "  Apagar:    minikube stop -p $PROFILE   (conserva datos)   ·   Borrar todo: minikube delete -p $PROFILE"
[ "$ok" = "1" ]
