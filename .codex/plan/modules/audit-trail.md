# Audit Trail 模块迁移计划

## 1. 业务概述

Audit Trail（审计追踪）记录财务相关接口的请求与响应信息，支持按 traceId、txFrom、txTo、txType、tokenName、tokenType、blockchainId、时间范围、txHash 等条件查询。页面包含一个列表页和一个详情页，详情页展示单次请求的完整信息（请求头、请求体、响应数据等）。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/audit-trail/index.tsx` | 506 | 审计列表页，使用 `CustomTable` + `useCustomTable` |
| `src/pages/financial/audit-trail/view.tsx` | 271 | 审计详情页，展示请求/响应详情 |

## 3. 依赖的 API

### 3.1 列表 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `exportTaskcreateApi` | `/api/manage/v1/export/task/create` | POST | 列表页顶部“导出/下载”按钮触发 |
| `exportTaskCreateRuleSaveApi` | `/api/manage/v1/export/task/create/rule` | POST | 创建导出规则（源文件中 `Download` 按钮实际调用的可能是这个，需确认） |
| `/api/manage/v1/financial/audit/listPage` | POST | CustomTable 内置请求 | 审计列表分页查询 |

> 注：`index.tsx` 中 `customTable` 的 `url` 为 `/api/manage/v1/financial/audit/listPage`，由 `useCustomTable` 内部统一请求。

### 3.2 详情 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `useSWR(['/api/manage/v1/financial/audit/detail', { id }])` | `/api/manage/v1/financial/audit/detail` | POST | 详情页获取审计详情 |

### 3.3 公共下拉

- `/api/manage/v1/common/stablecoin/enabled/searches`
- `/api/manage/v1/common/blockchain/list`
- `useTokenTypeOptions`

### 3.4 依赖共享组件

- `CustomTable` / `useCustomTable`
- `CustomTableTitle`
- `useHook`
- `useTokenTypeOptions`
- `formatTimestamp` / `getTimestamp`
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **低** |
| 困难分数 | 1.5/5 |
| 主要难点 | `useCustomTable` 需要拆分为 DataTable + TanStack Query；详情页需格式化 JSON |
| 建议负责人 | 初级/中级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/audit-trail/
├── data-access/
│   └── src/lib/
│       ├── audit-trail.model.ts
│       ├── audit-trail.api.ts
│       └── +queries/
│           ├── audit-trail.keys.ts
│           ├── audit-trail.queries.ts
│           └── audit-trail.mutations.ts   # 导出任务相关
├── feature/
│   └── src/lib/
│       ├── audit-trail-list-page.tsx
│       ├── audit-trail-detail-page.tsx
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       └── audit-json-viewer.tsx          # 格式化请求/响应 JSON
└── util/
    └── src/lib/
        └── audit-trail.constants.ts       # 权限、状态常量
```

## 6. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `CustomTable` / `useCustomTable` | DataTable + `useAuditTrailListQuery` + `react-hook-form` |
| `Button` | `@myorg/shared/ui` Button |
| `Form` / `Form.Item` | `react-hook-form` + `FormField` / `FormSelect` |
| `Input` | `@myorg/shared/ui` Input |
| `Select` | `@myorg/shared/ui` Select |
| `DatePicker.RangePicker` | `FormDatePicker` |
| `Tag` | Tailwind badge |
| `Drawer` / `Modal`（JSON 展示） | `@myorg/shared/ui` Drawer 或 Dialog |

## 7. 迁移步骤

1. 创建 `audit-trail` 模块库并注册路由/i18n。
2. 定义类型 `AuditTrailItem`、`AuditTrailListParams`、`AuditTrailDetail`。
3. 实现 API 函数：
   - `getAuditTrailList(params)` → POST `/api/manage/v1/financial/audit/listPage`
   - `getAuditTrailDetail(id)` → POST `/api/manage/v1/financial/audit/detail`
   - `createExportTask(data)` → POST `/api/manage/v1/export/task/create`
4. 实现 TanStack Query hooks。
5. 实现 `AuditTrailListPage`：
   - 使用 `react-hook-form` 写筛选表单。
   - 使用 `DataTable` 渲染列表。
   - “导出”按钮调用 `useCreateExportTaskMutation`。
   - traceId 可点击跳转详情。
6. 实现 `AuditTrailDetailPage`：
   - 读取 URL `id` 参数。
   - 用 `useAuditTrailDetailQuery` 获取详情。
   - 使用 `AuditJsonViewer` 格式化展示 requestData / responseData。
7. 添加单测与 E2E。

## 8. 风险与注意事项

- `useCustomTable` 内部封装了请求、分页、表单联动，迁移时需完整理解其 `form.items`、`table.columns`、`actions`、`actionClick` 的映射关系。
- 源文件中“导出”按钮调用的 API 在代码中存在歧义（`exportTaskcreateApi` vs `exportTaskCreateRuleSaveApi`），需与后端确认。
- 详情页 JSON 展示若数据量大，需考虑性能（可折叠或使用虚拟滚动）。

## 9. 验收标准

- 列表页支持所有原筛选条件并正确分页。
- traceId 点击跳转详情页，详情字段完整。
- 导出按钮调用正确 API 并给出反馈。
- 所有文案 i18n 化，权限控制正确。
- lint / test / build 通过。
