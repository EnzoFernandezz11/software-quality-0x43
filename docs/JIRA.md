# Gestión del Proyecto en Jira — Smart Office 🏢

Documentación del proyecto Jira del equipo: identificación del proyecto, backlog
de historias de usuario, tareas asociadas y seguimiento del trabajo.

---

## 1. Identificación del proyecto

| Dato | Valor |
|---|---|
| **Nombre del proyecto** | Smart Office — Ingeniería de Software 2026 (Grupo 9) |
| **URL del proyecto** | https://grupo-9.atlassian.net/jira/software/projects/SO/boards/3/backlog |
| **Prefijo de claves** | `SO` (las claves quedan `SO-1`, `SO-2`, …) |

Toda historia y tarea se identifica con una clave `SO-<n>` que se referencia en
ramas, commits y pull requests.

### Componentes (separación por parte del sistema)

| Componente | Prefijo en el resumen | Stack |
|---|---|---|
| Firmware | `[FW]` | ESP32 / C++ / PlatformIO |
| Backend | `[BE]` | Flask / PostgreSQL / SQLAlchemy |
| Frontend | `[FE]` | Next.js / React |

---

## 2. Backlog — Historias de Usuario

| Historia | Resumen | Criterio de aceptación |
|---|---|---|
| Monitoreo de telemetría en tiempo real | *Como operador de la sala quiero ver la temperatura y la ocupación en tiempo real para monitorear el ambiente y reaccionar ante condiciones fuera de lo normal.* | Una lectura enviada por el dispositivo aparece en el dashboard pocos segundos después, con su temperatura filtrada y, si corresponde, la alerta térmica. |
| Autenticación por teclado y cambio de modo de sala | *Como usuario autorizado quiero ingresar un PIN por el teclado matricial para cambiar el modo de la sala (Meeting, Energy Saving, Normal) y que todo intento quede auditado.* | Un PIN válido cambia el modo de sala y queda auditado; un PIN inválido es rechazado y también queda registrado. |
| Consulta histórica de lecturas y alertas | *Como operador quiero consultar el histórico de lecturas y alertas con filtros de fecha para auditar el comportamiento de la sala a lo largo del tiempo.* | Al aplicar un rango de fechas, la vista muestra solo los registros de ese rango, paginados. |
| Configuración dinámica de umbrales | *Como administrador quiero configurar la temperatura de confort y los parámetros de alerta para adaptar el sistema a cada sala sin redeploy.* | Un cambio guardado en el panel modifica el comportamiento de los algoritmos sin reiniciar el backend. |

---

## 3. Backlog — Tareas

### Firmware (ESP32)

| Tarea | Descripción | Criterio de aceptación |
|---|---|---|
| `[FW]` Firmware base (PlatformIO + AppConfig) | Entorno PlatformIO (board ESP32, deps ArduinoJson + Keypad) y `AppConfig` (identidad del dispositivo, Wi-Fi, URL del backend, pines, intervalos). `SensorService`: lectura de LM35, PIR y teclado 4x4, con modelo mock. `NetworkClient`: Wi-Fi (STA) y HTTP al backend (`POST /api/telemetry`, `POST /api/auth/validate`) con reconexión. | `pio run` compila; `read()` devuelve temperatura/movimiento y `readKey()` la tecla (o `'\0'`); los POST envían el JSON correcto, parsean la respuesta y reintentan sin colgarse. |
| `[FW]` SensorService (LM35, PIR, teclado 4x4) | Lectura de temperatura (LM35), movimiento (PIR) y teclas del teclado 4x4. Incluye el modelo mock para integración. | `read()` devuelve temperatura/movimiento; `readKey()` devuelve la tecla o `'\0'`. |
| `[FW]` NetworkClient (Wi-Fi + HTTP) | Conectividad Wi-Fi (modo estación) y HTTP con el backend: `POST /api/telemetry` y `POST /api/auth/validate`, con reconexión. | Conecta al Wi-Fi configurado; los POST envían el JSON correcto y parsean la respuesta; ante desconexión reintenta sin colgarse. |
| `[FW]` Firmware integración (main.cpp + tests) | Loop que coordina telemetría periódica y teclado (acumular PIN, `#` confirma, `*` cancela). Tests nativos (GoogleTest, sin hardware): (1) modelo mock — valor base, rango, extremos, periodicidad y determinismo; (2) `SensorService` sobre fakes de Arduino/Keypad — conversión LM35 (mV→°C), latcheo del PIR y su limpieza, y `readKey()`. | Envía telemetría según el intervalo y valida el PIN al confirmar; `pio test -e native_test` y `pio test -e native_sensor_service` pasan en verde. |

### Backend (Flask)

| Tarea | Descripción | Criterio de aceptación |
|---|---|---|
| `[BE]` Infraestructura + datos base | App factory de Flask (SQLAlchemy + migraciones, Blueprints) y punto de entrada. Migraciones Alembic que crean las tablas. Entidad `SensorReading` y schemas de creación/telemetría + serialización. | La app levanta y registra todos los blueprints; `flask db upgrade` crea el esquema; la entidad mapea sus campos; los schemas rechazan payloads inválidos. |
| `[BE]` Servicios de datos (repositorio + procesamiento + patrones) | `SensorsRepository`, `SensorsService`, `ProcessingService` (mediana móvil, inercia térmica), `DecoratorService` (Decorator) y `LiveMetricsService` (Observer). | Persiste/recupera lecturas con filtros por fecha; la temperatura filtrada es estable ante picos; el dato decorado incluye metadata y alerta; los observers se actualizan al ingresar una lectura. |
| `[BE]` Controllers de datos + tests | `TelemetryController` (`POST /api/telemetry`), `SensorsController` (`/api/sensors`), `DashboardController` (`/live`, `/history`, `/security-logs`). Fixtures y tests de telemetría, algoritmos, decorator y dashboard. | Cada endpoint devuelve el formato esperado; request inválida → 4xx; `pytest` pasa en verde. |
| `[BE]` Auth + Config base (entidades + schemas) | Entidades `AccessAudit` y `RoomConfig`. Schemas de validación de PIN y de configuración. | Las entidades persisten/recuperan sus datos; los schemas rechazan payloads inválidos o fuera de rango. |
| `[BE]` Auth + Config servicios (repos + lógica + patrones) | `AuthRepository`, `ConfigRepository`, `AuthenticationService` (valida PIN y notifica `SecurityAuditor` / `SystemAlerter`), `AuthStrategies` (Strategy + Factory: `LocalMemoryAuthStrategy`, `ExternalApiAuthStrategy`). | Guarda/lista auditorías y config; `authenticate()` valida y audita cada intento; cambiar de estrategia no altera el resto del flujo. |
| `[BE]` Auth + Config controllers + tests | `AuthController` (`POST /api/auth/validate`), `ConfigController` (`GET/PUT /api/config`). Tests de auth, estrategias y configuración. | PIN válido → autenticado y modo actualizado; inválido → 401 auditado; GET/PUT de config funcionan; `pytest` pasa en verde. |

### Frontend (Next.js)

| Tarea | Descripción | Criterio de aceptación |
|---|---|---|
| `[FE]` Front base (bootstrap + tipos + servicio + mock + utils) | Estructura base de Next.js, configuración de tests y navegación lateral. Tipos compartidos alineados con la API. Servicio de API (`getLiveMetrics`, `getHistory`, `getSecurityAudits`, `getRoomConfig`, `updateRoomConfig`). Datos mock y helpers + su test. | Arranca con `npm run dev` y navega entre secciones; los tipos reflejan los payloads; cada función del servicio consume su endpoint; `npm test` pasa. |
| `[FE]` Dashboard en vivo (hook + gráficos + widgets + composición + página) | Hook de short polling + derivación de alertas. Gráficos (temperatura, timeline de movimiento, comparativa). Widgets. `DashboardClient` que compone todo. Página del dashboard y su estado de carga. | Refresca en intervalos y limpia el timer al desmontar; gráficos y widgets se actualizan con datos en vivo; la página renderiza el `DashboardClient`. |
| `[FE]` Gestión (auditoría + histórico + configuración) | `ActivityFeed` (bitácora en vivo de accesos). Página de histórico con filtros de fecha (`getHistory()`). Página de configuración para editar umbrales (`updateRoomConfig()`). | El feed muestra `getSecurityAudits()`; el histórico filtra por fecha; la configuración se edita y persiste vía API. |

### Incidencias (Bugs)

| Incidencia | Descripción | Criterio de aceptación |
|---|---|---|
| `[FW]` Fallo de autenticación con estrategia externa | Al elegir la estrategia de autenticación externa desde el teclado e ingresar el PIN correspondiente, el backend rechazaba el acceso. El firmware no propagaba la estrategia seleccionada al validar el PIN. | Validar el PIN con la estrategia externa autentica correctamente; la estrategia local sigue funcionando como antes. |

---

## 4. Seguimiento del trabajo

- El avance se gestiona en el **board de Jira** (columnas *To Do → In Progress → Done*).
- Cada tarea se integra mediante **un pull request** que referencia su clave `SO-<n>`
  en la rama y en el título (ej. rama `feature/sensor-service`, título
  `SensorService`).
- La rama de integración (`development`) está **protegida**: requiere PR aprobado
  antes del merge.
