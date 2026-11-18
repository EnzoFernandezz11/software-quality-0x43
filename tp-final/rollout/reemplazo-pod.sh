#!/usr/bin/env bash
# Reemplazo de un pod del dashboard con tráfico continuo (#22, video 2). Desde la raíz del repo:
#
#   bash tp-final/rollout/reemplazo-pod.sh [stable|canary]     # default: stable
#
# Manda requests sin cookies a /dashboard (una cada 0,1 s), elimina un pod de
# front-<track>, espera a que el Deployment vuelva a tener todos sus pods listos
# y cuenta las respuestas por código HTTP y versión.
# Para el video, en otra terminal:
#   kubectl -n terrasense get pods -l app=front -L track,version -w
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
PROFILE="${MINIKUBE_PROFILE:-terrasense}"
TRACK="${1:-stable}"
OUT="tp-final/evidencias/reportes/rollout/reemplazo-pod-${TRACK}.txt"
H="terrasense.local"
IP="$(minikube -p "$PROFILE" ip)"
RESP="$(mktemp)"
kn() { minikube -p "$PROFILE" kubectl -- --context="$PROFILE" -n terrasense "$@"; }

trafico() {
    while :; do
        curl -s -o /dev/null --max-time 5 --resolve "$H:80:$IP" \
            -w '%{http_code} %header{x-app-version}\n' "http://$H/dashboard" >>"$RESP" || true
        sleep 0.1
    done
}

mkdir -p "$(dirname "$OUT")"
{
    echo "Reemplazo de un pod de front-$TRACK · $(date -Iseconds) · git $(git rev-parse --short HEAD)"
    kn get pods -l app=front -L track,version
    echo
    trafico &
    TRAFICO=$!
    trap 'kill "$TRAFICO" 2>/dev/null || true; rm -f "$RESP"' EXIT
    sleep 5

    POD="$(kn get pods -l "app=front,track=$TRACK" -o jsonpath='{.items[0].metadata.name}')"
    INICIO=$(date +%s)
    echo "$(date +%T)  se elimina $POD"
    kn delete pod "$POD" --wait=false
    kn wait --for=delete "pod/$POD" --timeout=120s >/dev/null
    kn rollout status "deployment/front-$TRACK" --timeout=180s >/dev/null
    echo "$(date +%T)  front-$TRACK de nuevo con todos sus pods listos ($(($(date +%s) - INICIO)) s)"

    sleep 5
    kill "$TRAFICO"
    echo
    echo "Respuestas durante el reemplazo (código HTTP, versión):"
    sort "$RESP" | uniq -c
    echo
    kn get pods -l app=front -L track,version
} 2>&1 | tee "$OUT"
