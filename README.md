# Admin Platform

基于 **Nx monorepo** 的配置驱动管理后台。核心应用位于 `apps/admin`，使用 Next.js App Router 提供带 locale 前缀的后台页面；具体业务能力按领域沉淀在 `libs/modules`，跨领域基础能力位于 `libs/shared`。

## 技术栈

- Nx 22、pnpm workspace
- Next.js 16、React 19、TypeScript
- Tailwind CSS、Radix UI
- TanStack Query、Axios、Zustand
- next-intl、Zod、React Hook Form
- Jest、Testing Library、Playwright

## 快速开始

### 运行环境

- Node.js：使用与 Next.js 16 兼容的当前 LTS 版本
- pnpm：项目使用 `pnpm-lock.yaml` 锁定依赖，请勿混用 npm 或 Yarn 安装依赖

安装依赖：

```bash
pnpm install
```

### 配置本地 API 代理

在 `apps/admin/.env.local` 中配置后端地址。客户端请求会通过 `NEXT_PUBLIC_API_BASE_URL` 指定的代理前缀，由 Next.js 转发至 `NEXT_SERVICE_SERVER_URL`。

```bash
# apps/admin/.env.local
NEXT_PUBLIC_API_BASE_URL=/aps
NEXT_SERVICE_SERVER_URL=http://<backend-host>:<port>
```

> `NEXT_SERVICE_SERVER_URL` 仅用于本地或部署环境配置，不应提交真实的内网地址或密钥。

### 启动开发服务

```bash
pnpm exec nx dev admin
```

默认访问地址为 `http://localhost:3000`。路由始终包含 locale 前缀，例如：

```text
http://localhost:3000/zh-CN/login
http://localhost:3000/en-US/login
```

## 项目配置

项目配置位于 `configs/`，当前内置 `stablecoin`、`ecommerce`、`crm`、`hospital` 和 `education` 等配置。配置决定项目主题、菜单、启用模块、国际化覆盖和 feature 开关。

默认加载 `stablecoin`。可通过 `NX_PROJECT_ID` 切换：

```bash
NX_PROJECT_ID=crm pnpm exec nx dev admin
```

新增或调整菜单、模块时，需要同步核对以下三层：

1. `configs/*.json`：菜单路径与模块启用状态；
2. `apps/admin/src/app`：App Router 与 locale 路由；
3. `libs/shared/util-config`、`apps/admin` 的 module page registry：配置加载与页面装配。

## 常用命令

```bash
# 开发与构建
pnpm exec nx dev admin
pnpm exec nx build admin
pnpm exec nx start admin

# 查看应用可用 targets
pnpm exec nx show project admin

# 质量检查（替换为实际项目名）
pnpm exec nx lint <project>
pnpm exec nx test <project>

# 端到端测试
pnpm exec nx e2e admin-e2e
```

示例：

```bash
pnpm exec nx lint shared-ui
pnpm exec nx test modules-user-feature
```

## 目录说明

```text
admin-platform/
├── apps/
│   ├── admin/                  # Next.js 管理后台应用与应用装配
│   └── admin-e2e/              # Playwright 端到端测试
├── libs/
│   ├── modules/<domain>/       # 领域模块：feature / ui / data-access / util
│   └── shared/                 # 跨模块共享基础设施与 UI
├── configs/                    # 项目、主题、菜单、模块开关等 JSON 配置
├── tools/generators/           # 本地 Nx generators
└── .codex/project/             # 项目结构与研发规范文档
```

依赖方向：

```text
apps/admin → libs/modules/* → libs/shared/*
```

`libs/shared` 禁止依赖 `libs/modules`。业务代码优先放入对应领域模块；只有跨模块且稳定复用的能力才进入 `shared`。

## 开发约定

- 应用层保持轻量，只负责 App Router、providers、配置装载与模块页面装配。
- 使用 `@myorg/...` alias 从各库的公共入口导入，避免跨库深层路径或相对路径绕过 Nx module boundary。
- 远程数据放在领域模块的 `data-access`，页面/场景级组件放在 `feature`，不要在 React 组件内散落 Axios 调用。
- 变更行为后执行最窄范围的 lint、test 或 build；若无法执行，需明确说明原因。
- 新增迁移模块时，除代码外还应更新配置、app-local page registry、`apps/admin/next.config.ts` 的 `transpilePackages` 和 TypeScript path 配置。

## 进一步阅读

- [项目结构说明](.codex/project/pro.md)
- [前端代码设计与规范](.codex/project/rule.md)
- [协作经验沉淀](.codex/project/memory.md)
