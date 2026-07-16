# Chart of Accounts 模块迁移计划

## 1. 业务概述

Chart of Accounts（会计科目表，COA）管理财务账本（Financial Book）。列表页展示账本信息（Book Name、Book No、Reserve Asset、Currency、Token Type、Tokens、EOD Cutoff Time、Last EOD Posting Run、Status），支持按书名、书号、储备资产、货币、token type、创建时间、状态筛选。每行支持 Detail、Edit、View Statements 三个操作，均跳转到同一个详情视图页的不同 tab。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/chart-of-accounts/index.tsx` | 673 | 列表页：复杂筛选 + 服务端分页 + antd Table |
| `src/pages/financial/chart-of-accounts/view.tsx` | 423 | 详情视图页：含多个 tab（Basic Information / Chart of Accounts / EOD Statements） |

## 3. 依赖的 API

### 3.1 列表 API

| 函数/URL | Endpoint | Method | 用途 |
|----------|----------|--------|------|
| `useSWR([COA_LIST_URL, requestPayload])` | `/api/finance/v1/finance/coa/list` | POST | 账本列表分页查询 |
| `useSWR(['/api/manage/v1/common/currency/list'])` | `/api/manage/v1/common/currency/list` | GET | 货币下拉 |

### 3.2 详情页 API

详情页 `view.tsx` 未直接调用 API，而是通过 `getFinancialBookMetaByBookId` 读取本地映射，并展示从路由 query 传入的数据。实际详情数据可能由 tab 内组件异步加载。

### 3.3 依赖共享组件/工具

- `CopyableEllipsisText`
- `formatEodCutoffTime`（`src/lib/financial/date-time.ts`）
- `getFinancialBookMetaByBookId`（`src/lib/financial/financial-book-meta.ts`）
- `useTokenTypeOptions`（未在列表页使用，但 view 页可能使用）
- `useHook`
- `getLS`
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **中** |
| 困难分数 | 2.5/5 |
| 主要难点 | 服务端分页、货币下拉动态构建、状态码自适应（20/30 vs 1/0）、详情页 tabs |
| 建议负责人 | 中级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/chart-of-accounts/
├── data-access/
│   └── src/lib/
│       ├── chart-of-accounts.model.ts
│       ├── chart-of-accounts.api.ts
│       └── +queries/
│           ├── chart-of-accounts.keys.ts
│           └── chart-of-accounts.queries.ts
├── feature/
│   └── src/lib/
│       ├── chart-of-accounts-list-page.tsx
│       ├── chart-of-accounts-detail-page.tsx   # 含 tabs 分发
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       ├── coa-basic-information-tab.tsx       # 从 src/lib/components/chart-of-accounts/view 迁移
│       ├── coa-chart-tab.tsx
│       ├── coa-eod-statements-tab.tsx
│       └── coa-status-tag.tsx
└── util/
    └── src/lib/
        ├── chart-of-accounts.constants.ts      # 权限 UUID
        └── chart-of-accounts.schema.ts         # 筛选 schema
```

## 6. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `Button` | `@myorg/shared/ui` Button |
| `DatePicker.RangePicker` | `FormDatePicker` |
| `Input` | `@myorg/shared/ui` Input |
| `Select` | `@myorg/shared/ui` Select |
| `Form` / `Form.Item` | `react-hook-form` + `FormField` |
| `Table` | `@myorg/shared/ui` DataTable |
| `Dropdown` | `@myorg/shared/ui` DropdownMenu |
| `Tag` | Tailwind badge |
| `CopyableEllipsisText` | `@myorg/modules/financial/ui` CopyableEllipsisText |
| `EllipsisHorizontalIcon` | `lucide-react` MoreHorizontal |

## 7. 迁移步骤

1. 创建 `chart-of-accounts` 模块库并注册路由/i18n/权限。
2. 定义类型：
   - `ChartOfAccountsItem`
   - `ChartOfAccountsListParams`
   - `ChartOfAccountsListResponse`
3. 实现 API：
   - `getChartOfAccountsList(params)` → POST `/api/finance/v1/finance/coa/list`
4. 实现 TanStack Query hook `useChartOfAccountsListQuery`。
5. 实现列表页：
   - 复杂筛选表单（书名、书号、储备资产、货币、token type、创建时间、状态）。
   - 货币下拉优先使用公共接口，失败回退到列表数据去重。
   - DataTable 渲染，操作列使用 DropdownMenu 聚合 Detail / Edit / View Statements。
   - 状态码自适应逻辑保留（根据返回数据推断 active/inactive code）。
6. 迁移 `src/lib/components/chart-of-accounts/view` 下的 tabs 到 `libs/modules/chart-of-accounts/ui`。
7. 实现详情页：
   - 读取 `id`、`financeBookId`、`bookNo`、`tab` query params。
   - 使用 `shared/ui` Tabs 切换。
   - 使用 `getFinancialBookMetaByBookId` 的等价实现。
8. 单测：筛选 payload 构建、状态码推断、详情页 tab 切换。

## 8. 风险与注意事项

- 状态码自适应逻辑（根据返回数据判断是 20/30 还是 1/0）需要保留，避免写死导致其他环境异常。
- `formatEodCutoffTime` 涉及时区处理，迁移到 date-fns 时需确认时区库（是否使用 `date-fns-tz`）。
- `getFinancialBookMetaByBookId` 当前是本地映射，需确认目标项目是否有等价后端接口，否则需要把整个映射数据迁移过去。
- 货币下拉回退逻辑（接口失败时用列表数据去重）需要完整保留。

## 9. 验收标准

- 列表页服务端分页正确，总条数与页码联动。
- 所有筛选条件能正确构建请求 payload。
- 操作菜单权限控制正确。
- 详情页 tabs 能根据 `tab` query param 高亮对应项。
- 所有 i18n key 语义化或保留原 key 映射。
- lint / test 通过。
