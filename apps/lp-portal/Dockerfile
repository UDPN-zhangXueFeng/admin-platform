# ─────────────────────────────────────────────────────────────
# lp-portal / apps/lp-portal 运行镜像
# 参照 apps/kissen-admin/Dockerfile（根 Dockerfile 模式）。差异仅三处：
#   ① install 层 manifest 增补 apps/lp-portal
#   ② 构建目录 apps/lp-portal
#   ③ runner 拷贝路径 apps/lp-portal/*
# 架构不变：后端 API（/lp/*）由前置 nginx 容器代理，本镜像
# 「环境无关」，可跨环境复用。
# ─────────────────────────────────────────────────────────────

# ── builder：装依赖 + 构建 standalone 产物 ──
FROM node:22-alpine AS builder

# 国内镜像源（对齐根 Dockerfile，加速内网构建）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 锁定 pnpm 版本与本地一致
RUN corepack enable && corepack prepare pnpm@8.14.1 --activate

WORKDIR /workspace

# 先仅复制依赖解析所需的 workspace manifest。
# ⚠️ lp-portal 已登记进 pnpm-lock.yaml importer，
#    缺这行则 --frozen-lockfile 直接失败（workspace 项目缺失）。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/admin-e2e/package.json ./apps/admin-e2e/package.json
COPY apps/lp-portal/package.json ./apps/lp-portal/package.json
COPY tools/generators/package.json ./tools/generators/package.json

# npm 源切国内镜像（目标节点对 registry.npmjs.org DNS 解析间歇失败 EAI_AGAIN）
ENV npm_config_registry=https://registry.npmmirror.com

# BuildKit cache mount 复用节点 pnpm store（与 admin 共享，内容寻址安全）。
RUN --mount=type=cache,id=admin-platform-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 依赖层完成后再复制源码
COPY . .

# 应用身份：loadProjectConfig() 无参调用时读 NX_PROJECT_ID 选 configs/<id>.json。
# dev 下由 Nx 注入（NX_PROJECT_ID=lp-portal）；Docker 内无 Nx，必须显式注入，
# 否则 fallback 到 stablecoin（admin 平台菜单）。builder 阶段覆盖预渲染，
# runner 覆盖 SSR。
ARG NX_PROJECT_ID=lp-portal
ENV NX_PROJECT_ID=$NX_PROJECT_ID
# rewrites 兜底地址（生产 /lp 由 nginx 拦截，此值不生效，仅给默认；
# 与 next.config.ts 代码默认一致）。
ARG NEXT_LP_BACKEND_URL=http://10.0.7.103:8090
ENV NEXT_LP_BACKEND_URL=$NEXT_LP_BACKEND_URL

# 目标服务器内存受限（<8G），限制 node 堆 + 关闭遥测
ENV NODE_OPTIONS=--max-old-space-size=2560
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /workspace/apps/lp-portal
RUN pnpm exec next build --webpack

# ── runner：最小运行镜像 ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# 应用身份（与 builder 同值）：SSR 运行期 loadProjectConfig 依赖。
ENV NX_PROJECT_ID=lp-portal

# Next 16 monorepo standalone 保留 workspace 相对路径
# → server.js 位于 apps/lp-portal/server.js
COPY --from=builder /workspace/apps/lp-portal/.next/standalone ./
# standalone 默认不含 static 与 public，需单独补齐
COPY --from=builder /workspace/apps/lp-portal/.next/static ./apps/lp-portal/.next/static
COPY --from=builder /workspace/apps/lp-portal/public ./apps/lp-portal/public

EXPOSE 3000
CMD ["node", "apps/lp-portal/server.js"]
