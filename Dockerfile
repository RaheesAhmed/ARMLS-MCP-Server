# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Builder
#   Installs ALL deps (including devDependencies) and compiles TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first — maximises layer-cache hits on subsequent builds
COPY package*.json ./

# Install all deps (dev included) so tsc is available
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production image
#   Only the compiled output + production node_modules
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install curl for the health-check probe (tiny addition to alpine)
RUN apk add --no-cache curl

WORKDIR /app

# Copy manifests and install production deps only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the server listens on (overridable via PORT env var)
EXPOSE 3000

# Health check — waits 10 s before first probe, retries 3 times
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Run as non-root for security
USER node

# Start the server
CMD ["node", "dist/index.js"]
