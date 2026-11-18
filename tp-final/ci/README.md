# Gate de calidad de la versión candidata

**Responsable:** Nacho. **Fecha de evaluación:** 18/11/2026. **Estado:** checks aprobados y GO para iniciar el rollout medido en `terrasense-tp23`.

La consigna del TP final (sección 3.1 de `TP_Final.pdf`) exige que la imagen candidata haya pasado linters y Horusec antes del rollout medido. El plan maestro del equipo asigna a Nacho la verificación de esa gate. La imagen y el proceso de build los prepara Valentín. Los dos documentos de planificación están fuera del repositorio; la evidencia técnica versionada se enlaza abajo.

## Qué está configurado

| Check | Disparo y alcance | Qué permite comprobar | Límite |
|---|---|---|---|
| [Quality Gate - Linters](../../.github/workflows/linter.yml) | PR hacia `main`, `development` o `develop`; push a `main`. Corre Flake8 sobre `app/`, ESLint sobre el frontend y clang-format sobre `src/` e `include/` del firmware. Un job final exige éxito de los tres. | El código analizado satisface las reglas estáticas configuradas en [.flake8](../../backend/flask/final_project/.flake8), [ESLint](../../frontend/dashboard/eslint.config.mjs) y [.clang-format](../../firmware/esp32/.clang-format). | No prueba funcionamiento, rendimiento, seguridad ni que la imagen desplegada se haya construido desde el commit analizado. Un push solo a la rama candidata no dispara este workflow. |
| [Horusec Security Scan](../../.github/workflows/horusec.yml) | Cualquier push o PR. Usa `horuszup/horusec-cli:v2.9.0-beta.3` y sube un JSON como artifact durante 14 días. | Se ejecutó el análisis SAST sobre la revisión del evento y hay un informe para revisar si el job y la subida terminaron bien. | El workflow no declara una política de severidades ni una revisión de falsos positivos. El estado verde del check no sustituye el análisis del JSON. La disponibilidad del artifact vence a los 14 días. |

Los workflows de build/tests de [frontend](../../.github/workflows/frontend-ci.yml), [backend](../../.github/workflows/backend-ci.yml) y [firmware](../../.github/workflows/firmware-ci.yml) están filtrados a PR hacia `development`; no forman parte automáticamente de la gate de un PR del TP final hacia `main`. Si se desean usar como condición del release, habrá que cambiar su disparador y verificarlo por separado. Esta observación no atribuye al pipeline actual una cobertura que no tiene.

## Hallazgos y límites ya documentados

- El [análisis de Horusec del TP2](../../RESPUESTAS_TP2_HORUSEC.md) y su [SARIF](../../evidencia-horusec-tp2.sarif) registran 16 hallazgos, de los cuales se clasificaron 3 como verdaderos positivos y 13 como falsos positivos. Esa corrida local usó Horusec CLI v2.8.0 y el motor interno. El workflow de la candidata usa v2.9.0-beta.3 y reúne resultados de varios analizadores.
- El hallazgo F-01 del TP2 ya documentaba el valor de respaldo de Flask. F-09 y F-10 señalan configuración guardada en `localStorage` que el cliente puede modificar.
- La gate de linters solo comprueba las reglas configuradas. La evidencia de diseño y de comportamiento viene de otras etapas: tests, despliegue y mediciones. No hay en este repositorio un conteo histórico de warnings de TP1 que permita afirmar una reducción numérica.

## Revisión de la candidata `1.1.0`

| Dato | Evidencia |
|---|---|
| Tag y revisión del build | `front-v1.1.0` → `acdca2896a16239c60d0fea21b6816a66b16857a`. El label OCI `org.opencontainers.image.revision` registra ese SHA. |
| Imagen de la candidata | `terrasense-front:1.1.0`. ID del build local `sha256:52c210ceec0131afcc6bbf6bd8bf664b7a18c34bdd31ce196aa36221e99019ab`. [Registro de build](https://github.com/EnzoFernandezz11/software-quality-0x43/blob/45848592ab9e380694078ef3cecce897428acaf3/tp-final/evidencias/reportes/imagenes/registro-1.1.0.txt) |
| Revisión analizada por Actions | Merge de prueba `d6c8fb2cb4337715c0d53657b184e3c0be5bc4d1` del [PR #27](https://github.com/EnzoFernandezz11/software-quality-0x43/pull/27). El merge de prueba y el commit del build tienen el mismo árbol Git `8c59b68f966f8aca9f5d1ed98e7504e56d41272b`. [Trazabilidad en #25](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/25#issuecomment-6968127024) |

| Check de Actions | Resultado | Alcance y límite |
|---|---|---|
| [Flake8](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106/job/134547394090) | Aprobado | Reglas estáticas de Python en `backend/flask/final_project/app/`. Las pruebas funcionales del backend quedan fuera de su alcance. |
| [ESLint](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106/job/134547394416) | Aprobado | Reglas del dashboard con Node 20. La carga del panel y sus recursos se comprueba en el navegador. |
| [clang-format](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106/job/134547394340) | Aprobado | Formato de `.cpp`, `.hpp` y `.h` en `src/` e `include/` del firmware. El comportamiento del firmware requiere otras pruebas. |
| [Gate global](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106/job/134547841601) | Aprobada | Consolida el resultado de los tres linters de [esta corrida](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473106). La revisión de Horusec se registra por separado. |
| [Horusec](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473114) | Análisis completado y JSON disponible | Escaneo estático del repositorio, que incluye código, ejemplos, pruebas y evidencia. El job permite hallazgos. La decisión depende de su clasificación y del entorno donde se despliega. |

Los tres linters también terminaron con código 0 al reproducirlos en una copia temporal de `acdca28`, con Python 3.12 y Flake8 7.5.0, Node 20 y ESLint 9.39.5, y clang-format 18.1.3.

## Interpretación del informe de Horusec

El JSON de la candidata registra **182 alertas** (10 críticas, 14 altas, 29 medias y 129 bajas). El [artefacto original](https://github.com/EnzoFernandezz11/software-quality-0x43/actions/runs/44228473114/artifacts/14393687943) está disponible hasta el 02/12/2026. SHA-256 del JSON descargado `654e50e1f32ae60bbaacfa5401ded5b701ab74104b1b7e742d077796e91859cd`.

| Severidad y cantidad | Clasificación | Decisión |
|---|---|---|
| Crítica · 1 | Hallazgo de configuración heredado. Flask puede usar un respaldo fijo si falta `FLASK_SECRET_KEY`. El despliegue del TP4 toma la variable de un Secret y el `.env` local contiene un valor público de ejemplo. | Verificar la clave efectiva en el backend compartido antes de medir. |
| Crítica · 9 | Cuatro alertas en el SARIF histórico y cinco en ejemplos o documentación. El origen de estas alertas es material versionado de referencia. | Verificar que el despliegue use un valor de Flask propio del entorno. |
| Alta · 2 | Falsos positivos de `HS-JAVASCRIPT-16` en `useSensorPolling`. `deriveAlert` construye un objeto de dominio para una alerta térmica. | Clasificados tras revisar el código de la candidata. |
| Alta · 8 | Uso de `Math.random` en datos simulados del dashboard y en scripts de k6. | El uso observado corresponde a generación de datos de prueba. |
| Alta · 4 | Safety evalúa rangos permitidos por `requirements.txt`. La imagen local inspeccionada tiene Flask 3.1.3, Flask-CORS 6.0.5, Marshmallow 4.4.0 y python-dotenv 1.2.4, fuera de los rangos señalados en esta corrida. | Confirmar el inventario en la imagen que use el canary si difiere de la inspeccionada. |
| Media · 29 y baja · 129 | Incluyen advertencias en manifiestos Kubernetes, incluido material histórico, aserciones de pruebas, código de firmware y el arranque local de Flask. | Los detalles por regla y archivo quedan en el JSON. |

La imagen de backend inspeccionada inicialmente fue `terrasense-back:local` con ID `sha256:15594d6dfbaff1780854c93396ddb8be25422a2aee77e36ad49190b701ed374d`. El perfil local de Minikube estaba detenido durante esa revisión. La verificación del inventario y de la clave efectiva en el entorno de medición quedó registrada después en la evidencia enlazada abajo.

## Decisión para el rollout medido

**18/11/2026 · Nacho · GO para iniciar el rollout medido de `front-v1.1.0` (`acdca28`).** Las comprobaciones que motivaron el NO-GO provisional quedaron resueltas en el perfil de Minikube `terrasense-tp23`, namespace `terrasense`. [Solicitud de verificación](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/22#issuecomment-6981814584) · [Confirmación del equipo](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/25#issuecomment-6986381594) · [Cierre de la gate](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/25#issuecomment-6986489015)

1. Ambos pods usan una clave efectiva de Flask propia del entorno. El equipo confirmó que difiere del respaldo y de los valores públicos de ejemplo y registró el resultado sin exponer la clave.
2. Ambos pods usan `terrasense-back:local` con ID `sha256:8a190cf71e6a51ae96312a692213479ed75d89e3029a84a6399e678f46b113f1`. El ID difiere del de la imagen local inicial. Los dos pods tienen Flask 3.1.3, Flask-CORS 6.0.5, Marshmallow 4.4.0 y python-dotenv 1.2.4, las mismas versiones evaluadas en esta revisión. [Registro de verificación](https://github.com/EnzoFernandezz11/software-quality-0x43/blob/5c8e0efaa2cb5324713ca9092adf3f51511c0f84/tp-final/evidencias/reportes/canary-previo/verificacion-gate.txt)

El GO habilita la medición en el entorno verificado. La decisión de promover o revertir la candidata se toma con los resultados del rollout y el estrés A/B. El resultado de la gate queda como insumo para el README técnico. [Rollout #22](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/22) · [Medición #23](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/23) · [README #24](https://github.com/EnzoFernandezz11/software-quality-0x43/issues/24)

## Material breve para la presentación

Los linters y Horusec se ejecutaron sobre el árbol Git que produjo `1.1.0`. La verificación de la clave efectiva y las dependencias del backend compartido habilitó el rollout medido en `terrasense-tp23`.

Las comprobaciones locales efectuadas sobre la base del TP4 se registran en [verificación local](verificacion-local.md). No constituyen la gate de `1.1.0`.
