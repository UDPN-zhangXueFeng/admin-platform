# ─────────────────────────────────────────────────────────────
# admin-platform / apps/admin 运行镜像
# Nx monorepo + pnpm workspace + Next.js 16 standalone
#
# 架构：后端 API (/aps/*) 由前置 nginx 容器代理并注入 NEXT_SERVICE_SERVER_URL，
#       因此本 Next.js 镜像「环境无关」，可跨环境复用、layer 缓存友好。
# ─────────────────────────────────────────────────────────────

# ── builder：装依赖 + 构建 standalone 产物 ──
FROM node:22-alpine AS builder

# 国内镜像源（对齐 td-manage，加速内网构建）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 锁定 pnpm 版本与本地一致（仓库未声明 packageManager，显式固定避免版本漂移）
RUN corepack enable && corepack prepare pnpm@8.14.1 --activate

WORKDIR /workspace

# 先拷 workspace 清单 + 全部子包源码，再装依赖。
# monorepo 的 package.json 分散在 apps/ libs/ packages/ tools/ 下，无法逐个 COPY，
# 故整体拷入；配合下方 BuildKit cache mount，改源码不会触发依赖重下载。
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps ./apps
COPY libs ./libs
COPY tools ./tools
COPY configs ./configs

# 装依赖（对齐 td-manage 朴素模式，不依赖 BuildKit；内网走阿里云源）
RUN pnpm install --frozen-lockfile

# 构建期 env：NEXT_PUBLIC_* 会被烘焙进前端 bundle，必须在 build 前确定
ARG NEXT_PUBLIC_API_BASE_URL=/aps
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
# rewrites 兜底地址（实际 /aps/ 请求由 nginx 代理，rewrites 不生效，这里仅给默认值）
ARG NEXT_SERVICE_SERVER_URL=http://10.0.48.123:30001
ENV NEXT_SERVICE_SERVER_URL=$NEXT_SERVICE_SERVER_URL

WORKDIR /workspace/apps/admin
RUN pnpm exec next build --webpack

# ── runner：最小运行镜像 ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# standalone 产物自带打平的 node_modules。
# Next 16 monorepo standalone 保留 workspace 相对路径 → server.js 位于 apps/admin/server.js。
# ⚠️ 首次构建请用 `docker run --rm <img> ls -R /app` 核对 server.js 实际路径，若不同调整下方 CMD。
COPY --from=builder /workspace/apps/admin/.next/standalone ./
# standalone 默认不含 static 与 public，需单独补齐
COPY --from=builder /workspace/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /workspace/apps/admin/public ./apps/admin/public

EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
