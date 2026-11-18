#!/usr/bin/env bash
# Comprueba la marca de versión de una imagen del dashboard (#21, TP final).
#
#   tp-final/imagenes/verificar-front.sh <version> [url]
#
#   Sin [url]: levanta terrasense-front:<version> con `docker run` en un puerto
#   libre, la verifica y la detiene.
#   Con [url]: verifica una instancia ya desplegada, por ejemplo
#   http://terrasense.local/dashboard (en ese caso el canary puede responder
#   con cualquiera de las dos versiones).
#
# Comprueba el header X-App-Version del documento y de sus recursos JS y CSS,
# el <meta name="app-version"> y el encabezado `h1.dashboard-title`. Si hay
# Chromium disponible, guarda además una captura del panel.
#
# Resultado en tp-final/evidencias/reportes/imagenes/verificacion-<version>.txt
# y captura en tp-final/evidencias/capturas/panel-<version>.png.
set -euo pipefail

VERSION="${1:?Uso: verificar-front.sh <version> [url]}"
URL="${2:-}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
OUT_DIR="$REPO_ROOT/tp-final/evidencias/reportes/imagenes"
CAP_DIR="$REPO_ROOT/tp-final/evidencias/capturas"
mkdir -p "$OUT_DIR" "$CAP_DIR"

CONTAINER=""
cleanup() { [ -n "$CONTAINER" ] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ -z "$URL" ]; then
    TAG="terrasense-front:${VERSION}"
    CONTAINER="$(docker run -d --rm -p 127.0.0.1::3000 "$TAG")"
    PORT="$(docker port "$CONTAINER" 3000/tcp | head -1 | sed 's/.*://')"
    URL="http://127.0.0.1:${PORT}/dashboard"
fi
BASE="${URL%/dashboard*}"

curl -sf -o /dev/null --retry 30 --retry-all-errors --retry-delay 1 "$URL"

FALLOS=0
check() { # descripción, valor obtenido, valor esperado
    if [ "$2" = "$3" ]; then echo "OK    $1: $2"; else echo "FALLA $1: '$2' (esperado '$3')"; FALLOS=$((FALLOS + 1)); fi
}
header() { curl -sI "$1" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-app-version"{print $2}'; }

REPORTE="$OUT_DIR/verificacion-${VERSION}.txt"
{
    echo "fecha:   $(date -Iseconds)"
    echo "url:     $URL"
    [ -n "$CONTAINER" ] && echo "imagen:  terrasense-front:${VERSION} ($(docker inspect --format '{{.Image}}' "$CONTAINER"))"
    echo
    echo "## Respuesta del documento"
    curl -sI "$URL" | tr -d '\r' | grep -iE '^HTTP|^x-app-version|^content-type'
    echo
    HTML="$(curl -s "$URL")"
    JS="$(grep -oE '/_next/static/[^"]+\.js' <<<"$HTML" | head -1)"
    CSS="$(grep -oE '/_next/static/[^"]+\.css' <<<"$HTML" | head -1)"
    echo "## Comprobaciones"
    check "header del documento" "$(header "$URL")" "$VERSION"
    check "meta app-version" "$(grep -oE '<meta name="app-version" content="[^"]*"' <<<"$HTML" | sed 's/.*content="//;s/"$//')" "$VERSION"
    check "h1.dashboard-title presente" "$(grep -c 'class="dashboard-title"' <<<"$HTML" | sed 's/^[1-9][0-9]*$/si/;s/^0$/no/')" "si"
    check "header de JS ($JS)" "$(header "$BASE$JS")" "$VERSION"
    check "header de CSS ($CSS)" "$(header "$BASE$CSS")" "$VERSION"
    echo
    echo "fallos: $FALLOS"
} | tee "$REPORTE"

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
if [ -n "$CHROME" ]; then
    CAPTURA="$CAP_DIR/panel-${VERSION}.png"
    "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
        --window-size=1440,1000 --virtual-time-budget=5000 \
        --screenshot="$CAPTURA" "$URL" >/dev/null 2>&1 || true
    [ -f "$CAPTURA" ] && echo "Captura: ${CAPTURA#"$REPO_ROOT"/}"
else
    echo "Sin Chromium: no se generó captura." >&2
fi

grep -q '^fallos: 0$' "$REPORTE"
