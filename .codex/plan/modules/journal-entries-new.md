# Journal Entries New 模块迁移计划

## 1. 业务概述

Journal Entries New 是新版 Journal 流水查询页面，用于展示链上交易对应的财务记账流水（tdTxId、txHash、from/to、token、blockchain、txType、amount、time、currency 等）。页面包含列表页和详情页，列表支持分页与多维筛选，详情页展示单笔 journal 的完整信息。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/journal-entries-new/index.tsx` | 479 | 列表页：筛选 + 服务端分页 + antd Table |
| `src/pages/financial/journal-entries-new/detail.tsx` | 539 | 详情页：展示 journal detail |

## 3. 依赖的 API

### 3.1 列表 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `financeJournalListApi` | `/api/finance/v1/finance/journal/list` | POST | Journal 列表分页 |

### 3.2 详情 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `financeJournalDetailApi` | `/api/finance/v1/finance/journal/detail/{tdTxId}` | GET | Journal 详情 |

### 3.3 公共下拉

- `/api/manage/v1/common/stablecoin/enabled/searches`
- `/api/manage/v1/common/blockchain/list`
- `useTokenTypeOptions`

### 3.4 依赖共享组件/工具

- `CopyableEllipsisText`
- `useHook`
- `formatTimestamp`
- `getLS`
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **中** |
| 困难分数 | 3/5 |
| 主要难点 | 真实 API 接入、日期格式化、from/to/transactionHash 等长字段展示 |
| 建议负责人 | 中级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/journal-entries-new/
├── data-access/
│   └── src/lib/
│       ├── journal-entries-new.model.ts
│       ├── journal-entries-new.api.ts
│       └── +queries/
│           ├── journal-entries-new.keys.ts
│           ├── journal-entries-new.queries.ts
│           └── journal-entries-new.mutations.ts   # 预留
├── feature/
│   └── src/lib/
│       ├── journal-entries-new-list-page.tsx
│       ├── journal-entries-new-detail-page.tsx
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       └── journal-tx-hash-cell.tsx
└── util/
    └── src/lib/
        ├── journal-entries-new.constants.ts
        └── journal-entries-new.schema.ts
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
| `Tag` | Tailwind badge |
| `CopyableEllipsisText` | `@myorg/modules/financial/ui` CopyableEllipsisText |

## 7. 迁移步骤

1. 创建 `journal-entries-new` 模块库并注册路由/i18n/权限。
2. 定义类型：
   - `JournalEntry`
   - `JournalListParams`
   - `JournalListResponse`
   - `JournalDetail`
3. 实现 API：
   - `getJournalList(params)` → POST `/api/finance/v1/finance/journal/list`
   - `getJournalDetail(id)` → GET `/api/finance/v1/finance/journal/detail/{id}`
4. 实现 TanStack Query hooks。
5. 实现列表页：
   - 筛选表单：from、to、tokenName、tokenType、blockchainId、transactionType、transactionTime、transactionHash。
   - DataTable 渲染，长字段使用 `CopyableEllipsisText`。
   - 行可点击跳转详情。
6. 实现详情页：
   - 读取 `id` param。
   - 用 `useJournalDetailQuery` 加载详情。
   - 展示完整字段。
7. 单测：列表 payload 构建、详情渲染。

## 8. 风险与注意事项

- `financeJournalDetailApi` 的 URL 路径参数是 `tdTxId`，类型为 `string | number`，迁移时需统一为 string。
- `transactionAmount` 与 `currencyCode` 组合展示逻辑需保留。
- 时间戳格式化当前使用 `dayjs`，迁移到 `date-fns` 时需对齐格式字符串。
- 部分 txType 可能没有对应 i18n key，需兜底显示 `'--'`。

## 9. 验收标准

- 列表页分页、筛选与源项目一致。
- 详情页正确展示单笔 journal 完整信息。
- 长文本字段（txHash、from、to）可复制、hover 展示完整值。
- 权限按钮控制正确。
- lint / test 通过。
