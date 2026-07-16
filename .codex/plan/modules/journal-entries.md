# Journal Entries 模块迁移计划

## 1. 业务概述

Journal Entries（旧版记账规则）管理“记账规则”（Bill Rule）。列表页展示规则（ledger、token、token type、blockchain、currency、price、create time、status），支持新增、编辑、启用/禁用。编辑页是一个非常复杂的动态表单：根据选择的 Token 动态加载交易类型（txType），每个 txType 下又包含动态增减的“借/贷”科目条目（`txTypeItems`），支持 autocomplete 选择科目代码。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/financial/journal-entries/index.tsx` | 289 | 规则列表页，使用 `CustomTable` |
| `src/pages/financial/journal-entries/edit.tsx` | 896 | 新增/编辑规则页，含复杂动态表单 |
| `src/pages/financial/journal-entries/view.tsx` | 405 | 规则详情页 |

## 3. 依赖的 API

### 3.1 列表 API

| 函数/URL | Endpoint | Method | 用途 |
|----------|----------|--------|------|
| `useCustomTable` 内部 | `/api/manage/v1/financial/bill/rule/listPage` | POST | 规则列表 |

### 3.2 操作 API

| 函数 | Endpoint | Method | 用途 |
|------|----------|--------|------|
| `financialBillOperateApi` | `/api/manage/v1/financial/bill/operate` | POST | 启用/禁用规则 |
| `financialBillRuleAddApi` | `/api/manage/v1/financial/bill/rule/add` | POST | 新增规则 |
| `financialBillRuleEditApi` | `/api/manage/v1/financial/bill/rule/edit` | POST | 编辑规则 |
| `financialBillRuleDetailApi` | `/api/manage/v1/financial/bill/rule/detail` | POST | 规则详情 |
| `financialBillRuleSubjectListApi` | `/api/manage/v1/financial/bill/rule/add/subjectList` | POST | 科目列表下拉 |
| `financialBillRuleAddSubjectSavetApi` | `/api/manage/v1/financial/bill/rule/add/subject/save` | POST | 保存新科目 |
| `financialBillRuleAddTokenListApi` | `/api/manage/v1/financial/bill/rull/add/tokenList` | GET | 新增规则时 token 下拉 |
| `interestTxTypeApi` | `/api/manage/v1/financial/bill/query/interest/tx/type` | POST | 利息交易类型 |

### 3.3 公共下拉

- `/api/manage/v1/common/stablecoin/enabled/searches`
- `/api/manage/v1/common/currency/list`
- `/api/manage/v1/common/blockchain/list`
- `useTokenTypeOptions`

### 3.4 依赖共享组件/工具

- `CustomTable` / `useCustomTable`
- `CustomTableTitle`
- `useHook`
- `formatTimestamp`
- `getLS`
- `getServerSidePropsResult` + `serverSideTranslations`

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **高** |
| 困难分数 | 4/5 |
| 主要难点 | 编辑页动态表单（txType 联动、useFieldArray、autocomplete 科目、保存新科目） |
| 建议负责人 | 高级前端 |

## 5. 迁移后目标文件清单

```text
libs/modules/journal-entries/
├── data-access/
│   └── src/lib/
│       ├── journal-entries.model.ts
│       ├── journal-entries.api.ts
│       └── +queries/
│           ├── journal-entries.keys.ts
│           ├── journal-entries.queries.ts
│           └── journal-entries.mutations.ts
├── feature/
│   └── src/lib/
│       ├── journal-entries-list-page.tsx
│       ├── journal-entries-form-page.tsx      # 对应 edit.tsx
│       ├── journal-entries-detail-page.tsx    # 对应 view.tsx
│       └── module-manifest.ts
├── ui/
│   └── src/lib/
│       ├── bill-rule-form.tsx                 # 动态表单主组件
│       ├── tx-type-section.tsx                # 单个 txType 区块
│       ├── subject-autocomplete.tsx           # 科目 autocomplete
│       ├── add-subject-dialog.tsx             # 新增科目弹窗
│       └── bill-rule-status-badge.tsx
└── util/
    └── src/lib/
        ├── journal-entries.constants.ts       # 权限 UUID
        ├── journal-entries.schema.ts          # 表单 Zod schema（核心）
        └── journal-entries.types.ts
```

## 6. UI 组件映射

| 源组件 | 目标替代 |
|--------|---------|
| `CustomTable` / `useCustomTable` | DataTable + `useBillRuleListQuery` |
| `Button` | `@myorg/shared/ui` Button |
| `Input` | `@myorg/shared/ui` Input |
| `Select` | `@myorg/shared/ui` Select |
| `AutoComplete` | 基于 `shared/ui` Input + Popover 封装，或新增 AutoComplete 组件 |
| `Form` / `Form.Item` / `Form.List` | `react-hook-form` + `useFieldArray` + `FormField` |
| `Tooltip` | `@myorg/shared/ui` Tooltip |
| `Spin` | skeleton / loading spinner |
| `Tag` | Tailwind badge |
| `PlusOutlined` / `MinusCircleOutlined` / `SaveOutlined` | `lucide-react` Plus / Minus / Save |

## 7. 迁移步骤

1. 创建 `journal-entries` 模块库并注册路由/i18n/权限。
2. 定义核心类型：
   - `BillRule`、`BillRuleListParams`、`BillRuleListResponse`
   - `BillRuleDetail`、`CreateBillRuleDTO`、`UpdateBillRuleDTO`
   - `BillSubject`、`TxTypeItem`
3. 实现 API 函数（8 个接口）。
4. 实现 TanStack Query hooks / mutations。
5. 设计并验证 Zod schema：
   - tokenId 必填。
   - txTypes 多选必填。
   - txTypeItems 数组，每个 item 含 loanType（1=Dr, 2=Cr）、subjectCode、subjectTitle、subjectCategory。
6. 实现列表页。
7. 实现表单页：
   - Token 选择触发 `interestTxType` 查询。
   - 根据返回 txTypes 动态渲染 `TxTypeSection`。
   - 每个 section 支持增减 Dr/Cr 条目。
   - 科目 autocomplete 调用 `getBillRuleSubjectList`。
   - 支持保存新科目（弹窗调用 `saveBillRuleSubject`）。
8. 实现详情页：只读展示。
9. 单测：schema 校验、动态表单增删、autocomplete 选择。

## 8. 风险与注意事项

- 编辑页代码 896 行，是 financial 模块最复杂的表单之一。必须拆分为多个子组件，否则维护性极差。
- `Form.List` 等价于 `react-hook-form` 的 `useFieldArray`，但 API 不完全一致，需要重写表单逻辑。
- `AutoComplete` 组件目标项目没有现成实现，需要封装。
- 保存新科目后需要刷新科目下拉并回填，状态同步需小心。
- 源文件类型全是 `BCMP.ANY`，迁移时必须补齐真实类型。
- `financialBillRuleAddTokenListApi` 的 endpoint 拼写为 `rull`，需确认后端是否接受，迁移时保持原样。

## 9. 验收标准

- 列表页展示规则，支持新增/编辑/启用/禁用。
- 编辑页能根据 token 动态加载 txType，并动态增减 Dr/Cr 科目条目。
- 科目 autocomplete 可用，支持保存新科目。
- 表单提交通过 Zod 校验。
- 详情页完整展示规则信息。
- lint / test 通过，表单单测覆盖主要路径。
