FROM oven/bun:1.2-slim AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

# ----------------------------------------------------
FROM oven/bun:1.2-slim

WORKDIR /app

# Copy the bundled output and package.json
COPY --from=builder /app/api ./api
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD [ "bun", "api/index.cjs" ]