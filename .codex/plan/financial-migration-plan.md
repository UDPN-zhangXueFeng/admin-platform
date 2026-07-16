# Financial 模块迁移与重构计划

> **范围**：将 `/Users/zhangxuefeng/reddate/poc/td-manage/src/pages/financial` 下的全部页面逻辑与 API 迁移到 `/Users/zhangxuefeng/pi-cwd-20260601/admin-platform`（Nx monorepo + Next.js App Router）。
> **目标**：产出可执行、可验收、按困难程度排序的迁移计划；在用户确认前不进行任何代码开发。
> **编写时间**：2026-06-22
> **计划版本**：v1.0

---

## 1. 项目背景与目标

### 1.1 背景

源项目 `td-manage` 是一个基于 **Next.js 15 Pages Router + antd 5 + swr + axios + tailwindcss + next-i18next** 的管理后台。`src/pages/financial` 目录下沉淀了完整的财务相关业务能力，包含 9 个子模块、23 个页面文件、约 **11,981 行** TSX 代码。

目标项目 `admin-platform` 是一个 **Nx monorepo**，采用 **Next.js 16 App Router + React 19 + Radix UI + Tailwind + TanStack Query + react-hook-form + zod + zustand + next-intl**。模块以 `libs/modules/{module}/{data-access,feature,ui,util}` 形式组织，通过动态路由 `[locale]/(app)/[module]/[[...slug]]` 统一加载。

### 1.2 目标

1. 将 financial 业务完整迁移到 admin-platform，保持现有业务行为不变。
2. 按目标项目约定重构：UI 组件从 antd 迁移到自研 Radix/Tailwind 组件；数据获取从 swr/axios 迁移到 TanStack Query + `apiClient`；表单从 antd Form 迁移到 react-hook-form + zod。
3. 输出可执行的模块级迁移文档，并按迁移/重构困难程度排序，便于分批落地与资源排期。

---

## 2. 源项目技术画像

### 2.1 核心依赖

| 维度 | 源项目（td-manage） |
|------|---------------------|
| 框架 | Next.js `15.5.2`（Pages Router） |
| React | `18.3.1` |
| UI 库 | antd `5.3.2` + `@ant-design/icons` + `@heroicons/react` |
| CSS | Tailwind CSS `3.3.1` + antd CSS |
| 状态管理 | 本地 `useState/useReducer` + `swr` |
| 请求库 | `axios`（封装在 `src/lib/axios.ts`） |
| 表单 | antd `Form` |
| 表格 | antd `Table` / 自研 `CustomTable` |
| 路由 | 文件约定式 Pages Router |
| i18n | `next-i18next` + `public/locales/{locale}/financial.json` |
| 日期库 | `dayjs` |
| 权限 | `localStorage.getItem('userPermission')` UUID 数组 |

### 2.2 API 封装方式

- 通用请求函数：`src/lib/axios.ts` 导出 `request(url, AxiosRequestConfig)` 与 `fetcher([url, payload])`。
- 业务 API：`src/lib/api/financial.ts` 以 `BCMP.GetRequestData<any, any>` 类型声明，调用 `request(...)`。
- 类型：几乎全用 `GlobalAny` / `BCMP.ANY`，类型安全薄弱。
- 响应约定：`{ code, data, message }`，`code === 0` 为成功。

### 2.3 页面组织

```text
src/pages/financial
├── adjustments/                 # 调账（本地 mock 数据，无真实 API）
│   ├── index.tsx   (413 lines)
│   ├── edit.tsx    (361 lines)
│   └── view.tsx    (295 lines)
├── audit-trail/                 # 审计追踪
│   ├── index.tsx   (506 lines)
│   └── view.tsx    (271 lines)
├── chart-of-accounts/           # 会计科目表
│   ├── index.tsx   (673 lines)
│   └── view.tsx    (423 lines)
├── journal-entries/             # 记账规则（旧版）
│   ├── index.tsx   (289 lines)
│   ├── edit.tsx    (896 lines)
│   └── view.tsx    (405 lines)
├── journal-entries-new/         # 新 Journal 流水
│   ├── index.tsx   (479 lines)
│   └── detail.tsx  (539 lines)
├── posting-engine/              # 过账引擎（最复杂）
│   ├── index.tsx   (492 lines)
│   ├── edit.tsx    (748 lines)
│   ├── view.tsx    (1099 lines)
│   └── detail.tsx  (148 lines)
├── statements/                  # 财务报表导出任务
│   ├── index.tsx   (583 lines)
│   ├── export.tsx  (592 lines)
│   └── view.tsx    (320 lines)
├── transaction-event-configuration/  # 交易事件配置 / 映射规则
│   ├── index.tsx                        (587 lines)
│   └── mapping-rule/
│       ├── index.tsx   (513 lines)
│       ├── edit.tsx    (870 lines)
│       └── detail.tsx  (133 lines)
└── travel-rule/                 # Travel Rule（静态 mock 页）
    └── index.tsx   (346 lines)
```

### 2.4 关键共享依赖

| 依赖 | 路径 | 用途 | 迁移优先级 |
|------|------|------|-----------|
| `useHook` | `libs/components` | i18n + router 统一 hook | 高，需替换为 next-intl + useRouter |
| `CustomTable` / `useCustomTable` | `libs/components` | 列表页统一封装 | 高，替换为 DataTable + TanStack Query |
| `CopyableEllipsisText` | `src/lib/components/financial/CopyableEllipsisText.tsx` | 表格长文本 tooltip + 复制 | 高，目标项目需新增 |
| `useTokenTypeOptions` | `src/lib/hooks/useTokenTypeOptions.ts` | Token Type 下拉选项 | 高 |
| `formatTimestamp` | `libs/utils` | 时间戳格式化 | 中，可用 date-fns 替代 |
| `formatEodCutoffTime` | `src/lib/financial/date-time.ts` | EOD 时间格式化 | 中 |
| `getFinancialBookMetaByBookId` / `getFinancialBookMetaById` | `src/lib/financial/financial-book-meta.ts` | 账本元数据映射 | 高 |
| `ReconciliationSection` / `ReconciliationExportButton` / `renderAdjustmentStatusTag` | `src/lib/components/reconciliation/adjustments` | adjustments 专用组件 | 中 |
| `BasicInformationTab` / `PostingEngineMatrixTab` | `src/lib/components/posting-engine` | posting-engine 详情 tabs | 高 |
| `BasicInformationTab` / `HistoricalRecordsTab` | `src/lib/components/financial/transaction-event-configuration` | tx-event 详情 tabs | 高 |

### 2.5 API 总览

financial 模块直接调用的业务 API 约 **18 个**（`src/lib/api/financial.ts`），加上公共下拉接口（`/api/manage/v1/common/*`）和文件下载接口（`src/lib/api/common.ts`）。

#### 2.5.1 financial 业务 API

| API 函数 | Endpoint | Method | 用途 |
|----------|----------|--------|------|
| `financialBillOTxListApi` | `/api/manage/v1/financial/bill/tx/listPage` | POST | 账单交易列表 |
| `financialBillOperateApi` | `/api/manage/v1/financial/bill/operate` | POST | 启用/禁用规则 |
| `financialBillRuleAddApi` | `/api/manage/v1/financial/bill/rule/add` | POST | 新增记账规则 |
| `financialBillRuleEditApi` | `/api/manage/v1/financial/bill/rule/edit` | POST | 编辑记账规则 |
| `financialBillRuleSubjectListApi` | `/api/manage/v1/financial/bill/rule/add/subjectList` | POST | 科目下拉 |
| `financialBillRuleAddSubjectSavetApi` | `/api/manage/v1/financial/bill/rule/add/subject/save` | POST | 保存科目 |
| `financialBillRuleAddTokenListApi` | `/api/manage/v1/financial/bill/rull/add/tokenList` | GET | Token 下拉 |
| `financialBillTxExportApi` | `/api/manage/v1/financial/bill/tx/export` | POST | 导出账单交易 |
| `financialBillRuleDetailApi` | `/api/manage/v1/financial/bill/rule/detail` | POST | 规则详情 |
| `exportTaskCreateRuleSaveApi` | `/api/manage/v1/export/task/create/rule` | POST | 创建导出任务规则 |
| `exportTaskRuleOperateApi` | `/api/manage/v1/export/task/rule/operate` | POST | 启用/禁用/删除导出规则 |
| `exportTaskcreateApi` | `/api/manage/v1/export/task/create` | POST | 创建导出任务 |
| `exportTaskDeleteApi` | `/api/manage/v1/export/task/delete` | POST | 删除导出任务 |
| `interestTxTypeApi` | `/api/manage/v1/financial/bill/query/interest/tx/type` | POST | 利息交易类型 |
| `billTxTypeApi` | `/api/manage/v1/financial/bill/query/tx/type` | POST | 账单交易类型 |
| `exportTaskPermissionEmailApi` | `/api/manage/v1/export/task/permission/email` | POST | 获取有权限用户邮箱 |
| `financeJournalListApi` | `/api/finance/v1/finance/journal/list` | POST | Journal 列表 |
| `financeJournalDetailApi` | `/api/finance/v1/finance/journal/detail/{tdTxId}` | GET | Journal 详情 |
| `financeJournalTravelRuleApi` | `/api/finance/v1/finance/journal/travel-rule/{tdTxId}` | GET | Travel Rule 详情 |

#### 2.5.2 公共下拉接口（通过 `useSWR` 直接调用）

| Endpoint | Method | 用途 |
|----------|--------|------|
| `/api/manage/v1/common/stablecoin/enabled/searches` | GET | Token（稳定币）下拉 |
| `/api/manage/v1/common/currency/list` | GET | 货币下拉 |
| `/api/manage/v1/common/blockchain/list` | GET | 区块链下拉 |
| `/api/manage/v1/financial/bill/rule/add/tokenList` | GET | 记账规则 Token 下拉 |

#### 2.5.3 文件下载

| API 函数 | Endpoint | 用途 |
|----------|----------|------|
| `downloadApi` | `${NEXT_PUBLIC_FILE_ID}v1/sftp/download?busId=...&busType=...` | 下载导出文件 |

---

## 3. 目标项目技术画像

### 3.1 核心依赖

| 维度 | 目标项目（admin-platform） |
|------|---------------------------|
| Monorepo | Nx `22.7.5` + pnpm workspace |
| 框架 | Next.js `16.1.6`（App Router） |
| React | `19.0.0` |
| UI 基座 | Radix UI + Tailwind CSS `3.4.17` + `class-variance-authority` |
| 共享 UI | `libs/shared/ui`（Button/Input/Select/DataTable/Dialog/Drawer/Tabs/Tooltip/Toast 等） |
| 表单 | `react-hook-form` + `zod` + `libs/shared/ui-forms` |
| 表格 | `@tanstack/react-table` + `libs/shared/ui` DataTable |
| 请求 | `axios`（封装在 `libs/shared/data-access-api`） |
| 服务端状态 | `@tanstack/react-query` + `libs/shared/data-access-query` |
| 客户端状态 | `zustand`（模块内 `+state/`） |
| 路由 | App Router `[locale]/(app)/[module]/[[...slug]]/page.tsx` |
| i18n | `next-intl` + `libs/shared/util-i18n-messages` |
| 日期 | `date-fns` |
| 权限 | `libs/shared/util-auth`（`PermissionGuard` + `token` header） |

### 3.2 模块组织约定

已有模块（user / order / sp-access / key-management / dashboard 等）遵循统一结构：

```text
libs/modules/{module}
├── data-access/
│   └── src/lib/
│       ├── {module}.api.ts          # 原始 HTTP 函数
│       ├── {module}.model.ts        # 类型定义
│       ├── +queries/
│       │   ├── {module}.keys.ts     # TanStack Query keys
│       │   ├── {module}.queries.ts  # useXxxQuery
│       │   └── {module}.mutations.ts# useXxxMutation
│       └── +state/
│           ├── {module}-filter.store.ts
│           └── {module}-ui.store.ts
├── feature/
│   └── src/lib/
│       ├── {module}-list-page.tsx
│       ├── {module}-form-page.tsx
│       ├── {module}-detail-page.tsx
│       └── module-manifest.ts       # 模块身份卡
├── ui/
│   └── src/lib/                     # 模块专属 UI 组件
└── util/
    └── src/lib/                     # 常量、校验、类型、权限
```

### 3.3 路由与模块注册

1. **动态路由入口**：`apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx`
2. **模块注册表**：`libs/shared/util-config/src/lib/module-registry.ts` 中静态注册模块的 manifest 与 page loader。
3. **硬编码分支**：`module-page-registry.ts` 对 `sp-access` 做了特殊处理；其他模块走 `loadLegacyModulePage`。
4. **启用开关**：`config.modules.enabled` 控制模块是否可用。

### 3.4 API 请求约定

- `libs/shared/data-access-api/src/lib/axios-client.ts`：baseURL 来自 `NEXT_PUBLIC_API_BASE_URL`，注入自定义 `token` header，统一处理 `code 3/4` 会话过期与 401。
- `libs/shared/data-access-api/src/lib/api-client.ts`：封装 `get/post/patch/delete`，自动 unwrap `{ code, data, message }`。
- 模块 `data-access` 中写原始 API 函数（如 `getUsers`），然后在 `+queries` 中写 `useUsersQuery`。

### 3.5 i18n 约定

- `libs/shared/util-i18n-messages/src/lib/{locale}/modules/{module}.json`
- `mergeMessages.ts` 静态 import 所有模块翻译，按 `enabledModules` 加载。
- 页面使用 `useTranslations('modules.financial.list')`。

---

## 4. 迁移总策略

### 4.1 原则

1. **业务行为优先**：先保证功能与接口一致，再谈优化。
2. **模式优先**：先落地 financial 模块基础设施与一个简单模块，形成代码样板，后续模块复制该样板。
3. **类型补齐**：目标项目要求类型安全，迁移时需为 API 定义真实 TypeScript 类型（替换 `GlobalAny`）。
4. **UI 复用**：优先使用 `libs/shared/ui` 与 `libs/shared/ui-forms`；缺失的组件（如 CopyableEllipsisText）先在 financial 模块内部实现，稳定后再提至 shared。
5. **权限平移**：源项目的 UUID permission string 原样迁移为常量，目标项目使用 `PermissionGuard` 包裹操作按钮。

### 4.2 总体步骤

```text
Phase 0: 基础设施（1-2 天）
  └─ 创建 libs/modules/financial 下 4 个 Nx lib
  └─ 注册模块到 module-registry.ts
  └─ 添加 i18n 文件
  └─ 实现 financial 通用工具（CopyableEllipsisText、date formatting、token options）

Phase 1: 简单模块（每模块 1-2 天）
  └─ travel-rule → audit-trail → adjustments → chart-of-accounts

Phase 2: 中等模块（每模块 2-4 天）
  └─ journal-entries-new → statements → journal-entries

Phase 3: 复杂模块（每模块 4-8 天）
  └─ posting-engine → transaction-event-configuration

Phase 4: 联调与验收（3-5 天）
  └─ 端到端流程、权限、i18n、E2E
```

---

## 5. 模块清单与复杂度总表

| 模块 | 源文件数 | 源代码行数 | API 数 | 表单复杂度 | 表格复杂度 | 共享依赖数 | 复杂度等级 | 建议批次 |
|------|----------|-----------|--------|-----------|-----------|-----------|-----------|----------|
| travel-rule | 1 | 346 | 0 | 低 | 中 | 1 | **低** | 第一批 |
| audit-trail | 2 | 777 | 2 | 低 | 中 | 2 | **低** | 第一批 |
| adjustments | 3 | 1069 | 0 | 中 | 中 | 3 | **中低** | 第一批 |
| chart-of-accounts | 2 | 1096 | 1 | 中 | 中 | 3 | **中** | 第一批 |
| journal-entries-new | 2 | 1018 | 2 | 低 | 中 | 3 | **中** | 第二批 |
| statements | 3 | 1495 | 5 | 高 | 中 | 3 | **中高** | 第二批 |
| journal-entries | 3 | 1590 | 6 | 高 | 中 | 3 | **高** | 第二批 |
| posting-engine | 4 | 2487 | 3+ | 高 | 高 | 5 | **高** | 第三批 |
| transaction-event-configuration | 4 | 2103 | 2+ | 很高 | 高 | 4 | **很高** | 第三批 |

> **说明**：API 数只统计该模块直接调用的 financial 业务 API；共享依赖数包含页面 import 的 `@/lib/*`、`libs/*` 等。

---

## 6. 基础设施先行工作

在迁移任何业务模块前，必须先完成以下基础设施。它们是多个模块的阻塞项。

### 6.1 创建 financial 模块库

使用 Nx generator（按项目 CLAUDE.md 要求，先调用 `nx-generate` skill）创建：

```bash
pnpm nx g @nx/react:library modules/financial/data-access --directory=libs/modules/financial/data-access --bundler=swc
pnpm nx g @nx/react:library modules/financial/feature --directory=libs/modules/financial/feature --bundler=swc
pnpm nx g @nx/react:library modules/financial/ui --directory=libs/modules/financial/ui --bundler=swc
pnpm nx g @nx/react:library modules/financial/util --directory=libs/modules/financial/util --bundler=swc
```

每个库需要：
- `project.json` 正确配置 tags（建议 `scope:financial`, `type:data-access|feature|ui|util`）。
- `tsconfig.json` 继承 base。
- `src/index.ts` barrel 导出。

### 6.2 注册模块路由

1. 在 `libs/shared/util-config/src/lib/module-registry.ts` 中新增 `financial` entry：

```ts
financial: {
  manifest: () => import('@myorg/modules/financial/feature').then((m) => m.manifest),
  pages: {
    list: () => import('@myorg/modules/financial/feature').then((m) => ({ default: m.FinancialListPage })),
    detail: () => import('@myorg/modules/financial/feature').then((m) => ({ default: m.FinancialDetailPage })),
    create: () => import('@myorg/modules/financial/feature').then((m) => ({ default: m.FinancialFormPage })),
  },
},
```

2. 若需要 sub-module（如 `financial/adjustments`），当前路由 `[module]/[[...slug]]` 只支持 `module` 一级。需要与项目架构组确认：
   - 方案 A：把每个 financial 子模块提升为一级模块（`adjustments`、`statements` 等），独立 manifest。
   - 方案 B：扩展路由为 `[module]/[submodule]/[[...slug]]`，financial 模块内部二次分发。
   - **建议方案 A**，因为每个子模块业务独立、权限独立、代码量足够大，符合目标项目“一个模块一个 manifest”的约定。

### 6.3 i18n 消息文件

在 `libs/shared/util-i18n-messages/src/lib/{en-US,zh-CN}/modules/financial.json` 中创建命名空间，并在 `merge-messages.ts` 中静态 import。

### 6.4 权限常量

在 `libs/modules/financial/util/src/lib/financial-permissions.ts` 中平移所有 UUID：

```ts
export const FINANCIAL_PERMISSIONS = {
  ADJUSTMENTS_ADJUST: '4398f1977e1b43dea24cc94d006b1d27',
  ADJUSTMENTS_DETAILS: '578aa45d4a44468f97d138a7abe8f9f9',
  CHART_OF_ACCOUNTS_DETAIL: 'e37d960ebaaa45d5a8b07c2008ad4a46',
  CHART_OF_ACCOUNTS_EDIT: '83ce166e92e04a7aa9a12083a8c50f60',
  CHART_OF_ACCOUNTS_VIEW_STATEMENTS: 'a3c908d0ec994da6abf82eea3872196f',
  // ... 其他
} as const;
```

### 6.5 通用工具实现

在 `libs/modules/financial/util` 或 `libs/modules/financial/ui` 中实现：

| 工具 | 目标路径 | 说明 |
|------|----------|------|
| `CopyableEllipsisText` | `libs/modules/financial/ui/src/lib/copyable-ellipsis-text.tsx` | 用 `shared/ui` Tooltip + copy-to-clipboard + sonner 重写 |
| `useTokenTypeOptions` | `libs/modules/financial/data-access/src/lib/+queries/token-type.queries.ts` | 基于 TanStack Query 的公共下拉 hook |
| `formatTimestamp` | `libs/modules/financial/util/src/lib/date-format.ts` | date-fns 实现 |
| `formatEodCutoffTime` | 同上 | 带 timezone 的 EOD 时间格式化 |
| `getFinancialBookMetaByBookId` | `libs/modules/financial/util/src/lib/financial-book-meta.ts` | 账本元数据映射 |
| `useCurrencyOptions` / `useBlockchainOptions` / `useStablecoinOptions` | `data-access/+queries/common.queries.ts` | 公共下拉数据 query hooks |

---

## 7. 组件/工具映射表

| 源（antd / 自研） | 目标项目替代 | 备注 |
|-------------------|-------------|------|
| `Button` | `@myorg/shared/ui` Button | 注意 `type="primary"` → `variant="default"` |
| `Input` / `Input.TextArea` | `@myorg/shared/ui` Input | 样式略有差异 |
| `Select` | `@myorg/shared/ui` Select | Radix Select，API 不同 |
| `DatePicker` / `RangePicker` | 需新增或基于 `shared/ui` 封装 | 目标项目只有 `ui-forms` 的 `FormDatePicker` |
| `Form` / `Form.Item` / `Form.useForm` | `react-hook-form` + `libs/shared/ui-forms` | 需要写 resolver |
| `Table` | `@myorg/shared/ui` DataTable | 基于 `@tanstack/react-table` |
| `CustomTable` / `useCustomTable` | DataTable + TanStack Query + 自定义 list page | 需要拆分为 page + query hook |
| `Tag` | 用 Tailwind badge 类或新增 Badge 组件 | 目标项目暂无 Badge |
| `Drawer` | `@myorg/shared/ui` Drawer | Radix Dialog 封装 |
| `Modal` / `confirm` | `@myorg/shared/ui` Dialog + AlertDialog | 需替换 confirm 调用 |
| `Dropdown` | `@myorg/shared/ui` DropdownMenu | Radix 封装 |
| `Tabs` | `@myorg/shared/ui` Tabs | Radix 封装 |
| `Spin` | 用 DataTable `isLoading` + skeleton | 或新增 Spinner |
| `message` / `notification` | `sonner` toast | 统一 toast |
| `ConfigProvider theme` | Tailwind CSS 变量 + 主题配置 | 移除 antd theme |
| `CopyableEllipsisText` | financial 模块自研 | 高优先级 |
| `useHook` | `useTranslations` + `useRouter` | 每个页面单独引入 |
| `getServerSideProps` + `serverSideTranslations` | 移除 | App Router 不再使用；i18n 由 layout 提供 |

---

## 8. 数据层迁移方案

### 8.1 API 函数封装

以 `financeJournalListApi` 为例：

```ts
// libs/modules/financial/data-access/src/lib/journal.api.ts
import { apiClient } from '@myorg/shared/data-access-api';
import type { JournalListParams, JournalListResponse } from './journal.model';

export function getJournalList(params: JournalListParams) {
  return apiClient.post<JournalListResponse>('/api/finance/v1/finance/journal/list', params);
}
```

### 8.2 TanStack Query Hooks

```ts
// libs/modules/financial/data-access/src/lib/+queries/journal.keys.ts
export const journalKeys = {
  all: ['financial', 'journal'] as const,
  list: (params: JournalListParams) => [...journalKeys.all, 'list', params] as const,
  detail: (id: string) => [...journalKeys.all, 'detail', id] as const,
};

// libs/modules/financial/data-access/src/lib/+queries/journal.queries.ts
import { useQuery } from '@tanstack/react-query';
import { getJournalList } from '../journal.api';
import { journalKeys } from './journal.keys';

export function useJournalListQuery(params: JournalListParams) {
  return useQuery({
    queryKey: journalKeys.list(params),
    queryFn: () => getJournalList(params),
  });
}
```

### 8.3 公共下拉数据

建议统一放到 `libs/modules/financial/data-access/src/lib/+queries/common.queries.ts`：

```ts
export function useStablecoinOptionsQuery() { ... }
export function useCurrencyOptionsQuery() { ... }
export function useBlockchainOptionsQuery() { ... }
export function useTokenTypeOptionsQuery() { ... }
```

### 8.4 表单提交与缓存失效

```ts
export function useCreateExportRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExportRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exportTaskKeys.lists() });
      toast.success(t('success'));
    },
  });
}
```

---

## 9. UI 层迁移方案

### 9.1 列表页统一模式

每个列表页应包含：

1. **Filter Panel**：用 `react-hook-form` + `shared/ui-forms` 封装筛选表单。
2. **DataTable**：使用 `@myorg/shared/ui` DataTable，传入 `ColumnDef`。
3. **Pagination**：目标项目 DataTable 内置 client-side pagination；若服务端分页，需扩展或手动实现。
4. **Action Column**：权限按钮用 `PermissionGuard` 包裹。

示例骨架：

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DataTable } from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useXxxListQuery } from '@myorg/modules/financial/data-access';

export function AdjustmentsListPage() {
  const t = useTranslations('modules.financial.adjustments');
  const form = useForm({ resolver: zodResolver(adjustmentFilterSchema) });
  // ...
}
```

### 9.2 表单页统一模式

- 使用 `react-hook-form` + zod resolver。
- 动态字段（如 `journal-entries/edit.tsx` 的 `txTypeItems`）用 `useFieldArray`。
- 日期字段用 `FormDatePicker` 或基于 date-fns 封装。
- 提交后根据模式跳转或刷新列表。

### 9.3 详情页统一模式

- 使用 `useXxxQuery` 获取详情。
- 若含 tabs（如 posting-engine view），用 `shared/ui` Tabs。
- 历史记录等二级列表单独写一个 query hook。

---

## 10. 路由与 i18n 方案

### 10.1 路由策略

由于 financial 子模块较多，推荐将每个子模块作为独立一级模块注册，而非全部塞进 `financial` 一个 slug。

| 源路由 | 建议目标路由 | 模块 ID |
|--------|-------------|---------|
| `/financial/adjustments` | `/adjustments` | `adjustments` |
| `/financial/audit-trail` | `/audit-trail` | `audit-trail` |
| `/financial/chart-of-accounts` | `/chart-of-accounts` | `chart-of-accounts` |
| `/financial/journal-entries` | `/journal-entries` | `journal-entries` |
| `/financial/journal-entries-new` | `/journal-entries-new` | `journal-entries-new` |
| `/financial/posting-engine` | `/posting-engine` | `posting-engine` |
| `/financial/statements` | `/statements` | `statements` |
| `/financial/transaction-event-configuration` | `/transaction-event-configuration` | `transaction-event-configuration` |
| `/financial/travel-rule` | `/travel-rule` | `travel-rule` |

这样每个模块拥有独立的 manifest、i18n namespace、权限集合，符合目标项目约定。

### 10.2 i18n 结构

```json
// libs/shared/util-i18n-messages/src/lib/en-US/modules/financial.json
{
  "adjustments": {
    "title": "Reconciliation Adjustments",
    "columnEodDate": "EOD Date"
  },
  "audit-trail": { ... },
  ...
}
```

页面中使用：

```ts
const t = useTranslations('modules.financial.adjustments');
```

> 注意：源项目使用 key 编码（如 `financial_0013`、`PUB_Query`），迁移时可保留 key 编码做第一层映射，再逐步改为语义化 key。

---

## 11. 权限方案

源项目权限判断模式：

```ts
const userPermission = getLS<string[]>('userPermission') || [];
const hasPermission = (pid: string) =>
  process.env.NEXT_PUBLIC_SYS_ENV === 'TDManage'
    ? userPermission.indexOf(pid) >= 0
    : true;
```

目标项目应改为：

```tsx
import { PermissionGuard } from '@myorg/shared/util-auth';
import { FINANCIAL_PERMISSIONS } from '@myorg/modules/financial/util';

<PermissionGuard permission={FINANCIAL_PERMISSIONS.ADJUSTMENTS_ADJUST}>
  <Button onClick={handleEdit}>Edit</Button>
</PermissionGuard>
```

需要确认 `util-auth` 的 `PermissionGuard` 是否兼容 UUID string，还是期望 `user:write` 这类语义化权限。若目标项目权限模型不同，需要做一次映射层。

---

## 12. 风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 源项目类型几乎全是 `any`，迁移时类型补齐工作量大 | 高 | 优先补齐 API 出入参类型；UI 局部可暂用 `unknown` + 运行时断言 |
| `CustomTable` / `useCustomTable` 是高度封装的 antd 抽象，迁移到 DataTable 需重写查询/分页/表单联动 | 高 | 先迁移一个简单的 `useCustomTable` 页面（audit-trail）建立模式，再复制 |
| React 18 → 19 与 Next.js 15 → 16 的 API 差异 | 中 | 严格按目标项目现有代码写新页面，不迁移旧生命周期 |
| 公共下拉接口在源项目中通过 `useSWR` 直接调用 URL，目标项目需要统一封装 | 中 | 在 financial data-access 中新建 `common.queries.ts` 统一提供 |
| 日期库从 dayjs 切到 date-fns | 中 | 编写映射函数，统一迁移所有时间格式化 |
| `CopyableEllipsisText` 等共享组件目标项目缺失 | 中 | 先在 financial/ui 中实现，稳定后提至 shared/ui |
| 路由方案未定（financial 一级 vs 子模块一级） | 高 | 第 0 阶段必须与架构组确认并定稿 |
| 权限模型差异 | 中 | 第 0 阶段确认 `PermissionGuard` 接受的权限标识形式 |
| journal-entries/edit 与 transaction-event-configuration/mapping-rule/edit 含复杂动态表单 | 高 | 安排高级前端负责，使用 `useFieldArray` 并写单测 |
| posting-engine/view 含 tabs + 历史记录 + 版本对比，代码 1099 行 | 高 | 拆分为多个子组件与独立 query hooks |

---

## 13. 推荐开发顺序（按迁移及重构困难程度从低到高）

| 顺序 | 模块 | 困难等级 | 推荐批次 | 预估人天 | 关键理由 |
|------|------|----------|----------|----------|----------|
| 1 | travel-rule | 1/5 | 第一批 | 1 | 纯静态 mock 页，无 API，用于验证 DataTable + CopyableEllipsisText |
| 2 | audit-trail | 1.5/5 | 第一批 | 2 | 列表+详情，API 少，适合建立 TanStack Query 模式 |
| 3 | adjustments | 2/5 | 第一批 | 2-3 | 本地 mock 数据，表单/表格/权限完整，适合练手 |
| 4 | chart-of-accounts | 2.5/5 | 第一批 | 3 | 引入 financial-book-meta，验证复杂筛选 + 服务端分页 |
| 5 | journal-entries-new | 3/5 | 第二批 | 3 | 真实 API，列表+详情，验证 journal API 类型 |
| 6 | statements | 3.5/5 | 第二批 | 4 | 抽屉表单、导出规则、文件下载，表单复杂 |
| 7 | journal-entries | 4/5 | 第二批 | 5 | 动态表单（txTypeItems + useFieldArray），6 个 API |
| 8 | posting-engine | 4.5/5 | 第三批 | 6-8 | 4 个文件、 tabs、matrix、history、版本控制 |
| 9 | transaction-event-configuration | 5/5 | 第三批 | 6-8 | mapping-rule 编辑页 870 行，wizard-like 表单，最多共享组件 |

### 13.1 分批说明

- **第一批（低风险，建立模式）**：travel-rule → audit-trail → adjustments → chart-of-accounts。完成后，financial 模块的基础设施、公共 query hooks、CopyableEllipsisText、路由注册、权限常量全部就位。
- **第二批（中等复杂度，验证 API 与表单）**：journal-entries-new → statements → journal-entries。重点验证复杂表单、抽屉、导出下载、API 类型。
- **第三批（高风险，需要资深前端）**：posting-engine → transaction-event-configuration。重点拆解大文件、动态表单、tabs、matrix、历史记录。

---

## 14. 验收标准

1. **功能等效**：每个迁移后的页面与原页面对接口、字段、交互行为一致（按钮权限、跳转、弹窗、导出）。
2. **类型安全**：financial data-access 中不再使用 `any`，API 与表单均有 Zod/TS 类型。
3. **代码规范**：通过 `pnpm nx lint financial` 与 `pnpm nx test financial`（至少新增关键单测）。
4. **i18n 完整**：所有用户可见文案均来自 `modules.financial` 命名空间，支持 en-US / zh-CN。
5. **权限正确**：每个操作按钮均通过 `PermissionGuard` 控制，UUID 与原项目一致。
6. **性能无损**：列表页使用 TanStack Query 缓存，翻页/筛选无额外请求。
7. **E2E 覆盖**：关键流程（CRUD、启用/禁用、导出）有 Playwright 用例。

---

## 15. 附录

### 15.1 源文件 → 目标文件映射总表

见各模块子文档：`modules/{module-name}.md`。

### 15.2 API → 目标函数映射总表

见 `libs/modules/financial/data-access/src/lib/financial.api.ts` 设计文档（将在 Phase 0 输出）。

### 15.3 关键路径（Critical Path）

```text
路由方案确认（financial 一级 vs 子模块一级）
    │
    ▼
模块注册 + i18n 消息注册
    │
    ▼
financial 通用 UI/工具实现（CopyableEllipsisText、useTokenTypeOptions、公共下拉 queries）
    │
    ▼
第一批模块迁移（建立模式）
    │
    ▼
第二批/第三批模块迁移
    │
    ▼
端到端联调 + 验收
```

### 15.4 需要用户/架构组确认的问题

1. financial 子模块是合并为一个 `financial` 模块，还是每个子模块作为独立一级模块注册？
2. 目标项目 `PermissionGuard` 是否直接支持源项目的 UUID permission string？
3. 日期/时间显示是否需要保持 UTC+8，还是跟随用户 locale？
4. `statements` 导出文件下载是否需要走目标项目的文件服务，还是沿用 `${NEXT_PUBLIC_FILE_ID}`？
5. `travel-rule` 当前为静态 mock 页，迁移后是否需要接真实 API？
6. `journal-entries` 与 `journal-entries-new` 是否都需要保留，还是合并/废弃旧版？

---

*本计划由 Claude Code 在 ultracode 工作流失败后基于直接源码盘点生成，待用户确认后方可进入开发阶段。*
