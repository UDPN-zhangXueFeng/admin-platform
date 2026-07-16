# Posting Engine 模块迁移计划

## 1. 业务概述

Posting Engine（过账引擎）管理财务账本的过账规则配置。列表页展示账本（Book Name、Book ID、Currency、Token Type、Token Count、Total Events、Configured、Last Rule Update、Status），支持查看详情与映射规则。编辑页为某个账本配置过账规则矩阵。详情视图页（view.tsx，1099 行）是模块最复杂页面，包含多个 tabs：Basic Information、Posting Engine Matrix、Version History，展示账本详情、规则矩阵、历史版本对比。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/posting-engine/index.tsx` | 492 | 列表页：筛选 + 服务端分页 |
| `src/pages/financial/posting-engine/edit.tsx` | 748 | 编辑过账规则矩阵页 |
| `src/pages/financial/posting-engine/view.tsx` | 1099 | 详情视图页（含 tabs + 历史版本） |
| `src/pages/financial/posting-engine/detail.tsx` | 148 | 可能是 view 的简化版或 tab 内容 |

## 3. 依赖的 API

### 3.1 列表 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `financePostingBooksApi` | `/api/finance/v1/finance/coa/list`（需确认） | POST | 过账引擎账本列表 |

> 注：`index.tsx` import `financePostingBooksApi` from `@/typings/token-finance/V1`，endpoint 需进一步确认。

### 3.2 详情/历史 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `financePostingDetailApi`（需确认） | 详情接口 | - | 账本详情 |
| `financePostingHistoryListApi` | 历史版本列表 | POST | Version History tab |

### 3.3 编辑页 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `financePostingRuleSaveApi`（需确认） | 保存过账规则 | POST | 编辑提交 |
| 科目/账户选项 API | 根据 Dr/Cr 加载账户 | GET/POST | 编辑页下拉选项 |

### 3.4 依赖共享组件/工具

- `CopyableEllipsisText`
- `formatTimestamp`
- `useTokenTypeOptions`
- `getFinancialBookMetaById` / `getFinancialBookMetaByBookId`
- `BasicInformationTab`、`PostingEngineMatrixTab`（`src/lib/components/posting-engine`）
- `useHook`
- `getLS`
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **高** |
| 困难分数 | 4.5/5 |
| 主要难点 | view.tsx 1099 行需大拆；tabs + matrix + version history；edit 页动态账户选项 |
| 建议负责人 | 高级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/posting-engine/
├── data-access/
│   └── src/lib/
│       ├── posting-engine.model.ts
│       ├── posting-engine.api.ts
│       └── +queries/
│           ├── posting-engine.keys.ts
│           ├── posting-engine.queries.ts
│           └── posting-engine.mutations.ts
├── feature/
│   └── src/lib/
│       ├── posting-engine-list-page.tsx
│       ├── posting-engine-form-page.tsx        # 对应 edit.tsx
│       ├── posting-engine-detail-page.tsx      # 对应 view.tsx，含 tabs
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       ├── posting-basic-information-tab.tsx   # 从 src/lib/components/posting-engine 迁移
│       ├── posting-matrix-tab.tsx
│       ├── posting-version-history-tab.tsx
│       ├── posting-matrix-editor.tsx           # edit.tsx 拆出
│       ├── posting-account-select.tsx          # Dr/Cr 账户下拉
│       └── posting-status-badge.tsx
└── util/
    └── src/lib/
        ├── posting-engine.constants.ts
        ├── posting-engine.schema.ts
        └── posting-engine.types.ts
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
| `Tabs` | `@myorg/shared/ui` Tabs |
| `Tag` | Tailwind badge |
| `CopyableEllipsisText` | `@myorg/modules/financial/ui` CopyableEllipsisText |
| `Dropdown` | `@myorg/shared/ui` DropdownMenu |

## 7. 迁移步骤

1. 创建 `posting-engine` 模块库并注册路由/i18n/权限。
2. 与后端确认所有 API endpoint（源文件部分 API 路径不清晰）。
3. 定义类型：
   - `PostingBook`、`PostingBookListParams`、`PostingBookListResponse`
   - `PostingRuleDetail`、`PostingRuleMatrix`、`PostingHistoryItem`
   - `SavePostingRuleDTO`
4. 实现 API 与 TanStack Query hooks。
5. 实现列表页：
   - 筛选：financialBookName、accountCurrency、tokenType、lastRuleUpdate。
   - DataTable 渲染，操作列：Detail / Mapping Rules。
6. 迁移 `src/lib/components/posting-engine` 的 tabs 到 `posting-engine/ui`。
7. 实现详情页 `posting-engine-detail-page.tsx`：
   - 使用 `shared/ui` Tabs。
   - Basic Information tab。
   - Posting Engine Matrix tab（只读展示）。
   - Version History tab（历史列表 + 对比）。
8. 实现编辑页 `posting-engine-form-page.tsx`：
   - 读取 `id` / `financeBookId`。
   - 加载详情与账户选项。
   - 矩阵编辑器：根据 Dr/Cr 联动账户下拉。
   - 保存提交。
9. 单测：矩阵编辑器联动、历史版本对比、列表 payload。

## 8. 风险与注意事项

- `view.tsx` 1099 行是 financial 模块最大的单文件之一，必须按 tabs 拆分为独立组件。
- 部分 API 路径在源码中未完全明确（通过 typings 生成文件 import），迁移前必须与后端或 Swagger 对齐。
- 账户下拉根据 Dr/Cr 和当前账本动态加载，需处理竞态（源文件用了 ref 记录当前请求 ID）。
- Version History 可能涉及时序数据对比，需要保留原展示逻辑。
- 状态码可能与 chart-of-accounts 类似存在环境差异，需保持自适应。

## 9. 验收标准

- 列表页筛选、分页、操作与源项目一致。
- 详情页三个 tabs 完整，数据加载正确。
- 编辑页矩阵编辑器可正确配置 Dr/Cr 账户。
- 保存后返回详情页并刷新缓存。
- 历史版本 tab 可展示并对比版本。
- lint / test 通过。
