# SonarQube local

Este proyecto incluye un entorno local de SonarQube Community Build.

El análisis inicial cubre el backend Flask y el panel web Next.js. El firmware
del ESP32 no forma parte de esta primera línea base porque un análisis C/C++
correcto necesita una captura de compilación compatible con CFamily. Enviar
solamente los archivos `.cpp` al scanner genérico puede producir un resultado
incompleto.

## Requisitos

- Docker Engine o Docker Desktop con Docker Compose v2.
- Al menos 4 GB de memoria disponibles para Docker.
- El puerto `9000` disponible en el equipo anfitrión.
- Python 3.12 y Node.js 20+ para generar los reportes de cobertura.

Si SonarQube no puede iniciar Elasticsearch en Linux, se deben verificar los
límites del sistema documentados por SonarSource. Una configuración temporal
requerida habitualmente es:

```bash
sudo sysctl -w vm.max_map_count=524288
```

Si Docker informa `permission denied` para `/var/run/docker.sock`, se debe
agregar el usuario actual al grupo de Docker y luego cerrar y volver a iniciar
la sesión:

```bash
sudo usermod -aG docker "$USER"
```

Pertenecer a este grupo concede acceso al daemon de Docker, lo que equivale a
tener permisos de administrador sobre el equipo. Este cambio solo debe hacerse
en un entorno local de desarrollo confiable.

## 1. Iniciar SonarQube

Desde la raíz del repositorio:

```bash
docker compose -f docker-compose.sonar.yml up -d sonarqube
docker compose -f docker-compose.sonar.yml logs -f sonarqube
```

Se debe esperar hasta que el log indique que SonarQube está operativo y luego
abrir:

```text
http://localhost:9000
```

En una instalación local nueva, las credenciales iniciales son `admin` /
`admin`. SonarQube solicita cambiar la contraseña durante el primer ingreso.

## 2. Crear el proyecto y el token

Se debe crear un proyecto local/manual con la siguiente clave:

```text
smart-office-iot
```

Luego se genera un token de análisis para el proyecto y se lo expone únicamente
en la terminal actual:

```bash
export SONAR_TOKEN="pegar-token-aqui"
```

El token real nunca debe agregarse a `.env`, `sonar-project.properties`, Docker
Compose ni Git.

## 3. Generar los reportes de cobertura

SonarQube importa la cobertura generada por las herramientas de pruebas; no la
genera por sí mismo.

Backend:

```bash
cd backend/flask/final_project
python -m pytest --cov=app --cov-report=term-missing --cov-report=xml:coverage.xml
cd ../../..
```

Frontend:

```bash
cd frontend/dashboard
npm ci
npm run test:coverage
cd ../..
```

El scanner puede ejecutarse aunque alguno de estos reportes no exista, pero no
se importará la cobertura correspondiente a esa parte del proyecto.

## 4. Ejecutar el análisis

Con SonarQube en ejecución:

```bash
test -n "$SONAR_TOKEN" || { echo "SONAR_TOKEN no está definido"; exit 1; }
docker compose -f docker-compose.sonar.yml run --rm scanner
```

Cuando finalice el scanner, se puede abrir el proyecto `Smart Office IoT` en
`http://localhost:9000`.

## Comandos útiles

Consultar el estado de los servicios:

```bash
docker compose -f docker-compose.sonar.yml ps
```

Detener los contenedores conservando los datos de SonarQube:

```bash
docker compose -f docker-compose.sonar.yml down
```

Reiniciar por completo el laboratorio local:

```bash
docker compose -f docker-compose.sonar.yml down -v
```

El último comando elimina permanentemente la base de datos local de SonarQube,
su configuración, los proyectos y los tokens almacenados en los volúmenes de
Docker.

## Alcance y próximo paso

Los parámetros del análisis están en el archivo `sonar-project.properties` de
la raíz. El scanner espera encontrar los reportes de cobertura en:

- `backend/flask/final_project/coverage.xml`
- `frontend/dashboard/coverage/lcov.info`

La incorporación posterior del firmware del ESP32 debe realizarse como una
tarea separada: primero hay que generar una base de datos o captura de
compilación válida para PlatformIO, verificar que la edición de SonarQube y el
modo del scanner elegidos sean compatibles y recién entonces agregar
`firmware/esp32` al alcance del análisis.
