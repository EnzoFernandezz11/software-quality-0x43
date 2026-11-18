# Verificación local de la base del TP4

**Fecha:** 17/11/2026. **Revisión:** `d9fa03b` (`origin/feat/tp4-k8s-hpa` al preparar esta rama). Estas comprobaciones se hicieron sobre la base anterior a la imagen candidata; no acreditan la gate de `1.1.0`.

| Componente | Comando equivalente al workflow | Resultado observado |
|---|---|---|
| Backend | `flake8 app/ --count --show-source --statistics` desde `backend/flask/final_project` | Código de salida 0; salida `0`. Se ejecutó en `python:3.11-slim` con Flake8 instalado dentro del contenedor. El workflow usa Python 3.12. |
| Frontend | `npm ci --no-audit --no-fund` y `npm run lint` desde `frontend/dashboard` | Ambos terminaron con código 0. `npm ci` instaló 935 paquetes y emitió advertencias de paquetes obsoletos; ESLint terminó sin diagnósticos. Se usó el Node local, mientras que el workflow fija Node 20. |
| Firmware | `find src include \( -name '*.cpp' -o -name '*.hpp' -o -name '*.h' \) -exec clang-format --dry-run --Werror {} +` desde `firmware/esp32` | Código de salida 0, sin diagnósticos. Se ejecutó en `ubuntu:24.04` con clang-format instalado dentro del contenedor. |

No se ejecutó Horusec en esta verificación local: la evidencia histórica está en el informe del TP2 y el análisis que importa para la gate debe corresponder a la candidata. Tampoco se ejecutaron estos checks en GitHub Actions durante esta sesión. Las diferencias de versiones entre los contenedores locales y Actions impiden presentarlos como sustituto de los jobs remotos.
