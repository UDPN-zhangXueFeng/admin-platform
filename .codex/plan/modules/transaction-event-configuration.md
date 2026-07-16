# Transaction Event Configuration 模块迁移计划

## 1. 业务概述

Transaction Event Configuration（交易事件配置）管理 Normalization Book（标准化账本）及其 Mapping Rule（映射规则）。列表页展示 Normalization Book（账本信息、资产价值、tokens、创建时间、状态），支持配置映射规则。Mapping Rule 子模块包含列表页、编辑页（870 行）、详情页（133 行）。编辑页是一个非常复杂的 wizard-like 表单，涉及源字段选择、目标字段映射、条件配置、预览等。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/transaction-event-configuration/index.tsx` | 587 | Normalization Book 列表页 |
| `src/pages/financial/transaction-event-configuration/mapping-rule/index.tsx` | 513 | Mapping Rule 列表页 |
| `src/pages/financial/transaction-event-configuration/mapping-rule/edit.tsx` | 870 | Mapping Rule 编辑页（最复杂表单） |
| `src/pages/financial/transaction-event-configuration/mapping-rule/detail.tsx` | 133 | Mapping Rule 详情页 |

## 3. 依赖的 API

### 3.1 Normalization Book 列表 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `financeNormalizationBooksApi` | `/api/finance/v1/finance/coa/list`（需确认） | POST | Normalization Book 列表 |
| `useSWR(['/api/manage/v1/common/currency/list'])` | `/api/manage/v1/common/currency/list` | GET | 货币下拉 |

### 3.2 Mapping Rule API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `financeMappingRulesApi`（需确认） | Mapping Rule 列表 | POST | Mapping Rule 列表 |
| `financeMappingRuleDetailApi`（需确认） | Mapping Rule 详情 | - | 详情 |
| `financeMappingRuleSaveApi`（需确认） | Mapping Rule 保存 | POST | 编辑提交 |
| `financeSourceFieldsApi`（需确认） | 源字段列表 | - | 编辑页源字段下拉 |

### 3.3 依赖共享组件/工具

- `CopyableEllipsisText`
- `getFinancialBookMetaById`
- `useTokenTypeOptions`
- `BasicInformationTab`、`HistoricalRecordsTab`（`src/lib/components/financial/transaction-event-configuration`）
- `MOCK_DATA`（`src/lib/components/financial/transaction-event-configuration/mock`）
- `useHook`
- `getLS`
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **很高** |
| 困难分数 | 5/5 |
| 主要难点 | mapping-rule/edit.tsx 870 行复杂表单；mock 数据与真实 API 混合；详情页 tab 组件 |
| 建议负责人 | 高级前端 + 业务专家 |

## 5. 迁移后目标文件清单

```text
libs/modules/transaction-event-configuration/
├── data-access/
│   └── src/lib/
│       ├── tx-event-config.model.ts
│       ├── tx-event-config.api.ts
│       └── +queries/
│           ├── tx-event-config.keys.ts
│           ├── tx-event-config.queries.ts
│           └── tx-event-config.mutations.ts
├── feature/
│   └── src/lib/
│       ├── tx-event-config-list-page.tsx              # Normalization Book 列表
│       ├── tx-event-mapping-rule-list-page.tsx        # Mapping Rule 列表
│       ├── tx-event-mapping-rule-form-page.tsx        # 对应 edit.tsx
│       ├── tx-event-mapping-rule-detail-page.tsx      # 对应 detail.tsx
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       ├── normalization-book-status-badge.tsx
│       ├── mapping-rule-form.tsx                      # 编辑表单主组件
│       ├── mapping-rule-field-mapper.tsx              # 字段映射器
│       ├── mapping-rule-condition-builder.tsx         # 条件配置
│       ├── mapping-rule-preview.tsx                   # 预览
│       ├── tx-event-basic-info-tab.tsx                # 从 src/lib/components 迁移
│       ├── tx-event-historical-records-tab.tsx        # 从 src/lib/components 迁移
│       └── tx-event-mock-data.ts                      # 若仍需 mock
└── util/
    └── src/lib/
        ├── tx-event-config.constants.ts
        ├── tx-event-config.schema.ts                  # 复杂 Zod schema
        └── tx-event-config.types.ts
```

## 6. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `Button` | `@myorg/shared/ui` Button |
| `DatePicker.RangePicker` | `FormDatePicker` |
| `Input` | `@myorg/shared/ui` Input |
| `Select` / `Select mode="multiple"` | `@myorg/shared/ui` Select |
| `Form` / `Form.Item` / `Form.List` | `react-hook-form` + `useFieldArray` |
| `Table` | `@myorg/shared/ui` DataTable |
| `Tabs` | `@myorg/shared/ui` Tabs |
| `Tag` | Tailwind badge |
| `CopyableEllipsisText` | `@myorg/modules/financial/ui` CopyableEllipsisText |
| `Dropdown` | `@myorg/shared/ui` DropdownMenu |

## 7. 迁移步骤

1. 创建 `transaction-event-configuration` 模块库并注册路由/i18n/权限。
2. 与后端确认所有 Mapping Rule 相关 API endpoint（源文件部分通过 typings 生成，路径不清晰）。
3. 定义类型：
   - `NormalizationBook`、`NormalizationBookListParams`
   - `MappingRule`、`MappingRuleListParams`、`MappingRuleDetail`
   - `MappingRuleFormValues`（字段映射、条件、预览）
4. 实现 API 与 TanStack Query hooks。
5. 实现 Normalization Book 列表页：
   - 筛选：financialBookName、tokenType、currency、creationDate。
   - 操作：Configure Mapping Rules → 跳转 `/transaction-event-configuration/mapping-rule?bookId=...`
6. 迁移 `src/lib/components/financial/transaction-event-configuration` 的 tabs 到 `ui`。
7. 实现 Mapping Rule 列表页：
   - 读取 `bookId` query param。
   - DataTable 展示规则。
   - 支持 New / Edit / Detail / Delete。
8. 实现 Mapping Rule 编辑页：
   - 拆分为 `MappingRuleForm`、`MappingRuleFieldMapper`、`MappingRuleConditionBuilder`、`MappingRulePreview`。
   - 源字段下拉、目标字段映射、条件规则、预览逻辑完整迁移。
   - 使用 `useFieldArray` 处理动态字段列表。
9. 实现 Mapping Rule 详情页。
10. 单测：复杂表单校验、字段映射增删、条件构建。

## 8. 风险与注意事项

- `mapping-rule/edit.tsx` 870 行，是 financial 模块**最复杂的单文件**。必须有业务专家参与拆解，否则容易遗漏业务规则。
- 源文件混合使用了 `MOCK_DATA`，需确认哪些字段已有真实 API、哪些仍是 mock。
- 字段映射与条件构建属于高内聚业务逻辑，需要写详细单测保证等价性。
- `getFinancialBookMetaById` 在 mapping-rule 中使用频繁，迁移时需保证映射数据完整。
- 多选 Select、动态字段数组在目标项目均需基于 Radix 封装或扩展。

## 9. 验收标准

- Normalization Book 列表页与源项目一致。
- 可跳转进入 Mapping Rule 列表，并正确过滤当前 book。
- Mapping Rule 编辑表单完整，字段映射、条件、预览功能等价。
- 详情页展示规则完整信息。
- 保存/删除后列表自动刷新。
- lint / test 通过，编辑表单单测覆盖主要分支。

---

## 10. 特别说明：为什么它是最难的模块

1. **代码规模最大**：4 个文件共 2103 行，且 `edit.tsx` 单文件 870 行。
2. **业务逻辑最复杂**：字段映射、条件配置、预览涉及多层嵌套数据结构。
3. **mock 与真实数据混合**：需要与后端确认每个字段的数据来源。
4. **共享组件依赖多**：详情 tabs、financial-book-meta、mock data 都需要迁移或重写。
5. **表单动态性最高**：源字段、目标字段、条件都是动态数组，对 `react-hook-form` + `useFieldArray` 要求高。

建议该模块安排在最后一批，由熟悉业务的高级前端主导，并安排充足联调时间。
