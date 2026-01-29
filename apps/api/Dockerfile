FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build types package
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @triple-a/types build

# Production
FROM base AS runner
WORKDIR /app/apps/api
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/api ./
COPY --from=builder /app/node_modules ../node_modules

EXPOSE 3000
ENV PORT=3000
CMD ["node", "src/index.js"]
