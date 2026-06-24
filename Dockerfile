FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
# The committed lockfile is generated on ARM (this dev host is aarch64) and pins
# ARM-only native optional deps. On the x64 Alpine build image, npm honors the
# lockfile and never fetches the missing musl-x64 binding, so `nuxi prepare`
# dies with "Cannot find module '@oxc-parser/binding-linux-x64-musl'" (npm
# optional-deps bug, https://github.com/npm/cli/issues/4828). Dropping the
# lockfile lets npm resolve optional deps fresh for the build platform.
RUN rm -f package-lock.json && npm install

COPY . .
RUN npx nuxi prepare
RUN npm test
RUN npm run build

# The Nitro node-server build produces a self-contained .output bundle.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Do NOT hardcode NITRO_PORT here: Nitro prefers NITRO_PORT over PORT, which would
# shadow the PORT that most PaaS platforms inject. Left unset, the server binds
# $PORT in production; docker-compose sets NITRO_PORT explicitly for local runs.

COPY --from=builder /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
