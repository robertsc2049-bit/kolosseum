# DEV NOTE: Platform-agnostic container image for local/self-hosted use.
# Multi-stage: a full "build" stage compiles the server (tsc) and the React
# app (vite) and runs `npm ci` once with dev dependencies; the final image
# only carries production dependencies plus the compiled output, keeping the
# runtime image small and free of the TypeScript/vite toolchain.

FROM node:25.9.0-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:25.9.0-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# @kolosseum/engine is a "file:engine" local dependency (see package.json) -
# its source and compiled dist must be present before `npm ci` for npm to
# resolve/copy it into node_modules.
COPY --from=build /app/engine ./engine
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY schema.sql ./schema.sql
COPY scripts/apply-schema.mjs ./scripts/apply-schema.mjs
COPY scripts/bootstrap_admin_account.mjs ./scripts/bootstrap_admin_account.mjs

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
