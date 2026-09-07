# Convención de Commits

Para mantener un historial limpio, legible y estructurado, el equipo ha adoptado el estándar **Conventional Commits**.

## Formato Obligatorio

Cada mensaje de *commit* debe estructurarse de la siguiente manera:

```text
<tipo>(<alcance>): <descripción>
```

O, de manera simplificada si no se especifica el alcance:

```text
<tipo>: <descripción>
```

### Componentes del formato:

1. **`<tipo>`**: Describe la intención del cambio. Debe ser uno de los siguientes:
   - `feat`: Una nueva característica (feature).
   - `fix`: Corrección de un error (bug fix).
   - `docs`: Cambios exclusivos en la documentación.
   - `style`: Cambios que no afectan el significado del código (espacios en blanco, formato, etc).
   - `refactor`: Un cambio de código que mejora la estructura sin corregir errores ni añadir características.
   - `test`: Añadir pruebas faltantes o corregir pruebas existentes.
   - `chore`: Cambios en el proceso de construcción, herramientas o dependencias auxiliares.

2. **`<alcance>`** (Opcional): Indica la sección o módulo del código modificado (ej: `frontend`, `backend`, `firmware`, `ui`, `sensors`, etc).

3. **`<descripción>`**: Un resumen breve en inglés (o español) de los cambios realizados. Se escribe en minúscula y sin punto final.

---

## Ejemplos Válidos

A continuación, ejemplos prácticos alineados con los commits de nuestro proyecto:

### Frontend
- `feat(ui): update dashboard layout`
- `fix(components): fix chart rendering bug on mobile`
- `style(css): update color palette in tailwind config`

### Backend
- `feat(api): add endpoint for historical data query`
- `fix(processing): resolve unhandled exception in moving median algorithm`
- `test(auth): add unit tests for credentials validation`

### Firmware
- `feat(sensors): implement mock sensor logic for temperature`
- `refactor(network): optimize http client post request payload`
- `chore(deps): update platformio libraries`
