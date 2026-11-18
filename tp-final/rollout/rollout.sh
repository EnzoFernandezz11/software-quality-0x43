#!/usr/bin/env bash
# Opera el canary del dashboard (TP final, #22). Desde la raíz del repo:
#
#   bash tp-final/rollout/rollout.sh estado            # peso, imágenes, pods y una muestra por curl
#   bash tp-final/rollout/rollout.sh muestra [n]       # n requests sin cookies, contadas por X-App-Version
#   bash tp-final/rollout/rollout.sh peso <0-100>      # mueve el tráfico al canary
#   bash tp-final/rollout/rollout.sh rollback          # peso 0 y canary a 0 réplicas
#   bash tp-final/rollout/rollout.sh promover          # stable pasa a la candidata; canary a peso 0 y 0 réplicas
#   bash tp-final/rollout/rollout.sh replicas <n>      # réplicas del canary (ej. volver a 2 tras un rollback)
#
# Cada cambio:
#   1. se aplica al clúster;
#   2. se refleja en el YAML de tp-final/k8s/ (el repo describe el estado real, Anexo A.7);
#   3. se registra con fecha, revisión de Git y estado en
#      tp-final/evidencias/reportes/rollout/eventos.txt (insumo de la bitácora).
#
# Variables opcionales: MINIKUBE_PROFILE (default: terrasense).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
K8S_DIR="tp-final/k8s"
STABLE_YAML="$K8S_DIR/stable/deployment.yaml"
CANARY_YAML="$K8S_DIR/canary/deployment.yaml"
CANARY_INGRESS_YAML="$K8S_DIR/canary/ingress-canary.yaml"
EVENTOS="tp-final/evidencias/reportes/rollout/eventos.txt"

PROFILE="${MINIKUBE_PROFILE:-terrasense}"
NS="terrasense"
FRONT_HOST="terrasense.local"
WEIGHT_ANN="nginx.ingress.kubernetes.io/canary-weight"

k() { minikube -p "$PROFILE" kubectl -- --context="$PROFILE" "$@"; }
kn() { k -n "$NS" "$@"; }

image_version() { sed -nE 's|^ *image: terrasense-front:([0-9][0-9A-Za-z.-]*) *$|\1|p' "$1"; }
cluster_weight() { kn get ingress terrasense-ingress-canary -o jsonpath="{.metadata.annotations.${WEIGHT_ANN//./\\.}}"; }
deploy_image() { kn get deployment "$1" -o jsonpath='{.spec.template.spec.containers[0].image}'; }
ready_replicas() { local n; n="$(kn get deployment "$1" -o jsonpath='{.status.readyReplicas}')"; echo "${n:-0}"; }

registrar() {
    local accion="$1"
    mkdir -p "$(dirname "$EVENTOS")"
    printf '%s | %-22s | peso=%s | stable=%s (%s listos) | canary=%s (%s listos) | git=%s\n' \
        "$(date -Iseconds)" "$accion" "$(cluster_weight)" \
        "$(deploy_image front-stable)" "$(ready_replicas front-stable)" \
        "$(deploy_image front-canary)" "$(ready_replicas front-canary)" \
        "$(git rev-parse --short HEAD)$([ -z "$(git status --porcelain -- "$K8S_DIR")" ] || echo '+sin-commitear')" \
        | tee -a "$EVENTOS"
}

set_weight() {
    local w="$1"
    kn annotate ingress terrasense-ingress-canary "${WEIGHT_ANN}=${w}" --overwrite >/dev/null
    sed -i -E "s|(${WEIGHT_ANN//./\\.}: )\"[0-9]+\"|\1\"${w}\"|" "$CANARY_INGRESS_YAML"
}

scale_canary() {
    local n="$1"
    kn scale deployment/front-canary --replicas="$n" >/dev/null
    sed -i -E "0,/^  replicas: [0-9]+/s//  replicas: ${n}/" "$CANARY_YAML"
}

muestra() {
    local n="${1:-200}" ip
    ip="$(minikube -p "$PROFILE" ip)"
    echo "Muestra de $n requests a http://$FRONT_HOST/dashboard sin cookies (peso configurado: $(cluster_weight) %):"
    for _ in $(seq 1 "$n"); do
        curl -s -o /dev/null --max-time 5 --resolve "${FRONT_HOST}:80:${ip}" \
            -w '%{http_code} %header{x-app-version}\n' "http://$FRONT_HOST/dashboard" || true
        # Si falla la conexión, curl ya imprimió «000 » (sin versión): no se agrega otra línea.
    done | sort | uniq -c | awk -v n="$n" '{ printf "  %5d  HTTP %s  versión %-8s %5.1f %%\n", $1, $2, ($3 == "" ? "-" : $3), $1 * 100 / n }'
}

estado() {
    echo "Peso canary en el clúster: $(cluster_weight) %   (en el YAML: $(sed -nE "s|.*${WEIGHT_ANN//./\\.}: \"([0-9]+)\".*|\1|p" "$CANARY_INGRESS_YAML") %)"
    echo "front-stable: $(deploy_image front-stable)   ·   front-canary: $(deploy_image front-canary)"
    echo
    kn get pods -l app=front -L track,version
    echo
    muestra "${1:-100}"
}

cmd="${1:-}"
case "$cmd" in
    estado)
        estado "${2:-100}"
        ;;
    muestra)
        muestra "${2:-200}"
        ;;
    peso)
        w="${2:-}"
        if ! [[ "$w" =~ ^[0-9]+$ ]] || [ "$w" -gt 100 ]; then
            echo "Uso: rollout.sh peso <0-100>" >&2
            exit 1
        fi
        if [ "$w" -gt 0 ] && [ "$(ready_replicas front-canary)" = "0" ]; then
            echo "front-canary no tiene pods listos: con peso $w las requests al canary darían 503." >&2
            echo "Subí primero las réplicas: bash tp-final/rollout/rollout.sh replicas 2" >&2
            exit 1
        fi
        set_weight "$w"
        registrar "peso $w"
        ;;
    replicas)
        n="${2:-}"
        if ! [[ "$n" =~ ^[0-9]+$ ]]; then
            echo "Uso: rollout.sh replicas <n>" >&2
            exit 1
        fi
        if [ "$n" = "0" ] && [ "$(cluster_weight)" != "0" ]; then
            echo "El peso es $(cluster_weight) %: bajalo a 0 antes de dejar el canary sin pods (si no, 503)." >&2
            exit 1
        fi
        scale_canary "$n"
        kn rollout status deployment/front-canary --timeout=300s
        registrar "canary $n réplicas"
        ;;
    rollback)
        # Orden obligatorio: primero peso 0 y después réplicas a 0 (si no, 503).
        set_weight 0
        registrar "rollback: peso 0"
        scale_canary 0
        kn rollout status deployment/front-canary --timeout=120s >/dev/null
        registrar "rollback: canary 0 pods"
        ;;
    promover)
        candidata="$(image_version "$CANARY_YAML")"
        actual="$(image_version "$STABLE_YAML")"
        [ "$candidata" != "$actual" ] || { echo "La estable ya corre $candidata." >&2; exit 1; }
        # (1) La stable pasa a correr la candidata. Peso 100 NO es promoción (Anexo A.12).
        sed -i -E "s|^( *image: terrasense-front:)[0-9][0-9A-Za-z.-]*|\1${candidata}|; s|^( *version: )\"[^\"]+\"|\1\"${candidata}\"|" "$STABLE_YAML"
        k apply -f "$STABLE_YAML" >/dev/null
        kn rollout status deployment/front-stable --timeout=300s
        registrar "promover: stable $candidata"
        # (2) Recién ahora se apaga el canary: primero peso 0, después réplicas.
        set_weight 0
        registrar "promover: peso 0"
        scale_canary 0
        kn rollout status deployment/front-canary --timeout=120s >/dev/null
        registrar "promover: canary 0 pods"
        echo "Revertir la promoción: kubectl -n $NS rollout undo deployment/front-stable (y volver el YAML a $actual)."
        ;;
    *)
        sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
        exit 1
        ;;
esac
