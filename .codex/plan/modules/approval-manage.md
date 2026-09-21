# Approval Management（approval-manage）模块迁移计划（td-manage → admin-platform）

> 源：`/Users/zhangxuefeng/reddate/poc/td-manage/src/pages/approval-manage/*`（28 文件 / 7342 行 / 2 路由页 + 25 审核组件 + 4 api/util 依赖文件）。
> 目标：`libs/modules/approval-manage/`（Nx 四层 util/data-access/ui/feature，**单一库，单模块入口**，feature 层按业务域分子目录）。
> 完成定义：页面不报错（curl SSR 200 + 4 层 lint + app tsc 本模块零错）+ 功能完整（三 Tab 列表 / dispatcher 按 busCode 渲染 / 审批操作 4 种 / MetaMask 签名或降级 / 权限 1:1 映射）。
> 复用既定模式：[[wallet-migration]]（分组路由 dispatcher）、[[tokenized-deposit-migration]]、[[cross-chain-migration]]、[[pledge-migration]]、[[posting-engine-migration]]、[[suspense-adjustment-migration]]。

---

## 0. 模块本质与拓扑决策（关键，先读）

**approval-manage 不是独立业务，是横切所有业务的「审批中心」**。它消费全平台所有模块发起的审批单：
`view.tsx`（1074 行）是一个 **dispatcher**——读取 URL `?id={taskId}&busCode={businessCode}`，按 `busCode`（30+ 种）分发到 25 个业务审核组件渲染左侧业务详情，右侧统一渲染审批操作区（通过/驳回/退回上一步/升级转办 + 可选 MetaMask 签名 + Steps 审批日志）。

这决定了三件事：
1. **大量复用已迁移模块**：25 个审核组件的字段语义来自 tokenized-deposit / wallet / cross-chain / pledge / financial 系列 / key-management，**不重新建类型，从对应已迁移模块 import model/ui**，本模块只新增审批专属类型（task / approvedDetail / approveForm / approvalLog）。
2. **单库单模块入口**：与 wallet 的「分组模块」不同，approval-manage 在源菜单是单条 `/approval-manage`，因此走**顶层模块**模式（非 group）。但 `view.tsx` 1074 行 + 25 个审核组件需拆 feature 子目录。
3. **dispatcher 是核心难点**：busCode 分发是 if-else 长链（~40 个精确 busCode + 4 组 financial 模糊匹配 `startsWith`/`includes`，顺序敏感），四套 status 字段派生（applyStatus/operateStatus/state/status/taskStatus），升级 Drawer 跨页选人去重，MetaMask 签名 RSV 注入。

**路由决策**：顶层模块 `approval-manage`，registry 注册 pages `{ list, detail }`（`list`=`index.tsx` 三 Tab；`detail`=`view.tsx` dispatcher，detail 按 query.id/busCode 渲染）。不进 group。

---

## 1. 业务概述

审批中心（Approval Center）是横切全平台所有业务的统一审批入口，**核心业务实体**是「审批任务（task）」，由后端工作流引擎按各业务域提交的 `busCode` 生成。

- **主要操作**：
  - **列表查询**：三个 Tab——待审批（queryTodoList）/ 已审批（queryCompletedList）/ 我发起的（queryCreateList），第三个 Tab 支持「撤回」（withdraw）。
  - **审批详情**：进入 `/approval-manage/view?id=&busCode=`，dispatcher 按 busCode 渲染对应业务详情（25 个审核组件之一），右侧展示审批操作区。
  - **审批操作（4 种）**：通过/驳回（mult/approval/process，可选 MetaMask 签名注入 RSV）/ 退回上一步（previousStep）/ 升级转办（addTaskApproveUser，Drawer 跨页选人）。
- **页面构成**：1 列表页（三 Tab）+ 1 详情页（dispatcher + 25 审核组件 + 审批操作区 + Steps 日志 + 2 个 Modal/Drawer）。
- **特殊业务规则**：busCode 分发链含 4 组 financial 模糊匹配（顺序敏感）；四套 status 字段派生逻辑（applyStatus / operateStatus / state+taskStatus）；MetaMask 签名 `message=(busCode+taskId+approve+remarks).replaceAll(' ','').toLowerCase()`，type=1 签 hash；升级 Drawer 选人跨页去重（removeKeys + Set）。

---

## 2. 源文件清单

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES`（28 文件，全列）。用途列由 Agent 读源码判断。`total_lines: 7342`，`api_module_files: 4`。

| 文件（相对模块） | 行数 | 用途 |
|------|------|------|
| `index.tsx` | 428 | **列表页**：三 Tab（待审批/已审批/我发起），3 个动态 URL 列表 + 撤回 Modal（CustomModal+CustomForms remarks） |
| `view.tsx` | 1074 | **详情 dispatcher + 审批操作区**：按 busCode 分发 25 审核组件 + approve/remarks 表单 + MetaMask 签名 + 退回 Modal + 升级 Drawer + Steps 日志 |
| `components/CustomInformation.tsx` | 82 | **共享 UI 原语**：通用只读详情渲染壳（detailsInfo 两层嵌套数组，isTable 横/纵布局切换，showBorder 分隔线），25 审核组件复用 |
| `components/token.tsx` | 268 | **审核组件**：TokenApproval（TD 主单据 Create/Update，type 驱动新旧差异+状态字段 applyStatus/operateStatus） |
| `components/mint.tsx` | 117 | 审核组件：MintApproval（增发，绿色 `+`，createUser+status） |
| `components/melt.tsx` | 148 | 审核组件：MeltApproval（销毁，红色 `-`，与 mint 对称） |
| `components/createWallet.tsx` | 117 | 审核组件：CreateWalletApproval（用户钱包新建，walletType 直显） |
| `components/updateAdminWallet.tsx` | 119 | 审核组件：UpdateAdminWalletApproval（字段命名独特：tokenName/blockChain/createdBy/createdOn，walletType 走 `admin_wallet_type_` 映射） |
| `components/userWallet.tsx` | 123 | 审核组件：UserWalletApproval（type 驱动 `user_wallet_task_type_`，多 remarks 字段） |
| `components/funds.tsx` | 132 | 审核组件：FundsApproval（资金操作，reSet 金额格式化 + operationCount/stablecoinCount） |
| `components/walletType.tsx` | 622 | 审核组件：WalletTypeApproval（钱包类型 Create/Update + MMF 分支 issueType=20，透支/利率三区块条件渲染，`∞` 魔数 99999999999） |
| `components/updateWalletType.tsx` | 143 | 审核组件：UpdateWalletTypeApproval（SP 钱包类型变更，new/oldWalletType 并列，status 字段） |
| `components/top-up.tsx` | 152 | 审核组件：TopUpApproval（稳定币充值/铸造，绿色 `+`，reserve 资产字段） |
| `components/withdrawal.tsx` | 147 | 审核组件：WithdrawalApproval（稳定币提现/赎回/销毁，红色 `-`，与 top-up 对称） |
| `components/serviceProvider.tsx` | 521 | 审核组件：ServiceProviderApproval（SP 注册/编辑，新旧差异 renderUpdatedValue + tdList 折叠卡片 + Business License 文件下载） |
| `components/reserve-asset.tsx` | 106 | 审核组件：ReserveAssetApproval（储备资产，operateTypeMap，Edit 显示新旧类别） |
| `components/reserve-asset-transaction.tsx` | 110 | 审核组件：ReserveAssetTransactionApproval（储备资产交易，Inflow/Outflow 红绿，Intl.NumberFormat） |
| `components/monitoring-rule.tsx` | 245 | 审核组件：MonitoringRuleApproval（监控规则，阈值区间表新旧差异，risk_level 动态 i18n） |
| `components/monitoring-result-process.tsx` | 185 | 审核组件：MonitoringResultProcessApproval（监控结果处理，businessType 50/40 条件渲染当前/对比值） |
| `components/interest-rule.tsx` | 272 | 审核组件：InterestRuleTypeApproval（利息规则，计息日序数词本地化+阶梯利率表，疑似 bug：`oldCalculateDayMonth!==calculateTimeMonth`） |
| `components/interest-fee.tsx` | 146 | 审核组件：InterestFeeApproval（利息费用/Posting，文件下载 Blob，Spin 加载态） |
| `components/token-pair.tsx` | 166 | 审核组件：TokenPairApproval（跨链代币对，ArrowRightCircleIcon 箭头布局 + blockchain_code_color 色块） |
| `components/liquidity-pool.tsx` | 201 | 审核组件：LiquidityPoolApproval（跨链流动性池，多处 operationType=2 新旧差异，疑似 bug：`numberOriginal!==emailRecipientsOriginal`） |
| `components/settlement.tsx` | 124 | 审核组件：SettlementApproval（MMF settlement，固定 Create，跨 4 namespace，createBy 字段名） |
| `components/financial-coa.tsx` | 541 | 审核组件：FinancialCoaApproval（COA，mapOperationType 三级推断，原生 table 渲染 assets/liabilities 分组） |
| `components/financial-normalization.tsx` | 373 | 审核组件：FinancialNormalizationApproval（规范化规则，依赖 tx-event-config mock 枚举，FIELD_LABEL_KEY_MAP 15 项） |
| `components/financial-posting-rule.tsx` | 410 | 审核组件：FinancialPostingRuleApproval（过账规则，与 normalization 高度同构，status 20/35→PUB_Succeed 特殊态，DEFAULT_AMOUNT_EXPRESSION） |
| `components/financial-suspense-adjustment.tsx` | 270 | 审核组件：FinancialSuspenseAdjustmentApproval（**唯一调 API 的组件**，fetchSuspenseAdjustmentDetail，依赖 adjustments 模块 adapter） |

> 注：`extract-module-meta.sh` 的 `total_files: 28` 仅统计了 `src/pages/approval-manage/` 下 28 个文件；`api_module_files: 4` 是 page 外的依赖（approval-manage.ts / common.ts / workflow.ts / adjustments/api.ts），其行数未计入 7342，迁移时需一并处理（见 §3）。

---

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS` + `SHARED_IMPORTS`。脚本 `from page literals` 段抓到 `(none)`——**这是脚本误判**：index.tsx 的三个列表 URL 是 `${NEXT_PUBLIC_CONFIG_ID}v1/task/xxx` 动态拼接，脚本静态扫描抓不到，**必须人工补全**。`from api modules` 段抓到的 15 个静态 URL 是真实的。按用途分 7 组。

### 3.1 列表 API（index.tsx 三 Tab，**全部动态拼接 URL，脚本漏抓**）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `${NEXT_PUBLIC_CONFIG_ID}v1/task/queryTodoList` | POST | `index.tsx` Tab1 `useCustomTable.url` | 待审批列表（动态前缀，脚本抓不到） |
| `${NEXT_PUBLIC_CONFIG_ID}v1/task/queryCompletedList` | POST | `index.tsx` Tab2 | 已审批列表（动态前缀） |
| `${NEXT_PUBLIC_CONFIG_ID}v1/task/queryCreateList` | POST | `index.tsx` Tab3 | 我发起的列表（动态前缀） |

> **迁移要点**：三 Tab 走动态 `${CONFIG_ID}v1/task/*` 前缀；列表行 rowKey 不一（Tab1/3=`taskId`，Tab2=`detailId`）；序号列 dataIndex 源用 `businessName`（疑似 bug，迁移建议纠正）；Tab3 比 1/2 少 `approvalTime` 列；状态 Tab1/2 用 `approvalStatus`+`common_approval_status_${status}`，Tab3 用 `taskStatus`+`common_task_status_${status}`+`approval_task_status_color_${status}`。

### 3.2 审批核心 API（mult/approval/* + task/*，view.tsx 调用）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/mult/approval/detail` | POST | `view.tsx` approvedDetailApi | 拉取单据业务内容 businessContent（detailInfo），进页+审批后刷新 |
| `/api/manage/v1/mult/approval/process` | POST | `view.tsx` multApprovalProcessApi | 通过/驳回，携带签名 RSV，**Header `Bus-Trace-ID`=transCode（非 body）** |
| `/api/manage/v1/mult/approval/previousStep` | POST | `view.tsx` approvalPreviousStepApi | 退回上一步（Modal remarks 必填） |
| `/api/manage/v1/mult/approval/withdraw` | POST | `index.tsx` approvalWithdrawApi | Tab3 撤回我发起的单据 |
| `${NEXT_PUBLIC_CONFIG_ID}v1/task/addTaskApproveUser` | POST | `view.tsx` addTaskApproveUserApi | 升级转办（动态前缀，nodeOrderType+approveUserIdList+reason） |
| `${NEXT_PUBLIC_CONFIG_ID}v1/task/listTaskApproved` | POST | `view.tsx` taskApprovedDetailApi | 审批日志 taskCreateInfo+recordList+approveType+taskStatus（动态前缀） |

> **迁移要点**：5 个审批 API 分两类前缀——4 个固定 `/api/manage/v1/mult/approval/*`（detail/process/previousStep/withdraw）+ 2 个动态 `${CONFIG_ID}v1/task/*`（addTaskApproveUser/listTaskApproved）。`multApprovalProcessApi` 是唯一带自定义 Header 的接口，header 透传不能丢。

### 3.3 工作流复用 API（workflow.ts，跨模块耦合点）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `${NEXT_PUBLIC_CONFIG_ID}v1/common/user/list` | POST | `view.tsx` workflowUserListApi（升级 Drawer 选人）；sys/workflow/edit.tsx 复用 | 用户下拉列表（动态前缀，approval-manage 仅复用此一个） |

> **迁移要点**：`workflow.ts` 是 sys 工作流配置模块的 API 层，但 `workflowUserListApi` 被 approval-manage 复用——迁移时**保留 workflowUserListApi 或抽到公共位置**（`common/user/list` 本是通用接口）。不要把整个 workflow.ts 当 approval-manage 依赖迁移。其余 4 个（workflowAdd/Edit/Detail/ModifyStatus）归 sys 模块。

### 3.4 公共下拉数据源（common.ts）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `${NEXT_PUBLIC_FILE_ID}v1/sftp/download?busId=&busType=` | GET | serviceProvider.tsx / interest-fee.tsx downloadApi | 文件下载（Blob，Business License / Interest 文件），busId/busType 双兜底 |
| `/api/manage/v1/common/bank/list` | GET | common.ts（脚本抓到） | 银行下拉（间接依赖，reserve/sp 相关） |
| `/api/manage/v1/common/resources/search` | POST | common.ts | 资源/PDF 搜索 |
| `/api/manage/v1/common/tokenType/list` | GET | common.ts | tokenType 下拉 |

### 3.5 util/wallet 工具 API

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/util/wallet/keystore` | POST | common.ts（脚本抓到） | 生成钱包 keystore（间接，MetaMask/钱包相关） |

### 3.6 RBAC 用户 API（rbac 域，脚本抓到）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/rbac/v1/user/accessKey/get` | POST | common.ts | 用户 accessKey 获取（间接依赖） |
| `/api/rbac/v1/user/password/modify` | POST | common.ts | 修改密码（间接依赖） |

### 3.7 Finance Suspense Adjustment API（financial-suspense-adjustment.tsx 唯一调 API 的审核组件）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/finance/v1/finance/suspense-adjustment/detail` | POST | financial-suspense-adjustment.tsx fetchSuspenseAdjustmentDetail | 拉取完整 Suspense Adjustment 明细（adjustmentId 解析失败时降级用 detailInfo） |
| `/api/finance/v1/finance/suspense-adjustment/adjust` | POST | adjustments/api.ts（脚本抓到） | Suspense Adjustment 调整（间接） |
| `/api/finance/v1/finance/suspense-adjustment/entry-detail` | POST | adjustments/api.ts | 条目详情（间接） |
| `/api/finance/v1/finance/suspense-adjustment/list` | POST | adjustments/api.ts | 列表（间接） |

> **迁移要点**：`financial-suspense-adjustment.tsx` 是 25 审核组件中**唯一主动调 API 的**，强依赖 `@/lib/components/financial/adjustments/{api,adapters,helpers}` 与 `@/lib/components/reconciliation/adjustments`（ReconciliationCopyableText）——这些模块必须已迁移（suspense-adjustment 模块已迁移完成，见 memory）或复用目标库等价物。

### 3.8 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `useHook` / `CustomTableTitle` / `CustomForms` / `CustomModal`（来自 `libs/components`）。
- `formatTimestamp`（支持第二参数 `'date'`/`'dateutc'`）/ `reSet`（金额格式化）/ `getServerSidePropsResult`（来自 `libs/utils`）。
- `MeatmaskOrSign`（connectToMetamask / signMessage / convertTxHashToRSV，文件名拼写错误 Meatmask，来自 `@/lib/components/MeatmaskOrSign`，**横切工具，login/account/approval 三处共用，放公共 util**）。
- `antd`（Button/Collapse/Drawer/Form/Input/Radio/Spin/Steps/Table/TablePaginationConfig/Tooltip/Typography/Tag/Tabs/Checkbox/Image/Modal.confirm）。
- `@heroicons/react/20/solid`（ChevronDoubleDownIcon/ChevronDoubleUpIcon/QuestionMarkCircleIcon/XMarkIcon/ArrowDownTrayIcon）/ `@heroicons/react/24/outline`（ArrowRightCircleIcon）。
- `dayjs`（financial 组件时间格式化）。

---

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **高**（迄今最复杂的 dispatcher 型模块） |
| 困难分数 | 5/5 |
| 主要难点 | ① **view.tsx 1074 行 dispatcher**：~40 精确 busCode + 4 组 financial 模糊匹配（startsWith/includes，顺序敏感：posting/normalization/suspense-adjust/coa 必须在精确匹配后兜底）；② **四套 status 字段派生**（applyStatus/operateStatus/state+taskStatus/status，busCode 决定取哪个）；③ **MetaMask 签名链**（ethers v5 API，目标若 v6 需改写，message 拼接+type=1 签 hash+RSV 拆分+r==='0' 中止）；④ **升级 Drawer 跨页选人去重**（removeKeys + Array.from(new Set)，selectedRowKeys 累积）；⑤ **Steps 审批日志**（5 种 operationType 渲染、reviewerUserNameList>5 折叠 Tooltip、approvedCurrent 异步 setTimeout 计算）；⑥ **25 审核组件复用 6+ 已迁移模块**的 model/ui，耦合面极大；⑦ **10 个 i18n namespace** 需全注册；⑧ **动态 URL 脚本漏抓**（3 列表 + 2 task 接口） |
| 建议负责人 | 高级前端（dispatcher + MetaMask + 升级 Drawer 须资深；25 审核组件大量是只读展示，可中级+sonnet 批量） |

---

## 5. 迁移后目标文件清单

```text
libs/modules/approval-manage/
├── data-access/
│   └── src/lib/
│       ├── approval-manage.model.ts          # 审批专属类型（task/approvedDetail/approveForm/approvalLog/escalationDrawer）；业务字段类型从已迁移模块 import 复用
│       ├── approval-manage.api.ts            # 审批核心 API（detail/process/previousStep/withdraw/addTaskApproveUser/listTaskApproved）+ 三列表 URL + workflowUserList
│       └── +queries/
│           ├── approval-manage.keys.ts       # Query key 工厂（todo/completed/create/detail/log/userList）
│           ├── approval-manage.queries.ts    # 查询 hooks（三 Tab 列表 keepPreviousData、详情 enabled、日志）
│           └── approval-manage.mutations.ts  # process/previousStep/withdraw/addTaskApproveUser
├── feature/
│   └── src/lib/
│       ├── approval-manage-list-page.tsx     # 三 Tab 列表页（3 DataTable + 撤回 Modal）
│       ├── approval-manage-detail-page.tsx   # dispatcher（按 busCode 路由到 25 审核组件）+ 审批操作区 + Steps 日志 + 退回 Modal + 升级 Drawer
│       ├── approval-manage-operation-panel.tsx  # 审批操作区（approve/remarks 表单 + MetaMask 签名按钮 + 退回 + 升级触发）
│       ├── approval-manage-approval-log.tsx  # Steps 审批日志（operationType 5 态 + reviewerUserNameList 折叠）
│       ├── approval-manage-escalation-drawer.tsx  # 升级选人 Drawer（跨页去重）
│       ├── module-manifest.ts                # 菜单/路由/权限注册（list/detail 通用 key）
│       └── components/                       # 25 审核组件，按业务域分子目录
│           ├── shared/custom-information.tsx # 通用详情渲染壳（迁移 CustomInformation）
│           ├── tokenized-deposit/            # token / mint / melt
│           ├── wallet/                       # createWallet / updateAdminWallet / userWallet / funds / walletType / updateWalletType
│           ├── sp-reserve/                   # serviceProvider / reserve-asset / reserve-asset-transaction / top-up / withdrawal
│           ├── monitoring-interest/          # monitoring-rule / monitoring-result-process / interest-rule / interest-fee
│           ├── crosschain-settlement/        # token-pair / liquidity-pool / settlement
│           └── financial/                    # financial-coa / financial-normalization / financial-posting-rule / financial-suspense-adjustment
├── ui/
│   └── src/lib/
│       ├── approval-status-badge.tsx         # 审批状态 badge（统一 approvalStatus/taskStatus 多族）
│       ├── bus-code-dispatcher.tsx           # busCode→组件分发器（封装 dispatcher 长链，pure component）
│       └── approval-detail-grid.tsx          # kv 详情网格（替代 CustomInformation 的目标实现）
└── util/
    └── src/lib/
        ├── approval-manage.constants.ts      # 状态/权限/枚举/busCode 映射表（4 套 status 颜色合并、operationType 三级推断、FIELD_LABEL_KEY_MAP、EVENT_TYPE_SOURCE_EVENT_MAP、recordType 映射）
        ├── approval-manage.bus-code-map.ts   # busCode→审核组件 + busCode→type 映射（dispatcher 事实源）
        └── approval-manage.helpers.ts        # formatTimestamp(支持 date/dateutc) / reSet / hasValue / parseCommaSelection / renderUpdatedValue / normalizeTimestamp / convertTxHashToRSV（MetaMask）
```

**子模块变体说明**：25 审核组件是同一 detail page 的分支，**不拆成独立子模块**（共享 dispatcher、审批操作区、Steps），feature 层用业务域子目录区分（tokenized-deposit/wallet/sp-reserve/monitoring-interest/crosschain-settlement/financial）。data-access/ui/util 共用。

**复用策略（关键）**：
- **类型复用**：业务字段类型从已迁移模块 import——tokenized-deposit（TD/Mint/Melt）、wallet（walletType/userWallet/funds）、cross-chain（token-pair/liquidity-pool）、pledge（reserve-asset）、financial（coa/normalization/posting/suspense）、key-management。本模块 `model.ts` 只定义 `ApprovalTask` / `ApprovedDetail` / `ApproveForm` / `ApprovalLog` / `EscalationDrawer` 等审批专属类型。
- **UI 复用**：`CustomInformation`→目标 `approval-detail-grid.tsx`（posting-engine book-detail 模式）；`Typography.Paragraph copyable`→`CopyableEllipsisText`（journal 模式）；状态 badge→posting-engine `toneClass` 模式。
- **adapter 复用**：`financial-suspense-adjustment` 复用 suspense-adjustment 模块的 api/adapters/helpers（已迁移）；`financial-normalization`/`financial-posting-rule` 复用 transaction-event-config 模块的 EVENT_TYPE→SourceEventTypeKey 映射（已迁移，见 memory）。

---

## 6. UI 组件映射

### 6.1 状态码映射族（util/constants.ts，合并规则：键值相同合并）

> 状态色与文案高度依赖 i18n 命名空间（approval-manage/common/screening-monitoring/interest/cross-chain/financial 等），**颜色值不硬编码，由 `t('approval_task_status_color_${status}')` 动态返回**。以下为组件内硬编码/派生的映射，照搬键值。

| 常量名 | 定义 | 来源 | 合并说明 |
|--------|------|------|----------|
| `approvalStatus`（列表 Tab1/2 颜色） | `{1:'orange', 2:'error', 3:'success'}` | index.tsx:22 | 唯一，独立 |
| `tokenType`（view.tsx TD 操作类型） | `{td_new:1, td_edit_all:2, td_disable:4, td_enable:3}` | view.tsx:66 | 独立（busCode→type） |
| `walletType`（view.tsx 钱包类型操作） | `{td_add_wallet_type:1, td_edit_wallet_type:2, td_disable_wallet_type:4, td_enable_wallet_type:3}` | view.tsx:72 | 独立（与 tokenType 键值同构但 busCode 不同，分开） |
| `monitoringRuleType` | `{save_monitoring_rule:1, update_monitoring_rule:2, deactivate_monitoring_rule:4, activate_monitoring_rule:3}` | view.tsx:78 | 独立 |
| `interestRuleType` | `{save_interest_rule:1, update_interest_rule:2, activate_interest_rule:3, deactivate_interest_rule:4}` | view.tsx:84 | 独立 |
| `operateTypeMap`（reserve-asset） | `{0:'All', 1:'Add', 2:'Edit', 3:'Activate', 4:'Deactivate', 5:'Add Asset Category'}` | reserve-asset.tsx:30 | 独立 |
| `mapOperationType`（financial-coa 三级推断） | recordType 优先{3:Activate,4:Deactivate,2:Update,1:Create}→oldItem/newItem 存在性→busCode includes | financial-coa.tsx:52 | **与 normalization/posting 的 getOperationType 合并**（见下） |
| `getOperationType`（financial-normalization） | busCode includes(update/edit→Edit, activate/enable→Activate, deactivate/disable→Deactivate, create/save→Create)→recordType{2:Edit,3:Activate,4:Deactivate,1:Create} | financial-normalization.tsx:60 | 合并为统一 `inferOperationType(busCode, recordType, {oldItem,newItem})`，保留 busCode includes 全集 |
| `getOperationType`（financial-posting-rule） | busCode includes(update/edit→Update, create/save→Create)→recordType{2:Update,1:Create}（仅 2 态，无 Activate/Deactivate） | financial-posting-rule.tsx:70 | 合并时保留参数控制是否含 Activate/Deactivate（posting 用 2 态子集） |
| `recordType→operationType`（行级） | financial-coa: `{3:'Activate',4:'Deactivate',2:'Update',1:'Create'}`；行级 normalizeChanges: oldItem&&newItem→'Edit'，仅 newItem→'Add'，否则→'Delete' | financial-coa.tsx | 行级独立常量 |
| `EVENT_TYPE_SOURCE_EVENT_MAP` | `{1:'reserveIn',3:'fundingIn',5:'mint',10:'repositoryOut',15:'transfer',20:'repositoryIn',25:'melt',30:'reserveOut',35:'fundingOut'}` | financial-normalization.tsx + financial-posting-rule.tsx（**两处重复定义，合并为一个**） | 合并；复用 transaction-event-config mock |
| `FIELD_LABEL_KEY_MAP`（normalization 15 项） | `{UniversalTransactionIdentifier:'financial_0294', UserUniversalIdentifier:'financial_0295', TokenName:'financial_0004', ...}` | financial-normalization.tsx | 独立（与后端 targetField 强耦合） |
| `getMappingMethodLabel`（normalization 版，3 值） | GENERATE/3→financial_0208, DIRECT/1→financial_0161, CONSTANT/2→financial_0209 | financial-normalization.tsx:110 | **与 posting 版冲突**：posting 仅 {1,2} 无 GENERATE/3。**保留 normalization 全集**，posting 用子集（Rule 7：取更全的，不平均） |
| `getDirectionLabel`（posting Dr/Cr） | `{1:'Dr', 2:'Cr'}` | financial-posting-rule.tsx | 独立 |
| `getAccountLabel` / `formatAccountDisplay` | code/name 都空→`--`，否则 `${code||'--'} - ${name||'--'}` | financial-coa + posting | 合并为 `formatCodeName` |
| `RECONCILIATION_LABEL_MAP`（serviceProvider） | `{1:'Daily', 2:'Weekly', 3:'Monthly'}` | serviceProvider.tsx | 独立 |
| `PRIVATE_KEY_CUSTODY_OPTIONS` | `[{value:'1',label:'Issuer Custody'},{value:'2',label:'SP Custody'},{value:'3',label:'Self-Custody (End User)'}]` | serviceProvider.tsx | 独立（复用 tokenized-deposit/key-management 枚举） |
| `TRANSACTION_POLICY_OPTIONS` | `[{value:'1',label:'Via Current SP'},{value:'2',label:'Direct (End User)'}]` | serviceProvider.tsx | 独立 |
| `calculateDayMonth 序数词`（interest-rule） | `{1/21/31:interest_00128, 2/22:interest_00129, 3/23:interest_00130, 其他:interest_00131}` | interest-rule.tsx | 独立 |
| `Steps.status`（审批日志步骤条） | `status===3||15||40 ? 'error' : 'process'` | view.tsx | 独立 |
| `transactionDirection`（reserve-asset-transaction） | `===1→'Inflow'(绿+), 否则→'Outflow'(红-)` | reserve-asset-transaction.tsx | 独立 |
| `approvalTaskStatus`（suspense-adjustment） | `label==='Approved'→green, 否则→orange` | financial-suspense-adjustment.tsx:179 | 独立（与 i18n key 方式不同，保留） |

> **动态 i18n key（非硬编码，需确保 namespace 含词条）**：`token_type_${n}` / `common_task_status_${n}` / `common_approval_status_${n}` / `approval_task_status_color_${n}` / `service_provider_type_${n}` / `service_provider_types_${n}` / `admin_wallet_type_${n}` / `user_wallet_task_type_${n}` / `funds_task_type_${n}` / `wallet_type_task_type_${n}` / `td_operation_type_edit_${n}` / `monitoring_rule_type_${n}` / `transaction_monitoring_type_${n}` / `risk_level_type_${n}` / `risk_level_color_${n}` / `rule_action_${n}` / `suggested_action_type_${n}` / `interest_operation_type_${n}` / `interest_account_type_${n}` / `interest_list_feeType_${n}` / `token_pair_operation_type_${n}` / `liquidity_pool_operation_type_${n}` / `mmf_settlement_operation_type_${n}` / `mmf_fund_type_${n}` / `mmf_risk_level_${n}` / `maintenance_fee_call_type_${n}` / `blockchain_code_color_${n}` / `approve_type_${n}`。

### 6.2 busCode → 审核组件映射表（从 view.tsx dispatcher 完整提取）

> dispatcher 是 view.tsx 的 if-else 长链。下表为 busCode→组件+传入 type/props 的完整映射。**顺序敏感**：精确匹配在前，4 组 financial 模糊匹配在后兜底。

| busCode（精确匹配） | 组件 | type/props 备注 |
|------|------|------|
| `td_new` | TokenApproval | type=tokenType.td_new=1（status 取 applyStatus） |
| `td_edit_all` | TokenApproval | type=2（status 取 operateStatus） |
| `td_disable` | TokenApproval | type=4 |
| `td_enable` | TokenApproval | type=3 |
| `td_mint` | MintApproval | — |
| `td_melt` | MeltApproval | — |
| `td_admin_wallet_update` | UpdateAdminWalletApproval | — |
| `td_add_wallet_type` | WalletTypeApproval | type=walletType=1（state 字段；selectType 派生） |
| `td_edit_wallet_type` | WalletTypeApproval | type=2（selectType 派生） |
| `td_disable_wallet_type` | WalletTypeApproval | type=4 |
| `td_enable_wallet_type` | WalletTypeApproval | type=3 |
| `td_freeze_wallet` | UserWalletApproval | type=1（冻结），status 取 `status` 字段 |
| `td_unfreeze_wallet` | UserWalletApproval | type=2（解冻），status 取 `status` 字段 |
| `sp_open_wallet` | CreateWalletApproval | status 取 `status` 字段 |
| `td_freeze_wallet_td` | FundsApproval | type=1（冻结 TD 资金），status 取 `status` 字段 |
| `td_unfreeze_wallet_td` | FundsApproval | type=2（解冻 TD 资金），status 取 `status` 字段 |
| `td_change_wallet_type` | UpdateWalletTypeApproval | — |
| `td_register_sp` | ServiceProviderApproval | type=1（selectType 派生） |
| `td_edit_sp` | ServiceProviderApproval | type=2（selectType 派生） |
| `sp_buy_token` | TopUpApproval | 稳定币充值/铸造，status 取 `status` 字段 |
| `sp_withdraw_token` | WithdrawalApproval | 稳定币提现/赎回，status 取 `status` 字段 |
| `save_monitoring_rule` | MonitoringRuleApproval | type=monitoringRuleType=1 |
| `update_monitoring_rule` | MonitoringRuleApproval | type=2 |
| `deactivate_monitoring_rule` | MonitoringRuleApproval | type=4 |
| `activate_monitoring_rule` | MonitoringRuleApproval | type=3 |
| `token_monitoring_result_process` | MonitoringResultProcessApproval | — |
| `save_interest_rule` | InterestRuleTypeApproval | type=interestRuleType=1 |
| `update_interest_rule` | InterestRuleTypeApproval | type=2 |
| `activate_interest_rule` | InterestRuleTypeApproval | type=3 |
| `deactivate_interest_rule` | InterestRuleTypeApproval | type=4 |
| `approve_interest_fee` | InterestFeeApproval | — |
| `save_token_pair` / `update_token_pair` / `activate_token_pair` / `deactivate_token_pair` | TokenPairApproval | recordType 驱动 |
| `save_liquidity_pool` / `update_liquidity_pool` | LiquidityPoolApproval | operationType 驱动 |
| `apply_mmf_settlement` | SettlementApproval | — |
| `save_reserve_asset` / `save_reserve_asset_category` / `update_reserve_asset` / `activate_reserve_asset` / `deactivate_reserve_asset` | ReserveAssetApproval | opType 来自 URL `query.opType`（非 busCode 派生）；operateType 展示由 `detailInfo.operateType` 经 operateTypeMap 映射 |
| `save_reserve_asset_transaction` | ReserveAssetTransactionApproval | — |

**4 组 financial 模糊匹配（顺序敏感，必须在精确匹配后兜底）**：

| 匹配规则 | 组件 | 备注 |
|------|------|------|
| `startsWith('fin_coa_')` | FinancialCoaApproval | mapOperationType 三级推断 |
| `startsWith('fin_normalization_')` ‖ `includes('normalization')` ‖ `includes('mapping')` | FinancialNormalizationApproval | 5 props 全传（detailInfo/approvalInfo/taskInfo/approvalStatus/busCode） |
| `includes('posting')` | FinancialPostingRuleApproval | **判定过宽**（可能误匹配含 posting 的其他 busCode），迁移路由收窄 |
| `includes('suspense')` && `includes('adjust')` | FinancialSuspenseAdjustmentApproval | 仅传 detailInfo，唯一调 API |

### 6.3 权限码（util/constants.ts，源 LIMIT_PERMISSIONS）

| 权限码（源 UUID） | 用途 | 目标映射建议 |
|------|------|------|
| `82536c63366b40a586774192751e7060` | 列表行 View 操作（跳转详情） | `approval-manage:view`（语义化字符串集，posting-engine 模式） |
| `5f1c684ec8374caf9a8d5e4b1f26796a` | Tab3 Withdrawal 操作（撤回） | `approval-manage:withdraw` |

> 目标权限映射为 `useAuth().permissions` 字符串集（空集→全放行，同 wallet/posting-engine 模式），非 1:1 UUID。

### 6.4 组件映射（源 → 目标）

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` + `useCustomTable`（三 Tab） | `DataTable` + TanStack Query + `react-hook-form` |
| `CustomForms` + `CustomModal`（撤回/退回 remarks） | RHF `useForm` + `FormField` + shadcn `Dialog` |
| `Form` / `Form.Item` / `Form.useWatch`（approve/remarks/升级 Drawer） | `react-hook-form` + `useForm` + `FormField` / `FormSelect` |
| antd `Drawer`（升级选人） | shadcn `Sheet`/`Drawer`（45% 宽度） |
| antd `Steps`（审批日志） | 目标 Steps（实现期确认 `@myorg/shared/ui` 导出，否则简单 timeline） |
| antd `Collapse` | shadcn `Collapsible`/`Accordion` |
| antd `Table`（static，mapping/entry 表） | `DataTable`（financial normalization/posting 的 mapping 表） |
| antd `Radio`（approve/nodeOrderType） | shadcn `RadioGroup` |
| antd `Tag`（颜色） | `<span className="badge toneClass">`（posting-engine 模式） + util/constants 映射 |
| antd `Tabs`（三 Tab） | 目标 Tabs（实现期确认，否则 state tab） |
| antd `Typography.Paragraph copyable` | `CopyableEllipsisText`（journal 模式） |
| antd `Checkbox.Group`（disabled，serviceProvider） | shadcn `Checkbox`（disabled 群组） |
| antd `Input.TextArea`（readOnly，serviceProvider desc） | `@myorg/shared/ui` TextArea readOnly |
| antd `Spin`（interest-fee 下载态） | loading 状态（目标 Skeleton 或 spinner） |
| antd `message.success/error` | `sonner` toast（statements 模式） |
| antd `Modal.confirm`（MetaMask 未装引导） | shadcn `AlertDialog`（i18n 化文案） |
| `CustomInformation`（通用详情壳） | `approval-detail-grid.tsx`（posting-engine book-detail 模式，支持 isTable 横/纵） |
| `useHook(['ns'])` + `t('key')`（10 namespace） | i18n hook + `modules.approval-manage` 命名空间（收敛） |
| `getServerSidePropsResult` + `serverSideTranslations` | 客户端 i18n（目标 CSR/SPA，无需 SSP） |
| `MeatmaskOrSign`（connectToMetamask/signMessage/convertTxHashToRSV） | 移植到 `util/approval-manage.helpers.ts`（**ethers v5→v6 改写风险，目标降级或 stub**，见 §8） |
| `downloadApi`（sftp/download Blob） | 目标文件下载 util（statements/wallet 模式，依赖 `NEXT_PUBLIC_FILE_ID`，无配置时降级） |

### 6.5 跨模块路由（CROSS_MODULE_ROUTES，迁移依赖）

| 源路由 | 用途 | 目标路由 |
|--------|------|----------|
| `/approval-manage/view` | 列表行 View 跳转详情 | `/approval-manage/view?id=&busCode=`（顶层模块，query 透传） |
| `/sys/user` | 升级提示跳转用户管理 | `/sys/user`（sys group 已迁移，见 memory） |

---

## 7. 迁移步骤

> 每步对应一个可独立开发的 loop 任务。模型分配：推理/拆任务/dispatcher/MetaMask/验收用 opus；页面+审核组件用 sonnet；model/api/constants/util 用 haiku。

1. **【scaffold/haiku】建库 + 注册**：Nx generator 建 `approval-manage`（data-access/feature/ui/util 四层 project.json/jest/index 桩）；`module-registry.ts` 注册 `approval-manage`（pages `{list, detail}` 通用 key，**顶层模块非 group**）；`apps/admin/tsconfig.json` + `tsconfig.base.json` 双 paths 加 `@myorg/modules/approval-manage/*`；`merge-messages.ts` 注册 `modules/approval-manage.json`；en/zh 空桩；`module-manifest.ts`（list/detail 桩 + 占位文字）。**验证**：`nx lint`×4 + `tsc -p apps/admin` 零错 + curl `/en-US/approval-manage`→200。
2. **【scaffold/haiku】util 层**：`constants.ts`（4 套 status 颜色合并 + 动态 i18n key 列表 + operationType 三级推断合并 + recordType 映射 + EVENT_TYPE_SOURCE_EVENT_MAP + FIELD_LABEL_KEY_MAP + RECONCILIATION/CUSTODY/POLICY OPTIONS + 序数词映射 + 权限码语义化 + `∞` 魔数 99999999999 抽常量）；`bus-code-map.ts`（§6.2 完整 busCode→组件+type 映射表，dispatcher 事实源）；`helpers.ts`（formatTimestamp date/dateutc / reSet / hasValue / parseCommaSelection / renderUpdatedValue / normalizeTimestamp / formatCodeName / inferOperationType 统一版）。
3. **【scaffold/haiku】data-access 层**：`model.ts`（审批专属类型：ApprovalTask/ApprovedDetail/ApproveForm/ApprovalLog/EscalationUser/EscalationDrawer；业务字段类型从已迁移模块 import）；`api.ts`（7 类 endpoint：三列表动态 URL + mult/approval 4 个静态 + task 2 个动态 + workflowUserList + downloadApi 封装；**区分两类前缀**；multApprovalProcessApi 的 Bus-Trace-ID header）；`+queries/`（keys + queries 三 Tab 列表 keepPreviousData + 详情 enabled + 日志；mutations process/previousStep/withdraw/addTaskApproveUser，成功后 invalidate+refetch）。
4. **【page/sonnet】列表页**：`approval-manage-list-page.tsx`——三 Tab（state tab 或目标 Tabs）+ 3 DataTable（Tab1/2 approvalStatus 列 + Tab3 taskStatus 列 + Withdrawal 按钮仅 `taskStatus===5&&withdrawType===1`）+ 撤回 Modal（remarks TextArea 必填，成功 resetFields+close+refetch）+ 行 View 跳转 `/approval-manage/view?id=&busCode=`（权限 `approval-manage:view`）。**注意**：三表 rowKey 不同（taskId/detailId）；序号列源 bug 纠正；Tab3 无 approvalTime 列。
5. **【page/opus】dispatcher 骨架**：`approval-manage-detail-page.tsx`——读 `?id=&busCode=`；调 approvedDetailApi（getApprovedDetail，**精确复制四套 status 字段派生 if-else 链**：td_new→applyStatus，td_edit_all/disable/enable→operateStatus，td_register_sp/edit_sp/add/edit/disable/enable_wallet_type→state，其它→status，taskApprovedDetailApi 覆盖 setStatus）；**selectType 派生**（仅 td_edit_sp/td_add_wallet_type/td_register_sp：operationKycComplianceType==2→'1'，operationPrivateKeyHostingType==2→'2'，挂回 businessContent.selectType）；按 busCode 分发（`bus-code-dispatcher.tsx`，精确匹配 + 4 组 financial 模糊兜底，顺序敏感）；hasData setTimeout 300ms 骨架。**验证**：dispatcher 单测覆盖关键 busCode 分支。
6. **【page/sonnet】审核组件批次 1（tokenized-deposit，3 个）**：token/mint/melt——复用 CustomInformation+formatTimestamp+状态 Tag；mint/melt 抽公共 MintMeltApproval（isMint 控制色/符号/title）；type 驱动新旧差异（token）；adminWallet 硬编码 [0][1][2]；条件渲染 COA/KeyCustody/AdminWallet 段（hasValue 判断）。
7. **【page/sonnet】审核组件批次 2（wallet，6 个）**：createWallet/updateAdminWallet/userWallet/funds/walletType/updateWalletType——注意字段命名差异（updateAdminWallet: tokenName/blockChain/createdBy/createdOn）；walletType MMF 分支（issueType=20）+ 透支/利率三区块条件渲染 + 阶梯利率遍历 + `∞` 魔数；Paragraph copyable→CopyableEllipsisText。
8. **【page/sonnet】审核组件批次 3（sp-reserve，5 个）**：serviceProvider（新旧差异 renderUpdatedValue + tdList 折叠卡片 + Business License 下载 Blob + PRIVATE_KEY_CUSTODY/TRANSACTION_POLICY disabled Checkbox）/ reserve-asset（operateTypeMap，Edit 新旧类别）/ reserve-asset-transaction（Inflow/Outflow 红绿 Intl.NumberFormat）/ top-up / withdrawal（绿色 `+`/红色 `-` 对称，reserveTxAmount 保留源 bug 或修正）。
9. **【page/sonnet】审核组件批次 4（monitoring-interest，4 个）**：monitoring-rule（阈值区间表新旧差异 + risk_level 动态 i18n + alertList 动态 label）/ monitoring-result-process（businessType 50/40 条件渲染 + BusinessName 大写笔误兜底）/ interest-rule（计息日序数词本地化 + 阶梯利率表 + **疑似 bug `oldCalculateDayMonth!==calculateTimeMonth` 保留或修正**）/ interest-fee（文件下载 Blob + Spin + message→sonner）。
10. **【page/sonnet】审核组件批次 5（crosschain-settlement，3 个）**：token-pair（ArrowRightCircleIcon 箭头布局 + blockchain_code_color 色块 + 跨链手续费新旧差异）/ liquidity-pool（多处 operationType=2 新旧差异 + **疑似 bug `numberOriginal!==emailRecipientsOriginal` 保留**）/ settlement（固定 Create + 跨 4 namespace + createBy 字段名 + 死引入 reSet 剔除）。
11. **【page/sonnet】审核组件批次 6（financial，4 个）**：financial-coa（mapOperationType 三级 + 原生 table assets/liabilities 分组 + extractAccountItems 递归拍平 + 多别名兜底）/ financial-normalization（复用 tx-event-config mock 枚举 + FIELD_LABEL_KEY_MAP + InfoGrid 单列）/ financial-posting-rule（与 normalization 同构，status 20/35→PUB_Succeed 特殊态 + DEFAULT_AMOUNT_EXPRESSION + InfoGrid 2 列 + **抽公共 InfoSection/InfoGrid 勿两处各写**）/ financial-suspense-adjustment（**唯一调 API**，复用 suspense-adjustment 模块 api/adapters/helpers + ReconciliationCopyableText，adjustmentId 解析失败降级 detailInfo）。
12. **【page/opus】审批操作区 + 审批日志 + 升级 Drawer**：`approval-manage-operation-panel.tsx`（approve Radio `'3'/'2'` + remarks TextArea required + Form.useWatch remarks 控制 MetaMask 按钮 flag + 提交 multApprovalProcessApi 携带 RSV + Bus-Trace-ID header）；`approval-manage-approval-log.tsx`（Steps 垂直，approvedCurrent 由 recordList findIndex operationType===0‖4，status===15 减 1，**源 setTimeout 300ms 异步建议改 useMemo 同步**；reviewerUserNameList>5 折叠 Tooltip；5 种 operationType 节点标题映射）；`approval-manage-escalation-drawer.tsx`（45% 宽度，nodeOrderType Radio + reason TextArea + workflowUserListApi 选人 Table checkbox 跨页去重 removeKeys+Set）；退回上一步 Modal（remarks 必填，approvalPreviousStepApi）。
13. **【page/opus】MetaMask 签名**：移植 `convertTxHashToRSV`/`signMessage`/`connectToMetamask` 到 `util/helpers.ts`；message=(busCode+taskId+approve+remarks).replaceAll(' ','').toLowerCase()；type=1 签 hash（keccak256(toUtf8Bytes)）；connectToMetamask→signMessage→convertTxHashToRSV→r/s/v 注入 form→r==='0' 中止；**ethers v5→v6 改写**（目标若 v6：JsonRpcProvider/BrowserProvider + ethers.keccak256/toUtf8Bytes）；未装 MetaMask→AlertDialog 引导（i18n 化）。**若目标无 MetaMask 需求→降级为 stub（签名步骤跳过，process 直接提交）**。
14. **【scaffold/haiku】i18n 注册**：收敛 10 个源 namespace（approval-manage/common/tokenized-deposit/wallet-type/sp-access/screening-monitoring/interest/cross-chain/mmf/financial）到 `modules.approval-manage.*`；补齐三套动态 key（common_approval_status_/common_task_status_/approval_task_status_color_）；ICU `{{}}`→`{}`；**labelKey 无双重前缀**。
15. **【verify/opus】终验**：4 层 lint + `tsc -p apps/admin` 本模块零错 + curl `/en-US/approval-manage`→200 + `/en-US/approval-manage/view?id=1&busCode=td_new`→200；运行时冒烟（§8 坑清单 grep + 跑应用逐 Tab/逐 busCode 控制台无 Runtime Error/MISSING_MESSAGE/INVALID_MESSAGE）；功能完整性核对（§9）。

---

## 8. 风险与注意事项

- **MetaMask 签名（最大风险）**：源 `MeatmaskOrSign.tsx` 强依赖 **ethers v5** API（`ethers.providers.Web3Provider` / `ethers.utils.keccak256` / `toUtf8Bytes`）。目标 monorepo 若用 ethers v6 需改写为 `ethers.BrowserProvider` + `ethers.keccak256` + `ethers.toUtf8Bytes`（v6 移除了 `.providers`/`.utils` 命名空间）。**若目标无 MetaMask 业务需求→降级为 stub**（跳过签名步骤，process 直接提交，保留 RSV 字段为空或后端约定值）。文件名拼写错误 Meatmask→MetaMask。convertTxHashToRSV 校验长度 **132**（130 hex + '0x'，注释写的 130/66 是错的，以代码为准）。`signMessage` type=1 签 hash 必须保留语义。
- **四套 status 字段分流**：view.tsx 按 busCode 决定状态取 `applyStatus`/`operateStatus`/`state`/`status`，且 `taskApprovedDetailApi` 的 `taskStatus` 会覆盖。getApprovedDetail 内 if-else 链极易出错，**必须精确复制**，迁移后对每个 busCode 分支写单测。
- **动态 URL 脚本漏抓**：`extract-module-meta.sh` 的 `from page literals` 抓到 `(none)` 是误判——3 个列表 URL + 2 个 task 接口都是 `${NEXT_PUBLIC_CONFIG_ID}v1/*` 动态拼接。**迁移 data-access 必须显式拼 CONFIG_ID**（对照 wallet 模式），核对目标 env 变量与 base path。
- **financial 组件复用耦合**：financial-normalization/posting-rule 强依赖 `@/lib/components/financial/transaction-event-configuration/mock`（EVENT_TYPE→SourceEventTypeKey 映射 + getMappingRuleSourceEventTypeLabelKey）；financial-suspense-adjustment 强依赖 `@/lib/components/financial/adjustments/{api,adapters,helpers}` + `@/lib/components/reconciliation/adjustments`（ReconciliationCopyableText）。**这些模块必须已迁移**（transaction-event-config / suspense-adjustment / reconciliation-adjustments，见 memory），否则缺类型/格式化函数/复制组件。
- **升级 Drawer 分页选人竞态**：workflowUserListApi 分页查询 + checkbox 跨页 selectedRowKeys 累积 + removeKeys 去重（Array.from(new Set)）。竞态点：翻页时已选项需保留、取消选中需 remove。源用 ref（removeKeys.current）+ state 双轨，迁移保留语义，建议用 TanStack Query 的 `keepPreviousData` + 本地 Map 累积。
- **Steps 审批日志复杂渲染**：5 种 operationType（0=待审批N人、1=reviewerStatus===3?通过:驳回、2=升级、3=退回上一步、其它=默认）；approvedCurrent 用 `setTimeout(...,300)` 异步计算 findIndex（**迁移建议改 useMemo 同步**）；reviewerUserNameList>5 slice(0,5)+Tooltip，分隔符 `t('approve_type_${approveType}')`；Steps.status `3/15/40→error`。
- **busCode 分发链顺序敏感**：~40 精确 busCode + 4 组 financial 模糊匹配（`startsWith('fin_coa_')` / `startsWith('fin_normalization_')‖includes('normalization')‖includes('mapping')` / `includes('posting')` / `includes('suspense')&&includes('adjust')`）。**financial 模糊匹配必须在精确匹配之后兜底**，否则误匹配。`includes('posting')` 过宽，迁移路由可收窄。
- **10 个 i18n namespace 全注册**：源 `useHook` 注入 10 个 namespace，getServerSideProps 全加载。迁移收敛到 `modules.approval-manage.*`，但动态 key（token_type_/common_task_status_/approval_task_status_color_/service_provider_type_/...）词条必须齐全，否则渲染原始 key 字符串。
- **疑似源 bug（迁移决策：保留或与后端确认）**：① 序号列 dataIndex 用 `businessName`（index.tsx，建议纠正）；② interest-rule `oldCalculateDayMonth!==calculateTimeMonth`（应 calculateDayMonth）；③ liquidity-pool `emailRecipientsNumberOriginal !== emailRecipientsOriginal`（数值字段 vs 字符串/数组字段，类型不匹配，line 136-137）；④ liquidity-pool 三元两分支都是 `liquidityPoolWalletAddressUpdate`（旧值靠下一区块）；⑤ withdrawal `reserveTxAmount` 未 reSet（与 top-up 不一致）；⑥ monitoring-result-process `BusinessName` 大写驼峰（疑似笔误）；⑦ getMappingMethodLabel 两版不一致（normalization 3 值 vs posting 2 值，**取 normalization 全集，Rule 7**）。
- **字段命名极端不统一**（迁移勿统一，逐组件对齐）：创建人 createUser/createUserName/createdBy/creator/createBy；创建时间 createTime/createdOn/createDate/createdTime；TD 名 name/tdName/tokenName；区块链 blockchainName/blockChain/blockchain；walletType 渲染策略不统一（createWallet/userWallet/funds 直显 vs updateAdminWallet 走 `admin_wallet_type_` 映射）；状态 state/status/applyStatus/operateStatus/taskStatus。
- **运行时坑清单（见 target-arch.md §1.5，阶段四 verify 必须 grep 拦截、阶段五跑应用冒烟）**：
  - `ALL_VALUE` 非空（`'all'` 非 `''`，否则 `SelectItem value=""` 崩溃）——升级 Drawer 的 nodeOrderType Radio 无此问题，但若有筛选项需自查。
  - i18n key 无双重 `approval-manage.` 前缀（否则拼成 `modules.approval-manage.approval-manage.xxx` → MISSING_MESSAGE）。
  - ICU `{{xxx}}` → `{xxx}`（源 i18next 双花括号 → 目标 next-intl 单花括号）。
  - list 请求体含 `pageNum`（sys 域后端要求，approval-manage 三 Tab 确认后端是否同样要求）。
  - 下拉数据过滤空 id 与 null（升级 Drawer workflowUserList 返回的 userList，过滤 userId 空项）。
- **Drawer 死代码核查**：walletType.tsx 行 290-304 注释死代码（arrangedOverdraftFee）不迁移；interest-rule 注释的 calculateDigitDay/calculateDigitMonth 死代码不迁移；mint/melt 末尾注释的 approvalTaskStatus/token_task_status_* 死代码不迁移；settlement 注释的 remarks 字段不迁移；withdrawal 注释的 manageWalletAddress 死代码不迁移。
- **已知限制（诚实标注）**：无后端/真实登录 → 无法验证 API 实际返回数据（auth 限制，同前序模块），SSR 降级为 loading/empty 不崩；权限 UUID → 语义化字符串映射（非 1:1）；MetaMask 签名目标若无需求→降级 stub；文件下载依赖 `NEXT_PUBLIC_FILE_ID`，环境无配置时降级为不可用按钮（不崩）；detail dispatcher 的 busCode 完整覆盖需运行时真实单据验证（静态只能验证路由命中）。

---

## 9. 验收标准

> 每项可客观验证（能跑、能看到、能对照）。阶段五「验收率 ≥98%」的分子来源。

**功能完整性**：
- [ ] 列表页三 Tab 数据各自独立加载（queryTodoList/queryCompletedList/queryCreateList），分页正确（pageNum 字段对齐后端）。
- [ ] 列表三 Tab rowKey 正确（Tab1/3=taskId，Tab2=detailId）；状态列颜色/文案正确（Tab1/2 approvalStatus + common_approval_status_，Tab3 taskStatus + common_task_status_ + approval_task_status_color_）。
- [ ] Tab3 Withdrawal 按钮仅在 `taskStatus===5 && withdrawType===1` 时启用；撤回 Modal remarks 必填；撤回成功 resetFields+close+refetch。
- [ ] 列表行 View 跳转 `/approval-manage/view?id=&busCode=`（权限 `approval-manage:view` 控制）。
- [ ] dispatcher 按 busCode 正确分发到 25 审核组件之一（关键 busCode 抽样：td_new→TokenApproval、td_register_sp→ServiceProviderApproval、fin_coa_xxx→FinancialCoaApproval、含 suspense+adjust→FinancialSuspenseAdjustmentApproval）。
- [ ] 四套 status 字段派生正确（td_new→applyStatus、td_edit_all→operateStatus、td_register_sp→state、financial→taskStatus 覆盖）。
- [ ] selectType 派生正确（td_edit_sp/td_add_wallet_type/td_register_sp 的 operationKycComplianceType==2→'1'，operationPrivateKeyHostingType==2→'2'）。
- [ ] 审批操作 4 种：通过/驳回（multApprovalProcessApi，携带 Bus-Trace-ID header）/ 退回上一步（previousStep Modal）/ 升级转办（addTaskApproveUser Drawer 选人）；成功后详情+日志刷新。
- [ ] MetaMask 签名（若启用）：message 拼接正确、type=1 签 hash、RSV 注入、r==='0' 中止；或降级 stub（签名步骤跳过）不崩。
- [ ] Steps 审批日志：5 种 operationType 节点标题正确、approvedCurrent 计算正确、reviewerUserNameList>5 折叠 Tooltip。
- [ ] 升级 Drawer：nodeOrderType Radio + reason 必填 + 选人 Table checkbox 跨页去重 + 提交 addTaskApproveUser。
- [ ] 文件下载（serviceProvider Business License / interest-fee 文件）：Blob 下载，busId/busType 双兜底，content-disposition 文件名解析；或降级不可用按钮。
- [ ] 权限控制：View（82536c...→approval-manage:view）/ Withdrawal（5f1c68...→approval-manage:withdraw）正确映射，空集全放行。

**i18n 与状态**：
- [ ] 所有文案 i18n 化，10 个源 namespace 收敛到 `modules.approval-manage.*`；动态 key 词条齐全（无 MISSING_MESSAGE）。
- [ ] ICU 语法正确（`{var}` 非 `{{var}}`，无 INVALID_MESSAGE）；labelKey 无双重前缀。
- [ ] 状态 Tag 颜色与源码一致（approvalStatus/taskStatus 多族）。

**工程**：
- [ ] `pnpm nx lint approval-manage`（四层）零 error。
- [ ] `pnpm nx test approval-manage` 通过（dispatcher busCode 分支单测、status 派生单测、helpers 单测）。
- [ ] `pnpm exec tsc -p apps/admin/tsconfig.json --noEmit` 本模块零新增类型错。
- [ ] `pnpm nx build admin` 通过（无 lazy/chunk 误报）。
- [ ] curl `/en-US/approval-manage`→200（SSR 渲染列表占位）；curl `/en-US/approval-manage/view?id=1&busCode=td_new`→200（dispatcher 命中）。
- [ ] 运行时冒烟：跑应用逐 Tab/逐 busCode，控制台无 Runtime Error / MISSING_MESSAGE / INVALID_MESSAGE，列表/详情数据能显示（auth 限制下降级 loading/empty 不崩）。

---

## 附：模型分配落地（阶段三/四参考）

| 任务 | 模型 | 落地 |
|------|------|------|
| scaffold（建库/注册/manifest/util constants+helpers/data-access model+api+queries） | haiku | `Agent(model:'haiku')` |
| 审核组件批次 1-6（25 个只读展示组件） | sonnet | `Agent(model:'sonnet')` |
| 列表页（三 Tab + 撤回 Modal） | sonnet | `Agent(model:'sonnet')` |
| dispatcher 骨架（busCode 分发 + status 派生 + selectType） | opus | `Agent(model:'opus')` |
| 审批操作区 + Steps 日志 + 升级 Drawer | opus | `Agent(model:'opus')` |
| MetaMask 签名移植（ethers v5→v6 / 降级 stub） | opus | `Agent(model:'opus')` |
| 终验（lint/test/tsc/curl + 运行时冒烟 + 迁移率/验收率判定） | opus | `Agent(model:'opus')` |
