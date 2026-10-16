# Build context is the repo root: docker build -f apps/server/Dockerfile .
# (fly deploy does this from the root, see fly.toml.)

FROM node:24-alpine AS build
RUN npm install -g pnpm@12.11.2
WORKDIR /repo
# Manifests first so the dependency layer is cached until they change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter "@chessweeper/server..."
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/server apps/server
RUN pnpm --filter @chessweeper/server build

# The bundle contains engine, protocol, zod and ws: no node_modules needed at runtime.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/server/dist/main.js ./main.js
USER node
EXPOSE 8080
CMD ["node", "main.js"]
