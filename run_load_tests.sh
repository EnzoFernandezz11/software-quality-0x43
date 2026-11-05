#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
k() { minikube -p soft-eng kubectl -- --context=soft-eng -n soft-eng "$@"; }
for tool in minikube python3 curl; do
  command -v "$tool" >/dev/null || { echo "Falta $tool" >&2; exit 1; }
done
profile=${1:-all}
case "$profile" in all) profiles=(smoke average stress soak breakpoint spike);; smoke|average|stress|soak|breakpoint|spike) profiles=("$profile");; *) echo "Perfil inválido: $profile" >&2; exit 2;; esac
echo "Comprobando la API en Kubernetes..."
k rollout status deployment/flask-backend --timeout=120s
k create configmap k6-script --from-file=load-test.js=kubernetes/load-test.js --dry-run=client -o yaml | k apply -f -
k create configmap grafana-dashboards --from-file=k6.json=kubernetes/grafana-dashboard.json --dry-run=client -o yaml | k apply -f -
k apply -f kubernetes/monitoring.yaml
for service in prometheus grafana; do k rollout status "deployment/$service" --timeout=300s; done
tunnel_pid=""
cleanup() {
  if [[ -n "$tunnel_pid" ]]; then
    kill "$tunnel_pid" 2>/dev/null || true
    wait "$tunnel_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
if ! curl -fsS --max-time 2 http://127.0.0.1:3001/api/health >/dev/null; then
  k port-forward service/grafana 3001:3000 &
  tunnel_pid=$!
  for _ in {1..30}; do
    curl -fsS --max-time 1 http://127.0.0.1:3001/api/health >/dev/null 2>&1 && break
    kill -0 "$tunnel_pid" 2>/dev/null || { echo "No se pudo abrir el puerto 3001" >&2; exit 1; }
    sleep 1
  done
fi
curl -fsS --max-time 2 http://127.0.0.1:3001/api/health >/dev/null || { echo "Grafana no responde en el puerto 3001" >&2; exit 1; }
echo "Grafana: http://localhost:3001/d/k6-local"
echo "Dejá esta terminal abierta durante las pruebas."
for profile in "${profiles[@]}"; do
  run_id="${profile}-$(date +%Y%m%d%H%M%S)"
  job="k6-${run_id}"
  echo "Ejecutando $profile ($run_id)"
  PROFILE="$profile" RUN_ID="$run_id" JOB="$job" python3 - <<'PY' | k apply -f -
import json, os
p=os.environ['PROFILE']; run=os.environ['RUN_ID']; name=os.environ['JOB']
container={'name':'k6','image':'grafana/k6:2.3.0','args':['run','-o','experimental-prometheus-rw','/scripts/load-test.js'],'env':[{'name':'BASE_URL','value':'http://flask-backend:5000'},{'name':'PROFILE','value':p},{'name':'RUN_ID','value':run},{'name':'K6_PROMETHEUS_RW_SERVER_URL','value':'http://prometheus:9090/api/v1/write'},{'name':'K6_PROMETHEUS_RW_TREND_STATS','value':'p(95),avg'},{'name':'K6_PROMETHEUS_RW_STALE_MARKERS','value':'true'}], 'volumeMounts':[{'name':'script','mountPath':'/scripts'}]}
print(json.dumps({'apiVersion':'batch/v1','kind':'Job','metadata':{'name':name},'spec':{'backoffLimit':0,'template':{'spec':{'restartPolicy':'Never','containers':[container],'volumes':[{'name':'script','configMap':{'name':'k6-script'}}]}}}}))
PY
  if ! k wait --for=condition=Ready "pod" -l "job-name=$job" --timeout=300s; then
    k describe job "$job" || true
    exit 1
  fi
  k logs -f "job/$job" || true
  if ! k wait --for=condition=complete "job/$job" --timeout=60s; then
    k describe job "$job" || true
    exit 1
  fi
done
echo "Pruebas terminadas. Grafana: http://localhost:3001/d/k6-local"
if [[ -n "$tunnel_pid" ]]; then
  echo "Presioná Ctrl+C para cerrar el acceso a Grafana."
  wait "$tunnel_pid"
fi
