# 1. Base Image for dependencies
FROM node:24-alpine AS base

# 2. Install dependencies (Cached)
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 3. Builder Stage (Compile code)
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Run Next.js build
# Disable telemetry for the build
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 4. Runner Stage (The final image)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV SKIP_ENV_VALIDATION="true"
ENV NEXT_TELEMETRY_DISABLED 1

# Create user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy assets
COPY --from=builder /app/public ./public

# Copy standalone build
# Next.js copies only the necessary files here
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
# Bind to 0.0.0.0 so Docker can map ports properly
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
