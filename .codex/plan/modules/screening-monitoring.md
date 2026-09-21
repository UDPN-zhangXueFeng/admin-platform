# screening-monitoring 模块迁移计划

## 1. 业务概述

Screening & Monitoring（筛查与监控）模块负责**反洗钱/制裁筛查规则配置**与**可疑交易监控处置**。是合规风控的核心模块。

核心业务实体：① 筛查规则集（`RuleSet`，含 Custom Rule 自定义规则 与 Chainalysis/Elliptic/MistTrack 第三方规则）；② 可疑交易记录（`SuspiciousTransaction`，规则命中后生成）；③ 筛查服务商（静态信息页，展示 6 个集成的第三方 KYA/KYT/AML 服务商）。

主要操作：**规则 CRUD**（规则列表查询 / 查看详情含风险等级表 / 编辑规则（Custom Rule 复杂表单 + 第三方规则静态原型表单）/ 启停规则）；**可疑交易管理**（列表查询 / 查看详情含关联交易列表 / Process 处置抽屉（审核通过/拒绝） / Retry 重试失败扫描）。

特殊业务规则：① Custom Rule `edit.tsx`（739 行）含真实 API 调用（save/edit/detail），业务类型 20/30 用 InputNumber+Select（频率单位动态切换），40/50 用 TimePicker+compareTo；② 第三方规则 `t_edit.tsx`（1398 行）是**纯静态原型页**，`onFinish` 只 console.log + setTimeout mock success，ColumnConfig 矩阵定义 4 种 ruleSource × 2 种 scanTiming = 8 种列组合；③ suspicious 列表含 Process Drawer（处理意见+备注表单，调 process API）+ Retry action；④ 详情页含条件渲染（businessType 40/50 显示交易时间序列表 vs 20/30 显示转账明细表）。

页面构成：**rule**（1 列表 + 1 详情 + 2 编辑表单）、**transaction-monitoring**（1 列表 + 1 详情）、**screening-providers**（1 纯静态页）。

---

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `rule/index.tsx` | 295 | **规则列表页**：`useCustomTable`（url=`rule/set/list`）。筛选：规则名称/Token（动态 stablecoin searches）/链（动态 blockchain list，含 disabled）/业务类型（动态 business/type/unit）/创建时间范围/状态（3 态：1/10/15）。表格 11 列含 2 列 TODO 假数据（Rule Source→"Custom Rule"、Scan Timing→"Post Transaction"）。双 Add 按钮（Custom Rule→edit / 第三方→t_edit，不同权限码）。action：View（跳 view）/Edit（跳 edit，仅 status=10/15 可编辑）/Disable（仅 status=10）/Enable（仅 status=15 且 buttonFlag===false）。调 `ruleOperateApi` 启停。 |
| `rule/view.tsx` | 357 | **规则详情页**：`useSWR` 调 `rule/set/detail`。3 Tab：① Basic Information（`CustomIBasicDetailsInfo` 8 格 KV + 风险等级静态 Table（`detailList` 数组渲染：区间/风险评分/优先级/处置方式/邮件接收人））；② Operation Records（`useCustomTable` url=`operation/records`，筛选 recordType，View action 跳 `/approval-manage/view`）；③ Execution Log（`useCustomTable` url=`operation/log`，筛选时间范围，列：taskId/执行时间/链/扫描钱包数/异常钱包数）。 |
| `rule/edit.tsx` | 739 | **Custom Rule 编辑/新建页**：`Form.useWatch` 监听 businessType 和 saveDetails。3 区块：① 基本信息（规则名称 Input disabled 编辑态 + Token Select disabled 编辑态 + 业务类型 Select 含 Tooltip 说明，切换时联动 unitList 和表单重置）；② 监控配置（businessType 20/30→InputNumber+Select 频率单位，40/50→TimePicker+compareTo InputNumber addonAfter Days + 动态提示文本）。含 Form.List saveDetails（最多 3 行，区间校验 min<max + min≥前一行 max，含风险评分 Input/优先级 Select 3 级/处置方式 Select + Info Tooltip）。③ 告警配置（Switch turnOnAlert 联动 Form.List alertList，每行 TextArea email 校验（正则逗号分隔，最多 20）+ Checkbox getAllUsers 调 `ruleUserListApi` 自动填充）。编辑回填：`ruleDetailApi` 取数据，处理 businessType 40/50 时 TimePicker 回填。提交：businessType 40/50 调 `dayjs.format(HH:mm:ss)` 编码，新建调 `ruleSaveApi`/编辑调 `ruleEditApi`。 |
| `rule/t_edit.tsx` | 1398 | **第三方规则新建原型页**（⚠️ 纯静态 mock，无真实 API）：硬编码 RULE_SOURCE_OPTIONS（Custom/KYA·KYC/AML·CFT 三层分组）、SCAN_TIMING_OPTIONS、TOKEN_OPTIONS。**COLUMN_CONFIGS 矩阵**（4 ruleSource × 2 scanTiming = 8 组合），每个组合定义 showPercentage/percentageAsRange/showRiskScore/riskScoreAsRange/showRiskLevel/showTransactionAction/showWalletAction/maxRiskLevels/allowAdd。3 Card：① 基本信息（规则名称/来源/扫描时机/Token，均为硬编码选项）；② 风险等级配置（动态列表格，根据 ColumnConfig 条件渲染 Percentage/Metric Threshold 列、Risk Score 列（范围/单一）、Risk Level 列、Transaction/Wallet Action 列）。各 ruleSource × scanTiming 组合有独立默认数据（chainalysis 4 行、elliptic 5 行、misttrack 4 行、custom 3 行）。③ 邮件告警配置（根据 ruleSource 决定 riskLevels 数量（custom 3 级/其他 4 级），Form.List emailRecipients）。`onFinish` 只 console.log + setTimeout mock success。**无 API 调用**。InfoPanel 可折叠信息面板组件。 |
| `screening-providers/index.tsx` | 421 | **筛查服务商静态页**（⚠️ 纯静态页，无 API）：2×3 Grid 展示 6 个服务商卡片（Chainalysis/Elliptic/MistTrack/LexisNexis/Oracle/SAS）。每卡片含 Image(Next.js `next/image`) + 功能列表 + 外链 + 分类标签（KYA/KYT 或 AML/CFT）。i18n namespace=`screening-providers`（独立于 screening-monitoring）。 |
| `transaction-monitoring/index.tsx` | 501 | **可疑交易列表页**：`useCustomTable`（url=`suspicious/list`）。筛选：钱包地址/Token（动态）/链（动态）/业务类型（动态）/优先级（3 级：20/30/40）/状态（5 态：1/2/3/4/5）/监控时间范围。表格 13 列含 2 列假数据（Rule Source→"Custom Rule"、Scan Timing→"Post Transaction"）+ 状态 Tag（5 色：orange/processing/success/error/error）+ 处置结果列（仅 state=3 展示）。action：View（跳 view）/Process（打开 Drawer，仅 state=1/4）+ Reset（调 `suspicious/retry`，仅 state=5，含 Spin + message.success）。**Process Drawer**（width 35%）：顶部信息卡（7 格 KV）+ 处理表单（Radio 2 项 pass/reject + TextArea comments required）。调 `suspicious/process` API。 |
| `transaction-monitoring/view.tsx` | 507 | **可疑交易详情页**：`useSWR` 调 `suspicious/detail`。基本信息 `CustomIBasicDetailsInfo`：businessType 40/50 展示 9 格（含 currentValue/compareValue），否则 8 格（无 currentValue/compareValue）。**条件表格**：businessType 40/50 渲染交易时间序列表（transactionDate/transactionType/transactionAmount），否则渲染转账明细表（from/to/transactionType/amount/txDate/txHash 含外链跳转区块链浏览器）。**规则详情静态 Table**（rowSpan 合并 ruleName）+ **处理记录 Table**（processResult/processingType/creator/time/txHash/status + PUB_Detail action 跳 `/approval-manage/view`）。 |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES`（7 文件 4218 行）。"用途"列均实际 Read 全文后判断。

---

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS`（页面字面量 10 + api 模块封装 7，去重后 **16 个唯一 endpoint**，detail 在两组中重复）。

### 3.1 公共下拉 API（3 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/common/stablecoin/enabled/searches` | POST | rule/index.tsx、transaction-monitoring/index.tsx、rule/edit.tsx（useSWR） | Token 下拉选项 |
| `/api/manage/v1/common/blockchain/list` | POST | rule/index.tsx、transaction-monitoring/index.tsx（useSWR） | 区块链下拉选项（含 disabled 过滤） |
| `/api/manage/v1/audit/rule/set/query/business/type/unit` | POST | rule/index.tsx、transaction-monitoring/index.tsx、rule/edit.tsx（useSWR） | 业务类型+监控单位下拉（businessType→businessName + unitList[{monitorName/monitorUnit}]） |

### 3.2 规则集 API（8 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/audit/rule/set/list` | POST | rule/index.tsx（`useCustomTable.url`） | 规则分页列表 |
| `/api/manage/v1/audit/rule/set/detail` | POST | rule/view.tsx（useSWR）+ rule/edit.tsx（ruleDetailApi） | 规则详情（含 detailList/alertList） |
| `/api/manage/v1/audit/rule/set/save` | POST | rule/edit.tsx（api 模块） | 创建规则 |
| `/api/manage/v1/audit/rule/set/edit` | POST | rule/edit.tsx（api 模块） | 编辑规则 |
| `/api/manage/v1/audit/rule/set/operate` | POST | rule/index.tsx（api 模块） | 规则启停（Enable/Disable） |
| `/api/manage/v1/audit/rule/set/operation/records` | POST | rule/view.tsx（`useCustomTable.url`） | 规则操作记录列表 |
| `/api/manage/v1/audit/rule/set/operation/log` | POST | rule/view.tsx（`useCustomTable.url`） | 规则执行日志列表 |
| `/api/manage/v1/audit/rule/set/user/list` | POST | rule/edit.tsx（api 模块，getUserEmail 自动填充） | 获取 Token 关联用户邮箱列表 |

### 3.3 可疑交易 API（5 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/audit/rule/suspicious/list` | POST | transaction-monitoring/index.tsx（`useCustomTable.url`） | 可疑交易分页列表 |
| `/api/manage/v1/audit/rule/suspicious/detail` | POST | transaction-monitoring/view.tsx（useSWR） | 可疑交易详情（含 ruleDetails/processList） |
| `/api/manage/v1/audit/rule/suspicious/detail/transactionList` | POST | transaction-monitoring/view.tsx（两个 `useCustomTable.url`） | 关联交易列表（条件渲染不同列） |
| `/api/manage/v1/audit/rule/suspicious/process` | POST | transaction-monitoring/index.tsx（api 模块，Drawer 表单） | 处理可疑交易（processRemark+comments） |
| `/api/manage/v1/audit/rule/suspicious/retry` | POST | transaction-monitoring/index.tsx（api 模块，Reset action） | 重试扫描 |

### 3.4 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `CustomTableTitle` / `useHook` → `DataTable` + TanStack Query + `react-hook-form`
- `CustomIBasicDetailsInfo` → `DescriptionList` 或自定义 KV
- `CustomCopy`（复制文本组件）→ 需自行实现或复用
- `formatTimestamp` / `getServerSidePropsResult` / `reSet` → 已有对应
- `@/lib/api/screening-monitoring`（7 函数）→ `data-access/src/lib/screening-monitoring.api.ts`

---

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **高** |
| 困难分数 | 4/5 |
| 主要难点 | ① **t_edit.tsx 1398 行 ColumnConfig 矩阵**：4×2=8 种列组合 + 10 个条件渲染分支 + 6 套默认数据 + 动态列头/tooltip；② **edit.tsx 业务类型联动**：businessType 切换联动 unitList/表单重置/频率组件切换（InputNumber vs TimePicker）；③ **Form.List 三层嵌套**：saveDetails + alertList + emailRecipients；④ **多态详情页**（transaction-monitoring/view.tsx）：businessType 条件渲染基本信息和表格列；⑤ **纯静态原型页决策**：t_edit.tsx + screening-providers 无 API，需决定迁移策略 |
| 建议负责人 | 高级前端（条件渲染矩阵 + Form.List 嵌套 + 双 mock 页处理） |

---

## 5. 迁移后目标文件清单

```text
libs/modules/screening-monitoring/
├── data-access/
│   └── src/lib/
│       ├── screening-monitoring.model.ts          # 类型定义
│       ├── screening-monitoring.api.ts            # API 函数（17 endpoint）
│       └── +queries/
│           ├── screening-monitoring.keys.ts       # Query key 工厂
│           ├── screening-monitoring.queries.ts    # 查询 hooks
│           └── screening-monitoring.mutations.ts  # 写操作 hooks
├── feature/
│   └── src/lib/
│       ├── rule-list-page.tsx                     # 规则列表
│       ├── rule-detail-page.tsx                   # 规则详情（3 Tab）
│       ├── rule-edit-page.tsx                     # Custom Rule 编辑/新建（page shell）
│       ├── rule-edit-content.tsx                  # Custom Rule 编辑表单内容
│       ├── rule-t-edit-page.tsx                   # 第三方规则原型页（⚠️ 纯静态 mock）
│       ├── screening-providers-page.tsx           # 服务商静态展示页（⚠️ 纯静态）
│       ├── transaction-monitoring-list-page.tsx   # 可疑交易列表 + Process Drawer
│       ├── transaction-monitoring-detail-page.tsx # 可疑交易详情
│       └── module-manifest.ts                     # 三子模块 manifest
├── ui/
│   └── src/lib/
│       ├── screening-status-badge.tsx             # 状态 Badge
│       ├── screening-risk-level-tag.tsx           # 风险等级标签
│       ├── screening-provider-card.tsx            # 服务商卡片组件
│       └── screening-column-config-table.tsx      # ColumnConfig 动态列表格（t_edit 核心）
└── util/
    └── src/lib/
        └── screening-monitoring.constants.ts      # 状态映射/权限码/枚举/ALL_VALUE
```

**子模块变体**：`rule` / `transaction-monitoring` / `screening-providers` 三个子模块共享同一库，
feature 层用子模块前缀区分。

---

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query + `react-hook-form` |
| `Form` / `Form.Item` / `Form.useWatch` / `Form.List` | `react-hook-form` + `useWatch` + `useFieldArray` + `FormField`/`FormSelect` |
| `Input` / `Input.TextArea` | `@myorg/shared/ui` Input / TextArea |
| `InputNumber` | `@myorg/shared/ui` InputNumber |
| `Select` | `@myorg/shared/ui` Select / `FormSelect` |
| `DatePicker.RangePicker` | `FormDatePicker` |
| `TimePicker` | TimePicker 组件 |
| `Switch` | `@myorg/shared/ui` Switch |
| `Radio.Group` / `Checkbox` | `@myorg/shared/ui` RadioGroup / Checkbox |
| `Button` | `@myorg/shared/ui` Button |
| `Tag` | Tailwind badge / Badge 组件 |
| `Tabs` | `@myorg/shared/ui` Tabs |
| `Table`（静态） | `@myorg/shared/ui` DataTable（或静态 Table） |
| `Drawer` | `@myorg/shared/ui` Drawer |
| `Spin` | Loading / Suspense |
| `Tooltip` | `@myorg/shared/ui` Tooltip |
| `Card` | `@myorg/shared/ui` Card |
| `CustomIBasicDetailsInfo` | `DescriptionList` 或自定义 KV 列表 |
| `CustomCopy` | 自定义 CopyableText 组件 |
| `notification.useNotification` | `toast` from `@myorg/shared/ui-toast` |
| `Paragraph copyable` | CopyableText 组件 |
| `Image` (next/image) | next/image（保留） |

### 6.1 状态/枚举映射

**规则状态**（rule/index.tsx:22 + rule/view.tsx:24，两处键值完全相同→合并）：
```typescript
export const RULE_STATUS_MAP = {
  1: { label: 'rule_status_1', color: 'processing' },
  10: { label: 'rule_status_10', color: 'success' },
  15: { label: 'rule_status_15', color: 'gray' },
};
```

**可疑交易状态**（transaction-monitoring/index.tsx:41 + view.tsx:23，完全相同→合并）：
```typescript
export const SUSPICIOUS_STATUS_MAP = {
  1: { label: 'transaction_monitoring_status_1', color: 'orange' },
  2: { label: 'transaction_monitoring_status_2', color: 'processing' },
  3: { label: 'transaction_monitoring_status_3', color: 'success' },
  4: { label: 'transaction_monitoring_status_4', color: 'error' },
  5: { label: 'transaction_monitoring_status_5', color: 'error' },
};
```

**风险等级**（edit.tsx + t_edit.tsx 共用）：
```typescript
export const RISK_LEVEL_MAP = {
  20: 'risk_level_type_20', // Low
  30: 'risk_level_type_30', // Medium
  40: 'risk_level_type_40', // High
};
```

**处置方式**（handleType）：
```typescript
export const HANDLE_TYPE_MAP = {
  1: 'rule_action_1', // Pass / Reject
  2: 'rule_action_2', // Hold / Flag
};
```

**操作类型**（operation records）：
```typescript
export const RULE_OPERATION_TYPE_MAP = {
  1: 'rule_operation_type_1',
  2: 'rule_operation_type_2',
  3: 'rule_operation_type_3',
  4: 'rule_operation_type_4',
};
```

**t_edit ColumnConfig 静态数据**：RULE_SOURCE_OPTIONS、SCAN_TIMING_OPTIONS、TOKEN_OPTIONS、RISK_LEVEL_OPTIONS（5 级）、TRANSACTION_ACTION_OPTIONS、WALLET_ACTION_OPTIONS、TRANSACTION_TYPE_OPTIONS、MONITORING_FREQUENCY_OPTIONS、COLUMN_CONFIGS 矩阵（8 组合）。全部硬编码迁移到 constants.ts。

### 6.2 权限码映射

| 权限码 | 用途 | 使用页面 |
|--------|------|----------|
| `34def8895d0a4ca59339d8acca702ff7` | 新建 Custom Rule | rule/index.tsx（Add 按钮） |
| `38fbb8b8cc1040da9993311925fd896c` | 新建第三方 Rule | rule/index.tsx（Add1 按钮） |
| `e338a3b41c21413db1d2ac7a90a65f5f` | 查看详情/审批 | rule/view.tsx + transaction-monitoring/view.tsx（View action） |
| `8ba81f3a7f6f4ece8ca17059ae384d94` | 编辑规则 | rule/index.tsx（Edit action） |
| `b0f7fd1abc85416ea6dfdcee46333992` | 停用规则 | rule/index.tsx（Disable action） |
| `9cfc0cbaa3f640e3aa536ff363ab1ddd` | 启用规则 | rule/index.tsx（Enable action） |
| `544f82b603d54d43bb6b63699582e08d` | 查看可疑交易 | transaction-monitoring/index.tsx（View） |
| `4f9a34c2215f4540be4eac03bcd6a8a8` | 重试扫描 | transaction-monitoring/index.tsx（Reset） |
| `b9433acf356b4a28a405513c505232cd` | 处置可疑交易 | transaction-monitoring/index.tsx（Process） |

### 6.3 跨模块跳转

| 目标路由 | 触发场景 | 携带参数 |
|----------|----------|----------|
| `/approval-manage/view` | rule/view 操作记录 View + transaction-monitoring/view 处理记录 Detail | `id=data.taskId, busCode=data.busCode` |
| `/screening-monitoring/rule/view` | rule/index View action | `id=data.ruleId` |
| `/screening-monitoring/rule/edit` | rule/index Edit/Add(Custom) action | 编辑 `id=data.ruleId`，新建无 id |
| `/screening-monitoring/rule/t_edit` | rule/index Add(第三方) action | 无 id |
| `/screening-monitoring/transaction-monitoring/view` | transaction-monitoring/index View action | `id=data.suspiciousId, type=data.businessType` |

---

## 7. 迁移步骤

1. **建库 + 注册**（scaffold）：Nx generator 创建 `screening-monitoring` 模块四层。manifest 注册 rule/transaction-monitoring/screening-providers 三子模块（group 机制）。tsconfig paths 登记。i18n 建 `modules/screening-monitoring.json` + `modules/screening-providers.json`。

2. **类型定义**（scaffold）：`screening-monitoring.model.ts` — Rule/RuleDetail/RuleFormValues、SuspiciousTransaction/SuspiciousDetail/ProcessFormValues、ColumnConfig 类型、screening-providers 静态数据类型。

3. **API 函数**（scaffold）：`screening-monitoring.api.ts` — 17 个 API 函数（3 公共下拉 + 8 ruleset + 4 suspicious + 2 写操作 process/retry）。

4. **Query/Mutation hooks**（scaffold）：queries（含 useBusinessTypeList/useStablecoinOptions/useBlockchainOptions）+ mutations（save/edit/operate/process/retry）。

5. **常量**（scaffold）：`screening-monitoring.constants.ts` — 状态映射 + 权限码 + ALL_VALUE='all' + t_edit 硬编码选项/配置矩阵。

6. **UI 组件**（page）：status-badge + risk-level-tag + provider-card（服务商卡片复用组件）+ column-config-table（ColumnConfig 动态列表格，t_edit 核心）。

7. **规则列表页**（page）：`rule-list-page.tsx` — DataTable + 动态下拉（3 个：token/blockchain/businessType）+ 11 列（含 2 列假数据占位）+ 双 Add 按钮 + 4 action（View/Edit/Disable/Enable）。

8. **规则详情页**（page）：`rule-detail-page.tsx` — 3 Tab（Basic Info 含静态 Table + Operation Records 含 DataTable + Execution Log 含 DataTable）。

9. **Custom Rule 编辑页**（page，复杂）：`rule-edit-page.tsx` + `rule-edit-content.tsx` — react-hook-form + useWatch 监听 businessType/saveDetails/turnOnAlert。三区块：基本信息 + 监控配置（组件条件切换 InputNumber+Select vs TimePicker+compareTo）+ 告警配置（Switch+alertList Form.List）。businessType 切换联动 unitList。编辑回填逻辑。

10. **第三方规则原型页**（page，⚠️ mock）：`rule-t-edit-page.tsx` — 保留完整静态逻辑。ColumnConfig 矩阵 + 8 组合默认数据。`onFinish` 保留 mock（console.log + setTimeout success toast）。标注「纯静态原型，无真实 API」。

11. **服务商静态页**（page，⚠️ mock）：`screening-providers-page.tsx` — 2×3 Grid 6 卡片，next/image + 外链。无 API，纯展示。

12. **可疑交易列表页**（page）：`transaction-monitoring-list-page.tsx` — DataTable + Process Drawer（Radio + TextArea form + submit）+ Reset action（Spin + retry API + toast）。

13. **可疑交易详情页**（page）：`transaction-monitoring-detail-page.tsx` — businessType 条件渲染基本信息 + 条件表格 + 规则详情 Table（rowSpan 合并）+ 处理记录 Table（Detail action 跳审批）。

14. **i18n 补全**：搬迁 screening-monitoring.json + screening-providers.json 全部 key，ICU `{{}}`→`{}`。

15. **静态验证**：`pnpm nx lint screening-monitoring` / build + 运行时坑 grep（ALL_VALUE/i18n 双重前缀/ICU/SelectItem 空串/pageNum）。

---

## 8. 风险与注意事项

- **t_edit.tsx 是纯静态原型页**：`onFinish` 只 console.log + setTimeout mock success，无真实 API。迁移时保留完整交互逻辑和硬编码数据，但标注 `⚠️ MOCK: 无后端 API，保存仅为前端演示`。不改动 ColumnConfig 矩阵数据（因后端接口未定型）。
- **screening-providers 纯静态页**：无 API、无交互（仅外链），直接保留。
- **edit.tsx businessType 联动复杂**：businessType 切换时需重置 monitorFrequency/monitorFrequencyType/compareTo/saveDetails；unitList 从 businessTypeList 的 option 对象中动态提取（`option.unitList`），需在 `FormSelect` 的 onChange 中处理。
- **假数据列**：规则列表和可疑交易列表各有 2 列硬编码假数据（Rule Source→"Custom Rule"、Scan Timing→"Post Transaction"），源码注释 `TODO: 添加翻译，假数据，后期需要修改数据接口`。迁移时保留假数据占位，不额外处理。
- **双 useCustomTable 同 endpoint**（transaction-monitoring/view.tsx）：两个表格同 URL `suspicious/detail/transactionList`，仅列定义不同（businessType 40/50 vs 20/30）。需确保 TanStack Query key 去重。
- **Process Drawer 关闭逻辑**：Drawer 宽度 35%，自定义 title 含 X 按钮 `XMarkIcon`，表单 Cancel 按钮也关闭。需保留双关闭路径。
- **screening-providers 使用独立 i18n namespace**（`screening-providers`）：不同于其他页面用 `screening-monitoring`。需单独建 JSON 并注册。
- **运行时坑清单**（阶段四 verify grep + 阶段五冒烟）：ALL_VALUE='all' 非空 / i18n 无双重点缀 / ICU 单花括号 / SelectItem value 非空 / 下拉数据过滤空 id（stablecoin/blockchain/businessType）/ list 请求体 pageNum / FormSelect option 含 disabled + 自定义字段（unitList）需特殊处理。
- **已知限制**：① t_edit.tsx 为纯静态原型，无后端支持；② screening-providers 纯静态展示；③ 规则列表/可疑交易列表各 2 列假数据待后端补充字段后移除。

---

## 9. 验收标准

- 规则列表页筛选（6 项）正常，双 Add 按钮跳不同编辑页，action（View/Edit/Disable/Enable）正确调 API 并权限控制
- 规则详情页 3 Tab 正常切换，基本信息含风险等级 Table，操作记录和执行日志 DataTable 分页正常
- Custom Rule 编辑表单：businessType 联动正确，20/30 显示频率组件，40/50 显示 TimePicker；saveDetails 区间校验正常；alertList 联动 Switch；新建/编辑回填正确
- 第三方规则原型页：8 种 ColumnConfig 组合列显示正确，默认数据填充正确，onFinish mock toast 正常
- 服务商静态页：6 卡片渲染正常，外链可点击，Image 加载正确
- 可疑交易列表页：筛选正常，Process Drawer 打开/提交正确，Reset action Spin+toast 正常
- 可疑交易详情页：businessType 40/50 vs 20/30 条件渲染正确，关联交易列表和规则详情 Table 正常，处理记录 Detail 跳审批正确
- 所有文案 i18n 化，无 MISSING_MESSAGE/INVALID_MESSAGE
- 状态 Tag 颜色正确
- `pnpm nx lint screening-monitoring` / build 通过
- 运行时 SelectItem 无空串崩溃
