# TP2 — Análisis Estático de Seguridad con Horusec

**Materia:** Gestión de la Calidad de Software  
**Herramienta:** Horusec CLI v2.8.0 / HorusecEngine v2.8.0  
**Fecha:** 21/09/2026  
**Evidencia:** `evidencia-horusec-tp2.sarif`

> La consigna original fue diseñada para un repositorio de la cátedra con 20 defectos intencionales. Esta entrega analiza un repositorio propio, por lo que informa los resultados efectivamente obtenidos sin tomar esa cantidad como objetivo.

## 1. Ejecución

Se analizó el frontend Next.js, el backend Flask, la configuración Docker y el firmware ESP32. Debido a que Docker no estaba disponible, se utilizó el motor interno de Horusec, se incluyeron los resultados informativos y se exportó la evidencia en SARIF:

```powershell
horusec.exe start -p <copia-versionada-del-repositorio> -D -I `
  -o sarif -O evidencia-horusec-tp2.sarif
```

La copia analizada incluyó los archivos versionados y excluyó informes anteriores de Horusec para evitar resultados autorreferenciales. El análisis fue local y el código no se envió a servicios externos.

## 2. Resultados

El SARIF contiene **16 findings**, correspondientes a 6 reglas.

| Severidad Horusec | Nivel SARIF | Cantidad |
|---|---|---:|
| Critical | `error` | 6 |
| High | `error` | 8 |
| Info | `note` | 2 |
| **Total** |  | **16** |

| Clasificación después de la revisión | Cantidad |
|---|---:|
| Verdadero positivo | 3 |
| Falso positivo | 13 |

Cada alerta producida por Horusec se revisó para determinar si representa una vulnerabilidad real, justificar su clasificación, identificar el activo afectado y proponer una corrección.

## 3. Análisis y clasificación de los hallazgos de Horusec

Los siguientes hallazgos fueron generados únicamente por el motor interno de Horusec, según lo indicado en la consigna.

| ID | Archivo y línea | Regla, categoría y severidad | Clasificación y justificación | Activo y consecuencia | Corrección propuesta |
|---|---|---|---|---|---|
| F-01 | `backend/flask/final_project/app/__init__.py:48` | `HS-LEAKS-25`, credencial hardcodeada, Critical | **Verdadero positivo.** `SECRET_KEY` utiliza el fallback público y predecible `dev-change-me` cuando falta la variable de entorno. | Sesiones y datos firmados por Flask. Puede permitir falsificación de valores firmados y suplantación de usuarios. | Eliminar el fallback, exigir `FLASK_SECRET_KEY` al iniciar y administrarla mediante secretos del entorno. |
| F-02 | `.env.example:29` | `HS-LEAKS-27`, contraseña en URL, Critical | Falso positivo. La URL contiene `${POSTGRES_PASSWORD}`, no una contraseña literal. | Credenciales y datos de PostgreSQL. Esta línea no produce una fuga; sería vulnerable si incluyera un valor real. | Mantener la variable o documentar la URL sin credenciales; aceptar únicamente este hash como falso positivo. |
| F-03 | `docker/README.md:104` | `HS-LEAKS-27`, contraseña en URL, Critical | Falso positivo. Es un ejemplo documental para una base local, no configuración ejecutada ni una credencial productiva confirmada. | Base PostgreSQL local. Sería riesgoso si la contraseña se reutilizara en un entorno compartido. | Reemplazar el valor por `<PASSWORD>` y exigir credenciales distintas por entorno. |
| F-04 | `docker/README.md:302` | `HS-LEAKS-26`, contraseña hardcodeada, Critical | Falso positivo. Es un fragmento TypeORM del README y no código ejecutado. | Base PostgreSQL local. El riesgo aparecería si el ejemplo se copiara literalmente a producción. | Mostrar `process.env.POSTGRES_PASSWORD` en el ejemplo. |
| F-05 | `firmware/esp32/.env.example:3` | `HS-LEAKS-26`, contraseña hardcodeada, Critical | Falso positivo. `TU_PASSWORD_AQUI` es un placeholder, no una contraseña válida. | Red Wi-Fi. No existe exposición actual. | Usar `<WIFI_PASSWORD>` y mantener la configuración real fuera de Git. |
| F-06 | `firmware/esp32/.env.example:10` | `HS-LEAKS-25`, credencial hardcodeada, Critical | Falso positivo. `TU_TOKEN_DE_AUTENTICACION` es un placeholder. | Identidad del dispositivo y API. No existe un token utilizable en esa línea. | Usar `<API_KEY>` y aprovisionar el secreto por un canal seguro. |
| F-07 | `frontend/dashboard/src/hooks/useSensorPolling.ts:11` | `HS-JAVASCRIPT-16`, uso de `alert`, High | Falso positivo. `deriveAlert` construye un objeto de dominio; no invoca `window.alert`. | Telemetría térmica. No se muestra información mediante un diálogo del navegador. | No requiere corrección; opcionalmente renombrar a `deriveThermalNotification`. |
| F-08 | `frontend/dashboard/src/hooks/useSensorPolling.ts:77` | `HS-JAVASCRIPT-16`, uso de `alert`, High | Falso positivo. La llamada es a `deriveAlert`, no al método global `alert`. | Telemetría térmica. Sin consecuencia de seguridad. | Aceptar el hash específico o aplicar el mismo cambio de nombre de F-07. |
| F-09 | `frontend/dashboard/src/services/mockData.ts:22` | `HS-JAVASCRIPT-14`, Web Storage, Info | **Verdadero positivo.** Inicializa configuración hardcodeada de la sala y la persiste en un almacenamiento controlado por el cliente. | Umbrales térmicos, temperatura objetivo y modo de sala. Cualquier script del origen puede leer o modificar esos valores. | Obtener la configuración del backend, autorizar cambios y validar rangos del lado servidor. |
| F-10 | `frontend/dashboard/src/services/mockData.ts:30` | `HS-JAVASCRIPT-14`, Web Storage, Info | **Verdadero positivo.** La configuración actualizada queda confiada a `localStorage` y puede manipularse desde el navegador. | Integridad de la configuración mostrada por el dashboard. Puede alterarse el modo o los límites locales. | Persistir cambios en el backend autenticado y no utilizar Web Storage como fuente confiable. |
| F-11 | `frontend/dashboard/src/services/mockData.ts:45` | `HS-JAVASCRIPT-6`, PRNG débil, High | Falso positivo. `Math.random()` solo agrega ruido a una temperatura sintética. | Telemetría mock. Solo cambia el dato visual. | No requiere CSPRNG; usar una semilla si se necesitan pruebas repetibles. |
| F-12 | `frontend/dashboard/src/services/mockData.ts:112` | `HS-JAVASCRIPT-6`, PRNG débil, High | Falso positivo. Genera variaciones de un historial térmico simulado, no secretos. | Gráfico histórico mock. Sin consecuencia de seguridad. | Utilizar fixtures deterministas para pruebas. |
| F-13 | `frontend/dashboard/src/services/mockData.ts:179` | `HS-JAVASCRIPT-6`, PRNG débil, High | Falso positivo. Decide cuándo agregar un evento ficticio al feed. | Feed simulado. No habilita acceso ni modifica auditorías reales. | Usar una secuencia fija si se requiere determinismo. |
| F-14 | `frontend/dashboard/src/services/mockData.ts:180` | `HS-JAVASCRIPT-6`, PRNG débil, High | Falso positivo. Decide el resultado de una autenticación ficticia y no concede acceso al backend. | Auditoría mock. Sin efecto sobre autenticación real. | Mantener el mock separado del flujo productivo. |
| F-15 | `frontend/dashboard/src/services/mockData.ts:181` | `HS-JAVASCRIPT-6`, PRNG débil, High | Falso positivo. Selecciona la etiqueta `RFID` o `PIN` para un registro ficticio. | Descripción de una auditoría mock. Sin efecto de seguridad. | Alternar de forma determinista si es necesario. |
| F-16 | `frontend/dashboard/src/services/mockData.ts:185` | `HS-JAVASCRIPT-6`, PRNG débil, High | Falso positivo. El PIN generado solo integra una auditoría ficticia y no se valida como credencial. | Campo visual `pin_entered`. Sería vulnerable si se utilizara como PIN, OTP o token real. | Usar un literal en el mock; para credenciales reales, CSPRNG, expiración y límite de intentos. |

## 4. Respuestas a la consigna

### 1. ¿Cuántos findings totales obtuviste?

Se obtuvieron **16 hallazgos en total**: 6 de severidad Critical, 8 High y 2 Info. El resultado completo se encuentra en `evidencia-horusec-tp2.sarif`.

### 2. ¿Cuáles findings corresponden a verdaderos positivos?

Después de revisar las alertas, se consideraron verdaderos positivos los siguientes casos:

- **F-01:** la aplicación puede utilizar una clave Flask fija y conocida.
- **F-09:** la configuración inicial de la sala queda guardada en `localStorage`.
- **F-10:** los cambios de esa configuración también quedan guardados y pueden modificarse desde el navegador.

### 3. ¿Qué categorías de vulnerabilidad encontraste?

- Credenciales y contraseñas escritas directamente en el código.
- Contraseñas incluidas en una URL.
- Posible uso de ventanas de alerta de JavaScript.
- Uso de `Math.random()` para generar valores aleatorios.
- Almacenamiento de datos en `localStorage`.

### 4. Elegí cinco verdaderos positivos y describí un escenario de impacto realista

En este repositorio se confirmaron tres verdaderos positivos, por lo que solo se pueden describir estos tres escenarios:

1. **F-01 — clave Flask:** si no se configura `FLASK_SECRET_KEY`, la aplicación usa `dev-change-me`. Como este valor está publicado en el repositorio, alguien podría aprovecharlo para alterar una sesión o hacerse pasar por otro usuario.
2. **F-09 — configuración inicial en `localStorage`:** cualquier persona con acceso al navegador puede ver o cambiar los límites de temperatura, la temperatura objetivo y el modo de la sala.
3. **F-10 — cambios guardados en el navegador:** un usuario puede modificar manualmente la configuración almacenada sin que el servidor compruebe si esos valores son correctos.

### 5. Identificá todos los falsos positivos y explicá qué contexto hace que la regla no aplique

- **F-02:** la URL usa variables de entorno y no contiene una contraseña escrita directamente.
- **F-03 y F-04:** son ejemplos incluidos en la documentación para trabajar de forma local; no son configuraciones que ejecute la aplicación.
- **F-05 y F-06:** `TU_PASSWORD_AQUI` y `TU_TOKEN_DE_AUTENTICACION` son textos de ejemplo, no credenciales reales.
- **F-07 y F-08:** `deriveAlert` es el nombre de una función que crea una alerta de temperatura; no llama a la ventana `alert` del navegador.
- **F-11 a F-16:** `Math.random()` se utiliza para generar información simulada y no para crear contraseñas ni permitir accesos reales.

### 6. Elegí dos falsos positivos: ¿qué tendría que cambiar para que pasen a ser verdaderos positivos?

- **F-03:** pasaría a ser un verdadero positivo si `dev_password_2026` fuera la contraseña de una base de datos real o compartida. En ese caso, cualquier persona que leyera el README conocería la credencial.
- **F-16:** pasaría a ser un verdadero positivo si el número generado con `Math.random()` se utilizara como PIN real de acceso. Esos números pueden ser más fáciles de adivinar y no deberían utilizarse como credenciales.

### 7. ¿Qué riesgo existe si se ignoran automáticamente severidades bajas o informativas?

Una severidad baja o informativa no significa que el hallazgo no tenga importancia. Por ejemplo, F-09 y F-10 fueron informados como Info, pero permiten modificar configuración desde el navegador. Si el equipo descartara automáticamente estas alertas, podría ignorar problemas que afectan al funcionamiento del sistema. Por eso cada caso debe revisarse teniendo en cuenta cómo se usa el dato dentro de la aplicación.

### 8. ¿Por qué un análisis sin alertas no demuestra que el sistema sea seguro?

Horusec busca patrones definidos en sus reglas, pero no puede comprender por completo el funcionamiento del sistema. Una vulnerabilidad puede no coincidir con ninguna regla o depender de cómo se configura y utiliza la aplicación. Por eso, que el análisis no muestre alertas solo significa que Horusec no encontró coincidencias; no garantiza que el software sea seguro.

### 9. ¿Qué controles complementarían SAST en un pipeline DevSecOps?

- Revisar si las dependencias utilizadas tienen vulnerabilidades conocidas, por ejemplo con `npm audit` y `pip-audit`.
- Buscar claves o contraseñas subidas por error al repositorio y a su historial.
- Probar la aplicación mientras está funcionando para detectar problemas que no aparecen al leer el código.
- Crear pruebas para verificar la autenticación y los permisos de usuarios y dispositivos.
- Revisar la configuración de Docker y de los entornos donde se despliega la aplicación.
- Realizar revisiones manuales de las partes más importantes, como el ingreso mediante PIN y el envío de datos de los sensores.
- Limitar intentos de acceso, cambiar las claves periódicamente y registrar actividades sospechosas.

### 10. Si Horusec se ejecutara en GitHub Actions, ¿qué severidades usarías como Quality Gate y por qué?

Usaría el siguiente criterio para decidir si el pipeline puede continuar:

- Los hallazgos Critical y High bloquearían el pipeline hasta ser revisados o corregidos.
- Los Medium bloquearían cuando se confirme que afectan accesos, contraseñas o información importante.
- Los Low e Info se mostrarían para revisión, pero no bloquearían automáticamente.
- Los falsos positivos deberían quedar justificados para que no vuelvan a generar trabajo innecesario.

En este análisis, F-01 bloquearía el pipeline por tratarse de una clave insegura. F-09 y F-10 deberían corregirse aunque sean informativos. F-07 y F-08 podrían marcarse como falsos positivos después de comprobar que no utilizan `window.alert`.
