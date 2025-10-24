# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm 설치
RUN npm install -g pnpm

# 의존성 파일 복사 및 설치
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 소스 코드 복사
COPY . .

# Prisma 생성 및 빌드
RUN pnpm prisma generate
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

# 의존성만 복사 (production)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# 빌드된 파일과 Prisma 스키마 복사
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Prisma 클라이언트 생성
RUN pnpm prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]

