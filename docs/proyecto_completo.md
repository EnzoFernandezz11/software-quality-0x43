# Documentación Completa del Proyecto — Smart Office 🏢

Este documento consolida la especificación técnica, la arquitectura, el diseño de software y los procesos del sistema **Estación de Eficiencia Térmica y Ocupación (Smart Office)**. Combina los requerimientos de negocio y de cátedra, y sirve como única fuente de verdad para los componentes de **Firmware**, **Backend** y **Frontend**.

---

## 💡 1. Resumen Ejecutivo (Contexto General)

### 1.1 Propósito del Sistema
El sistema optimiza la climatización (calefacción/refrigeración) y audita el uso físico de las salas en una oficina. Recolecta lecturas de temperatura y detección de movimiento en tiempo real para tomar decisiones inteligentes de eficiencia energética, permitiendo el control local a través de una interfaz de hardware segura y la supervisión global desde un dashboard web.

### 1.2 Problemas que Resuelve
1. **Desperdicio energético:** Relaja los setpoints cuando no se detecta presencia humana en la sala o durante horas inactivas del edificio (cálculo de temperatura base de reposo).
2. **Inercia térmica y carga humana:** Se anticipa a la acumulación rápida de calor producida por la ocupación masiva mediante el monitoreo de la tasa de incremento de temperatura ($\Delta T / \Delta t$) a lo largo del tiempo.
3. **Seguridad y Auditoría local:** Controla de forma física quién y cuándo altera la climatización en cada sala mediante un teclado local con código PIN.

---

## 🎨 2. Arquitectura General y Componentes

El sistema sigue una arquitectura de tres capas físicas desacopladas con comunicación unidireccional de datos:

*   **Borde (Firmware ESP32):** Adquiere datos locales de los sensores analógicos y digitales, maneja el teclado matricial 4x4 y envía payloads vía HTTP REST al backend.
*   **Servidor (Backend Flask):** Procesa y valida la ingesta de datos, ejecuta algoritmos analíticos, maneja la persistencia y sirve la API de consulta.
*   **Cliente (Frontend Next.js):** Consulta métricas en vivo (Short Polling) y presenta históricos tabulares y gráficos interactivos sin refresh de página.

### 🗺️ Diagramas de Arquitectura
> [!TIP]
> Podés visualizar de forma interactiva todos los diagramas renderizados nativamente por GitHub ingresando a la carpeta **[docs/diagrams/](diagrams/)**.

*   **Diagrama de Componentes (Fuente Mermaid):** [diagrama_componentes.md](diagrams/diagrama_componentes.md)

---

## 🧮 3. Backend: Modelos, Algoritmos y Patrones (GoF)

### 3.1 Algoritmos Inteligentes (Servicios)
Residen en [processing_service.py](file:///d:/facultad/soft/sof-eng-2026-grupo-nueve/backend/flask/final_project/app/services/processing_service.py) y operan sobre PostgreSQL:

1.  **Mediana Móvil (`apply_moving_median`):**
    *   *Propósito:* Suaviza los ruidos eléctricos del sensor analógico LM35.
    *   *Operación:* Toma las últimas 5 lecturas consecutivas y calcula la mediana matemática para evitar picos abruptos falsos.
2.  **Temperatura Base de Reposo (`calculate_base_sleep_temperature`):**
    *   *Propósito:* Conocer la temperatura inercial pasiva del edificio sin personas.
    *   *Operación:* Promedia los registros históricos de temperatura de las últimas 24 horas correspondientes únicamente a periodos donde `motion_detected` fue falso.
3.  **Detección de Inercia Térmica (`detect_thermal_inertia`):**
    *   *Propósito:* Detectar si la temperatura ambiente sube críticamente debido a la carga humana.
    *   *Operación:* Evalúa los últimos 15 minutos en ocupación continua. Si la derivada de cambio de temperatura ($\Delta T / \Delta t$) supera los $0.5\text{°C / minuto}$, activa una alerta térmica (`thermal_alert_status: true`).

### 3.2 Patrones de Diseño GoF Implementados
El backend aplica de manera estricta los siguientes patrones de diseño:

1.  **Observer 1 — Live Metrics (`LiveMetricsSubject`):**
    *   *Sujeto:* `LiveMetricsSubject`.
    *   *Observadores:* `CacheMetricsUpdater` (actualiza la caché en memoria para responder de inmediato al short polling) y `LiveConsoleLogger` (escribe alertas térmicas en stdout).
    *   *Desencadenante:* Al persistir exitosamente una lectura de telemetría procesada.
2.  **Observer 2 — Seguridad (`AuthenticationService`):**
    *   *Sujeto:* `AuthenticationService`.
    *   *Observadores:* `SecurityAuditor` (persiste el intento en la tabla de base de datos `access_audits`) y `SystemAlerter` (emite una advertencia en consola en caso de PIN fallido).
    *   *Desencadenante:* Al intentar validar una clave desde el teclado matricial.
3.  **Strategy — Autenticación (`AuthenticationStrategy`):**
    *   *Estrategia Base:* `AuthenticationStrategy` (interfaz).
    *   *Estrategias Concretas:* `LocalMemoryAuthStrategy` (validación offline local contra código estático `1234`) y `ExternalApiAuthStrategy` (simulación de validación contra servicio externo HTTP).
    *   *Propósito:* Desacopla la lógica del servicio de validación de la lógica del almacén de credenciales.
4.  **Decorator — Enriquecimiento de Telemetría (`SensorMetadataDecorator`):**
    *   *Componente Base:* `BaseTelemetry` (extrae `sensor_id`, `raw_temperature` y `motion_detected`).
    *   *Decorador Concreto:* `SensorMetadataDecorator` (añade `room_location` y calcula el indicador `thermal_alert_status` en el servidor).
    *   *Propósito:* Enriquece los datos del sensor del ESP32 con datos contextuales del servidor antes de persistirlos, evitando sobrecargar al microcontrolador de borde con lógica de base de datos.

### 📊 Diagramas de Diseño de Backend
*   **Diagrama de Clases (Backend):** [diagrama_clases_backend.md](diagrams/diagrama_clases_backend.md)

---

## 🗄️ 4. Base de Datos y Persistencia

El sistema utiliza **PostgreSQL** para la persistencia histórica completa. La conexión se modela a través del ORM SQLAlchemy.

### 4.1 Entidades del Dominio
*   **`sensor_readings`:** Histórico de telemetría proveniente del sensor de temperatura analógico y presencia PIR. Contiene los campos calculados por el Decorator y el algoritmo de inercia térmica.
*   **`access_audits`:** Logs de auditoría de intentos de ingreso de PIN desde el teclado matricial.
*   **`room_configs`:** Configuraciones configurables del espacio (temperatura de confort, tiempos de inercia y modo de sala actual).

### 📊 Diagrama de Datos
*   **Diagrama Entidad-Relación (Base de Datos):** [diagrama_entidad_relacion.md](diagrams/diagrama_entidad_relacion.md)

---

## 🔄 5. Casos de Uso y Diagramas de Secuencia (Flujos)

### UC-01: Ingesta de Telemetría
*   *Secuencia:* El firmware del ESP32 lee los sensores y despacha los datos crudos vía `POST /api/telemetry`. El backend los filtra mediante la mediana móvil, los decora con metadatos de sala y alertas térmicas, los persiste en BD y notifica a los observadores para refrescar la caché en memoria del frontend.
*   *Diagrama:* [diagrama_secuencia_telemetria.md](diagrams/diagrama_secuencia_telemetria.md)

### UC-02: Autenticación por Teclado Matricial y Cambio de Modo
*   *Secuencia:* El operador introduce un código de 4 dígitos y presiona la tecla de envío en el teclado matricial del ESP32. Éste despacha un `POST /api/auth/validate`. El backend evalúa la autenticidad usando el patrón Strategy y utiliza el patrón Observer para registrar el log de auditoría en la base de datos de manera desacoplada. Si la autenticación es correcta, actualiza el setpoint y el modo en la base de datos de configuración de sala (`room_configs`).
*   *Diagrama:* [diagrama_secuencia_autenticacion.md](diagrams/diagrama_secuencia_autenticacion.md)

### UC-03: Consulta Histórica
*   *Secuencia:* El usuario abre la pestaña "Historial" del dashboard Next.js, ingresa rangos de fechas de inicio y fin, y hace clic en "Buscar". La aplicación realiza una petición a `/api/dashboard/history` retornando un JSON con lecturas paginadas obtenidas desde PostgreSQL.

### UC-04: Configuración Dinámica de Umbrales
*   *Secuencia:* El administrador actualiza la temperatura objetivo o los minutos de inercia desde la interfaz del frontend. Esto se envía mediante un `PUT /api/config` al backend, que valida los rangos de temperatura y persiste el nuevo estado en la base de datos, afectando de forma inmediata a los cálculos en curso.
*   *Diagrama:* [diagrama_secuencia_configuracion.md](diagrams/diagrama_secuencia_configuracion.md)

---

## 🎛️ 6. Firmware de la ESP32 (Hardware & Estados)

El microcontrolador ESP32 captura datos del entorno físico mediante tres canales de entrada diferenciados:
1.  **Sensor de Temperatura LM35 (Analógico):** Conectado a un puerto ADC. Lee el voltaje variable para computar la temperatura ambiente ruidosa.
2.  **Sensor de Movimiento PIR (Digital):** Conectado a un pin GPIO configurado como entrada. Detecta la presencia en alto (`HIGH`) o la inactividad en bajo (`LOW`).
3.  **Teclado Matricial 4x4 (Interfaz de Hardware):** Permite ingresar claves y seleccionar modos de funcionamiento (Reunión, Normal, Ahorro de Energía) multiplexando 8 pines en lugar de 16 mediante un algoritmo de barrido de filas y columnas.

---

## 🔌 7. Contrato de la API REST

### 7.1 ESP32 ↔ Backend

#### 7.1.1 Ingesta de Datos (Telemetría)
*   **Método:** `POST`
*   **Ruta:** `/api/telemetry`
*   **Payload (JSON):**
    ```json
    {
      "sensor_id": "esp32-office-1",
      "raw_temperature": 24.5,
      "motion_detected": true
    }
    ```
*   **Respuestas:**
    *   `201 Created`: Ingesta correcta. Retorna el objeto decorado y persistido.
    *   `400 Bad Request`: Payload incorrecto (tipos de datos no válidos, no se persiste nada).

#### 7.1.2 Validación de PIN (Teclado)
*   **Método:** `POST`
*   **Ruta:** `/api/auth/validate`
*   **Payload (JSON):**
    ```json
    {
      "pin": "1234"
    }
    ```
*   **Respuestas:**
    *   `200 OK`: PIN válido. Retorna el modo de sala establecido.
        ```json
        {
          "authenticated": true,
          "current_mode": "Meeting",
          "message": "Access granted, mode updated to Meeting"
        }
        ```
    *   `401 Unauthorized`: PIN incorrecto.
    *   `400 Bad Request`: PIN malformado (no numérico o longitud != 4).

---

### 7.2 Frontend ↔ Backend

#### 7.2.1 Obtener Métricas en Vivo
*   **Método:** `GET`
*   **Ruta:** `/api/dashboard/live`
*   **Respuesta (`200 OK`):**
    ```json
    {
      "last_reading": {
        "raw_temperature": 24.5,
        "filtered_temperature": 24.3,
        "motion_detected": true,
        "thermal_alert_status": false,
        "room_location": "Meeting Room A",
        "created_at": "2026-06-06T20:15:30Z"
      },
      "room_status": {
        "current_mode": "Meeting",
        "target_temperature": 24.0,
        "base_sleep_temperature": 21.2
      }
    }
    ```

#### 7.2.2 Obtener Histórico de Lecturas
*   **Método:** `GET`
*   **Ruta:** `/api/dashboard/history`
*   **Query Params:** `limit` (opcional), `offset` (opcional), `start_date` (opcional), `end_date` (opcional).
*   **Respuesta (`200 OK`):** Retorna array de registros históricos paginados.

#### 7.2.3 Obtener Log de Auditoría de Accesos
*   **Método:** `GET`
*   **Ruta:** `/api/dashboard/security-logs`
*   **Respuesta (`200 OK`):** Retorna la lista de accesos auditados (`is_success`, `strategy_used`, etc.).

#### 7.2.4 Obtener y Actualizar Configuración
*   **Método:** `GET` / `PUT`
*   **Ruta:** `/api/config`
*   **Payload PUT (JSON):**
    ```json
    {
      "room_name": "Meeting Room A",
      "base_temp_limit": 21.0,
      "inertia_time_minutes": 15,
      "target_temperature": 24.0,
      "current_mode": "Meeting"
    }
    ```
*   **Respuestas:**
    *   `200 OK`: Configuración modificada correctamente.
    *   `400 Bad Request`: Datos de configuración inválidos (ej. umbral de temperatura fuera de rango).

---

## 👥 8. Procesos y Colaboración

Para garantizar un desarrollo ágil y trazable en el equipo, se adoptan las siguientes políticas de versionado y gestión de tareas:

### 8.1 Gestión del Proyecto en Jira
*   **Nombre del Proyecto:** Smart Office
*   **URL de Jira:** [grupo-9.atlassian.net/jira/software/projects/SO/summary](https://grupo-9.atlassian.net/jira/software/projects/SO/summary)
*   **Prefijo de Claves (Jira Key):** `SO`
*   **Seguimiento:** Se utiliza el tablero de Jira para la planificación y el seguimiento del backlog de historias de usuario (ej. `SO-15` para Monitoreo de telemetría en tiempo real, `SO-16` para Autenticación, etc.) y tareas de desarrollo asociadas, moviéndolas a través de las columnas de estado estándar (*To Do*, *Analysis*, *In Progress*, *QA*, *RFP*, *Closed*).

### 8.2 Git Workflow (Flujo de Ramas)
El equipo adopta un flujo de ramas organizado por componentes:
*   `main` / `master`: Contiene el código estable de producción.
*   `development`: Rama de integración donde convergen todas las características estables.
*   `frontend`, `backend`, `firmware`: Ramas de trabajo donde se desarrollan las tareas de cada componente correspondiente antes de ser integradas a `development` mediante Pull Requests.
*   **Revisiones obligatorias:** Para fusionar una Pull Request hacia `development`, se requiere la aprobación de al menos otro integrante del equipo.

### 8.3 Convención de Mensajes de Commits (Conventional Commits)
Los commits siguen el estándar **Conventional Commits**:
`tipo(alcance): descripción` o `tipo: descripción`

**Ejemplos Válidos:**
1.  `feat(backend): add moving median filter algorithm`
2.  `fix(firmware): resolve bounce noise in keypad scan matrix`
3.  `test(frontend): implement unit tests for temperature chart widget`
