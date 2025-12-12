FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN NUXT_BUILD=true npm run build

# ----------------------------------------------------
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./

RUN npm install --omit=dev 

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD [ "npm", "run", "start" ]