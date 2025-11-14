
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:20-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]