FROM node:lts-alpine AS builder

RUN npm install -g pnpm@10.34.5
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN pnpm config set store-dir /root/.pnpm-store

RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile --ignore-scripts

COPY prisma ./prisma
RUN pnpm prisma generate

COPY . .
RUN pnpm build

RUN pnpm prune --prod --ignore-scripts

# For prisma runtime files
COPY ./tsconfig.json ./tsconfig.json

FROM node:lts-alpine AS runner

# For prisma runtime files (seeds mainly)
RUN npm install -g pnpm@10.34.5 ts-node typescript
RUN pnpm add -D @types/node

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma migrate deploy && (pnpm db:seed || true) && node ./dist/src/main.js"]
