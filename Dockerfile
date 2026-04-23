# ─────────────────────────────────────────────
# Stage 1 – Build / Install dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

LABEL maintainer="devops@gestion-voitures.com"
LABEL description="Gestion des voitures – Build stage"

WORKDIR /app

# Copy dependency manifests first (layer cache optimisation)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source
COPY . .

# ─────────────────────────────────────────────
# Stage 2 – Production image (minimal attack surface)
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

LABEL maintainer="devops@gestion-voitures.com"
LABEL description="Gestion des voitures – Production image"
LABEL version="1.0.0"

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only the production artefacts from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app .

# Harden the image
RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache dumb-init \
    && rm -rf /var/cache/apk/*

# Drop privileges
USER appuser

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Use dumb-init to handle PID 1 signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
