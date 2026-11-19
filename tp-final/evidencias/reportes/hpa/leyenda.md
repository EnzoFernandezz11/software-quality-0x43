# Captura OBS: ensayo HPA

[Grabación real de terminal](../../videos/hpa-escala.mp4) realizada el 18 de noviembre de 2026 en el perfil aislado `terrasense-tp23`. El recorte conserva el intervalo 00:40–04:10 del archivo original, se reproduce a 1,25× y no contiene audio; dura 2 min 48 s. La banda superior indica la aceleración. El original permanece intacto fuera del repositorio. Para la presentación se derivó [hpa-escala.gif](../../videos/hpa-escala.gif): la mitad izquierda del cuadro (donde están el HPA, los pods y k6) a 2 cuadros por segundo, con la misma velocidad de 1,25× y el resumen final de k6 fijo 4 s antes de repetir.

El panel superior muestra HPA y pods con hora local UTC−3; el inferior muestra k6. Al inicio había 2 pods listos. Durante la carga se observaron pods temporalmente no listos y el HPA pasó a 6 réplicas; a las 14:48:16 se registraron los 6 pods listos. Se aplicó `e2-spike.js` con rampa de 5 s hasta 100 iteraciones/s, meseta de 3 min y bajada de 5 s. El objetivo no implica tasa conseguida.

k6 completó 17.760 solicitudes (93,47/s en el resumen), con 1.540 fallas (8,67 %): 1.399 respuestas HTTP 503 y 141 respuestas HTTP 502. El p95 de duración HTTP fue 14,47 s y se descartaron 739 iteraciones; por ello no se mantuvo toda la carga prevista. El script terminó con código 0 y no establece thresholds; eso no implica cumplimiento de SLO. La pérdida de readiness se observó durante la carga, pero la captura no establece por sí sola una causa única de las respuestas 502 y 503.

El tamaño del panel deja visible solo la parte inferior del resumen de k6 en la captura; el resumen completo está en [k6.txt](k6.txt); las métricas individuales permanecen fuera del repositorio. Las observaciones del HPA y los pods están en [muestras-hpa.jsonl](muestras-hpa.jsonl).

El ensayo anterior y su evidencia reconstruida permanecen disponibles en el [commit aa09215](https://github.com/EnzoFernandezz11/software-quality-0x43/tree/aa0921590ecdd98ff856b3d0751332ece51f20ec/tp-final/evidencias/reportes/hpa).
