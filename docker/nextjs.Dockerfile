# syntax=docker/dockerfile:1
#
# Production image for the IoT dashboard (`frontend/dashboard`).
# Build from the repository root so paths match the monorepo layout:
#
#   docker build -f docker/nextjs.Dockerfile -t soft-eng-dashboard .
#
# `NEXT_PUBLIC_*` variables are inlined at build time. Match the monorepo root
# `.env` value for `NEXT_PUBLIC_API_URL` (see root `.env.example`). Pass the
# URL your browser will use to reach the backend (not a Docker-only hostname
# unless you expose the API under that name on the host network).

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

FROM base AS deps
COPY frontend/dashboard/package.json frontend/dashboard/package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/dashboard/ ./

ARG NEXT_PUBLIC_API_URL=http://localhost:5000/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# TP final (canary): la versión sale de `package.json`. Si se pasa APP_VERSION
# (el tag de la imagen), el build falla cuando no coincide con el código.
ARG APP_VERSION=""
RUN node -e 'const v = require("./package.json").version; const e = process.env.APP_VERSION; \
  if (e && e !== v) { console.error(`APP_VERSION=${e} no coincide con package.json (${v})`); process.exit(1); } \
  console.log(`Versión del panel: ${v}`);'

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner

# Trazabilidad: `docker inspect` muestra la versión y la revisión de Git de origen.
ARG APP_VERSION=""
ARG GIT_SHA=""
LABEL org.opencontainers.image.title="terrasense-front" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.source="https://github.com/EnzoFernandezz11/software-quality-0x43"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
