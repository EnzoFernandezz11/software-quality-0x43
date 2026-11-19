# Videos del rollout: cambio de peso y reemplazo de un pod

Dos grabaciones de pantalla de Valentino, del 18 de noviembre de 2026, sin audio. Muestran el mecanismo del canary. **No reemplazan a las mediciones**: las cifras oficiales del reparto están en [`reparto-10.json` y `reparto-50.json`](../canary-23/), y las del reemplazo de un pod, en [`reemplazo-pod-stable.txt`](reemplazo-pod-stable.txt).

## [`cambio-peso.mp4`](../../videos/cambio-peso.mp4) · 2:50

**Es una recreación posterior a la medición.** Las etapas se midieron entre las 14:59 y las 15:06 en `terrasense-tp23`, y la promoción en `terrasense` fue a las 16:12. Este video se grabó entre las 17:12 y las 17:16, desde otro clon del repositorio (`video-canary`). `rollout.sh` informa el estado del código como `git=db095ca+sin-commitear`.

En el video hay dos zonas:
- **A la izquierda**, una terminal con `rollout.sh`.
- **A la derecha**, el panel de `terrasense.local/dashboard` en ventanas privadas de Brave. Cada ventana privada nueva llega sin cookie, así que vuelve a sortear la versión. La 1.0.0 se ve blanca, y la 1.1.0 tiene un banner violeta y el fondo verde.

| Hora | Comando | Resultado |
|---|---|---|
| 17:12:51 | `muestra 50` con peso 0 | 50 de 50 HTTP 200 con 1.0.0 |
| 17:13:10 | `peso 10` | Estable `terrasense-front:1.0.0` y canary `terrasense-front:1.1.0`, con 2 pods listos cada una |
| | `muestra 100` | 85 con 1.0.0 y 15 con 1.1.0 |
| | Ventanas privadas | Algunas cargan la 1.0.0 y otras la 1.1.0 |
| 17:15:18 | `peso 50` y `muestra 100` | 53 con 1.0.0 y 47 con 1.1.0 |

**Sobre el 15 % con peso 10.** Queda fuera del margen del plan (7–13 %), pero ese margen está pensado para muestras de unas 1.800 visitas. Con 100 visitas, el desvío esperable es de unos 3 puntos ($\sqrt{0{,}1 \times 0{,}9 / 100} \approx 0{,}03$), y 15 % está a menos de dos desvíos de 10 %. Es una demostración, no una etapa medida. La etapa medida del 10 % dio 10,27 % sobre 1.801 visitas.

**En la presentación** se muestra a pantalla completa, desde el segundo 20 y a 3× (unos 50 s), sin modificar el archivo.

## [`pods.mp4`](../../videos/pods.mp4) · 0:45

Muestra la eliminación de un pod de `front-stable` mientras recibe tráfico. Se grabó a las 19:53 en el namespace `terrasense` (código en `dd7e0a8`), con la estable en 1.0.0 y el canary en 1.1.0.

La pantalla está dividida en dos paneles:
- **Arriba:** `kubectl -n terrasense get pods -l app=front -L track,version -w`.
- **Abajo:** `bash tp-final/rollout/reemplazo-pod.sh`.

| Hora | Evento |
|---|---|
| 19:53:17 | Se elimina `front-stable-56fcb4798f-8j7gt` |
| 19:53:29 | `front-stable` vuelve a tener todos sus pods listos, en **12 s** |
| Resumen | **179 de 179** respuestas HTTP 200 con 1.0.0 durante el reemplazo |

**Es otra corrida que la del archivo de evidencia.** [`reemplazo-pod-stable.txt`](reemplazo-pod-stable.txt) registra la de las 13:39, con el código en `edba94f`: 188 de 188 respuestas y 13 s. La salida de la corrida del video no se guardó aparte. Las dos llegan a la misma conclusión: perder un pod del front no produjo errores.

Mientras termina, el pod eliminado aparece como `Error` en el panel de arriba. No se analizó el código de salida del contenedor.
