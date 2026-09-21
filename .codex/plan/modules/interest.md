# interest 模块迁移计划

## 1. 业务概述

Interest（计息）模块负责管理稳定币的**计息策略（Policy）**、查看**计息记录（Accrual）**和**计息交易（Transaction）**。这是计息业务的核心管理后台，覆盖从策略配置 → 每日计息 → 交易过账的完整链路。

核心业务实体：① 计息策略（`InterestRule`，含存款/透支两种类型 + 全额/分段两种计算方式）；② 计息记录（`AccrualRecord`，每日按策略生成的计息明细）；③ 计息交易（`TokenBill`，将计息记录汇总过账到链上的交易批次）。

主要操作：**策略 CRUD**（list/detail/create/edit/启停）、**计息记录查询**（list/detail + 钱包维度明细）、**交易管理**（list/detail + Post 过账/Retry 重试）。

页面构成：3 子模块共 8 页面 — **policy**（1 列表+1 详情+2 表单）、**accrual**（1 列表+1 详情）、**transactions**（1 列表+1 详情）。

特殊业务规则：
- **双计息类型**：透支计息（Overdraft，interestType=1）+ 存款计息（Deposit，interestType=2），用 Tabs 区分
- **双计算方式**：全额计息（Whole Balance Method，`interestCalculationMethod=1`）+ 分段计息（Partial Balance Method，`interestCalculationMethod=2`），按余额区间分段利率
- **利率正负号**：支持正向（add）和负向（minus）利率，编辑表单用 Select addonBefore 切换
- **策略状态机**：1=Processing → 10=Active ↔ 15=Inactive（5=Unactivated）
- **交易状态机**：1=Pending Posting → 5=Pending Approval → 10=Under Approval → 20=Approved → 30=Processing → 35=Success / 40=Failed
- **分段利率校验**：`minValue < maxValue`，当前区间 `minValue ≥ 上一区间 maxValue`

---

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/interest/policy/index.tsx` | 402 | **策略列表页**：双 Tab（存款计息 / 透支计息），每个 Tab 独立 `useCustomTable`（url=`/api/manage/v1/manage/interest/list`，interestType=2/1）。筛选：策略名称 / 生效日期范围 / 创建时间范围 / 状态（4 态）。表格 7 列（序号/名称/账户类型/年利率/生效日期/创建时间/状态 Tag）。action：View/Edit/Disable/Enable（权限码控制 + 条件 disabled）。透支计息 Tab `disabled: true`（不可点击）。调 `interestOperateApi` 启停。 |
| `src/pages/interest/policy/view.tsx` | 470 | **策略详情页**：双 Tab（Basic Information + Operation Records）。`useSWR` 调 detail API。基本信息用 `CustomIBasicDetailsInfo` 渲染（interestType===2 时展示分段利率 `saveDetails`，含 `calculateDayMonth` 序数词后缀逻辑）。Operation Records Tab 用 `useCustomTable`（url=`operation/records`，筛选 recordType，展示操作类型/创建人/创建时间/审批状态，action=View 跳 `/approval-manage/view`）。**walletTypeTable**（url=null, dataSource=[]，纯占位 mock 表格，显示 "No associated wallet types found"）。调 2 个详情 API。 |
| `src/pages/interest/policy/deposit/edit.tsx` | 829 | **存款计息策略编辑/新建页**（最复杂表单）：`interestType=2`。三区块布局：**① 策略配置**（名称 Input maxLength 50 + 账户类型 Select disabled + 计算方式 Radio.Group（全额/分段））→ **全额模式**：年利率 InputNumber（正负号 addonBefore + % addonAfter）+ 自定义校验（正则 `^[0-9]+(.[0-9]{1,2})?$`）+ 生效日期 DatePicker（disable 今天之前）；**分段模式**：Form.List（最多 10 行，每行 minValue/maxValue/interestRate + 正负号，交叉校验 + min<max + min≥前一行max）+ 生效日期。**② 日计息配置**（频率固定 Daily + TimePicker HH:mm:ss）。**③ 月计息应用配置**（Day of Month Select 1-28 + TimePicker HH:mm:ss）。编辑模式回填：从 interestDetailsApi 取数据，处理利率正负号拆分（`indexOf('-')`），分段利率逆向还原。提交：利率正负号编码 + `getTimestamp` 转换 + `dayjs` 格式化时间。调 `interestSaveApi`（新建）或 `interestEditApi`（编辑）。已生效/禁用状态下名称字段 disabled。 |
| `src/pages/interest/policy/overdraft/edit.tsx` | 382 | **透支计息策略编辑/新建页**：`interestType=1`，`interestCalculationMethod` 固定为 1（全额）。三区块：**① 策略配置**（名称 Input + 账户类型 Select disabled（当前账户）+ 年利率 InputNumber + % addonAfter + 自定义校验 + 生效日期 DatePicker）。**② 日计息配置**（频率 Daily + TimePicker）。**③ 月计息应用配置**（频率 Monthly + TimePicker）。无分段利率逻辑（比存款版简单 50%+）。disabled 逻辑同存款版。文案用 `.replace(t('interest_00134'), t('interest_00133'))` 将 "Deposit" 替换为 "Overdraft"。 |
| `src/pages/interest/accrual/index.tsx` | 191 | **计息记录列表页**：`useCustomTable`（url=`accrual/record/list`）。筛选：计息时间范围 / Token（`stablecoin/enabled/searches` 动态下拉）+ 链（`blockchain/list` 动态下拉，含 disabled 过滤）+ 计息类型（50=存款/60=透支）。表格 8 列（序号/计息时间/Token/链/类型/计息周期/金额/总钱包数）。action=View（跳 `accrual/view`，带 id+tokenId+feePeriod+feeType 四参数）。 |
| `src/pages/interest/accrual/view.tsx` | 234 | **计息记录详情页**：`useSWR` 调 `accrual/record/detail`。基本信息 `CustomIBasicDetailsInfo`（6 格 KV：类型/Token/计息时间/周期/金额/钱包数）。**feeType===50**（存款）展示 `customTable`（url=`accrual/record/history/list`，筛选 walletAddress，列：地址/钱包类型/链/策略名/余额/计息金额）；**feeType !== 50**（透支）展示 `customTable1`（同 url，额外列 `billType` + `isCopy: false`）。两个 `useCustomTable` 初始值都注入 tokenId+feePeriod+feeType。 |
| `src/pages/interest/transactions/index.tsx` | 237 | **计息交易列表页**：`useCustomTable`（url=`tx/list`）。筛选：过账时间范围 / Token（动态下拉）+ 链（动态下拉）+ 计息类型 + 状态（8 态：1/5/10/15/20/30/35/40）。表格 8 列（序号/过账时间/Token/链/类型/应计金额/实发金额/状态 Tag，状态色用 `t('approval_task_status_color_${status}')`）。action：View（跳 `transactions/view`）/ Post（`interestTxSaveApi`，仅 status===1）/ Reset（`interestTxRetryApi` + Spin loading + 手动 mutate + Success message）。 |
| `src/pages/interest/transactions/view.tsx` | 319 | **计息交易详情页**：双 Tab（Basic Information + Operation Records）。`useSWR` 调 `tx/detail/basic`。基本信息 `CustomIBasicDetailsInfo`（9 格 KV：类型/Token/链/过账时间/应计金额/实发金额/总钱包数/失败钱包数）。Tab1 内含 `customTable`（url=`tx/detail/records`，筛选 walletAddress+status，列：地址/钱包类型/链/计息周期/应计金额/实发金额/交易时间/txHash/状态）。Tab2 含 `customTable1`（url=`tx/operation/records`，无筛选，列：操作类型/创建人/创建时间/状态，action=View 跳 `/approval-manage/view`）。 |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES` 段（8 文件，100% 覆盖）。"用途"列均实际 Read 全文后判断。

---

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS`（页面字面量 12 + api 模块封装 6，去重后 17 个唯一 endpoint）。

### 3.1 公共下拉 API（2 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/common/stablecoin/enabled/searches` | POST | `accrual/index.tsx`、`transactions/index.tsx`（useSWR） | Token 下拉选项（动态，name→label / stablecoinId→value） |
| `/api/manage/v1/common/blockchain/list` | POST | `accrual/index.tsx`、`transactions/index.tsx`（useSWR） | 区块链下拉选项（动态，value→label / key→value，含 disabled 过滤 status!==1） |

### 3.2 策略管理 API（4 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/manage/interest/list` | POST | `policy/index.tsx`（两个 `useCustomTable.url`） | 策略分页列表（interestType=1/2 区分透支/存款，筛选 policyName/effectiveDate 范围/createTime 范围/status） |
| `/api/manage/v1/manage/interest/detail` | POST | `policy/view.tsx`（useSWR） | 策略详情（interestRuleId→完整策略对象含 saveDetails/tiers/利率信息） |
| `/api/manage/v1/manage/interest/operation/records` | POST | `policy/view.tsx`（`useCustomTable.url`） | 策略操作记录分页列表（interestRuleId+recordType 筛选，展示增/改/启/停操作历史） |
| `/api/manage/v1/manage/interest/operate` | POST | `policy/index.tsx`(actionClick Disable/Enable)（api 模块） | 策略启停（interestRuleId+state，10=Enable/15=Disable） |

### 3.3 策略写操作 API（2 个，api 模块封装）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/manage/interest/save` | POST | `policy/deposit/edit.tsx`、`policy/overdraft/edit.tsx`（新建模式） | 创建计息策略（完整策略对象含 interestType/interestCalculationMethod/annualInterestRate/saveDetails/effectiveTime/calculateTimeDay/calculateTimeMonth） |
| `/api/manage/v1/manage/interest/edit` | POST | `policy/deposit/edit.tsx`、`policy/overdraft/edit.tsx`（编辑模式） | 编辑计息策略（interestRuleId+完整策略对象） |

### 3.4 计息记录 API（3 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/manage/interest/accrual/record/list` | POST | `accrual/index.tsx`（`useCustomTable.url`） | 计息记录分页列表（筛选 accrualTime 范围/tokenId/blockchainId/feeType） |
| `/api/manage/v1/manage/interest/accrual/record/detail` | POST | `accrual/view.tsx`（useSWR） | 计息记录详情（accrualRecordId→计息汇总信息） |
| `/api/manage/v1/manage/interest/accrual/record/history/list` | POST | `accrual/view.tsx`（两个 `useCustomTable.url`，同 endpoint 不同配置） | 计息历史明细列表（tokenId+feePeriod+feeType+walletAddress 筛选） |

### 3.5 交易管理 API（4 个页面字面量 + 2 个 api 模块封装）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/manage/interest/tx/list` | POST | `transactions/index.tsx`（`useCustomTable.url`） | 交易批次分页列表（筛选 postTime 范围/tokenId/blockchainId/feeType/status） |
| `/api/manage/v1/manage/interest/tx/detail/basic` | POST | `transactions/view.tsx`（useSWR） | 交易批次基本信息（tokenBillId→汇总数据：金额/钱包数/失败数） |
| `/api/manage/v1/manage/interest/tx/detail/records` | POST | `transactions/view.tsx`（Tab1 `useCustomTable.url`） | 交易明细列表（tokenBillId+walletAddress+status 筛选） |
| `/api/manage/v1/manage/interest/tx/operation/records` | POST | `transactions/view.tsx`（Tab2 `useCustomTable.url`） | 交易操作记录列表（tokenBillId 筛选） |
| `/api/manage/v1/manage/interest/tx/save` | POST | `transactions/index.tsx`（actionClick Post）（api 模块） | 发起过账（tokenBillId） |
| `/api/manage/v1/manage/interest/tx/retry` | POST | `transactions/index.tsx`（actionClick Reset）（api 模块） | 重试失败交易（tokenBillId，成功后手动 mutate+Success message） |

### 3.6 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `CustomTableTitle` / `useHook`（来自 `libs/components`）→ 目标用 `DataTable` + TanStack Query + `react-hook-form`
- `CustomIBasicDetailsInfo`（来自 `libs/components/CustomIBasicDetailsInfo`）→ 目标用 `DescriptionList` 或自行实现 KV 列表组件
- `formatTimestamp` / `getServerSidePropsResult` / `reSet`（来自 `libs/utils`）→ `formatTimestamp` 已有对应实现；`reSet` 用于空值回退展示；`getServerSidePropsResult` + `serverSideTranslations` 无需迁移（目标 CSR/SPA）
- `getTimestamp`（来自 `libs/utils/get/getDateFormat`）→ 日期转 epoch 工具函数
- `@/lib/api/interest`（api 模块，6 函数）→ 目标 `data-access/src/lib/interest.api.ts`

---

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **中高** |
| 困难分数 | 3.5/5 |
| 主要难点 | ① **deposit/edit.tsx 829 行复杂表单**：双计算方式切换（全额/分段）、Form.List 分段利率（最多 10 行、交叉校验、正负号编码/解码）、新建/编辑双模式数据回填；② **3 子模块 group 机制**：需正确配置 registry + manifest + menu group（同 reconciliation/cross-chain 模式）；③ **状态机双映射**：策略 4 态 + 交易 8 态，需统一定义常量；④ **动态下拉**：stablecoin/blockchain 双下拉在多页面复用，需抽 query hook；⑤ **walletTypeTable**：url=null 的占位 mock 表格，需保留 mock 空态但不发请求 |
| 建议负责人 | 中级前端（表单逻辑复杂，但无文件下载/审批流/嵌套抽屉等极端复杂度） |

---

## 5. 迁移后目标文件清单

```text
libs/modules/interest/
├── data-access/
│   └── src/lib/
│       ├── interest.model.ts          # 类型定义（策略/计息/交易 三大域）
│       ├── interest.api.ts            # API 函数（17 endpoint）
│       └── +queries/
│           ├── interest.keys.ts       # Query key 工厂
│           ├── interest.queries.ts    # 查询 hooks（useInterestPolicyList/useInterestDetail/useAccrualRecordList...）
│           └── interest.mutations.ts  # 写操作 hooks（useSaveInterestPolicy/useEditInterestPolicy/useOperateInterest...）
├── feature/
│   └── src/lib/
│       ├── policy-list-page.tsx            # 策略列表（双 Tab，各自 DataTable）
│       ├── policy-detail-page.tsx          # 策略详情（双 Tab：基本信息 + 操作记录）
│       ├── policy-deposit-edit-page.tsx    # 存款策略编辑/新建（复杂表单）
│       ├── policy-overdraft-edit-page.tsx  # 透支策略编辑/新建
│       ├── accrual-list-page.tsx           # 计息记录列表
│       ├── accrual-detail-page.tsx         # 计息记录详情（条件表格渲染 feeType===50）
│       ├── transactions-list-page.tsx      # 计息交易列表（Post/Reset 操作）
│       ├── transactions-detail-page.tsx    # 计息交易详情（双 Tab）
│       ├── policy-deposit-edit-content.tsx # 存款编辑表单内容（拆 content 避免 nx lazy 误报）
│       ├── policy-overdraft-edit-content.tsx # 透支编辑表单内容
│       └── module-manifest.ts             # 三子模块 manifest（policy/accrual/transactions）
├── ui/
│   └── src/lib/
│       ├── interest-status-badge.tsx  # 策略/交易状态 Badge 组件
│       ├── interest-rate-display.tsx  # 利率展示组件（正负号 + %）
│       ├── interest-tier-table.tsx    # 分段利率表格展示组件（detail 页用）
│       └── interest-empty-wallet.tsx  # walletTypeTable 空态组件
└── util/
    └── src/lib/
        └── interest.constants.ts      # 状态映射/权限码/枚举常量/ALL_VALUE
```

**子模块变体**：`policy` / `accrual` / `transactions` 三个子模块共享同一 `libs/modules/interest/` 库，
feature 层用子模块前缀区分（`{sub}-list-page.tsx`），data-access/ui/util 共用。

**拆分 content 文件原因**：`policy/deposit/edit.tsx`（829 行）和 `policy/overdraft/edit.tsx`（382 行）含大量 JSX，
拆 content 文件可让 page shell 用 `next/dynamic` lazy load，避免 nx 构建误报 chunk 错误（历史踩坑）。

---

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query + `react-hook-form` |
| `Form` / `Form.Item` / `Form.useForm` / `Form.List` | `react-hook-form` + `useForm` + `useFieldArray` + `FormField` / `FormSelect` |
| `Form.useWatch` | `react-hook-form` `useWatch` |
| `Input` | `@myorg/shared/ui` Input |
| `InputNumber` | `@myorg/shared/ui` InputNumber 或 Input type=number |
| `Select` | `@myorg/shared/ui` Select / `FormSelect` |
| `DatePicker` / `DatePicker.RangePicker` | `FormDatePicker` / DatePicker 组件 |
| `TimePicker` | TimePicker 组件 |
| `Radio.Group` | `@myorg/shared/ui` RadioGroup |
| `Button` | `@myorg/shared/ui` Button |
| `Tag` | Tailwind badge / Badge 组件 |
| `Tabs` | `@myorg/shared/ui` Tabs |
| `Spin` | Loading 组件 / Suspense |
| `Tooltip` | `@myorg/shared/ui` Tooltip |
| `Card` | `@myorg/shared/ui` Card |
| `QuestionCircleOutlined` | 内联 SVG icon 或 icon 库 |
| `CustomIBasicDetailsInfo` | `DescriptionList` 或自定义 KV 列表组件（Card + grid） |
| `CustomTableTitle` | 页面内 title + Button（无独立组件，直接写 JSX） |
| `useHook(['interest'])` + `t('key')` | `useTranslations('modules.interest')` + 相对 key |
| `getServerSidePropsResult` + `serverSideTranslations` | 无需迁移（目标 CSR/SPA） |

### 6.1 状态/枚举映射

> 数据来源：`extract-module-meta.sh` 的 `STATUS_ENUMS` + i18n JSON 文件。

**策略状态**（policy/index.tsx:19 + policy/view.tsx:17，两处键值完全相同，合并为一个常量）：
```typescript
export const POLICY_STATUS_MAP = {
  1: { label: 'interest_status_1', color: 'processing' },    // Processing
  5: { label: 'interest_status_5', color: 'gray' },          // Unactivated
  10: { label: 'interest_status_10', color: 'success' },     // Active
  15: { label: 'interest_status_15', color: 'gray' },        // Inactive
} as const;
```

**交易状态**（transactions/index.tsx 和 view.tsx 用 `common_task_status_${status}` + `approval_task_status_color_${status}`，来自 common namespace）：
```typescript
export const TRANSACTION_STATUS_MAP = {
  1:  { label: 'interest_list_transaction_status_1',  color: '' },  // Pending Posting
  5:  { label: 'interest_list_transaction_status_5',  color: '' },  // Pending Approval
  10: { label: 'interest_list_transaction_status_10', color: '' },  // Under Approval
  15: { label: 'interest_list_transaction_status_15', color: '' },  // Rejected
  20: { label: 'interest_list_transaction_status_20', color: '' },  // Approved
  30: { label: 'interest_list_transaction_status_30', color: '' },  // Processing
  35: { label: 'interest_list_transaction_status_35', color: '' },  // Success
  40: { label: 'interest_list_transaction_status_40', color: '' },  // Failed
} as const;
```

注：颜色通过 `t('approval_task_status_color_${status}')` 从 common namespace 获取，不硬编码。

**计息类型**（feeType）：
```typescript
export const FEE_TYPE_MAP = {
  50: 'interest_list_feeType_50',  // Deposit Interest
  60: 'interest_list_feeType_60',  // Overdraft Interest
} as const;
export const FEE_TYPE_OPTIONS = [
  { value: '50', label: 'interest_list_feeType_50' },
  { value: '60', label: 'interest_list_feeType_60' },
];
```

**账户类型**（accountType）：
```typescript
export const ACCOUNT_TYPE_MAP = {
  1: 'interest_account_type_1',  // Current account
  2: 'interest_account_type_2',  // Savings account
} as const;
```

**计息计算方法**：
```typescript
export const CALCULATION_METHOD_MAP = {
  1: 'interest_method_1',  // Whole Balance Method
  2: 'interest_method_2',  // Partial Balance Method
} as const;
```

**操作类型**（policy operation records）：
```typescript
export const OPERATION_TYPE_MAP = {
  1: 'interest_operation_type_1',  // Add
  2: 'interest_operation_type_2',  // Edit
  3: 'interest_operation_type_3',  // Activate
  4: 'interest_operation_type_4',  // Deactivate
} as const;
```

**ALL_VALUE**（"全部"选项占位，必须非空，不能 `''`）：
```typescript
export const ALL_VALUE = 'all';
```

### 6.2 权限码映射

> 数据来源：`extract-module-meta.sh` 的 `LIMIT_PERMISSIONS`（10 个唯一码）。

| 权限码 | 用途 | 使用页面 |
|--------|------|----------|
| `1533a5824226411c902baf02a632b56f` | 新建策略 | policy/index.tsx（两个 Tab 的 Add 按钮） |
| `a572edeedf814f4fca76e40acf822c11b` | 查看策略 | policy/index.tsx（两个 Tab 的 View action） |
| `7d94af987806492b8c2dbe604847da6e` | 编辑策略 | policy/index.tsx（两个 Tab 的 Edit action） |
| `5bf84826d7da49a6a0a650613935d32c` | 停用策略 | policy/index.tsx（两个 Tab 的 Disable action） |
| `a6fc701d44f94121b0b9d0dcc698cea7` | 启用策略 | policy/index.tsx（两个 Tab 的 Enable action） |
| `cdd57472f91e449fac71b6372fd38aa2` | 查看计息记录 | accrual/index.tsx（View action） |
| `b1bd494af08a49dabf9aa7b9cabcd954` | 查看交易 | transactions/index.tsx（View action） |
| `6975b7173e03428aa538cb923cdf1ba5` | 过账 | transactions/index.tsx（Post action） |
| `73ea065245de44d5bc66ded0c7a2295b` | 重试 | transactions/index.tsx（Reset action） |
| `e338a3b41c21413db1d2ac7a90a65f5f` | 查看审批详情 | policy/view.tsx + transactions/view.tsx（操作记录 View action） |

### 6.3 跨模块跳转

> 数据来源：`extract-module-meta.sh` 的 `CROSS_MODULE_ROUTES`。

| 目标路由 | 触发场景 | 携带参数 |
|----------|----------|----------|
| `/approval-manage/view` | policy/view.tsx + transactions/view.tsx 操作记录 View action | `id=data.taskId, busCode=data.busCode` |
| `/interest/accrual/view` | accrual/index.tsx View action | `id=data.accrualRecordId, tokenId=data.tokenId, feePeriod=data.feePeriod, feeType=data.feeType` |
| `/interest/policy/deposit/edit` | policy/index.tsx Tab2（存款）新建/编辑 | 新建无 id；编辑 `id=data.interestRuleId` |
| `/interest/policy/overdraft/edit` | policy/index.tsx Tab1（透支）新建/编辑 | 新建无 id；编辑 `id=data.interestRuleId` |
| `/interest/policy/view` | policy/index.tsx 两个 Tab View action | `id=data.interestRuleId` |
| `/interest/transactions/view` | transactions/index.tsx View action | `id=data.tokenBillId` |

---

## 7. 迁移步骤

1. **建库 + 注册**（scaffold）：Nx generator 创建 `interest` 模块四层（data-access / feature / ui / util）。
   在 `module-registry.ts` 注册 policy/accrual/transactions 三个子模块 entry（group 模式，同 reconciliation）。
   在 i18n messages 新增 `modules/interest.json`（搬迁老项目 `public/locales/en-US/interest.json` 全部 key，ICU `{{}}` → `{}`）。
   在 `apps/admin/tsconfig.json` 登记 paths。

2. **类型定义**（scaffold）：`interest.model.ts` — 策略（InterestRule/InterestRuleListParams/InterestRuleDetail）、
   计息记录（AccrualRecord/AccrualRecordListParams/AccrualRecordDetail/AccrualHistoryItem）、
   交易（TokenBill/TokenBillListParams/TokenBillDetail/TransactionRecord/TransactionOperationRecord）、
   公共（BlockchainOption/StablecoinOption/表单类型）。

3. **API + Query hooks**（scaffold）：`interest.api.ts` — 17 个 API 函数。
   `interest.keys.ts` — Query key 工厂。
   `interest.queries.ts` — 查询 hooks（含 useStablecoinOptions/useBlockchainOptions 共享下拉 hook，带 select 过滤空 id）。
   `interest.mutations.ts` — 写操作 hooks（useSaveInterestPolicy / useEditInterestPolicy / useOperateInterest / usePostTransaction / useRetryTransaction）。

4. **常量**（scaffold）：`interest.constants.ts` — 全部状态映射 + 权限码 + ALL_VALUE='all'。

5. **UI 组件**（page）：`interest-status-badge.tsx` + `interest-tier-table.tsx` + `interest-rate-display.tsx` + `interest-empty-wallet.tsx`。

6. **策略列表页**（page）：`policy-list-page.tsx` — 双 Tab DataTable，各自筛选+表格+action（View/Edit/Disable/Enable），权限控制，Create 按钮跳不同 edit 路由。**注意**：Tab1（透支计息）`disabled: true`。

7. **策略详情页**（page）：`policy-detail-page.tsx` — 双 Tab（基本信息 KV 列表 + 操作记录 DataTable）。根据 `interestType===2` 切换基本信息展示（分段利率 vs 全额利率）。含 `calculateDayMonth` 序数词后缀逻辑。操作记录 View action 跳 `/approval-manage/view`。walletTypeTable 保留为空态占位。

8. **存款策略编辑页**（page，最复杂）：`policy-deposit-edit-page.tsx` + `policy-deposit-edit-content.tsx` —
   react-hook-form + useFieldArray（分段利率）。三区块：策略配置（双计算方式切换 + 利率正负号 + 生效日期）→ 日计息（TimePicker）→ 月计息应用（Day Select + TimePicker）。
   新建/编辑双模式 + 数据回填（利率正负号逆向解析）。表单校验：正则 `^[0-9]+(.[0-9]{1,2})?$` + 交叉校验（min<max + min≥前max）。

9. **透支策略编辑页**（page）：`policy-overdraft-edit-page.tsx` + `policy-overdraft-edit-content.tsx` —
   简化版表单（无分段利率、无计算方式切换）。三区块结构同存款版但更简单。文案 "Deposit"→"Overdraft" 替换。

10. **计息记录列表页**（page）：`accrual-list-page.tsx` — DataTable + 动态下拉（stablecoin/blockchain）。View action 带 4 参数跳转。

11. **计息记录详情页**（page）：`accrual-detail-page.tsx` — 基本信息 KV + 条件表格（feeType===50 存款表 / 否则透支表（多 billType 列+isCopy:false））。初始值注入 tokenId+feePeriod+feeType。

12. **计息交易列表页**（page）：`transactions-list-page.tsx` — DataTable + Post/Reset action（含 Spin loading + Success message）。8 态筛选。

13. **计息交易详情页**（page）：`transactions-detail-page.tsx` — 双 Tab（基本信息+明细表 / 操作记录）。操作记录 View action 跳 `/approval-manage/view`。

14. **i18n 补全**：搬迁 interest.json 全部 160+ key，ICU 语法转换。确保 `modules/interest.json` 作为 namespace。

15. **静态验证**：`pnpm nx lint interest` / `pnpm nx test interest` / `pnpm nx build interest` + tsc 零新增错误。**+ 运行时坑 grep 拦截**：ALL_VALUE 非空、i18n 无双重点缀、ICU 单花括号、SelectItem value 非空。

---

## 8. 风险与注意事项

- **deposit/edit.tsx 正负号编码**：新建时 `selectType === 'add' ? rate : '-' + rate`，编辑回填时 `rate.indexOf('-') > -1` 判断正负。目标实现时需精准还原此逻辑，否则利率回显错误。
- **分段利率交叉校验**：`minValue < maxValue` + 当前 `minValue ≥ 上一行 maxValue`。校验依赖 `form.getFieldValue('saveDetails')` 取当前状态，react-hook-form 中需用 `watch` 或 `getValues`。
- **双 useCustomTable 同 endpoint**（accrual/view.tsx）：两个表格调同一 URL `accrual/record/history/list`，仅列配置不同（一个有 billType 列，一个没有）+ `isCopy: false`。迁移时需注意 TanStack Query key 去重。
- **walletTypeTable**（policy/view.tsx）：`url: null` + `dataSource: []` + 硬编码筛选/列 + 自定义 emptyText。这是一个**明确的后端未就绪占位**，不调 API。迁移时保留空态 UI，不发请求（同 reconciliation 的 adjustments 子系统处理方式）。
- **Tab disabled**（policy/index.tsx）：透支计息 Tab `disabled: true` 使其不可点击，但代码完整存在。推测业务上暂未启用透支计息。迁移时保留 disabled 状态。
- **transactions status 45**（Deleted）：下拉选项中被注释掉（`// { value: '45', label: t('interest_list_transaction_status_45') }`），列表页不展示该状态。常量定义中保留 45 注释。
- **accrual feeTypes 数组未使用**（accrual/view.tsx:18）：`const feeTypes = [10, 35, 40]` 定义了但未在文件中使用，推测为预留或历史代码。迁移时不保留。
- **动态下拉 disabled 逻辑**（blockchain list）：`el.status === 1 ? false : true` — status===1 的链可用，否则 disabled。需在选项 map 中保留 disabled 属性（FormSelect option.disabled）。
- **approval_task_status_color 来自 common namespace**：老项目用 `t('approval_task_status_color_${status}')` 从 common 取颜色。目标需确认 common namespace 是否已有对应 key，若无则需补充或在 interest constants 中硬编码颜色映射。
- **利率百分比展示**：老项目 `annualInterestRate + '%'` 直接拼接，未做格式化。目标可保持一致或加 `toFixed(2)`。
- **运行时坑清单**（阶段四 verify grep 拦截 + 阶段五跑应用冒烟）：
  - `ALL_VALUE` 必须非空（`'all'` 非 `''`），否则 `SelectItem value=""` 崩溃
  - i18n key 无双重点缀（页面 `useTranslations('modules.interest')` 已在 namespace，常量 labelKey 用相对 key）
  - ICU `{{}}` → `{}`（老项目 i18next → 目标 next-intl）
  - list 请求体含 `pageNum`（非 `page`）
  - 下拉数据过滤空 id（stablecoin/blockchain 可能返回空 `stablecoinId`/`key`）
  - `FormSelect` 的"全部"选项用 `ALL_VALUE='all'`（非 `''`），手写 `SelectItem` 场景自检
- **已知限制**：① walletTypeTable（policy/view.tsx）为后端未就绪占位，迁移后仍为空态；② 透支计息 Tab（policy/index.tsx）`disabled: true`，功能未开放；③ `approval_task_status_color_*` 依赖 common namespace 已有定义，若无则需补 common i18n 或改用硬编码颜色。

---

## 9. 验收标准

- 策略列表页双 Tab 可切换（透支 disabled），筛选/分页正常，action（View/Edit/Disable/Enable）正确调 API 并有反馈
- 策略详情页基本信息字段完整（interestType===2 时分段利率正确渲染，序数词后缀逻辑正确），操作记录列表可筛选+分页，View 跳审批管理正确
- 存款策略编辑/新建表单：双计算方式切换（全额 ↔ 分段），全额模式利率校验+正负号，分段模式 Form.List 添加/删除/交叉校验，新建/编辑双模式数据回填正确，提交 payload 格式正确
- 透支策略编辑/新建表单：简化版表单功能完整，文案正确替换为 Overdraft
- 计息记录列表页筛选+动态下拉（stablecoin/blockchain）正常，View 带 4 参数跳转详情
- 计息记录详情页基本信息完整，feeType===50 条件渲染正确表格，feeType!==50 渲染含 billType 列表格
- 计息交易列表页 Post/Reset action 正确调 API，Spinning loading + Success message 正常
- 计息交易详情页双 Tab 正常，明细表筛选+分页正常，操作记录 View 跳审批正确
- 所有文案 i18n 化，ICU 语法正确（单花括号），无 MISSING_MESSAGE / INVALID_MESSAGE
- 权限码控制正确（10 个权限码对应按钮/action）
- 状态 Tag 颜色与老项目一致（策略 4 态 + 交易 8 态）
- walletTypeTable 空态正确显示（不调 API，不报错）
- 运行时 SelectItem 无空串崩溃（ALL_VALUE='all'，下拉数据过滤空 id）
- `pnpm nx lint interest` 零错误 / `pnpm nx test interest` 全绿 / build 通过

---

## 生成 Agent（阶段一）的操作约束

1. **先跑脚本**：`extract-module-meta.sh` 产出 8 文件 3064 行、17 endpoint、10 权限码、6 跨模块路由。
2. **Read 全部 8 源文件 + i18n JSON**：逐文件全文阅读，判断业务逻辑（已执行）。
3. **状态映射完整搬运**：`STATUS_ENUMS` 的 `approvalTaskStatus`（两处完全相同→合并）+ 交易 8 态 + 计息类型 + 账户类型 + 计算方法 + 操作类型。
4. **输出路径**：`.codex/plan/modules/interest.md`。
5. **自检**：对照迁移率校验四维度预检——源文件 8/8 ✓、API 17/17 ✓、页面 8/8 ✓、UI 映射（状态枚举 6 类 + 权限码 10 + 跨模块路由 6）全部覆盖。
