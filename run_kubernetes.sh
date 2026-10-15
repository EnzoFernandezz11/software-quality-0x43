#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

for tool in docker minikube; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "Falta $tool. Instalalo y agregalo al PATH antes de continuar." >&2
        exit 1
    fi
done
docker info >/dev/null

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Se creó .env con los valores de desarrollo."
fi

k() { minikube -p soft-eng kubectl -- --context=soft-eng "$@"; }

# Cada proceso tiene su grupo para cerrar también el kubectl hijo de Minikube.
set -m
tunnels=()
monitor_pid=""
stop_monitor() {
    if [ -n "$monitor_pid" ]; then
        kill -- "-$monitor_pid" 2>/dev/null || true
        wait "$monitor_pid" 2>/dev/null || true
        monitor_pid=""
    fi
}
cleanup() {
    trap - EXIT INT TERM
    stop_monitor
    for pid in "${tunnels[@]}"; do
        kill -- "-$pid" 2>/dev/null || true
    done
    wait || true
    echo "Puertos cerrados. El clúster sigue activo si llegó a iniciarse; para apagarlo: minikube stop -p soft-eng"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "[1/6] Iniciando Minikube. Asegurate de tener espacio disponible en Docker (20 GB libres)."
minikube start -p soft-eng --driver=docker --cpus=2 --memory=3072

echo "[2/6] Construyendo Flask (la salida del build aparece debajo)..."
minikube -p soft-eng image build -t soft-eng-flask:local -f docker/flask.Dockerfile .
echo "[3/6] Construyendo Next.js (la salida del build aparece debajo)..."
minikube -p soft-eng image build -t soft-eng-dashboard:local \
    -f docker/nextjs.Dockerfile \
    --build-opt build-arg=NEXT_PUBLIC_API_URL=http://localhost:5000/api .

echo "[4/6] Creando namespace, configuración y servicios..."
k apply -f kubernetes/namespace.yaml
k -n soft-eng create secret generic app-env --from-env-file=.env \
    --dry-run=client -o yaml | k apply -f -
k apply -f kubernetes/app.yaml

# Las etiquetas locales se reutilizan; los pods deben recargar imágenes y Secret.
k -n soft-eng rollout restart deployment/flask-backend deployment/frontend-dashboard
echo "[5/6] Esperando los servicios. Estado y avisos de Kubernetes cada 5 segundos:"
(
    while true; do
        echo "--- Pods ($(date +%H:%M:%S)) ---"
        k -n soft-eng get pods -o wide || true
        echo "--- Eventos de advertencia recientes ---"
        k -n soft-eng get events --field-selector type=Warning \
            --sort-by=.metadata.creationTimestamp | tail -n 12 || true
        sleep 5
    done
) &
monitor_pid=$!
for service in postgres flask-backend frontend-dashboard pgadmin; do
    echo "Esperando $service (máximo 300 segundos)..."
    if ! k -n soft-eng rollout status "deployment/$service" --timeout=300s; then
        stop_monitor
        echo "Falló el arranque de $service. Diagnóstico de Kubernetes:" >&2
        k -n soft-eng describe pods -l "app=$service" || true
        k -n soft-eng logs "deployment/$service" --all-containers=true --tail=80 || true
        exit 1
    fi
    echo "$service listo."
done
stop_monitor
k -n soft-eng get pods,svc,pvc

# Detiene solamente los servicios Compose de este repo y conserva sus volúmenes.
echo "[6/6] Deteniendo Compose y abriendo los puertos locales..."
docker compose -f docker/docker-compose.yml stop

k -n soft-eng port-forward service/flask-backend 5000:5000 &
tunnels+=("$!")
k -n soft-eng port-forward service/frontend-dashboard 3000:3000 &
tunnels+=("$!")
k -n soft-eng port-forward service/pgadmin 5050:80 &
tunnels+=("$!")

echo "Cuando aparezca 'Forwarding from', abrí:"
echo "Dashboard: http://localhost:3000"
echo "Swagger:   http://localhost:5000/apidocs/"
echo "pgAdmin:   http://localhost:5050 (admin@softeng.com / admin)"
echo "Dejá esta terminal abierta. Ctrl+C cierra los puertos."

while true; do
    for pid in "${tunnels[@]}"; do
        if ! kill -0 "$pid" 2>/dev/null; then
            echo "Un port-forward terminó. Revisá los mensajes anteriores y volvé a ejecutar el script." >&2
            exit 1
        fi
    done
    sleep 1
done
