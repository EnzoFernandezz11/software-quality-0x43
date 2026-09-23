# Aegis Vault — Laboratorio SAST con Horusec

**Gestión de la Calidad de Software · UNC · 2026**

Repositorio educativo construido en **React + TypeScript** para practicar análisis estático de seguridad con Horusec.

> ⚠️ **Laboratorio intencionalmente inseguro.** Contiene patrones vulnerables deliberados. Usarlo solamente de manera local para la actividad. No desplegarlo en Internet ni reutilizar este código en producción. Todos los datos visibles en la UI son sintéticos.

## 1. Objetivos

Al finalizar la práctica deberías poder:

- ejecutar Horusec localmente sobre un repositorio real;
- leer y agrupar findings de SAST;
- distinguir **verdaderos positivos** de **falsos positivos**;
- reconocer vulnerabilidades de categorías diferentes;
- relacionar un defecto técnico con el **impacto sobre información sensible**;
- proponer remediaciones sin asumir que “todo lo que reporta el scanner es una vulnerabilidad confirmada”.

## 2. Ejecutar la aplicación

Requisitos: Node.js 18+ y npm.

```bash
npm install
npm run dev
```

Abrir la URL local que informa Vite (por defecto `http://127.0.0.1:5173`).

Usá la aplicación durante unos minutos: filtrá registros, seleccioná activos y ejecutá la simulación de brecha. El objetivo de esta parte es comprender **qué tipo de información protege el sistema y qué impacto tendría perderla**.

## 3. Ejecutar Horusec

Primero verificá la instalación:

```bash
horusec version
```

Luego, desde la raíz del proyecto:

```bash
horusec start -p .
```

El repositorio contiene un `horusec-config.json` preparado para que la práctica sea reproducible: habilita el motor interno de reglas JavaScript/TypeScript y la severidad informativa, y deshabilita analizadores externos que podrían variar según Docker, versiones de imágenes o bases de CVE.

> No modifiques `horusec-config.json` en la primera ejecución.

## 4. Consigna central

Horusec debería devolver **muchos hallazgos**. **No todos son vulnerabilidades reales.**

Tu trabajo es hacer triage y encontrar **exactamente 20 defectos de seguridad reales** presentes de forma intencional en el repositorio. Los demás hallazgos preparados para la actividad representan situaciones que deben ser justificadas como **falsos positivos** según su contexto.

Para cada hallazgo registrá:

1. archivo y línea;
2. regla / categoría reportada;
3. severidad informada por Horusec;
4. clasificación: `verdadero positivo` o `falso positivo`;
5. justificación técnica;
6. dato o activo que podría verse afectado;
7. consecuencia posible si el defecto llegara a producción;
8. propuesta de corrección.

## 5. Preguntas para entregar

1. ¿Cuántos findings totales obtuviste?
2. ¿Cuáles corresponden a los 20 verdaderos positivos?
3. ¿Qué categorías de vulnerabilidad diferentes encontraste?
4. Elegí cinco verdaderos positivos y describí un escenario de impacto realista.
5. Identificá todos los falsos positivos y explicá **qué contexto** hace que la regla no aplique.
6. Elegí dos falsos positivos: ¿qué tendría que cambiar en el código para que pasen a ser verdaderos positivos?
7. ¿Qué riesgo existe si un equipo decide ignorar automáticamente todos los findings de severidad baja o informativa?
8. ¿Por qué un análisis “sin alertas” no demuestra que el sistema sea seguro?
9. ¿Qué controles complementarían a SAST en un pipeline DevSecOps?
10. Si Horusec se ejecutara en GitHub Actions, ¿qué severidades usarías como Quality Gate y por qué?

## 6. Exportar resultados (opcional)

Podés conservar evidencia del análisis en SARIF:

```bash
horusec start -p . -o sarif -O horusec.sarif
```

## 7. Regla del laboratorio

La actividad es de **análisis estático y triage**, no de explotación. No es necesario atacar la aplicación, ejecutar payloads ni intentar acceder a archivos del sistema operativo.
