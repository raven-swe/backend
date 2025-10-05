FROM node:lts-alpine AS builder 

RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile 

COPY . .
RUN pnpm build

FROM node:lts-alpine AS runner

WORKDIR /app 
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN npm install -g pnpm 
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
EXPOSE 3000

CMD ["node", "dist/main"]
