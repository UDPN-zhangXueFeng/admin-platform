# mmf 模块迁移计划

## 1. 业务概述

mmf（Money Market Fund / Dividend，分红计提与结算）模块管理两类核心业务实体：**计提记录（Accrual Record）** 与 **结算记录（Settlement Record）**。主要操作为「查询列表 / 查看详情」，其中计提列表额外支持「批量申报（Batch Apply）」与「单条申报（Apply）」两类写操作（通过 Modal + 可选表格完成），结算详情页含两个 Tab（基本信息 + 审批记录，审批记录行可跳转到 `/approval-manage/view`）。页面构成：2 个列表页（accrual / settlement 各一）+ 2 个详情页（accrual / settlement 各一），**无独立编辑/创建页**，写操作内嵌在 accrual 列表页的 Modal 内。特殊业务规则：金额字段普遍 `reSet(value) + ' ' + tokenSymbol` 拼接显示；accrual 详情页单行布局（`span: 3` 的状态字段打破 2 列网格）；批量申报依赖跨页签选择 + 聚合计算（选中条数、钱包总数、计提总额）。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/mmf/accrual/index.tsx` | 628 | 计提列表页：筛选表单（计提时间/基金/币种/链/状态）+ 表格 + 批量申报 Modal（含可选子表格 + 聚合统计）+ 单条申报 Modal，调用 accrual list / fund/list / stablecoin / blockchain 等 API |
| `src/pages/mmf/accrual/view.tsx` | 218 | 计提详情页：基本信息描述列表 + 钱包明细子表格（CustomTable，按 walletAddress 筛选），调用 accrual detail / wallet/records API |
| `src/pages/mmf/settlement/index.tsx` | 183 | 结算列表页：筛选表单（结算编码/申请时间/基金/状态）+ 表格，调用 settlement list / fund/list API，行操作「查看」跳详情 |
| `src/pages/mmf/settlement/view.tsx` | 337 | 结算详情页：Tabs 两页签（基本信息 + 钱包记录子表格 / 审批记录子表格），调用 settlement detail / wallet/records / record/list API，审批记录行可跳 `/approval-manage/view` |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES` 段（4 文件 / 1366 行）。「用途」由 Agent 读源码判断。注意：实际写操作 API（`batch/apply/list`、`apply`）封装在 `src/lib/api/mmf.ts`，不在页面源码内，详见第 3.3 与第 8 章。

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS`（页面内字面量 10 个）+ 源码补充（`@/lib/api/mmf.ts` 封装 2 个）。**实际共 12 个 endpoint**，按用途分组如下。

### 3.1 列表 API

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/manage/dividend/accrual/record/list` | POST | `accrual/index.tsx` 的 `useCustomTable.url` | 计提记录分页列表查询 |
| `/api/manage/v1/manage/dividend/settlement/record/list` | POST | `settlement/index.tsx` 的 `useCustomTable.url` | 结算记录分页列表查询 |

### 3.2 详情 API

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/manage/dividend/accrual/record/detail` | POST | `accrual/view.tsx` 的 `useSWR`（参数 `accrualRecordId`） | 计提详情页获取单条记录 |
| `/api/manage/v1/manage/dividend/settlement/record/detail` | POST | `settlement/view.tsx` 的 `useSWR`（参数 `settlementId`） | 结算详情页获取单条记录 |

### 3.3 子查询 API（详情页内嵌表格 / 申报 Modal）

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/manage/dividend/accrual/record/wallet/records` | POST | `accrual/view.tsx` 的 `useCustomTable.url` | 计提详情页「钱包明细」子表格（按 walletAddress 筛选，initialValues 带 billCode） |
| `/api/manage/v1/manage/dividend/settlement/record/wallet/records` | POST | `settlement/view.tsx` 的 `useCustomTable.url`（Tab1） | 结算详情页「钱包记录」子表格（initialValues 带 settlementId） |
| `/api/manage/v1/manage/dividend/settlement/record/record/list` | POST | `settlement/view.tsx` 的 `useCustomTable1.url`（Tab2） | 结算详情页「审批记录」子表格，行操作跳 `/approval-manage/view` |
| `/api/manage/v1/manage/dividend/accrual/record/fund/list` | POST | `accrual/index.tsx` + `settlement/index.tsx` 的 `useSWR` | 基金下拉数据源（两个列表页共用，用于筛选 + 批量申报 Modal 的基金选择） |

### 3.4 写操作 API（批量申报 / 单条申报）

> 来源：`@/lib/api/mmf.ts`，**脚本未抓取**（封装在 api 模块而非页面字面量）。涉及文件下载：否。

| 函数（源） | Endpoint | Method | 调用方 | 触发场景 |
|-----------|----------|--------|--------|----------|
| `getBatchApplyListexportApi` | `/api/manage/v1/manage/dividend/accrual/record/batch/apply/list` | POST | `accrual/index.tsx` 批量申报 Modal 内「查询」按钮 | 按基金 + 申请时间范围查询可申报的计提记录列表，填入 Modal 内可选表格 |
| `accrualRecordApplyApi` | `/api/manage/v1/manage/dividend/accrual/record/apply` | POST | `accrual/index.tsx` 两个 Modal 的「确认」 | 提交申报（批量 applyReqVOList + ruleId + totalAccrualUnits，或单条 currentData），成功后 `mutate()` 刷新列表 |

### 3.5 公共下拉数据源

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/common/stablecoin/enabled/searches` | POST | `accrual/index.tsx` | 「币种（Token）」筛选项（`stablecoinId` / `name`） |
| `/api/manage/v1/common/blockchain/list` | POST | `accrual/index.tsx` | 「链（Blockchain）」筛选项（`key` / `value`，`status===1` 可选，否则 disabled） |

> settlement 列表/详情页未使用 stablecoin / blockchain 下拉（其筛选只有结算编码/时间/基金/状态）。

### 3.6 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `CustomTableTitle` / `CustomModal` / `useHook`（来自 `libs/components`）
- `CustomIBasicDetailsInfo`（详情页基本信息描述列表，来自 `libs/components`）
- `formatTimestamp` / `reSet` / `getServerSidePropsResult`（来自 `libs/utils`）
- `getTimestamp`（来自 `libs/utils/get/getDateFormat`，批量申报 Modal 时间范围转时间戳）
- `request`（来自 `lib/api/axios`，封装 `@/lib/api/mmf.ts`）
- `@heroicons/react/20/solid` → `InformationCircleIcon`（申报 Modal 提示图标）
- `useSWR`（swr，下拉与详情数据获取）
- i18n 命名空间：`mmf` / `wallet-type`（主），`common` / `router`（getServerSideProps）

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **中高** |
| 困难分数 | 3.5/5 |
| 主要难点 | ① **4 个页面、12 个 endpoint**（含 2 个脚本未抓取的写操作），规模中等偏上；② accrual 列表页的「批量申报 Modal」含**内嵌可选静态 Table**（非 useCustomTable）+ `rowSelection` checkbox + 跨选择 `useMemo` 聚合（选中条数/钱包总数/计提总额），需还原成 TanStack Query + 自定义选择状态；③ `params` 对象用模块级可变引用 + `Object.assign` 副作用，迁移时需改为显式 state/mutation payload；④ settlement 详情页 **Tabs 双子表格**（wallet/records + record/list），其中 record/list 行操作跨模块跳转 `/approval-manage/view`；⑤ 5 处状态枚举（2 套独立 status 映射 + 详情页复用 `approval_task_status_color_*` / `common_task_status_*` i18n key）；⑥ 两个 Modal 共用同一 `onFinish` + `spinning` 状态，单条申报走「预填 items → 确认」两步。 |
| 建议负责人 | 中级 / 高级前端（批量申报 Modal 的选择聚合与跨页签 state 是主要难点） |

## 5. 迁移后目标文件清单

> 子模块处理：mmf 含 `settlement`（结算）与 `accrual`（计提）两个子模块，各有列表页+详情页。同一 `libs/modules/mmf/` 库下用文件名前缀区分，**不拆成两个库**。

```text
libs/modules/mmf/
├── data-access/
│   └── src/lib/
│       ├── mmf.model.ts                    # 类型：AccrualRecordItem / SettlementRecordItem / 两个详情 / 钱包明细 / 审批记录 / 批量申报 VO / 查询参数
│       ├── mmf.api.ts                      # 12 个 API 函数（2 list + 2 detail + 3 子查询 + 1 fund/list + 2 写操作 + 2 公共下拉）
│       └── +queries/
│           ├── mmf.keys.ts                 # Query key 工厂
│           ├── mmf.queries.ts              # 列表/详情/子表格/下拉查询 hooks
│           └── mmf.mutations.ts            # accrualRecordApply 写操作（批量/单条）
├── feature/
│   └── src/lib/
│       ├── accrual-list-page.tsx           # 计提列表页（含批量申报 Modal + 单条申报 Modal）
│       ├── accrual-detail-page.tsx         # 计提详情页（基本信息 + 钱包明细子表格）
│       ├── settlement-list-page.tsx        # 结算列表页
│       ├── settlement-detail-page.tsx      # 结算详情页（Tabs 双子表格）
│       ├── accrual-apply-modal.tsx         # 批量申报 Modal（可选表格 + 聚合统计），从列表页拆出避免大文件
│       └── module-manifest.ts              # 菜单/路由/权限注册（4 个路由 + 2 菜单项）
├── ui/
│   └── src/lib/
│       ├── mmf-status-badge.tsx            # 通用状态 Badge（按 status + 业务类型取色）
│       └── mmf-basic-details.tsx           # 详情页基本信息描述列表（替代 CustomIBasicDetailsInfo）
└── util/
    └── src/lib/
        └── mmf.constants.ts                # 5 处状态/枚举映射 + 4 个 limit 权限码
```

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query + `react-hook-form`（4 处：2 列表 + 2 详情子表格；settlement 详情有第 2 个子表格） |
| `CustomModal`（2 个申报 Modal） | `@myorg/shared/ui` Dialog / Drawer |
| `CustomIBasicDetailsInfo`（详情基本信息） | `mmf-basic-details.tsx` 或 `@myorg/shared/ui` Descriptions |
| `Form` / `Form.Item` / `Form.useForm`（2 个 form：列表筛选 + Modal 内查询） | `react-hook-form` + `useForm` + `FormField` / `FormSelect` |
| `Select` / `Input` | `@myorg/shared/ui` Select / Input |
| `DatePicker.RangePicker` | `FormDatePicker`（批量申报 Modal + settlement 列表筛选） |
| `Table`（Modal 内静态可选表格） | `@myorg/shared/ui` DataTable（rowSelection checkbox + 自定义选中 state） |
| `Tabs`（settlement 详情双页签） | `@myorg/shared/ui` Tabs |
| `Button` / `Tooltip` / `Spin` / `Tag` | `@myorg/shared/ui` Button / Tooltip / Spinner + Tailwind badge |
| `InformationCircleIcon`（heroicons） | `@myorg/shared/ui` Icon 或 lucide-react 同名图标 |
| `formatTimestamp` / `reSet` / `getTimestamp` | `@myorg/shared/util` 对应工具（迁移时确认目标库已有，否则补） |
| 5 处状态 Tag 颜色对象 | `util/mmf.constants.ts` + Badge variant 映射（见下） |

### 6.1 状态/枚举映射（完整搬运，写入 `util/mmf.constants.ts`）

> 数据来源：`extract-module-meta.sh` 的 `STATUS_ENUMS` 段（5 处定义起始行）。以下为 Agent 读对应源文件行后完整搬运的键值。

**① `accrual/index.tsx:36` — `approvalTaskStatus`（计提列表行状态色，status→antd Tag color）**

```ts
// 计提记录状态色（accrual list + accrual view 共用，仅 3 个状态）
export const ACCRUAL_STATUS_COLOR: Record<number, BadgeVariant> = {
  5: 'orange',      // 对应 mmf_distribution_status_5
  10: 'processing', // 对应 mmf_distribution_status_10
  35: 'success'     // 对应 mmf_distribution_status_35
};
// 筛选下拉 options（accrual/index.tsx:127-132）
export const ACCRUAL_STATUS_OPTIONS = [
  { value: 5,  labelKey: 'mmf.mmf_distribution_status_5' },
  { value: 10, labelKey: 'mmf.mmf_distribution_status_10' },
  { value: 35, labelKey: 'mmf.mmf_distribution_status_35' }
];
```

**② `accrual/view.tsx:21` — `approvalTaskStatus`（计提详情页状态色，与 ① 同键值，仅 3 个状态）**

> 与 ① 完全一致（`{5:'orange',10:'processing',35:'success'}`），合并为同一常量 `ACCRUAL_STATUS_COLOR`。

**③ `settlement/index.tsx:19` — `approvalTaskStatus`（结算列表行状态色，6 个状态）**

```ts
// 结算记录状态色（settlement list + settlement view 共用，6 个状态）
export const SETTLEMENT_STATUS_COLOR: Record<number, BadgeVariant> = {
  5:  'orange',      // mmf_settlement_status_5
  10: 'processing',  // mmf_settlement_status_10
  15: 'error',       // mmf_settlement_status_15
  20: 'processing',  // mmf_settlement_status_20
  35: 'success',     // mmf_settlement_status_35
  40: 'error'        // mmf_settlement_status_40
};
export const SETTLEMENT_STATUS_OPTIONS = [
  { value: 5,  labelKey: 'mmf.mmf_settlement_status_5' },
  { value: 10, labelKey: 'mmf.mmf_settlement_status_10' },
  { value: 15, labelKey: 'mmf.mmf_settlement_status_15' },
  { value: 20, labelKey: 'mmf.mmf_settlement_status_20' },
  { value: 35, labelKey: 'mmf.mmf_settlement_status_35' },
  { value: 40, labelKey: 'mmf.mmf_settlement_status_40' }
];
```

**④ `settlement/view.tsx:21` — `approvalTaskStatus`（结算详情页 Tab1 基本信息状态色，6 个状态）**

> 与 ③ 完全一致（`{5:'orange',10:'processing',15:'error',20:'processing',35:'success',40:'error'}`），合并为同一常量 `SETTLEMENT_STATUS_COLOR`。

**⑤ `settlement/view.tsx:29` — `mmfSettlementRecordsStatus`（结算详情页钱包记录子表格状态色，4 个状态）**

```ts
// 结算钱包记录状态色（settlement view Tab1 子表格，4 个状态，独立枚举）
export const SETTLEMENT_WALLET_RECORD_STATUS_COLOR: Record<number, BadgeVariant> = {
  20: 'orange',     // mmf_settlement_records_status_20
  30: 'processing', // mmf_settlement_records_status_30
  35: 'success',    // mmf_settlement_records_status_35
  40: 'error'       // mmf_settlement_records_status_40
};
export const SETTLEMENT_WALLET_RECORD_STATUS_OPTIONS = [
  { value: 20, labelKey: 'mmf.mmf_settlement_records_status_20' },
  { value: 30, labelKey: 'mmf.mmf_settlement_records_status_30' },
  { value: 35, labelKey: 'mmf.mmf_settlement_records_status_35' },
  { value: 40, labelKey: 'mmf.mmf_settlement_records_status_40' }
];
```

**⑥（衍生，源码非对象字面量但属于状态映射）settlement/view.tsx:245-251 审批记录状态**：源码用 `t(\`approval_task_status_color_${state}\`)` 取色 + `t(\`common_task_status_${state}\`)` 取文案，即色值与文案均由 i18n key 动态拼接（复用 `common`/全局审批状态约定）。迁移时：

```ts
// 审批记录状态（settlement view Tab2）：色值走 i18n key，非静态对象
// 渲染：color={t(`approval_task_status_color_${state}`)} label={t(`common_task_status_${state}`)}
// 迁移策略：保留 i18n key 动态拼接，或抽取为 SETTLEMENT_APPROVAL_RECORD_STATUS 映射表
```

### 6.2 limit 权限码（按钮可见性，写入 constants.ts）

```ts
export const MMF_PERMISSIONS = {
  ACCRUAL_BATCH_APPLY_BTN: '395e4d677e6d4275b5b49a172b352676', // 计提列表「批量申报」按钮
  ACCRUAL_SINGLE_APPLY_BTN: 'fdbee193ff1f4121a37dcea24b7711df', // 计提列表行「申报(Edit)」操作
  ACCRUAL_VIEW_BTN: '4570f906fddd40c9a2ef38e06e3099df',         // 计提列表行「查看」
  SETTLEMENT_VIEW_BTN: '49d8f06f484745129a1b36ab47e7c9ac',      // 结算列表行「查看」
  SETTLEMENT_RECORD_VIEW_BTN: '3b64dfc2a03e4e159778c2d19cfa4315' // 结算详情审批记录行「查看」
};
```

## 7. 迁移步骤

1. **Nx generator 建 `mmf` 库**（data-access / feature / ui / util 四层），在 `module-registry.ts` 注册；i18n 新增 `modules/mmf.json`（命名空间 `modules.mmf`，迁入 mmf / wallet-type / common / router 命名空间的 key）；**在 `apps/admin/tsconfig.json` 的 paths 登记 mmf 库路径**（防 nx 误报 lazy，见 memory sys-migration-status）。
2. **类型定义（`mmf.model.ts`，haiku）**：`AccrualRecordItem`、`SettlementRecordItem`、`AccrualDetail`、`SettlementDetail`、`AccrualWalletRecord`、`SettlementWalletRecord`、`SettlementApprovalRecord`、`FundOption`、`AccrualApplyReqVO`、各列表查询参数。金额字段统一带 `tokenSymbol`。
3. **常量（`mmf.constants.ts`，haiku）**：搬运 6.1 的 5 处状态映射 + 6.2 的 5 个权限码 + transactionType / operationType / dividendMethod 等 i18n key 前缀常量。
4. **API 函数（`mmf.api.ts` + queries/keys，haiku）**：12 个 endpoint 函数 + Query key 工厂 + 列表/详情/子表格/下拉的 TanStack Query hooks + `useApplyAccrualMutation`（mutations.ts）。
5. **结算列表页（`settlement-list-page.tsx`，sonnet）**：`react-hook-form` 筛选（结算编码 / 申请时间 RangePicker / 基金 Select / 状态 Select）+ `DataTable` + 行「查看」跳详情。状态色用 `SETTLEMENT_STATUS_COLOR`。
6. **结算详情页（`settlement-detail-page.tsx`，sonnet）**：`Tabs` 双页签。Tab1 = 基本信息描述列表（8 字段，含两条注释掉的死代码字段 riskLevel/createUser **不迁移**）+ 钱包记录子表格（`DataTable`，按 walletAddress + status 筛选，状态色用 `SETTLEMENT_WALLET_RECORD_STATUS_COLOR`）。Tab2 = 审批记录子表格（行「查看」跳 `/approval-manage/view`，传 taskId + busCode，状态走 `approval_task_status_color_*` i18n）。底部「返回」按钮。
7. **计提列表页（`accrual-list-page.tsx`，sonnet）**：`react-hook-form` 筛选（计提时间 / 基金 / 币种 / 链 / 状态）+ `DataTable` + 顶部「批量申报」按钮 + 行「申报(Edit, status===5 时可用)」/「查看」操作。详情跳转带 `id` + `billCode`。状态色用 `ACCRUAL_STATUS_COLOR`。
8. **批量申报 Modal（`accrual-apply-modal.tsx`，sonnet）**：从列表页拆出。内含独立查询表单（基金 Select + 申请时间 RangePicker → `getBatchApplyListexportApi`）+ 可选静态表格（`rowSelection` checkbox，列含 fundName/accrualDate/dividendMethod/accrualUnits/totalWalletBalance/totalWallets，均 Tooltip 包裹）+ 聚合统计区（`useMemo` 算 selectLength/selectTotalWallets/totalAccrualUnits）+ 信息提示 + 确认提交（`accrualRecordApplyApi`，成功后 invalidate 列表）。
9. **单条申报 Modal（同文件或内联）**：展示 `currentData` 预填 items（6 字段）+ 确认提交同一 `accrualRecordApplyApi`（payload 为单条 applyReqVO）。两个 Modal 共用 `spinning` + 提交后 `mutate()` 刷新。
10. **计提详情页（`accrual-detail-page.tsx`，sonnet）**：基本信息描述列表（13 字段，状态字段 `span:3` 打破 2 列网格）+ 钱包明细子表格（按 walletAddress 筛选，initialValues 带 `billCode`）。底部「返回」。
11. **单测 + `pnpm nx lint/test mmf` + build**。重点覆盖：状态色映射、批量申报选择聚合计算、limit 权限码可见性。

## 8. 风险与注意事项

- **脚本漏抓 2 个写操作 API（高优）**：`extract-module-meta.sh` 的 `API_ENDPOINTS` 仅抓页面内字面量 URL，`accrual/index.tsx` 通过 `@/lib/api/mmf.ts` 引入的 `accrualRecordApplyApi`（`/apply`）和 `getBatchApplyListexportApi`（`/batch/apply/list`）未被列入。实际 endpoint 共 **12 个**而非脚本输出的 10 个。**迁移率校验若以脚本 10 个为分母会漏这 2 个**，必须补进 `mmf.api.ts`。建议脚本增强：扫描页面 import 的 api 模块文件。
- **`params` 模块级可变引用（架构异味）**：`accrual/index.tsx:41` 的 `params` 是模块顶层对象，通过 `Object.assign` 在 `useMemo` 内被副作用修改，再在 `onFinish` 读取。这是隐式共享可变状态，迁移时必须改为 mutation 的显式 payload（由 `selectedRows` / `currentData` 计算），否则并发渲染会出脏数据。
- **批量申报 Modal 内嵌静态表格**：非 `useCustomTable`，是独立 `Table` + 手动 `rowSelection`，数据来自 `getBatchApplyListexportApi`（非分页）。迁移时不能用 `DataTable` 的服务端分页模式，需本地数据 + 客户端选择 state。
- **settlement 详情页两条死代码（不迁移）**：`settlement/view.tsx:99-108` 注释掉的 `riskLevel` / `createUser` 字段，确认后不迁移并在文档标注（已知限制）。
- **跨模块跳转 `/approval-manage/view`**：settlement 详情 Tab2 审批记录行跳转，依赖 `approval-manage` 模块的路由与权限。若该模块尚未迁移，跳转目标需占位或标注依赖。
- **审批记录状态色走 i18n key**：`approval_task_status_color_${state}` 非静态对象（与 5 处 STATUS_ENUMS 不同），属全局 `common` 约定。迁移时确认目标项目 i18n 是否已有这套 key，否则需补译。
- **antd Tag color 值映射**：源用 antd 内置色名（`processing`/`success`/`error`/`orange`），目标若用 Tailwind Badge variant，需建 `processing→warning/success→success/error→danger/orange→warning` 的映射表，且注意 `processing`/`orange` 在两处语义不同。
- **i18n 命名空间跨模块**：除 `mmf` 外大量复用 `wallet-type`（`wallet_type_*`，约 20+ key）。迁移时需确认目标 `modules/mmf.json` 或 `shared` 是否已含这些 key，避免重复或缺失。
- **状态枚举重复定义**：`approvalTaskStatus` 在 4 个文件各定义一次（accrual 两处键值相同、settlement 两处键值相同但与 accrual 不同），迁移时合并为 `ACCRUAL_STATUS_COLOR` + `SETTLEMENT_STATUS_COLOR` 两个常量，消除重复。

## 9. 验收标准

- 结算列表页支持全部 4 个筛选条件（结算编码 / 申请时间范围 / 基金 / 状态），正确分页，6 个状态 Tag 颜色与 `SETTLEMENT_STATUS_COLOR` 一致。
- 计提列表页支持全部 5 个筛选条件（计提时间 / 基金 / 币种 / 链 / 状态），币种下拉来自 stablecoin、链下拉来自 blockchain（`status===1` 选项 disabled）。
- 计提列表「批量申报」Modal：查询出可申报列表 → 勾选 → 聚合统计（选中条数 / 钱包总数 / 计提总额）正确 → 确认调用 `/apply` 成功后列表刷新；空选择时确认按钮 disabled。
- 计提列表行「申报(Edit)」仅在 `status===5` 时可用，弹单条确认 Modal → 确认调用 `/apply` → 列表刷新。
- 计提详情页 13 个字段完整（含 `span:3` 的状态字段打破网格），钱包明细子表格按 walletAddress 筛选且带 `billCode` initialValue。
- 结算详情页 Tabs 两页签：Tab1 基本信息完整（不含已注释的 riskLevel/createUser 死代码）+ 钱包记录子表格（4 状态色用 `SETTLEMENT_WALLET_RECORD_STATUS_COLOR`）；Tab2 审批记录行「查看」正确跳 `/approval-manage/view`（带 taskId + busCode）。
- 行操作「查看」跳转正确：accrual 带 `id`+`billCode`，settlement 带 `id`。
- 5 个 limit 权限码（`MMF_PERMISSIONS`）正确控制按钮可见性。
- 12 个 endpoint（含脚本漏抓的 `/apply` + `/batch/apply/list`）全部在 `mmf.api.ts` 实现，迁移率 ≥98%。
- 所有文案 i18n 化（`modules.mmf` + 复用 `wallet-type`/`common`/`router` 命名空间），无硬编码中文。
- `pnpm nx lint mmf` / `pnpm nx test mmf` / build 通过。
