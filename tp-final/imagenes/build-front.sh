#!/usr/bin/env bash
# Construye la imagen del dashboard desde una revisión de Git (#21, TP final).
#
#   tp-final/imagenes/build-front.sh <ref> [--load]
#
#   <ref>    tag, rama o SHA. Ej.: front-v1.0.0, front-v1.1.0, origin/develop.
#   --load   además carga la imagen en Minikube (`minikube image load`).
#
# Siempre construye desde un worktree limpio de <ref>: lo que no está commiteado
# no entra en la imagen. El tag sale de `frontend/dashboard/package.json` en esa
# revisión (terrasense-front:<version>), así la revisión define la versión.
#
# Deja el registro (SHA, tag, Image ID, labels) y la salida del build en
# tp-final/evidencias/reportes/imagenes/.
#
# Variables opcionales:
#   API_URL   URL de la API que queda fija en el bundle
#             (por defecto http://api.terrasense.local/api, igual que el TP4).
set -euo pipefail

usage() { sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

REF="${1:-}"
[ -n "$REF" ] || usage
LOAD=0
[ "${2:-}" = "--load" ] && LOAD=1

API_URL="${API_URL:-http://api.terrasense.local/api}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
OUT_DIR="$REPO_ROOT/tp-final/evidencias/reportes/imagenes"

SHA="$(git rev-parse --verify "${REF}^{commit}")"
VERSION="$(git show "${SHA}:frontend/dashboard/package.json" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
TAG="terrasense-front:${VERSION}"

case "$VERSION" in
    ""|*latest*) echo "Versión inválida en package.json: '$VERSION'" >&2; exit 1 ;;
esac

echo "Revisión: $SHA ($REF)"
echo "Imagen:   $TAG"

# La gate (#25) solo vale si el commit está publicado y con checks.
if [ -z "$(git branch -r --contains "$SHA" 2>/dev/null)" ]; then
    echo "AVISO: $SHA no está en ninguna rama remota; sus checks de CI no existen todavía." >&2
fi

if docker image inspect "$TAG" >/dev/null 2>&1; then
    PREV="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$TAG")"
    if [ -n "$PREV" ] && [ "$PREV" != "$SHA" ]; then
        echo "AVISO: $TAG ya existía construida desde $PREV; se reemplaza." >&2
    fi
fi

WORKTREE="$(mktemp -d)"
cleanup() { git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true; }
trap cleanup EXIT
git -C "$REPO_ROOT" worktree add --detach --quiet "$WORKTREE" "$SHA"

mkdir -p "$OUT_DIR"
# .txt y no .log: el .gitignore del repo ignora *.log
BUILD_LOG="$OUT_DIR/build-${VERSION}.txt"

# Con BuildKit (buildx) se pide la salida completa; el builder legacy no acepta --progress.
PROGRESS=()
docker buildx version >/dev/null 2>&1 && PROGRESS=(--progress=plain)

docker build "${PROGRESS[@]}" \
    -f "$WORKTREE/docker/nextjs.Dockerfile" \
    --build-arg "NEXT_PUBLIC_API_URL=${API_URL}" \
    --build-arg "APP_VERSION=${VERSION}" \
    --build-arg "GIT_SHA=${SHA}" \
    -t "$TAG" \
    "$WORKTREE" 2>&1 | tee "$BUILD_LOG"

IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$TAG")"

if [ "$LOAD" = "1" ]; then
    minikube image load "$TAG"
fi

REGISTRO="$OUT_DIR/registro-${VERSION}.txt"
{
    echo "fecha:        $(date -Iseconds)"
    echo "ref:          $REF"
    echo "git_sha:      $SHA"
    echo "commit:       $(git log -1 --format='%h %s' "$SHA")"
    echo "imagen:       $TAG"
    echo "image_id:     $IMAGE_ID"
    echo "api_url:      $API_URL"
    echo "dockerfile:   docker/nextjs.Dockerfile (en $SHA)"
    echo "docker:       $(docker version --format '{{.Server.Version}}')"
    echo "minikube:     $([ "$LOAD" = "1" ] && echo cargada || echo 'no cargada (usar --load)')"
    echo "labels:"
    docker image inspect --format '{{ range $k, $v := .Config.Labels }}  {{ $k }}={{ $v }}{{ "\n" }}{{ end }}' "$TAG"
} | tee "$REGISTRO"

echo
echo "Registro: ${REGISTRO#"$REPO_ROOT"/}"
echo "Build:    ${BUILD_LOG#"$REPO_ROOT"/}"
