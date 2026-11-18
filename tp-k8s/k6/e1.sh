#!/usr/bin/env bash
# E1a: elimina un pod con >=2 réplicas. E1b: elimina todos los pods del back.
# Opera únicamente en el perfil local indicado y no cambia réplicas ni limits.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

MODE="${1:-e1a}"
case "$MODE" in e1a|e1b) ;; *) echo "Uso: bash tp-k8s/k6/e1.sh [e1a|e1b]" >&2; exit 2;; esac
PROFILE="${MINIKUBE_PROFILE:-terrasense}"
NS=terrasense
export E1_MODE="$MODE"
export RPS="${RPS:-5}" DURATION_SECONDS="${DURATION_SECONDS:-60}"
export FAILURE_DELAY_SECONDS="${FAILURE_DELAY_SECONDS:-20}" UX_WAIT_SECONDS="${UX_WAIT_SECONDS:-12}"
export PRE_ALLOCATED_VUS="${PRE_ALLOCATED_VUS:-20}" MAX_VUS="${MAX_VUS:-100}"
export BASE_URL="${BASE_URL:-http://api.terrasense.local}"
export FRONT_URL="${FRONT_URL:-http://terrasense.local}"
export RUN_ID="${RUN_ID:-$MODE-$(date +%Y%m%d-%H%M%S)}"
k() { minikube -p "$PROFILE" kubectl -- --context="$PROFILE" -n "$NS" "$@"; }

for tool in minikube k6 python3 curl setsid; do
  command -v "$tool" >/dev/null || { echo "Falta $tool" >&2; exit 1; }
done
if [[ -z "${K6_BROWSER_EXECUTABLE_PATH:-}" ]]; then
  for candidate in chromium chromium-browser google-chrome brave-browser; do
    if command -v "$candidate" >/dev/null; then
      export K6_BROWSER_EXECUTABLE_PATH
      K6_BROWSER_EXECUTABLE_PATH="$(command -v "$candidate")"
      break
    fi
  done
fi
[[ -x "${K6_BROWSER_EXECUTABLE_PATH:-}" ]] || { echo "Falta Chromium/Chrome; definí K6_BROWSER_EXECUTABLE_PATH." >&2; exit 1; }
export K6_BROWSER_HEADLESS=true
k6 inspect --include-system-env-vars tp-k8s/k6/e1-falla.js >/dev/null
minikube -p "$PROFILE" status >/dev/null
k rollout status deployment/back --timeout=120s
resolve=()
if [[ -n "${INGRESS_IP:-}" ]]; then
  resolve=(--resolve "api.terrasense.local:80:$INGRESS_IP" --resolve "terrasense.local:80:$INGRESS_IP")
fi
curl -fsS --max-time 5 "${resolve[@]}" "$BASE_URL/health/ready" >/dev/null
curl -fsS --max-time 5 "${resolve[@]}" "$FRONT_URL" >/dev/null

# Comprueba las réplicas reales, también si un HPA está activo.
select_pods() {
  k get pods -l app=back -o json | python3 -c '
import json, sys
pods = [p for p in json.load(sys.stdin)["items"] if not p["metadata"].get("deletionTimestamp")]
ready = [p for p in pods if any(c["type"] == "Ready" and c["status"] == "True" for c in p.get("status", {}).get("conditions", []))]
if len(ready) < (2 if sys.argv[1] == "e1a" else 1):
    sys.exit("E1a requiere >=2 pods listos; E1b requiere >=1. No se inyectó la falla.")
print("\n".join(p["metadata"]["name"] for p in (ready[:1] if sys.argv[1] == "e1a" else pods)))
' "$MODE"
}
select_pods >/dev/null
OUTPUT_DIR="${OUTPUT_DIR:-tp-k8s/evidencias/$RUN_ID}"
mkdir "$OUTPUT_DIR"  # No sobreescribir una ejecución anterior.
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"
SCREENSHOT_PATH="$OUTPUT_DIR/ux.png"
[[ "$MODE" == e1b ]] && SCREENSHOT_PATH="$OUTPUT_DIR/falla-ux.png"
export SCREENSHOT_PATH

watcher_pids=()
k6_pid=""
# Se invoca desde el trap EXIT.
# shellcheck disable=SC2317
cleanup() {
  local pid
  for pid in "${watcher_pids[@]}" "${k6_pid:-}"; do
    [[ -z "$pid" ]] && continue
    kill -- "-$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
start_watch() {
  local file="$1"; shift
  # Las variables se expanden en el shell hijo.
  # shellcheck disable=SC2016
  setsid bash -c '
    set -o pipefail
    profile="$1"; ns="$2"; shift 2
    minikube -p "$profile" kubectl -- --context="$profile" -n "$ns" get "$@" --watch |
      while IFS= read -r line; do printf "%s %s\n" "$(date -Is)" "$line"; done
  ' _ "$PROFILE" "$NS" "$@" > "$OUTPUT_DIR/$file" 2>&1 &
  watcher_pids+=("$!")
}
start_watch pods.txt pods -l app=back -o wide
start_watch endpoints.txt endpoints back -o 'custom-columns=NAME:.metadata.name,READY:.subsets[*].addresses[*].ip,NOT_READY:.subsets[*].notReadyAddresses[*].ip'
k get deployment back -o yaml > "$OUTPUT_DIR/deployment.yaml"
k get hpa -o yaml > "$OUTPUT_DIR/hpa.yaml"
{
  date -Is
  printf 'mode=%s profile=%s namespace=%s run_id=%s\n' "$MODE" "$PROFILE" "$NS" "$RUN_ID"
  printf 'rps=%s duration=%ss failure_delay=%ss ux_wait=%ss vus=%s/%s\n' "$RPS" "$DURATION_SECONDS" "$FAILURE_DELAY_SECONDS" "$UX_WAIT_SECONDS" "$PRE_ALLOCATED_VUS" "$MAX_VUS"
  printf 'api=%s front=%s ingress_ip=%s browser=%s\n' "$BASE_URL" "$FRONT_URL" "${INGRESS_IP:-DNS local}" "$K6_BROWSER_EXECUTABLE_PATH"
  k6 version
  minikube version
} > "$OUTPUT_DIR/configuracion.txt"

echo "Ejecutando $MODE; evidencias: $OUTPUT_DIR"
setsid k6 run --out "json=$OUTPUT_DIR/requests.json" \
  --summary-export "$OUTPUT_DIR/resumen-k6.json" tp-k8s/k6/e1-falla.js > "$OUTPUT_DIR/k6.txt" 2>&1 &
k6_pid=$!
start_ms=""
for _ in {1..300}; do
  start_ms="$(sed -nE 's/.*E1_START_MS=([0-9]+).*/\1/p' "$OUTPUT_DIR/k6.txt" | head -n 1)"
  [[ -n "$start_ms" ]] && break
  kill -0 "$k6_pid" 2>/dev/null || { cat "$OUTPUT_DIR/k6.txt"; exit 1; }
  sleep 0.1
done
[[ -n "$start_ms" ]] || { echo "k6 no inició los escenarios; no se borraron pods." >&2; exit 1; }
python3 - "$start_ms" "$FAILURE_DELAY_SECONDS" <<'PY'
import sys, time
time.sleep(max(0, int(sys.argv[1])/1000 + int(sys.argv[2]) - time.time()))
PY
kill -0 "$k6_pid" 2>/dev/null || { echo "k6 terminó antes de la falla." >&2; exit 1; }
for pid in "${watcher_pids[@]}"; do
  kill -0 "$pid" 2>/dev/null || { echo "Falló un registro de Kubernetes; no se borraron pods." >&2; exit 1; }
done
pods="$(select_pods)"
{
  printf '%s inicio del borrado\n' "$(date -Is)"
  printf 'kubectl delete pod --wait=false: %s\n' "$pods"
  # Los nombres provienen de Kubernetes. No usar --force: se mide SIGTERM/preStop.
  # shellcheck disable=SC2086
  k delete pod $pods --wait=false
  printf '%s borrado solicitado\n' "$(date -Is)"
} | tee "$OUTPUT_DIR/falla.txt"

k6_status=0
wait "$k6_pid" || k6_status=$?
k6_pid=""
k rollout status deployment/back --timeout=180s > "$OUTPUT_DIR/recuperacion.txt" 2>&1 || true
k get pods -l app=back -o wide >> "$OUTPUT_DIR/recuperacion.txt"
k get endpoints back >> "$OUTPUT_DIR/recuperacion.txt"
k get events --sort-by=.metadata.creationTimestamp > "$OUTPUT_DIR/eventos.txt"

# El JSON de k6 registra cada request al finalizar. Se excluye el tráfico UX.
python3 - "$OUTPUT_DIR" <<'PY' | tee "$OUTPUT_DIR/medicion.txt"
import collections, datetime, json, math, pathlib, sys
root = pathlib.Path(sys.argv[1])
requests, durations, dropped = [], [], 0
with (root / 'requests.json').open() as stream:
    for line in stream:
        point = json.loads(line)
        if point.get('type') != 'Point':
            continue
        data = point['data']
        tags = data.get('tags') or {}
        if tags.get('scenario') != 'carga':
            continue
        metric = point['metric']
        if metric == 'http_req_failed':
            requests.append((datetime.datetime.fromisoformat(data['time'].replace('Z', '+00:00')), bool(data['value']), tags.get('status', '0')))
        elif metric == 'http_req_duration':
            durations.append(data['value'])
        elif metric == 'dropped_iterations':
            dropped += data['value']
requests.sort()
errors = [r for r in requests if r[1]]
after = [r for r in requests if errors and r[0] > errors[-1][0] and not r[1]]
durations.sort()
def percentile(values, q):
    if not values:
        return None
    index = (len(values)-1)*q
    low = math.floor(index)
    return values[low] + (values[math.ceil(index)]-values[low])*(index-low)
p95 = percentile(durations, .95)
result = {
    'requests': len(requests), 'errores': len(errors),
    'porcentaje_error': 100*len(errors)/len(requests) if requests else None,
    'estados_http': dict(collections.Counter(r[2] for r in requests)),
    'primer_error': errors[0][0].isoformat() if errors else None,
    'ultimo_error': errors[-1][0].isoformat() if errors else None,
    'ventana_error_s': (errors[-1][0]-errors[0][0]).total_seconds() if errors else None,
    'primer_exito_posterior': after[0][0].isoformat() if after else None,
    'recuperacion_observada': bool(after) if errors else None,
    'p95_ms': p95, 'iteraciones_descartadas': dropped,
    'slo_error': len(errors)/len(requests) < .01 if requests else False,
    'slo_p95': p95 < 300 if p95 is not None else False,
}
(root / 'medicion.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
if not requests:
    sys.exit('SIN REQUESTS: ejecución inválida.')
if not errors:
    print('Sin errores observados; no hay ventana de recuperación que medir.')
elif not after:
    print('No se observó recuperación dentro de la prueba; la ventana de error es parcial.')
if dropped:
    print('Se descartaron iteraciones: no se mantuvo toda la carga prevista.')
PY

[[ -s "$SCREENSHOT_PATH" ]] || { echo "Falta la captura UX; revisar k6.txt." >&2; exit 1; }
if [[ "$MODE" == e1b ]]; then
  # Solo publicar la captura como evidencia de falla si se detectó degradación.
  if python3 - "$OUTPUT_DIR/resumen-k6.json" <<'PY'
import json, sys
summary = json.load(open(sys.argv[1]))
sys.exit(0 if summary['metrics'].get('ux_degradada', {}).get('value') == 1 else 1)
PY
  then
    cp "$SCREENSHOT_PATH" tp-k8s/evidencias/falla-ux.png
  else
    echo "E1b no mostró un error visible: revisar captura y repetir; no se publicó falla-ux.png." >&2
    exit 1
  fi
fi
echo "Código k6: $k6_status (99 indica thresholds incumplidos; ver resumen-k6.json)."
echo "Contrastar medicion.txt con falla.txt, endpoints.txt y pods.txt."
exit "$k6_status"
