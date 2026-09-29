# TP2 — Análisis Estático de Seguridad con Horusec

**Materia:** Gestión de la Calidad de Software  
**Aplicación analizada:** Aegis Vault SAST Lab  
**Tecnologías:** React y TypeScript  
**Herramienta:** Horusec CLI v2.8.0  
**Fecha:** 23/09/2026  
**Evidencia:** `evidencia-horusec-tp2-aegis-vault.sarif`

## 1. Introducción

Para este trabajo analizamos Aegis Vault, una aplicación de ejemplo que maneja datos ficticios de pacientes, empleados y operadores. Entre los datos que muestra hay historias clínicas, información financiera, datos personales y accesos privilegiados.

Nuestro objetivo no fue corregir el código, sino ejecutar Horusec, revisar sus resultados y determinar cuáles alertas representan problemas reales y cuáles son falsos positivos.

## 2. Resumen de resultados

| Severidad | Cantidad |
|---|---:|
| Critical | 2 |
| High | 19 |
| Medium | 5 |
| Low | 2 |
| Info | 3 |
| **Total** | **31** |

Después de revisar el código, clasificamos los resultados de esta manera:

| Clasificación | Cantidad |
|---|---:|
| Verdaderos positivos | 20 |
| Falsos positivos | 11 |
| **Total** | **31** |

La terminal también mostró un mensaje que hablaba de 28 vulnerabilidades. La diferencia se debe a que ese resumen no contó las tres alertas informativas. El archivo SARIF sí contiene los 31 resultados, por lo que tomamos ese número para el informe.

## 3. Revisión de los verdaderos positivos

Consideramos verdaderos positivos a los siguientes 20 casos porque, al revisar el código y su uso, encontramos un riesgo real.

| ID | Ubicación | Regla y severidad | Por qué es un problema | Información afectada y posible consecuencia | Posible corrección |
|---|---|---|---|---|---|
| VP-01 | `server/modules/tlsClient.ts:2` | `HS-JAVASCRIPT-3` — **Critical** | Se desactiva la validación de certificados TLS. La aplicación podría confiar en un servidor falso. | Los datos enviados por la red podrían ser leídos o modificados por un atacante. | No desactivar la validación y utilizar certificados válidos. |
| VP-02 | `src/services/riskSimulator.ts:4` | `HS-JAVASCRIPT-2` — **Critical** | El contenido del campo “Fórmula de impacto” llega directamente a `eval`. Esto permite ejecutar JavaScript escrito por el usuario. | Podrían quedar expuestos los datos visibles en la sesión del navegador. | Reemplazar `eval` por una función que acepte solamente números y operaciones matemáticas permitidas. |
| VP-03 | `server/modules/navigation.ts:2` | `HS-JAVASCRIPT-22` — **High** | La aplicación redirige al valor recibido en `next` sin verificarlo. | Un usuario podría ser enviado a una página falsa para robarle información. | Permitir únicamente rutas internas conocidas. |
| VP-04 | `server/modules/passwordDigest.ts:4` | `HS-JAVASCRIPT-4` — **High** | Las contraseñas se procesan con MD5, un algoritmo antiguo que ya no se considera seguro. | Si se filtran los resultados, sería más fácil descubrir las contraseñas. | Usar una función actual creada específicamente para guardar contraseñas, como bcrypt. |
| VP-05 | `server/modules/maintenanceCli.ts:1` | `HS-JAVASCRIPT-21` — **High** | Se ejecuta con `exec` un argumento recibido desde la línea de comandos sin validarlo. | Se podrían ejecutar comandos no autorizados y acceder a archivos del servidor. | Definir una lista de tareas permitidas y no pasar texto libre a `exec`. |
| VP-06 | `server/modules/staticFiles.ts:2` | `HS-JAVASCRIPT-17` — **High** | La opción `dotfiles: 'allow'` permite servir archivos ocultos. | Podrían publicarse por error archivos como `.env` o información del repositorio Git. | Cambiar la opción a `deny` y publicar solo una carpeta preparada para archivos estáticos. |
| VP-07 | `server/modules/weakTls.ts:2` | `HS-JAVASCRIPT-12` — **High** | Se fuerza el uso de TLS 1.1, una versión vieja que ya no se considera segura. | La información enviada por la red podría quedar menos protegida. | Utilizar una versión actual de TLS, como TLS 1.2 o TLS 1.3. |
| VP-08 | `src/services/productionProbe.ts:2` | `HS-JAVASCRIPT-15` — **High** | Hay una sentencia `debugger` que no está limitada al modo de desarrollo. | Podría detener la aplicación y permitir inspeccionar el contenido recibido por la función. | Eliminar el `debugger` del código de producción. |
| VP-09 | `server/modules/profileRenderer.ts:2` | `HS-JAVASCRIPT-23` — **High** | Se envía todo `req.body` directamente a la plantilla, sin revisar qué campos contiene. | Un usuario podría enviar valores no esperados y modificar la información que se muestra. | Pasar a la plantilla solamente los campos que la aplicación espera. |
| VP-10 | `src/services/legacyClientDb.ts:9` | `HS-JAVASCRIPT-13` — **High** | Se usa Web SQL, una tecnología obsoleta para guardar la auditoría en el navegador. | Un script del mismo sitio podría leer o cambiar esos datos y algunos navegadores ni siquiera soportan la tecnología. | Guardar la auditoría en el servidor. Si el dato no fuera sensible, se podría usar IndexedDB. |
| VP-11 | `src/services/recoveryDialog.ts:2` | `HS-JAVASCRIPT-16` — **High** | El código de recuperación se muestra mediante `prompt`. | El código podría ser visto por otra persona o capturado por un script/extensión del navegador. | Usar un flujo de recuperación autenticado y códigos de un solo uso que venzan rápidamente. |
| VP-12 | `src/services/frameBridge.ts:5` | `HS-JAVASCRIPT-11` — **High** | `postMessage` usa `"*"` como destino y envía el registro completo. | Una ventana padre no confiable podría recibir historias clínicas, datos financieros o información de acceso. | Indicar el dominio exacto que puede recibir el mensaje y enviar solo los datos necesarios. |
| VP-13 | `server/modules/tokenDigest.ts:4` | `HS-JAVASCRIPT-5` — **High** | Los tokens se procesan con SHA-1, que ya no se recomienda para usos de seguridad. | Si esos datos se filtran, sería más fácil intentar obtener los tokens originales. | Reemplazar SHA-1 por un método más seguro y actual. |
| VP-14 | `src/services/riskSimulator.ts:10` | `HS-JAVASCRIPT-6` — **High** | El identificador de recuperación se genera con `Math.random()` y la fecha actual, por lo que puede ser predecible. | Otra persona podría intentar adivinar un identificador válido de recuperación. | Usar el generador seguro que ofrece el navegador y hacer que el identificador venza. |
| VP-15 | `server/modules/reportStream.ts:4` | `HS-JAVASCRIPT-8` — **Medium** | El nombre recibido en `req.params.file` se usa directamente para abrir un archivo. | Se podrían usar rutas con `../` para intentar leer archivos fuera de la carpeta de reportes. | Usar una carpeta base fija y comprobar que la ruta final siga dentro de ella. |
| VP-16 | `server/modules/reportReader.ts:4` | `HS-JAVASCRIPT-7` — **Medium** | El valor de `req.query.report` también se usa como ruta sin validarlo. | Podrían quedar expuestos archivos de configuración u otros reportes. | Trabajar con identificadores de reporte o limitar la lectura a nombres y extensiones permitidos. |
| VP-17 | `server/modules/errorResponder.ts:2` | `HS-JAVASCRIPT-25` — **Medium** | La respuesta devuelve `err.stack` completo al usuario. | Se muestran rutas internas y detalles del código que pueden ayudar a preparar otros ataques. | Mostrar un error genérico al usuario y guardar el detalle solamente en los logs del servidor. |
| VP-18 | `server/modules/xmlImport.ts:8` | `HS-JAVASCRIPT-10` — **Medium** | Se recibe un XML y se procesa sin mostrar medidas para bloquear contenido externo. | Un XML preparado de forma maliciosa podría intentar leer archivos del servidor. | Configurar el lector de XML para que no pueda acceder a archivos o direcciones externas. |
| VP-19 | `server/modules/corsPolicy.ts:4` | `HS-JAVASCRIPT-19` — **Low** | Se llama a `cors()` sin indicar qué sitios están permitidos. | Una página de otro dominio podría intentar acceder a la API. | Indicar de forma explícita qué sitios pueden conectarse. |
| VP-20 | `src/services/sensitiveCache.ts:5` | `HS-JAVASCRIPT-14` — **Info** | Se guarda en `localStorage` el registro sensible completo que selecciona el usuario. | Otro script del mismo sitio o una persona con acceso al navegador podría leer información médica o financiera. | No guardar el registro completo. Mantenerlo en memoria o guardar solo un identificador temporal. |

## 4. Revisión de los falsos positivos

Los siguientes 11 casos coinciden con una regla de Horusec, pero el contexto del código hace que no sean vulnerabilidades reales.

| ID | Ubicación | Regla y severidad | Por qué lo consideramos falso positivo | Qué pasaría y posible mejora |
|---|---|---|---|---|
| FP-01 | `server/modules/corsPolicy.ts:1` | `HS-JAVASCRIPT-19` — **Low** | La línea solo declara la función `cors` para que TypeScript conozca su tipo. No configura ningún encabezado. El problema real aparece por separado en la línea 4. | Esta línea sola no tiene impacto. Importar la función desde su paquete real podría evitar la alerta duplicada. |
| FP-02 | `server/support/cacheHash.ts:5` | `HS-JAVASCRIPT-4` — **High** | MD5 se usa solamente para saber si cambió un CSS público. No se usa con contraseñas ni para comprobar seguridad. | Un resultado repetido podría afectar la caché, pero no permitiría entrar al sistema. Se podría usar un algoritmo actual para evitar la alerta. |
| FP-03 | `server/support/escapedEcho.ts:11` | `HS-JAVASCRIPT-23` — **High** | Antes de responder se reemplazan los caracteres especiales de HTML. Además, la línea no envía ningún stack trace aunque el mensaje de Horusec también lo mencione. | El mensaje queda mostrado como texto y no como HTML ejecutable. Se podría enviar directamente como `text/plain`. |
| FP-04 | `server/support/etag.ts:5` | `HS-JAVASCRIPT-5` — **High** | SHA-1 se usa como un identificador para contenido público, no para guardar contraseñas o tokens. | No protege información sensible. De todos modos, se podría reemplazar por un algoritmo actual. |
| FP-05 | `server/support/safeReportReader.ts:8` | `HS-JAVASCRIPT-7` — **Medium** | `path.basename` elimina las carpetas ingresadas por el usuario y el archivo se combina con una carpeta base fija. | Una ruta con `../` no puede salir de la carpeta prevista. Como mejora, también se podría validar la extensión. |
| FP-06 | `server/support/validatedRedirect.ts:5` | `HS-JAVASCRIPT-22` — **High** | Antes de redirigir se comprueba que la ruta esté dentro de `/home`, `/help` o `/privacy`. Si no está, se usa `/home`. | No se puede indicar libremente una página externa. Conviene conservar esa lista de rutas permitidas. |
| FP-07 | `src/tooling/uiDiagnostics.ts:2` | `HS-JAVASCRIPT-1` — **Info** | El `console.log` muestra solamente el texto fijo “Aegis Vault UI ready”. No contiene datos de usuarios ni secretos. | No se filtra información sensible. Igual podría eliminarse del build final para mantener limpia la consola. |
| FP-08 | `src/tooling/uiDiagnostics.ts:7` | `HS-JAVASCRIPT-6` — **High** | `Math.random()` se usa para mover una partícula decorativa. No genera claves, tokens ni decisiones de acceso. | Que el número sea predecible no genera un riesgo de seguridad en este caso. |
| FP-09 | `src/tooling/uiDiagnostics.ts:12` | `HS-JAVASCRIPT-14` — **Info** | En `localStorage` solo se guarda si el tema elegido es claro u oscuro. | Si se modifica el valor, como máximo cambia el aspecto de la página. No se guarda información sensible. |
| FP-10 | `src/tooling/uiDiagnostics.ts:17` | `HS-JAVASCRIPT-15` — **High** | El `debugger` está dentro de una condición `import.meta.env.DEV`, por lo que se usa solamente durante el desarrollo. | No debería ejecutarse en la versión de producción generada por Vite. Se puede quitar si se quiere reducir alertas. |
| FP-11 | `src/tooling/uiDiagnostics.ts:23` | `HS-JAVASCRIPT-16` — **High** | El `prompt` pide una etiqueta de demostración y propone el texto “muestra”. No solicita ni muestra datos secretos. | El texto queda en el navegador y no afecta la seguridad. Podría reemplazarse por un campo normal por comodidad de uso. |

## 5. Respuestas a las preguntas de la consigna

### 1. ¿Cuántos findings totales obtuvimos?

Obtuvimos **31 findings** en total:

- 2 Critical.
- 19 High.
- 5 Medium.
- 2 Low.
- 3 Info.

El resultado completo quedó guardado en `evidencia-horusec-tp2-aegis-vault.sarif`.

### 2. ¿Cuáles corresponden a los 20 verdaderos positivos?

Consideramos verdaderos positivos los casos **VP-01 a VP-20** de la tabla anterior. Incluyen problemas como el uso de `eval`, contraseñas con MD5, comandos sin validar, lectura de archivos, configuraciones inseguras de TLS y almacenamiento de datos sensibles en el navegador.

### 3. ¿Qué categorías de vulnerabilidad diferentes encontramos?

Como grupo, los agrupamos en las siguientes categorías:

- ejecución de código y comandos;
- métodos antiguos para proteger contraseñas y tokens;
- generación insegura de códigos de recuperación;
- configuración insegura de TLS y certificados;
- lectura de archivos usando rutas ingresadas por el usuario;
- redirecciones y CORS mal configurados;
- exposición de información sensible;
- uso inseguro de `postMessage` y `localStorage`;
- lectura insegura de XML;
- código de depuración en producción;
- tecnologías web obsoletas.

### 4. Elegimos cinco verdaderos positivos y describimos un escenario de impacto realista

1. **VP-02 — uso de `eval`:** alguien podría escribir código en el campo de la fórmula y ejecutarlo dentro de la aplicación.
2. **VP-05 — ejecución de comandos:** una entrada modificada podría hacer que el servidor ejecute un comando que no estaba previsto.
3. **VP-12 — uso de `postMessage("*")`:** una página externa podría recibir el registro seleccionado porque no se limita el destino.
4. **VP-15 — lectura de archivos:** una ruta modificada podría permitir leer un archivo que no debía ser público.
5. **VP-01 — certificados sin validar:** en una red insegura, un atacante podría interceptar la información enviada.

### 5. Identificamos todos los falsos positivos y explicamos qué contexto hace que la regla no aplique

Los falsos positivos son **FP-01 a FP-11**, explicados en la tabla de la sección 4. En general, Horusec encontró instrucciones que pueden ser peligrosas, pero que en estos casos se usan con datos públicos, preferencias visuales o herramientas de desarrollo. Por eso consideramos que el contexto no presenta una vulnerabilidad real.

### 6. Elegimos dos falsos positivos: ¿qué tendría que cambiar para que pasen a ser verdaderos positivos?

- **FP-08:** sería verdadero positivo si `Math.random()` se usara para generar un PIN o un token, porque esos valores deben ser difíciles de adivinar.
- **FP-09:** sería verdadero positivo si `localStorage` guardara contraseñas, tokens o datos personales en lugar de una preferencia visual.

### 7. ¿Qué riesgo existe si ignoramos automáticamente las severidades bajas o informativas?

Podríamos descartar problemas reales. Por ejemplo, VP-20 es Info, pero guarda datos médicos o financieros en `localStorage`. Por eso consideramos que las alertas bajas no siempre deben bloquear el proyecto, pero sí deben revisarse.

### 8. ¿Por qué un análisis “sin alertas” no demuestra que el sistema sea seguro?

Horusec busca ciertos patrones, pero no entiende por completo cómo funciona toda la aplicación. También puede haber errores que aparezcan solamente cuando el sistema está funcionando. Por eso, que no haya alertas significa que la herramienta no encontró coincidencias, pero no garantiza que el sistema sea seguro.

### 9. ¿Qué controles complementarían a SAST en un pipeline DevSecOps?

Complementaríamos Horusec con:

- revisión de las dependencias del proyecto;
- búsqueda de contraseñas o claves subidas por error;
- pruebas sobre la aplicación funcionando;
- tests de autenticación, permisos y entradas;
- revisión manual del código más importante.

### 10. Si Horusec se ejecutara en GitHub Actions, ¿qué severidades usaríamos como Quality Gate y por qué?

Usaríamos **Critical** y **High** para bloquear el pipeline. Los **Medium** se revisarían antes de decidir, mientras que los **Low** e **Info** quedarían como advertencias. Los falsos positivos deberían documentarse para no volver a analizarlos desde cero en cada ejecución.

De todas formas, creemos que ninguna alerta debería ignorarse solamente por su severidad, porque el contexto puede cambiar su importancia.

## 6. Conclusión

Horusec encontró 31 alertas, de las cuales consideramos 20 verdaderos positivos y 11 falsos positivos. Como grupo, concluimos que la herramienta es útil para señalar partes del código que deben revisarse, pero que siempre hace falta mirar el contexto para decidir si existe un problema real.
