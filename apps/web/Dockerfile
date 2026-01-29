FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage
FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @triple-a/types build
RUN pnpm --filter @triple-a/web build

# Production
FROM node:20-slim AS runner
RUN corepack enable
WORKDIR /app
COPY --from=builder /app/apps/web/dist ./dist
COPY --from=builder /app/apps/web/package.json ./
RUN pnpm install --prod --ignore-scripts

EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "start"]
