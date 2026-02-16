FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY apps/api ./apps/api
COPY packages ./packages
RUN cd packages/shared && pnpm build
RUN cd apps/api && pnpm prisma generate && pnpm build

# Deploy — use pnpm deploy to create a standalone directory with real files
RUN pnpm --filter api deploy --prod /app/deployed
# Copy the generated Prisma client (with engine) over the stubs in deployed
RUN PRISMA_DEST=$(find /app/deployed/node_modules/.pnpm -path '*/@prisma+client*/node_modules/.prisma/client' -type d | head -1) && \
    PRISMA_SRC=$(find /app/node_modules/.pnpm -path '*/@prisma+client*/node_modules/.prisma/client' -type d | head -1) && \
    rm -rf "$PRISMA_DEST" && cp -r "$PRISMA_SRC" "$PRISMA_DEST"

# Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/deployed/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/deployed/prisma ./prisma
COPY --from=builder /app/deployed/package.json ./

USER appuser
EXPOSE 5000
CMD ["node", "dist/app.js"]
