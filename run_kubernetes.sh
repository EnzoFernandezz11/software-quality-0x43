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

echo "Iniciando Minikube. Asegurate de tener espacio disponible en Docker (20 GB libres)."
minikube start -p soft-eng --driver=docker --cpus=2 --memory=3072

echo "Construyendo Flask y Next.js..."
minikube -p soft-eng image build -t soft-eng-flask:local -f docker/flask.Dockerfile .
minikube -p soft-eng image build -t soft-eng-dashboard:local \
    -f docker/nextjs.Dockerfile \
    --build-opt build-arg=NEXT_PUBLIC_API_URL=http://localhost:5000/api .

k apply -f kubernetes/namespace.yaml
k -n soft-eng create secret generic app-env --from-env-file=.env \
    --dry-run=client -o yaml | k apply -f -
k apply -f kubernetes/app.yaml

# Las etiquetas locales se reutilizan; los pods deben recargar imágenes y Secret.
k -n soft-eng rollout restart deployment/flask-backend deployment/frontend-dashboard
for service in postgres flask-backend frontend-dashboard pgadmin; do
    k -n soft-eng rollout status "deployment/$service" --timeout=300s
done

# Detiene solamente los servicios Compose de este repo y conserva sus volúmenes.
docker compose -f docker/docker-compose.yml stop

# Cada túnel tiene su grupo para cerrar también el kubectl hijo de Minikube.
set -m
tunnels=()
cleanup() {
    trap - EXIT INT TERM
    for pid in "${tunnels[@]}"; do
        kill -- "-$pid" 2>/dev/null || true
    done
    wait || true
    echo "Puertos cerrados. El clúster sigue activo; para apagarlo: minikube stop -p soft-eng"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

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
