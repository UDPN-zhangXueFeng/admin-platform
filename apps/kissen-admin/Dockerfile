# ─────────────────────────────────────────────────────────────
# kissen-admin / apps/kissen-admin 运行镜像
# 参照根 Dockerfile（apps/admin）。差异仅三处：
#   ① install 层 manifest 增补 apps/kissen-admin
#   ② 构建目录 apps/kissen-admin
#   ③ runner 拷贝路径 apps/kissen-admin/*
# 架构不变：后端 API (/v1/*) 由前置 nginx 容器代理并注入
# NEXT_SERVICE_SERVER_URL，本镜像「环境无关」，可跨环境复用。
# ─────────────────────────────────────────────────────────────

# ── builder：装依赖 + 构建 standalone 产物 ──
FROM node:22-alpine AS builder

# 国内镜像源（对齐根 Dockerfile，加速内网构建）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 锁定 pnpm 版本与本地一致
RUN corepack enable && corepack prepare pnpm@8.14.1 --activate

WORKDIR /workspace

# 先仅复制依赖解析所需的 workspace manifest。
# ⚠️ kissen-admin 已登记进 pnpm-lock.yaml importer，
#    缺这行则 --frozen-lockfile 直接失败（workspace 项目缺失）。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/admin-e2e/package.json ./apps/admin-e2e/package.json
COPY apps/kissen-admin/package.json ./apps/kissen-admin/package.json
COPY tools/generators/package.json ./tools/generators/package.json

# npm 源切国内镜像（目标节点对 registry.npmjs.org DNS 解析间歇失败 EAI_AGAIN）
ENV npm_config_registry=https://registry.npmmirror.com

# BuildKit cache mount 复用节点 pnpm store（与 admin 共享，内容寻址安全）。
RUN --mount=type=cache,id=admin-platform-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 依赖层完成后再复制源码
COPY . .

# 应用身份：loadProjectConfig() 无参调用时读 NX_PROJECT_ID 选 configs/<id>.json。
# dev 下由 Nx 注入（NX_PROJECT_ID=kissen-admin）；Docker 内无 Nx，必须显式注入，
# 否则 fallback 到 stablecoin（admin 平台菜单）。builder 阶段覆盖预渲染，runner 覆盖 SSR。
ARG NX_PROJECT_ID=kissen-admin
ENV NX_PROJECT_ID=$NX_PROJECT_ID
# rewrites 兜底地址（生产 /v1 由 nginx 拦截，此值不生效，仅给默认）。
ARG NEXT_PUBLIC_KISSEN_API_BASE_URL=/v1
ENV NEXT_PUBLIC_KISSEN_API_BASE_URL=$NEXT_PUBLIC_KISSEN_API_BASE_URL
ARG NEXT_SERVICE_SERVER_URL_KISSEN=http://10.0.7.103:9000
ENV NEXT_SERVICE_SERVER_URL_KISSEN=$NEXT_SERVICE_SERVER_URL_KISSEN

# 目标服务器内存受限（<8G），限制 node 堆 + 关闭遥测
ENV NODE_OPTIONS=--max-old-space-size=2560
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /workspace/apps/kissen-admin
RUN pnpm exec next build --webpack

# ── runner：最小运行镜像 ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# 应用身份（与 builder 同值）：SSR 运行期 loadProjectConfig 依赖。
ENV NX_PROJECT_ID=kissen-admin

# Next 16 monorepo standalone 保留 workspace 相对路径
# → server.js 位于 apps/kissen-admin/server.js
COPY --from=builder /workspace/apps/kissen-admin/.next/standalone ./
# standalone 默认不含 static 与 public，需单独补齐
COPY --from=builder /workspace/apps/kissen-admin/.next/static ./apps/kissen-admin/.next/static
COPY --from=builder /workspace/apps/kissen-admin/public ./apps/kissen-admin/public

EXPOSE 3000
CMD ["node", "apps/kissen-admin/server.js"]
