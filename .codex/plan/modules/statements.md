# Statements 模块迁移计划

## 1. 业务概述

Statements（财务报表导出任务）管理定时导出任务规则。列表页展示导出规则（任务名、token、blockchain、导出策略、创建时间、最后执行时间、状态），支持新建规则、启用/禁用/删除规则。新建规则通过右侧 Drawer 表单完成，包含任务名、token、token type、交易类型、导出格式、导出频率、通知邮箱等字段。详情页展示规则详情与历史导出文件列表，支持下载文件。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/statements/index.tsx` | 583 | 列表页 + 新建规则 Drawer |
| `src/pages/financial/statements/export.tsx` | 592 | “我的导出”/导出任务列表页 |
| `src/pages/financial/statements/view.tsx` | 320 | 规则详情 + 历史文件列表 |

## 3. 依赖的 API

### 3.1 列表 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `useCustomTable` 内部 | `/api/manage/v1/export/task/list/rule` | POST | 导出规则列表 |
| `useCustomTable` 内部（export.tsx） | `/api/manage/v1/export/task/list/my` | POST | 我的导出任务列表 |
| `useCustomTable` 内部（view.tsx） | `/api/manage/v1/export/task/list/all` | POST | 全部导出文件列表 |

### 3.2 操作 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `exportTaskCreateRuleSaveApi` | `/api/manage/v1/export/task/create/rule` | POST | 新建导出规则 |
| `exportTaskRuleOperateApi` | `/api/manage/v1/export/task/rule/operate` | POST | 启用/禁用/删除规则 |
| `exportTaskcreateApi` | `/api/manage/v1/export/task/create` | POST | 创建导出任务 |
| `exportTaskDeleteApi` | `/api/manage/v1/export/task/delete` | POST | 删除导出任务 |
| `exportTaskPermissionEmailApi` | `/api/manage/v1/export/task/permission/email` | POST | 获取有权限用户邮箱 |

### 3.3 文件下载

| 函数 | Endpoint | 用途 |
|------|----------|------|
| `downloadApi` | `${NEXT_PUBLIC_FILE_ID}v1/sftp/download?busId=...&busType=...` | 下载导出文件 |

### 3.4 公共下拉

- `/api/manage/v1/common/stablecoin/enabled/searches`
- `/api/manage/v1/common/blockchain/list`

### 3.5 依赖共享组件/工具

- `CustomTable` / `useCustomTable`
- `CustomTableTitle`
- `CopyableEllipsisText`
- `useHook`
- `formatTimestamp`
- `downloadApi`
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **中高** |
| 困难分数 | 3.5/5 |
| 主要难点 | Drawer 表单复杂（含联动、邮箱批量校验、checkbox 全选）、三个列表页、文件下载 |
| 建议负责人 | 中级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/statements/
├── data-access/
│   └── src/lib/
│       ├── statements.model.ts
│       ├── statements.api.ts
│       └── +queries/
│           ├── statements.keys.ts
│           ├── statements.queries.ts
│           └── statements.mutations.ts
├── feature/
│   └── src/lib/
│       ├── statements-list-page.tsx
│       ├── statements-export-list-page.tsx   # 对应 export.tsx
│       ├── statements-detail-page.tsx        # 对应 view.tsx
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       ├── export-rule-form.tsx              # Drawer 内表单
│       ├── export-frequency-select.tsx
│       └── export-status-badge.tsx
└── util/
    └── src/lib/
        ├── statements.constants.ts           # 权限 UUID
        └── statements.schema.ts              # Drawer 表单 Zod schema
```

## 6. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `CustomTable` / `useCustomTable` | DataTable + `useXxxListQuery` + `react-hook-form` |
| `Button` | `@myorg/shared/ui` Button |
| `Input` / `Input.TextArea` | `@myorg/shared/ui` Input / Textarea |
| `Select` / `Select mode="multiple"` | `@myorg/shared/ui` Select（需支持多选） |
| `Radio.Group` | `@myorg/shared/ui` RadioGroup |
| `Checkbox` | `@myorg/shared/ui` Checkbox |
| `Form` / `Form.Item` | `react-hook-form` + `FormField` |
| `Drawer` | `@myorg/shared/ui` Drawer |
| `Spin` | DataTable `isLoading` / skeleton |
| `Tag` | Tailwind badge |
| `CopyableEllipsisText` | `@myorg/modules/financial/ui` CopyableEllipsisText |
| `message` / `notification` | `sonner` toast |

## 7. 迁移步骤

1. 创建 `statements` 模块库并注册路由/i18n/权限。
2. 定义类型：
   - `ExportRule`、`ExportRuleListParams`、`ExportRuleListResponse`
   - `ExportTask`、`ExportTaskListParams`
   - `ExportRuleDetail`
3. 实现 API 函数：
   - `getExportRuleList(params)`
   - `getMyExportTaskList(params)`
   - `getAllExportTaskList(params)`
   - `createExportRule(data)`
   - `operateExportRule(data)`
   - `createExportTask(data)`
   - `deleteExportTask(data)`
   - `getPermissionEmails(data)`
4. 实现 TanStack Query hooks 与 mutations。
5. 实现列表页：
   - 筛选表单 + DataTable。
   - “New” 按钮打开 Drawer。
   - 行操作：View / Disable / Enable / Delete。
6. 实现 Drawer 表单 `ExportRuleForm`：
   - token 选择联动 token type 与 txTypes 选项。
   - export strategy 单选，选中后展示提示文案。
   - notifyEmail 邮箱批量校验（正则、中文逗号、最多 20 个）。
   - “Select All Users” checkbox 调用 `getPermissionEmails` 回填邮箱。
7. 实现 `statements/export-list-page.tsx`（我的导出）。
8. 实现 `statements/detail-page.tsx`（规则详情 + 历史文件 + 下载）。
9. 单测：Drawer 表单校验、mutation 缓存失效、下载逻辑。

## 8. 风险与注意事项

- `Select mode="multiple"` 在目标项目 Radix Select 中需确认是否已支持；若不支持，需要扩展或换用其他多选方案。
- 邮箱校验规则复杂（正则 + 中文逗号 + 数量），需完整迁移并补充单测。
- 文件下载涉及 `NEXT_PUBLIC_FILE_ID` 环境变量，目标项目需要确认文件服务 baseURL 是否一致。
- 三个列表页 URL 不同、权限不同、用途不同，需要清晰命名避免混淆。
- Drawer 表单提交成功后需刷新规则列表，注意 invalidate query key。

## 9. 验收标准

- 三个列表页分别正常渲染与分页。
- Drawer 表单完整，联动与校验正确。
- 创建/启用/禁用/删除规则后列表自动刷新。
- 详情页历史文件可下载。
- 所有操作给出 toast 反馈。
- lint / test 通过。
