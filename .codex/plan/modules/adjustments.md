# Adjustments 模块迁移计划

## 1. 业务概述

Adjustments（调账 / Reconciliation Adjustments）是一个本地 mock 数据的调账管理页面。列表展示调账记录（EOD Date、Adjustment ID、Transaction ID、Account、DR/CR、金额、状态等），支持按日期、ID、Account、Currency、Offsetting Account、Status 筛选。每行支持 Adjust 和 View Details 操作。

该模块是**无后端 API** 的纯前端页面，使用 `RECONCILIATION_ADJUSTMENT_ROWS` 常量数组作为数据源，非常适合作为第一批迁移模块来建立目标项目模式。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/adjustments/index.tsx` | 413 | 列表页：筛选表单 + antd Table |
| `src/pages/financial/adjustments/edit.tsx` | 361 | 编辑/调账页 |
| `src/pages/financial/adjustments/view.tsx` | 295 | 详情页 |

## 3. 依赖的 API

**无真实 API**。所有数据来自：
- `RECONCILIATION_ADJUSTMENT_ROWS`（`src/lib/components/reconciliation/adjustments`）

依赖的共享组件/工具：
- `CopyableEllipsisText`
- `ReconciliationSection`、`ReconciliationExportButton`、`renderAdjustmentStatusTag`、`RECONCILIATION_TABLE_THEME`
- `useHook`
- `getLS`
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **中低** |
| 困难分数 | 2/5 |
| 主要难点 | 筛选表单 + 本地分页 + 权限控制 + 复用 Reconciliation 系列共享组件 |
| 建议负责人 | 初级/中级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/adjustments/
├── data-access/
│   └── src/lib/
│       ├── adjustments.model.ts
│       └── adjustments.mock.ts          # RECONCILIATION_ADJUSTMENT_ROWS 迁移到这里
├── feature/
│   └── src/lib/
│       ├── adjustments-list-page.tsx
│       ├── adjustments-form-page.tsx
│       ├── adjustments-detail-page.tsx
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       ├── adjustment-status-tag.tsx    # 替代 renderAdjustmentStatusTag
│       ├── adjustment-section.tsx       # 替代 ReconciliationSection
│       └── adjustment-export-button.tsx # 替代 ReconciliationExportButton
└── util/
    └── src/lib/
        └── adjustments.constants.ts     # 权限、状态、表头 key
```

## 6. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `Button` | `@myorg/shared/ui` Button |
| `DatePicker.RangePicker` | `FormDatePicker`（范围） |
| `Input` | `@myorg/shared/ui` Input |
| `Select` | `@myorg/shared/ui` Select |
| `Form` / `Form.Item` | `react-hook-form` + `FormField` |
| `Table` | `@myorg/shared/ui` DataTable |
| `ConfigProvider theme` | Tailwind 变量 |
| `Space` | Tailwind flex gap |
| `CopyableEllipsisText` | `@myorg/modules/financial/ui` CopyableEllipsisText |
| `ReconciliationSection` | `AdjustmentSection` |
| `ReconciliationExportButton` | `AdjustmentExportButton` |
| `renderAdjustmentStatusTag` | `AdjustmentStatusTag` |

## 7. 迁移步骤

1. 创建 `adjustments` 模块库并注册路由/i18n/权限。
2. 迁移 mock 数据 `RECONCILIATION_ADJUSTMENT_ROWS` 到 `adjustments.mock.ts`，并补齐 `AdjustmentItem` 类型。
3. 实现本地筛选逻辑（日期范围、文本包含、下拉精确匹配）。
4. 实现本地分页（或使用 DataTable client-side pagination）。
5. 实现列表页：
   - 筛选表单绑定到 `react-hook-form`。
   - DataTable 列定义包含 `CopyableEllipsisText`。
   - 操作列根据 `record.actions` 与权限显示 Adjust / View Details。
6. 实现编辑页：
   - 读取 `id` query param。
   - 从 mock 数据找到记录并渲染表单。
   - 提交后更新本地 mock 或 toast 提示（当前无真实 API）。
7. 实现详情页：展示记录只读信息。
8. 将 Reconciliation 系列共享组件改写为 adjustments/ui 内部组件。
9. 单测：筛选逻辑、分页、权限渲染。

## 8. 风险与注意事项

- 源文件使用 `RECONCILIATION_ADJUSTMENT_ROWS` 和 `Reconciliation*` 组件，命名带有 reconciliation 业务色彩。迁移到 `adjustments` 模块时建议统一改名为 `adjustment*` 以避免歧义。
- `RECONCILIATION_TABLE_THEME` 是 antd 主题对象，目标项目应移除，改用 Tailwind。
- 权限判断依赖 `process.env.NEXT_PUBLIC_SYS_ENV === 'TDManage'`，目标项目应通过 `PermissionGuard` 统一处理。
- 编辑页当前无真实保存 API，需明确是仅做 UI 演示还是后续会接 API。

## 9. 验收标准

- 列表页展示 mock 数据，支持所有筛选条件。
- DataTable 分页正确。
- Adjust / View Details 权限按钮按原逻辑显示。
- 编辑页与详情页能正确根据 `id` 加载记录。
- 所有共享组件（Section/ExportButton/StatusTag）在目标项目可用。
- lint / test 通过。
