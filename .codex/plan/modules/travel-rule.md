# Travel Rule 模块迁移计划

## 1. 业务概述

Travel Rule 页面用于展示涉及旅行规则（Travel Rule）的交易流水。当前源页面是一个**纯静态 mock 页面**，表格数据写死在组件内，顶部有一个查询表单但仅改变本地 state，不调用任何后端 API。页面上方 TODO 注释明确说明“需要后续对接数据及翻译提取”。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/travel-rule/index.tsx` | 346 | 静态列表页：查询表单 + antd Table + Tag 状态渲染 |

## 3. 依赖的 API

**无真实 API**。源文件仅使用本地 `mockData` 数组。

依赖的公共组件/工具：
- `CopyableEllipsisText`（`src/lib/components/financial/CopyableEllipsisText.tsx`）
- `useHook`（`libs/components`）
- `formatTimestamp`（`libs/utils`）
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **低** |
| 困难分数 | 1/5 |
| 主要难点 | 无 API；主要是验证目标项目 DataTable + CopyableEllipsisText + i18n 模式 |
| 建议负责人 | 初级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/travel-rule/
├── data-access/
│   └── src/lib/
│       ├── travel-rule.model.ts          # 可预定义 TravelRuleItem 类型
│       ├── travel-rule.api.ts            # 预留真实 API 函数
│       └── +queries/
│           ├── travel-rule.keys.ts
│           └── travel-rule.queries.ts    # 当前返回 mock 数据
├── feature/
│   └── src/lib/
│       ├── travel-rule-list-page.tsx     # 列表页
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       └── travel-rule-status-badge.tsx  # Verification Status badge
└── util/
    └── src/lib/
        └── travel-rule.constants.ts      # 状态常量
```

## 6. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `Button` | `@myorg/shared/ui` Button |
| `Input` | `@myorg/shared/ui` Input |
| `Select` | `@myorg/shared/ui` Select |
| `Form` | `react-hook-form` |
| `DatePicker.RangePicker` | `FormDatePicker` / 自定义 RangePicker |
| `Table` | `@myorg/shared/ui` DataTable |
| `Tag` | Tailwind badge 或新增 Badge 组件 |
| `CopyableEllipsisText` | `@myorg/modules/financial/ui` CopyableEllipsisText |

## 7. 迁移步骤

1. 使用 Nx generator 创建 `travel-rule` 模块（data-access / feature / ui / util）。
2. 在 `libs/shared/util-config/src/lib/module-registry.ts` 注册 `travel-rule`。
3. 在 `libs/shared/util-i18n-messages` 中新增 `modules/travel-rule.json`。
4. 实现 `TravelRuleListPage`：
   - 用 `react-hook-form` 写查询表单（当前仅本地筛选）。
   - 用 `DataTable` 渲染本地 mock 数据。
   - 使用 `CopyableEllipsisText` 渲染 hash/wallet 字段。
   - 用 badge 渲染 `verificationStatus`。
5. 添加单测：DataTable 渲染、状态 badge。
6. 运行 `pnpm nx lint travel-rule` 与 `pnpm nx test travel-rule`。

## 8. 风险与注意事项

- 当前无真实 API，迁移后仍保留 mock。若后续需要接 API，只需替换 `travel-rule.queries.ts` 中的 `queryFn`。
- 表格列名在源文件中部分硬编码为英文（如 `Transaction Hash`），需全部提取到 i18n。
- 状态颜色（Pending/Verified）需与目标项目主题色对齐。

## 9. 验收标准

- 页面在 `/travel-rule` 正常渲染。
- 查询表单可本地筛选 mock 数据（后续对接 API 时不改页面结构）。
- 所有文案来自 i18n 命名空间 `modules.travel-rule`。
- 通过 lint 与单元测试。
