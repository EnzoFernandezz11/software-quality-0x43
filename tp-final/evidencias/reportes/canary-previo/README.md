# Puesta a punto previa al canary

Captura del 18 de noviembre de 2026, zona horaria Argentina (UTC-3), en Minikube `terrasense-tp23`, namespace `terrasense`. Despliegue de integración `99d2ce071cd4b35f485b9e4d945ba4e0a3e3fce2`; el smoke se ejecutó desde `54a2ac0c3dc7ebe291c24c248574199e7b3e5fd6`. Las revisiones de las imágenes están en la captura de configuración.

- `verificacion-gate.txt`: ambos pods backend cargaron una clave efectiva propia del entorno; incluye versiones de dependencias e identificadores de imagen. Es una comprobación técnica: el GO formal de #25 sigue pendiente de Nacho.
- `despliegue-configuracion.txt`: imágenes, recursos, réplicas, HPA, pods, servicios e Ingress. Es una captura puntual, no un estado en vivo. Peso canary configurado: 0 %.
- `smoke.json`: smoke de 10 segundos y un usuario virtual; 10 respuestas identificadas como 1.0.0, sin errores. El campo de peso esperado es `null` porque no se pasó al smoke; la configuración del Ingress se registró por separado.
- `ruteo-smoke.txt`: solicitudes HTTP normal y con `X-Canary: never` y `always`; respondieron 200 con versiones 1.0.0, 1.0.0 y 1.1.0 respectivamente.

El despliegue completó las migraciones y rollouts; sus verificaciones de `/health`, `/health/ready` y dashboard forzado a ambas versiones dieron OK. No se modificó `/etc/hosts`. No se ejecutaron scripts de etapa ponderada.

Comandos sintetizados desde la raíz; adaptar IP al perfil y disponer de los recursos ya desplegados:

```bash
minikube -p terrasense-tp23 kubectl -- -n terrasense get pods,deploy,hpa,svc,ingress -o wide
printf '%s\n' '{"hosts":{"terrasense.local":"192.168.67.2","api.terrasense.local":"192.168.67.2"}}' > /tmp/k6-dns.json
k6 run --config /tmp/k6-dns.json -e REPORT_JSON=/tmp/smoke.json tp-final/k6/smoke.js
curl --noproxy '*' --resolve terrasense.local:80:192.168.67.2 -sS -D - -o /dev/null http://terrasense.local/dashboard
# Repetir curl con -H 'X-Canary: never' y -H 'X-Canary: always'.
```
