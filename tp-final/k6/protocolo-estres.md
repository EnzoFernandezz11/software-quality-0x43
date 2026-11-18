# Protocolo previo: estrés A/B del frontend

Protocolo previo a las mediciones. Coordinar con Valentino el momento de la corrida al 50 % y los criterios de avance y rollback.

## Pregunta e hipótesis

¿Presenta la candidata `1.1.0` una regresión relevante frente a la estable `1.0.0` bajo carga comparable?

Hipótesis: con carga comparable, el p95 de la candidata es como máximo un 10 % mayor que el de la estable, ambas versiones presentan menos del 1 % de errores y el p95 de la candidata es menor a 300 ms. Adoptamos los umbrales absolutos como criterios de esta prueba del frontend. El 10 % fija el margen de regresión que queremos detectar durante el rollout.

## Preparación

- Desplegar ambas versiones detrás del mismo Ingress con peso canary de 50 %. Identificar las respuestas de `GET http://terrasense.local/dashboard` mediante `X-App-Version`.
- Mantener equivalentes los requests y limits, el número de réplicas y demás condiciones relevantes de ambos despliegues. Registrar los valores reales y las revisiones e imágenes utilizadas.
- Ejecutar el mismo escenario al mismo tiempo para ambas versiones. En una corrida aparte, usar k6/browser para verificar el panel, el JavaScript y el CSS y guardar capturas.
- Verificar que la gate de la candidata esté aprobada. Acordar con Valentino los pesos y los criterios de avance y rollback de las mediciones de reparto. Los criterios de este A/B aplican al peso 50 %.

## Perfil de carga propuesto

Generar solicitudes con ritmo de llegada fijo por etapa, sin pausa entre etapas:

| Etapa | Objetivo total | Duración |
| --- | --- | --- |
| 1 | 10 solicitudes/s | 2 min |
| 2 | 20 solicitudes/s | 2 min |
| 3 | 40 solicitudes/s | 2 min |
| 4 | 80 solicitudes/s | 2 min |

Con reparto 50 %, se esperan aproximadamente la mitad de solicitudes por versión, pero se informarán las tasas y cantidades observadas. El perfil dura 8 minutos. La carga máxima es un punto de partida: no se supone que alcance para saturar el frontend ni que el generador pueda sostenerla.

## Registro e interpretación

Por etapa, conservar el comando, fecha, duración, peso, condiciones del despliegue, resumen y total de respuestas de cada versión y sin versión reconocida. Informar el denominador usado para el reparto, errores y p95 globales y por versión cuando existan muestras, tasa objetivo y lograda e iteraciones descartadas. Registrar también los recursos y estado de los pods y del generador para interpretar las limitaciones.

Evaluar la hipótesis por etapa. Para comparar, exigir al menos 200 respuestas reconocidas de cada versión, reparto reconocido entre 45/55 y 55/45 y cero descartes. Verificar la cantidad de solicitudes completadas contra la prevista, con un margen de una iteración por el límite temporal del escenario. Una etapa comparable cumple la hipótesis si se cumplen los tres límites, y la refuta en ese nivel de carga si incumple alguno. Si falla un criterio de comparabilidad, el resultado de la etapa queda inconcluso.

Investigar las respuestas sin versión y los errores globales antes de recomendar una promoción. Revisar las métricas del generador y del clúster para distinguir saturación del despliegue de límites del generador. Usar los resultados del TP4 como contexto de la API compartida y limitar la conclusión sobre el frontend a la carga medida sobre el documento de `/dashboard`.

## Controles incorporados después de la corrida documentada

Una etapa queda inconclusa si el 1 % o más del total de solicitudes completadas tiene una versión sin reconocer. Si la muestra es comparable y una versión incumple sus umbrales, el reporte conserva ese incumplimiento. Si las métricas por versión cumplen pero el porcentaje global de errores HTTP es del 1 % o más, la etapa queda inconclusa. El umbral de error global también se aplica a los thresholds de k6. Los reportes publicados del TP registran cero errores y cero respuestas sin versión, por lo que mantienen su resultado con estos controles.
