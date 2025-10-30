FROM node:20-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile


COPY . .

# Prisma 생성 및 빌드
RUN npx prisma generate
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

# 의존성만 복사
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# 빌드된 파일과 Prisma 스키마 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Prisma 클라이언트 생성
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]

