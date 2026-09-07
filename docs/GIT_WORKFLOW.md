# Git Workflow

Este documento describe el flujo de trabajo de Git para el desarrollo del proyecto de IoT, adaptado a la estructura de ramas del equipo.

## Ramas Principales

El repositorio se estructura en cuatro ramas principales que organizan el ciclo de vida del código:

1. **`development`**
   - Es la **rama de integración**. Todo el código funcional y estable converge aquí.
   - Es la rama protegida hacia la cual se dirigen las Pull Requests (PRs).
   - No se debe hacer *commit* directamente en esta rama.

2. **`frontend`**
   - Rama de trabajo para el desarrollo del Dashboard web en Next.js.

3. **`backend`**
   - Rama de trabajo para el desarrollo de la API REST en Flask y los algoritmos.

4. **`firmware`**
   - Rama de trabajo para el código C++ de la ESP32.

---

## Flujo de Trabajo (Integración)

El trabajo diario de los integrantes se realiza en la rama correspondiente al componente que están desarrollando (`frontend`, `backend` o `firmware`).

Para integrar los cambios al código base general (`development`), el flujo es el siguiente:

1. **Desarrollo:** El integrante escribe código en su rama de trabajo (`frontend`, `backend` o `firmware`), realizando *commits* respetando la convención establecida.
2. **Push:** Se hace push de la rama de trabajo al repositorio remoto en GitHub.
3. **Pull Request (PR):** Se abre una Pull Request desde la rama de trabajo hacia `development`.
4. **Revisión (Code Review):** Para poder fusionar la PR, se requiere **obligatoriamente al menos 2 aprobaciones** de integrantes distintos al autor. (Si el equipo es de solo dos personas, se requiere la aprobación de la otra persona).
5. **Merge:** Una vez aprobada, la PR se fusiona (merge) en `development`.

---

## Sincronización

Para evitar conflictos grandes, es responsabilidad de cada integrante mantener su rama de trabajo actualizada con los últimos cambios que ya se hayan integrado en `development` por otros compañeros.

```bash
# Ejemplo: actualizando la rama backend con lo último de development
git checkout backend
git fetch origin
git merge origin/development
```

---

## Git Hooks (pre-commit / pre-push)

El repositorio versiona hooks de Git gestionados con [Husky](https://typicode.github.io/husky/), en la carpeta `.husky/`. Se instalan automáticamente al correr `npm install` en la **raíz del repositorio** (gracias al script `prepare`).

### Activación en un clone limpio

Requisito: tener **Node.js** instalado.

```bash
# Desde la raíz del repositorio
npm install
```

Eso ejecuta el script `prepare` (`husky`) y deja los hooks activos. No hace falta ningún paso manual adicional. Para reinstalarlos si se desactivaron, basta con volver a correr `npm install` (o `npx husky`).

### Qué ejecuta cada hook

| Hook | Ejecuta | Por componente |
|---|---|---|
| **`pre-commit`** | Linters | `flake8` (backend), `eslint` (frontend), `clang-format` (firmware) |
| **`pre-push`** | Tests unitarios | `pytest` (backend), `jest` (frontend), `pio test` (firmware) |

Cada chequeo corre **solo** si hay archivos staged del componente correspondiente y si su toolchain está instalado; si falta la herramienta (p. ej. no hay venv de Python o `node_modules`), ese paso se omite con un aviso en vez de fallar. Así, cada integrante solo necesita el toolchain del componente que toca.
