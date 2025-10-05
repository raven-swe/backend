FROM node:lts-alpine AS builder 

RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile 

COPY . .
RUN pnpm prisma generate
RUN pnpm build

RUN pnpm prune --prod

FROM node:lts-alpine AS runner

WORKDIR /app 
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
