# Diagramas del Proyecto — Smart Office 🏢

Esta carpeta contiene todos los diagramas del sistema. Cada uno de ellos está en su propio archivo `.md` para permitir que GitHub los renderice de forma interactiva y visual de manera nativa al hacerles clic.

## 📌 Listado de Diagramas

1.  **[Diagrama de Componentes (Arquitectura General)](diagrama_componentes.md):** Estructura del firmware, backend, DB y frontend.
2.  **[Diagrama de Clases del Backend](diagrama_clases_backend.md):** Clases del dominio, repositorios, controladores, servicios y patrones de diseño (Decorator, Strategy, Observer).
3.  **[Diagrama de Secuencia: Ingesta de Telemetría (UC-01)](diagrama_secuencia_telemetria.md):** Flujo de datos de sensores, filtros, decoraciones y observador de métricas en vivo.
4.  **[Diagrama de Secuencia: Autenticación por Teclado (UC-02)](diagrama_secuencia_autenticacion.md):** Flujo de login físico, estrategia de autenticación y auditoría.
5.  **[Diagrama de Secuencia: Configuración de Umbrales (UC-04)](diagrama_secuencia_configuracion.md):** Modificación de umbrales desde el dashboard web.
6.  **[Diagrama Entidad-Relación (Base de Datos)](diagrama_entidad_relacion.md):** Esquema de tablas en PostgreSQL (`sensor_readings`, `access_audits`, `room_configs`).
