# Multi-stage build for Aircraft Database MCP Server

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies only when needed
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV production
ENV API_PORT 3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --chown=appuser:nodejs package.json ./
COPY --chown=appuser:nodejs src/database ./src/database
COPY --chown=appuser:nodejs data ./data

# Create logs directory
RUN mkdir -p logs && chown appuser:nodejs logs

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "run", "start:api"]
