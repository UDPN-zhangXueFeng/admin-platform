# admin-platform 项目结构说明

## 1. 项目定位

`admin-platform` 是一个基于 Nx 的 monorepo，核心应用是 `apps/admin`，用于承载 Next.js App Router 管理后台。项目来源于 `/Users/zhangxuefeng/reddate/poc/td-manage` 的重构，因此业务语义、菜单概念和模块命名会继承旧系统，但代码组织已切换为 Nx workspace 的应用层、共享层、领域模块层结构。

当前真实技术栈以仓库配置为准：

- Nx `22.7.5`
- Next.js `~16.1.6`
- React `^19.0.0`
- TypeScript `~5.9.2`
- next-intl、Axios、TanStack Query、Zustand
- Radix UI、Tailwind CSS、Zod、React Hook Form、Playwright、Jest

## 2. 顶层目录职责

```text
admin-platform/
├── apps/
│   ├── admin/              # Next.js 管理后台应用
│   └── admin-e2e/          # Playwright E2E 测试工程
├── libs/
│   ├── modules/            # 按业务域拆分的模块层
│   └── shared/             # 跨模块共享基础层
├── configs/                # 多项目、多产品 JSON 配置
├── tools/
│   └── generators/         # 本地 Nx generators
├── .doc/                   # 项目理解与架构草案文档
├── .codex/project/         # Codex 项目上下文文档
├── nx.json                 # Nx workspace 配置
├── package.json            # 依赖声明
└── tsconfig.base.json      # TypeScript 基础配置
```

## 3. 应用层：`apps/`

### `apps/admin`

`apps/admin` 是管理后台主应用，职责应保持尽量薄：

- 承载 Next.js App Router 入口
- 组织 locale 路由、layout、middleware、providers
- 装载项目配置并把页面能力委派给 `libs/`
- 承载只属于当前应用装配层的动态模块页面 registry，避免 `shared` 反向依赖业务模块

当前关键路径：

```text
apps/admin/src/app/
├── [locale]/
│   ├── (app)/              # 登录后的业务壳层与首页
│   ├── (auth)/             # 登录等认证页面
│   ├── layout.tsx          # locale 级 layout
│   └── not-found.tsx
├── globals.css
└── layout.tsx
```

当前动态模块路由入口在：

```text
apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/
├── page.tsx                 # 根据 module + slug 解析 list/create/edit/detail
└── module-page-registry.ts  # app-local 业务模块页面加载表，例如 sp-access
```

`apps/admin/project.json` 中的主要 target：

- `build`：`pnpm exec next build --webpack`
- `dev`：`pnpm exec next dev --webpack`
- `start`：`pnpm exec next start`

### `apps/admin-e2e`

`apps/admin-e2e` 是 Playwright E2E 测试工程，用于验证端到端业务流程。

## 4. 领域模块层：`libs/modules/`

`libs/modules/` 按业务域拆分。当前存在的主要模块包括：

- `auth`
- `dashboard`
- `inventory`
- `key-management`
- `notification`
- `order`
- `product`
- `report`
- `setting`
- `user`

多数模块遵循以下分层：

```text
libs/modules/<domain>/
├── feature/                # 页面级、场景级业务组件
├── ui/                     # 模块内部可复用展示组件
├── data-access/            # 接口、query、store、数据模型
└── util/                   # 模块内常量、校验、权限、工具函数
```

约束原则：

- `feature` 可以依赖本模块或允许范围内的 `ui`、`data-access`、`util`、`model`
- 领域模块不应把旧系统耦合关系原样搬进新架构
- 新业务优先落在对应 domain 下，不要为了单次使用新增 shared 抽象

## 5. 共享基础层：`libs/shared/`

`libs/shared/` 是跨模块共享基础设施。当前关键库包括：

```text
libs/shared/
├── data-access-api/        # Axios/API client 基础设施
├── data-access-query/      # TanStack Query 基础设施
├── design-tokens/          # 设计 token 与主题基础
├── model/                  # 跨模块共享 TypeScript 类型
├── ui/                     # 基础 UI 组件
├── ui-charts/              # 图表组件
├── ui-forms/               # 表单组件封装
├── ui-layout/              # AppShell、Sidebar、Header、Breadcrumb 等布局
├── util-auth/              # 登录态、权限、token 相关工具
├── util-classnames/        # className 合并工具
├── util-config/            # 项目配置系统与历史模块加载辅助
├── util-dates/             # 日期工具
├── util-formatting/        # 格式化工具
├── util-i18n/              # i18n 路由与核心能力
├── util-i18n-messages/     # 国际化文案
├── util-state/             # Zustand 通用状态工具
└── util-testing/           # 测试工具
```

共享层约束：

- `shared` 不能依赖 `libs/modules/*`
- 可复用能力应稳定后再沉入 `shared`
- `shared` 更适合放平台基础能力，而不是具体业务逻辑

## 6. 配置层：`configs/`

`configs/` 是当前项目配置驱动能力的核心入口：

```text
configs/
├── _schema.json
├── crm.json
├── ecommerce.json
├── education.json
├── hospital.json
└── stablecoin.json
```

这些配置通常控制：

- 项目名称、logo、主题
- layout 形态
- 菜单顺序与路径
- 启用模块
- dashboard 配置
- i18n 与 feature 开关；`features.inactivityLogout` 仅在 production 生效，用于启用 30 分钟无操作自动退出

修改菜单或模块启用状态时，需要同时检查：

- `configs/*.json`
- `apps/admin/src/app`
- `libs/shared/util-config`
- 对应 `libs/modules/<domain>/*`

大多数路由类回归来自这些层之间不同步。

## 7. 配置系统关键文件

`libs/shared/util-config/src/lib/` 是配置系统的主要实现位置：

```text
libs/shared/util-config/src/lib/
├── config.context.tsx      # 配置上下文
├── config.defaults.ts      # 默认配置
├── config.loader.ts        # 配置加载逻辑
├── config.schema.ts        # 配置 schema
├── config.types.ts         # 配置类型
└── module-registry.ts      # 历史模块注册与解析；新增业务优先放到 app-local registry
```

理解某个页面为什么显示、隐藏或无法加载时，优先检查配置、App Router 动态路由和 app-local module registry 是否一致。`shared-util-config` 不能新增对 `libs/modules/*` 的依赖；新模块应在 `apps/admin` 装配层接入动态页面加载。

## 8. 常用命令

```bash
npx nx dev admin
npx nx build admin
npx nx test <project>
npx nx e2e admin-e2e
npx nx lint <project>
npx nx show project admin
```

示例：

```bash
npx nx test modules-user-feature
npx nx lint shared-ui
```

## 9. 读代码建议顺序

理解一个功能时，建议按以下顺序阅读：

1. `configs/*.json`：确认菜单、路径、模块启用状态
2. `apps/admin/src/app`：确认 App Router 入口、layout 和 locale 路由
3. `libs/shared/util-config`：确认配置加载、模块注册和动态解析
4. `libs/modules/<domain>/*`：阅读对应业务域的 feature、data-access、ui、util
5. `libs/shared/*`：只在遇到共享能力时继续向下追踪

## 10. 维护原则

- 优先遵循现有 Nx tags、module boundary 和目录约定
- 修改应尽量外科手术式，避免顺手重构无关代码
- 从 `td-manage` 迁移功能时，保留业务语义，不复制旧项目耦合结构
- 新增测试应覆盖行为意图，尤其是配置解析、路由解析、共享工具和复用 UI
- locale 路由必须保持 `/en-US/...`、`/zh-CN/...` 这类前缀形态
- 配置、路由、模块注册三层必须一起校验

## 11. 项目一句话总结

这是一个基于 Nx 的配置驱动、多业务域、可按项目切换的后台管理平台重构工程；应用层负责装配，业务能力下沉到领域模块，共享基础设施沉淀在 `libs/shared`。
