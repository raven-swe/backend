FROM node:lts-alpine AS builder 

RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY prisma ./prisma
RUN pnpm prisma generate

COPY . .
RUN pnpm build

RUN pnpm prune --prod --ignore-scripts

FROM node:lts-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma migrate deploy && node ./dist/src/main.js"]
