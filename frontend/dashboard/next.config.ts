import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

import packageJson from "./package.json";

// Single source of truth: monorepo root `.env` / `.env.local` (see root `.env.example`).
// Next still loads `frontend/dashboard/.env*` afterward if students add overrides there.
const monorepoRoot = path.resolve(__dirname, "../..");
loadEnvConfig(monorepoRoot);

// Versión del panel (TP final, canary). Sale de `package.json`, así la revisión
// de Git define la versión y una imagen no puede quedar etiquetada con otra.
const appVersion = packageJson.version;

const nextConfig: NextConfig = {
  // Required for the production image in `docker/nextjs.Dockerfile` (standalone server bundle).
  output: "standalone",

  // Disponible en el bundle del navegador y en los componentes de servidor.
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },

  // Marca legible por máquina en todas las respuestas (documento, JS, CSS e
  // imágenes). k6 cuenta las visitas por versión con este header y permite ver
  // si un recurso llegó desde la otra versión del canary.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-App-Version", value: appVersion }],
      },
    ];
  },
};

export default nextConfig;
