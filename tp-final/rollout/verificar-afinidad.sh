#!/usr/bin/env bash
# Verificación previa al rollout (#22): ¿la afinidad de sesión evita mezclar
# recursos de dos versiones?, ¿qué pasa con un navegador fijado al canary al
# bajar el peso?, ¿funciona el header X-Canary? Desde la raíz del repo:
#
#   bash tp-final/rollout/verificar-afinidad.sh [salida.txt]
#
# Simula una carga de página con curl: el documento /dashboard y todos sus JS y
# CSS, con o sin cookie jar (un navegador conserva la cookie; curl, por defecto, no).
# Cambia el peso del Ingress canary con `kubectl annotate` y AL TERMINAR lo deja
# como estaba: no altera el YAML ni el estado del rollout.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1
PROFILE="${MINIKUBE_PROFILE:-terrasense}"
OUT="${1:-tp-final/evidencias/reportes/rollout/verificacion-afinidad.txt}"
H="terrasense.local"
IP="$(minikube -p "$PROFILE" ip)"
TMP="$(mktemp -d)"
ANN="nginx.ingress.kubernetes.io/canary-weight"

k() { minikube -p "$PROFILE" kubectl -- --context="$PROFILE" -n terrasense "$@"; }
peso_actual() { k get ingress terrasense-ingress-canary -o jsonpath="{.metadata.annotations.${ANN//./\\.}}"; }
peso() { k annotate ingress terrasense-ingress-canary "$ANN=$1" --overwrite >/dev/null; sleep 5; }

ORIGINAL="$(peso_actual)"
REPLICAS="$(k get deployment front-canary -o jsonpath='{.spec.replicas}')"
restaurar() {
    k scale deployment/front-canary --replicas="$REPLICAS" >/dev/null
    k rollout status deployment/front-canary --timeout=180s >/dev/null
    peso "$ORIGINAL"
    rm -rf "$TMP"
}
trap restaurar EXIT

[ "$(k get deployment front-canary -o jsonpath='{.status.readyReplicas}')" -ge 1 ] 2>/dev/null || {
    echo "front-canary no tiene pods listos: no hay nada que verificar." >&2; exit 1; }

# Una «página»: documento + JS/CSS que referencia. $1 = archivo de cookies ("" = sin cookies).
visita() {
    local jar="$1" html doc vers bad=0 a out code v
    local c=(); [ -n "$jar" ] && c=(-b "$jar" -c "$jar")
    html="$(curl -s --resolve "$H:80:$IP" "${c[@]}" -D "$TMP/h" "http://$H/dashboard")"
    doc="$(tr -d '\r' < "$TMP/h" | awk 'tolower($1)=="x-app-version:"{print $2}')"
    vers=""
    while read -r a; do
        out="$(curl -s --resolve "$H:80:$IP" "${c[@]}" -o /dev/null -w '%{http_code} %header{x-app-version}' "http://$H$a")"
        code="${out%% *}"; v="${out#* }"
        [ "$code" != 200 ] && bad=$((bad + 1))
        [ "$v" != "$doc" ] && vers="si"
    done < <(grep -oE '/_next/static/[^"]+\.(js|css)' <<<"$html" | sort -u)
    echo "documento=${doc:-?}  recursos_no_200=$bad  recursos_de_otra_version=${vers:-no}"
}

mkdir -p "$(dirname "$OUT")"
{
    echo "Verificación de afinidad · $(date -Iseconds) · git $(git rev-parse --short HEAD)$([ -z "$(git status --porcelain -- tp-final/k8s)" ] || echo '+manifiestos-sin-commitear')"
    echo "Imágenes: $(k get deploy front-stable front-canary -o jsonpath='{range .items[*]}{.metadata.name}={.spec.template.spec.containers[0].image} {end}')"
    echo "Recursos JS/CSS por página: $(curl -s --resolve "$H:80:$IP" "http://$H/dashboard" | grep -oE '/_next/static/[^"]+\.(js|css)' | sort -u | wc -l)"

    echo; echo "A. Peso 50, SIN cookies: cada request (documento, JS, CSS) se sortea por separado. 20 páginas:"
    peso 50
    for _ in $(seq 20); do visita ""; done | sort | uniq -c

    echo; echo "B. Peso 50, CON cookie (como un navegador; cookie nueva por página). 20 páginas:"
    for _ in $(seq 20); do rm -f "$TMP/jar"; visita "$TMP/jar"; done | sort | uniq -c

    echo; echo "C. Peso 0 con header X-Canary:"
    peso 0
    for hv in always never; do
        echo "  X-Canary: $hv -> $(curl -s --resolve "$H:80:$IP" -H "X-Canary: $hv" -o /dev/null -w '%header{x-app-version}' "http://$H/dashboard")"
    done

    echo; echo "D. Navegador fijado al canary (cookie obtenida con peso 100) cuando el peso baja a 0:"
    peso 100
    rm -f "$TMP/jar"; echo "  peso 100, primera visita: $(visita "$TMP/jar")"
    peso 0
    echo "  peso 0, MISMA cookie, 5 páginas:"
    for _ in $(seq 5); do visita "$TMP/jar"; done | sort | uniq -c | sed 's/^/  /'
    echo "  peso 0, cookie nueva, 5 páginas:"
    for _ in $(seq 5); do rm -f "$TMP/jar"; visita "$TMP/jar"; done | sort | uniq -c | sed 's/^/  /'

    echo; echo "E. El mismo navegador fijado al canary, con peso 0 y front-canary escalado a 0 réplicas:"
    k scale deployment/front-canary --replicas=0 >/dev/null
    k wait --for=delete pod -l app=front,track=canary --timeout=120s >/dev/null 2>&1
    sleep 5
    echo "  peso 0, 0 réplicas canary, MISMA cookie, 5 páginas:"
    for _ in $(seq 5); do visita "$TMP/jar"; done | sort | uniq -c | sed 's/^/  /'
    echo "  código HTTP del documento con esa cookie: $(curl -s --resolve "$H:80:$IP" -b "$TMP/jar" -o /dev/null -w '%{http_code}' "http://$H/dashboard")"

    echo; echo "Restaurado: peso $ORIGINAL y $REPLICAS réplicas de front-canary."
} 2>&1 | tee "$OUT"
