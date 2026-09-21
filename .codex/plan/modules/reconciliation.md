# reconciliation 模块迁移计划

> 本文档为**推倒重写版**。先前已迁移过一次，data-access 层（api.ts / model.ts /
> queries / mutations）质量较高且基本完整，但 **feature 层页面与 4 个超大 Modal 普遍缩水**，
> 关键运行时逻辑块缺失（见第 8 章「上次迁移缺失清单」）。本次以源码逐文件全文阅读为基准重写。
>
> **真实规模**：脚本统计 pages/ 仅 4 文件 1870 行，但业务核心在
> `src/lib/components/reconciliation/`（3861 行），真实合计 ~5731 行。其中
> 4 个超大 Modal（767+629+572+496=2464 行）是本次重灾区。

---

## 1. 业务概述

对账（Reconciliation）模块负责把**链上交易/储备资产变动**与**账务侧（finance book）入账记录**逐笔比对，
按 Token（real-time 子域）/ 储备资产（reserve 子域）两个维度汇总，对**未匹配（Unmatched）**的明细
执行「挂账到暂存户（Post to Suspense）」并记录处理日志（Recon Log）。

核心业务实体：① Token 对账汇总（`TokenReconSummaryRespVo`，列表页）；② 储备资产汇总
（`ReserveAssetSummaryRespVo`，列表页）；③ 对账明细行（`TxReconDetailRespVo` /
`ReserveReconDetailRespVo`，详情页双 Tab 表格）；④ 对账日志（`TxReconLogRespVo` /
`ReserveReconLogRespVo`，弹窗回显，含 Original Entry / On-chain Details / Suspense Entries）。

主要操作：**查询（5 列表 + 4 详情查询）**、**查看详情（基本信息 + 统计卡片 + 双 Tab 明细表）**、
**Post to Suspense（写操作，提交暂记分录，含借贷平衡校验）**、**Recon Log（只读日志抽屉）**。
特殊业务规则：① Post to Suspense 仅当行 `reconciliationStatus===3 && canPostSuspense===true` 时可点
（real-time）；reserve 详情无 Post to Suspense 入口（源码 `buildActions` 只返回 ReconLog，列表页
`PostToSuspense` action 被注释掉）；② 挂账分录必须**借贷平衡（drTotal===crTotal）**才允许提交；
③ real-time Investigation Queue 在前端二次过滤 `reconciliationStatus===3`，reserve 则不在前端过滤
（语义分叉 R2）。

页面构成：real-time 子域 1 列表页 + 1 详情页（含 PostToSuspense + ReconLog 两个抽屉）；
reserve 子域 1 列表页 + 1 详情页（含 ReserveReconLog 抽屉；ReservePostToSuspense 组件存在但
详情页未挂载，因后端端点缺失 R1）。

---

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/reconciliation/real-time/index.tsx` | 273 | **Token 对账列表页**：`useCustomTable` 筛选表单（7 项：tokenName/tokenType/blockchainId/financeBookName/bookNo/currencyCode/lastReconciliationDate 范围）+ 汇总表格（10 列，行 key=tokenId）。动态下拉 `updateAvailableOptions`：从 list 返回行抽取 blockchain/currency 可选项，空则回退通用下拉。action=Details/PostToSuspense 均跳详情页（PostToSuspense 带 `tab=investigation`）。调 `tx/token-list`。 |
| `src/pages/reconciliation/real-time/detail.tsx` | 793 | **Token 对账详情页**：基本信息（`tx/token-basic-detail`，9 格 KV）+ 3 统计卡片（matched/unmatched/actioned）+ Tabs（Reconciliation List / Investigation Queue）+ 双 `useCustomTable`（共用列定义与 action 逻辑）。Investigation Tab 前端过滤 `INVESTIGATION_STATUSES={3}` + 角标轻量请求（pageSize=1）。action：`canPostSuspense && status===3` → PostToSuspense 弹窗，否则 → ReconLog 弹窗。调 `tx/list` + `tx/investigation-list` + `tx/token-basic-detail`。挂 `PostToSuspenseModal` + `ReconLogModal`。 |
| `src/pages/reconciliation/reserve/index.tsx` | 183 | **储备资产列表页**：`useCustomTable` 筛选表单（5 项：reserveAssetName/financeBookName/financeBookId/currencySymbol/lastReconciliationDate 范围）+ 汇总表格（9 列含 associatedTokens 截断展示，行 key=reserveAccountId）。action 仅 Details（PostToSuspense 被注释）。调 `reserve/asset-list`。 |
| `src/pages/reconciliation/reserve/detail.tsx` | 621 | **储备资产详情页**：基本信息（`reserve/asset-basic-detail`，8 格 KV，标题含 reserveAssetName 动态拼接）+ 2 统计卡片（matched/exceptions，无 actioned）+ Tabs（Reconciliation List / Investigation Queue）+ 双 `useCustomTable`（共用列定义）。Investigation 角标轻量请求但**不过滤**（R2）。action 仅 ReconLog。调 `reserve/list` + `reserve/investigation-list` + `reserve/asset-basic-detail`。挂 `ReserveReconLogModal`。 |
| `src/lib/components/reconciliation/ReconciliationBasePage.tsx` | 57 | **基础占位页**（title/description/modules/statusText/alertText/emptyText）。纯展示型，无数据/无 API。**老项目未被 4 个业务页面引用**（grep 确认仅 `reconciliation/index.ts` re-export），属早期 scaffold 残留。**迁移：不迁移**（目标侧无需占位壳）。 |
| `src/lib/components/reconciliation/adjustments/AdjustmentShared.tsx` | 208 | **共享 UI 组件集**（re-export 自 `adjustments/index.ts`，被 4 业务页面 + 4 Modal 引用）：`ReconciliationSection`（带标题/描述/extra 的 section 壳）、`ReconciliationDrawerCard`（抽屉内 Card 壳，标题+extra）、`ReconciliationMetricCard`（统计卡片，label/value/icon/extra）、`renderAdjustmentStatusTag`（adjustment 6 态 Tag，**未被业务页面引用**，仅 mock 独有）、`ReconciliationCopyableText`/`ReconciliationTransactionText`/`ReconciliationHistoryEmpty`/`ReconciliationExportButton`（**均未被业务页面引用**，adjustments 子系统 mock 独有）。`RECONCILIATION_TABLE_THEME`（antd Table 主题 token，区分 TDManage/其他环境）。**迁移：仅迁移 `ReconciliationSection`/`ReconciliationDrawerCard`/`ReconciliationMetricCard` 三个实际被引用的组件**到 ui 层；adjustments 独有部分不迁移（见下）。 |
| `src/lib/components/reconciliation/real-time/PostToSuspenseModal.tsx` | 767 | **Token 挂账抽屉**（Drawer width=960）。打开触发：详情页 action=PostToSuspense（`status===3 && canPostSuspense`）。回显数据 `tx/recon-log`。**完整内部结构**：① 顶部信息卡（ReconciliationDrawerCard，8 格 KV + unmatchedType 红色差异标签）；② Original Entry 表（只读，4 列）；③ On-chain Details 表（只读，6 列）；④ Suspense Entries（`tx/recon-log.suggestedSuspenseEntries` 回显**只读**表，4 列，**前端不可新增**）+ postingDate DatePicker + 借贷平衡汇总（drTotal/crTotal/diff，balanced 判定）；⑤ Exception Context TextArea（必填，maxLength 200）。**关键逻辑**：`resolveDisplayUnmatchedType`（根据 original/onchain/suspense 数据存在性推断显示类型 1/2/3）、`toPostingDateEpoch`（日期转 UTC epoch）、`mapSuggestedSuspenseEntries`（注入 _rowKey）、`canConfirm`（balanced && postDate && exceptionContext 非空 && 每行 accountCode+amount>0）。提交 `postTokenSuspense` payload=`{reconciliationTxId, postingDate, exceptionContext, suspenseEntries[]}`，code===0 成功后 onSuccess 刷新表格。 |
| `src/lib/components/reconciliation/real-time/ReconLogModal.tsx` | 572 | **Token 对账日志抽屉**（Drawer width=960，只读）。打开触发：详情页 action=ReconLog（非挂账场景）。回显 `tx/recon-log`。**完整内部结构**：① 顶部信息卡（8 格 KV + statusTag 含 resultLabel 拼接 + onchain amount）；② Original Entry 表（4 列，**TX_TYPE_REPOSITORY_OUT(10) 特殊处理**：硬编码注入 2002/2003 Stablecoin 分录）；③ On-chain Details 表（6 列）；④ Suspense Entries 表（5 列，**仅当已挂账**展示 + exceptionContext 文本块）；⑤ 处理信息卡（processedBy/processedTime，仅当存在）。**关键逻辑**：`resolveReconResultLabel`（推断 result 标签）、`hasOriginalData`/`hasOnchainData`/`hasSuspenseData` 数据存在性判定。无提交（只读 Close）。 |
| `src/lib/components/reconciliation/reserve/ReservePostToSuspenseModal.tsx` | 629 | **储备挂账抽屉**（Drawer width=960）。**注意：reserve 详情页源码未挂载此组件**（详情页 action 只有 ReconLog），但组件本身完整存在，调 `reserve/recon-log` + `tx/accounts/leaf`（跨域复用末级科目）。**完整内部结构**：① 顶部信息卡（7 格 KV + reserveStatusTag extra）；② Mintable Capacity 卡（3 格，Reserve 独有）；③ Actual Execution 卡（6 格，Reserve 独有）；④ Transaction Request 卡（7 格含 tokenType 映射，Reserve 独有）；⑤ **可编辑** Suspense Entries 表（5 列：direction Select / accountCode Select 从 leafAccounts.debitAccounts|creditAccounts 动态 / amount InputNumber / _txRef Input / 删除按钮）+ 新增行按钮 + 借贷平衡汇总；⑥ Exception Context TextArea。**关键逻辑**：`useEffect` 打开时初始化 2 行空白 Dr/Cr（**非后端建议分录**，注释明示"自动生成建议分录留作后续优化"）、`updateEntry`、`debitAccounts`/`creditAccounts` 来自 leafAccounts。提交 `postReserveSuspense`（**后端端点缺失 R1，mock 顶位**）。 |
| `src/lib/components/reconciliation/reserve/ReserveReconLogModal.tsx` | 496 | **储备对账日志抽屉**（Drawer width=960，只读）。打开触发：reserve 详情页 action=ReconLog。回显 `reserve/recon-log`。**完整内部结构**：① 警告条（`reserveWarningText`：status 3/4/5 硬编码英文警告）；② 顶部信息卡（7 格 KV + statusLabel 卡片含金额）；③ **双视图**：`isReserveOut(type===2)` → "Request vs Execution"（Transaction Request 卡 + Actual Execution 卡，含"无 transaction request"的 Unauthorized 红色提示）；`isMint(type===1)` → "Mintable Capacity vs Mint Execution"（Mintable Capacity 卡 + Actual Execution 卡）。**关键逻辑**：`reserveStatusCardClassName`（status 2 绿/其他红）、`statusAmountValue` 多来源推断（mint+overcap 用 mintableCapacity-executionAmount）、`meltActualExecution`（Melt 退款执行详情，reserve mock 独有但源码消费）。无提交（只读 Close）。 |
| `src/lib/components/reconciliation/real-time/mock.ts` | 296 | **real-time mock 数据**（模式 A：`NEXT_PUBLIC_ENABLE_MODULE_MOCK=true` 时 api.ts 路由）。**数据结构参考，不迁移**。字段要点：`TxReconLogRespVo.onchainDetails.hash`（非 txHash）、`originalEntry.tranId`、`suspenseEntries.tranId`、`suggestedSuspenseEntries`（PostToSuspense 回显建议分录）。 |
| `src/lib/components/reconciliation/reserve/mock.ts` | 324 | **reserve mock 数据**（模式 A）。**数据结构参考，不迁移**。字段要点：`ReserveReconDetailRespVo.orderSerialNumber`、`ReserveReconLogRespVo.meltActualExecution`、`ReserveAssetSummaryRespVo.associatedTokens[]`。 |
| `src/lib/components/reconciliation/adjustments/mock.ts` | 302 | **adjustments 子系统 mock + 类型**（`ReconciliationAdjustmentStatus` 6 态联合、`ReconciliationAdjustmentListRow`/`Detail`/`FormDetail` 等）。**注意：adjustments 子系统（独立列表/详情/编辑页）在老项目无对应 pages，仅 mock + AdjustmentShared 中未被引用的辅助组件**。属"建了数据模型但未接页面"的半成品。**迁移：不迁移 mock 数据；`renderAdjustmentStatusTag` 及 adjustments 专用类型/组件不迁移**（无页面消费）。仅 `AdjustmentShared` 中被 4 业务页面实际引用的 3 组件迁移。 |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES`（4 pages）+ 手动补齐 7 个
> lib/components 文件（脚本未统计 lib，但属业务核心，逐文件 Read 补全行数与用途）。
> 「用途」列每个文件均实际 Read 全文判断，不得遗漏。

---

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS`（页面字面量 6 + api 模块封装 13 去重）。
> 共 **13 个唯一 endpoint**（real-time 7 + reserve 6），全部为 finance 域静态全路径
> `/api/finance/v1/finance/reconciliation/<domain>/<action>`，无 `${CONFIG_ID}` 模板段。

### 3.1 列表 API（3 个，汇总维度）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/finance/v1/finance/reconciliation/tx/token-list` | POST | `real-time/index.tsx` `useCustomTable.url` + `fetchTokenReconList`（customFetch 包装，抽 blockchain/currency 可选下拉） | Token 对账汇总分页列表（rowKey=tokenId，10 列含 matched/unmatched/actioned 统计） |
| `/api/finance/v1/finance/reconciliation/tx/list` | POST | `real-time/detail.tsx` `reconListForm`（Reconciliation List Tab） | Token 对账明细分页列表（rowKey=reconciliationTxId，10 列含 statusTag） |
| `/api/finance/v1/finance/reconciliation/reserve/asset-list` | POST | `reserve/index.tsx` `useCustomTable.url` | 储备资产汇总分页列表（rowKey=reserveAccountId，9 列含 associatedTokens） |

### 3.2 列表 API（reserve 明细，1 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/finance/v1/finance/reconciliation/reserve/list` | POST | `reserve/detail.tsx` `reconListForm`（Reconciliation List Tab） | 储备对账明细分页列表（rowKey=reconciliationReserveId，9 列含 reserveDiff 红色负值） |

### 3.3 子查询 API（investigation + recon-log + accounts-leaf，5 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/finance/v1/finance/reconciliation/tx/investigation-list` | POST | `real-time/detail.tsx` `investListForm`（Investigation Tab）+ 角标轻量请求（pageSize=1） | Token 异常队列；**前端二次过滤 `reconciliationStatus===3`**（`filterInvestigationRows` 同时改 total 与 rows） |
| `/api/finance/v1/finance/reconciliation/reserve/investigation-list` | POST | `reserve/detail.tsx` `investListForm` + 角标轻量请求 | 储备异常队列；**不在前端过滤**（R2 语义分叉），直接展示后端返回 |
| `/api/finance/v1/finance/reconciliation/tx/recon-log` | POST | `PostToSuspenseModal` + `ReconLogModal`（useSWR，key=`[url,{reconciliationTxId}]`） | Token 对账日志回显（originalEntry/onchainDetails/suspenseEntries/suggestedSuspenseEntries） |
| `/api/finance/v1/finance/reconciliation/reserve/recon-log` | POST | `ReserveReconLogModal` + `ReservePostToSuspenseModal`（useSWR） | 储备对账日志回显（mintableCapacity/actualExecution/transactionRequest/meltActualExecution） |
| `/api/finance/v1/finance/reconciliation/tx/accounts/leaf` | POST | `ReservePostToSuspenseModal`（useSWR，**跨域复用**，入参 financeBookId） | 末级科目（debitAccounts/creditAccounts，挂账选科目下拉） |

### 3.4 详情 API（基本信息，2 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/finance/v1/finance/reconciliation/tx/token-basic-detail` | POST | `real-time/detail.tsx` `realtimeFetch`（useEffect，入参 tokenId） | Token 基本信息（9 格 KV + 统计卡片数据源） |
| `/api/finance/v1/finance/reconciliation/reserve/asset-basic-detail` | POST | `reserve/detail.tsx` `reserveFetch`（useEffect，入参 reserveAccountId） | 储备资产基本信息（8 格 KV + 统计卡片数据源 + associatedTokens） |

### 3.5 写操作 API（Mutation，2 个）

| Endpoint | Method | 调用方 | 用途 / 限制 |
|----------|--------|--------|------|
| `/api/finance/v1/finance/reconciliation/tx/post-suspense` | POST | `PostToSuspenseModal.handleSubmit` → `postTokenSuspense` | **Token 挂账提交**。payload=`{reconciliationTxId, postingDate(UTC epoch), exceptionContext, suspenseEntries[]}`。code===0 成功 → onSuccess 刷新当前 Tab 表格。端点已存在，可正常联调。 |
| `/api/finance/v1/finance/reconciliation/reserve/post-suspense` | POST | `ReservePostToSuspenseModal.handleSubmit` → `postReserveSuspense` | **储备挂账提交**。payload=`{reconciliationReserveId, exceptionContext, suspenseEntries[]}`。⚠️ **后端端点尚未生成（R1 限制）**：老 api.ts 注释明示 mock 临时顶位。组件完整保留但 reserve 详情页未挂载入口。迁移后以 feature-flag 隐藏挂账入口，函数保留待后端就绪。 |

### 3.6 公共下拉数据源（3 个 hook，非本模块 endpoint）

> 老项目 `@/lib/hooks/*`，目标侧需映射到等价共享 hook（参考已迁移模块的下拉来源）。

- `useTokenTypeOptions` → `{ tokenTypeList, tokenTypeOptions }`：Token 类型下拉（id→name 映射）。
  消费方：real-time 列表页（tokenType 筛选，过滤仅 1/5）、real-time 详情页（tokenType 展示映射）、
  ReservePostToSuspenseModal（transactionRequest.tokenType 映射）、ReserveReconLogModal（同）。
- `useBlockchainOptions` → `{ blockchainOptions }`：区块链下拉。消费方：real-time 列表页
  （blockchainId 筛选，动态可选项为空时回退此）。
- `useCurrencyOptions` → `{ currencyOptions }`：币种下拉。消费方：real-time 列表页（currencyCode 筛选，
  动态回退）、reserve 列表页（currencySymbol 筛选）。

### 3.7 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `useHook` / `CustomTableTitle`（来自 `libs/components`）→ 目标 `DataTable` + TanStack Query + `react-hook-form`。
- `formatTimestamp` / `getServerSidePropsResult`（来自 `libs/utils`）→ 目标 `formatTimestamp`（util 层）+ CSR 无需 SSP。
- `ReconciliationSection` / `ReconciliationDrawerCard` / `ReconciliationMetricCard`（来自 `adjustments/AdjustmentShared`）→ 目标 ui 层 3 组件（上次迁移已建，需校验 props 对齐）。
- `copy-to-clipboard` + `@ant-design/icons` `CopyOutlined` → 目标 CopyableEllipsisText（已迁移模块 ui）。
- `dayjs` → 目标 dayjs（postingDate 处理）。
- `antd` `Drawer`/`Table`/`Tag`/`Skeleton`/`DatePicker`/`InputNumber`/`Select`/`Tabs`/`Tooltip`/`message` → 目标 `@myorg/shared/ui` 同名/等价组件。

---

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **高** |
| 困难分数 | **4/5** |
| 主要难点 | ① 4 个超大 Drawer（767/629/572/496 行），每个含多张只读/可编辑表 + 数据存在性推断逻辑（resolveDisplayUnmatchedType / resolveReconResultLabel / statusAmountValue 多来源）；② `useCustomTable` 隐式封装需完整还原（form.items 7/5/5 项、table.columns 9~10 列、actions 条件渲染、actionClick 跳转/开弹窗）；③ real-time Investigation Queue 前端二次过滤（同时改 total+rows）+ 角标轻量请求竞态；④ 双 Tab 共用列定义与 action 逻辑（两份 useCustomTable 实例）；⑤ ReserveReconLogModal 双视图（Melt vs Mint）+ 硬编码英文警告文案；⑥ 借贷平衡校验 + postingDate epoch 转换；⑦ 跨域 accounts/leaf 复用（reserve 调 tx 域接口）；⑧ i18n key 体量大（reconciliation_xxxx 系列，超 60 个 key）需映射到目标 MSG_09_00xx 体系。 |
| 建议负责人 | **高级前端**（4 Modal + 数据推断逻辑需 opus 级理解，页面骨架可 sonnet，类型/常量/查询 hook 可 haiku） |

---

## 5. 迁移后目标文件清单

> 采用 **group 机制**（`reconciliation` 作分组模块，`real-time`/`reserve` 两子模块各自 entry），
> 对齐上次迁移已建立的拓扑（registry 已注册 `real-time`/`reserve` 两项，stablecoin.json 已配菜单）。
> 标注 `[已有·需校验/补全]`（上次迁移产物，重灾区在 feature 层）与 `[需重写/补全]`。

```text
libs/modules/reconciliation/
├── data-access/src/lib/
│   ├── reconciliation.model.ts                 # [已有·需校验] 13 endpoint 全部 Req/Resp 类型
│   ├── reconciliation.api.ts                   # [已有·基本完整] 13 endpoint apiClient 函数 + postList 注入 id
│   └── +queries/
│       ├── reconciliation.keys.ts              # [已有·需校验] Query key 工厂
│       ├── reconciliation.queries.ts           # [已有·需校验] 11 查询 hook（list×3+detail×2+investigation×2+recon-log×2+accounts-leaf+basic-detail×2）
│       └── reconciliation.mutations.ts         # [已有·需校验] postTokenSuspense + postReserveSuspense（R1 flag）
├── feature/src/lib/
│   ├── module-manifests.ts                     # [已有] realTimeManifest + reserveManifest（i18nNamespace=modules.reconciliation，routes list/detail）
│   ├── real-time-list-page.tsx                 # [需校验] RHF 筛选 + DataTable + 动态下拉(updateAvailableOptions) + Details/PostToSuspense 跳转
│   ├── real-time-detail-page.tsx               # [需重写] ⚠️缺 INVESTIGATION_STATUSES 前端过滤 + investBadge 角标 + resolveDetailTab + canPostSuspense 条件 action
│   ├── reserve-list-page.tsx                   # [需校验] RHF 筛选 + DataTable + associatedTokens 截断展示
│   ├── reserve-detail-page.tsx                 # [需校验] 双 Tab + 2 统计卡片(无 actioned) + ReconLog action
│   ├── real-time/
│   │   ├── post-to-suspense-modal.tsx          # [需重写] ⚠️缺 resolveDisplayUnmatchedType/toPostingDateEpoch/mapSuggestedSuspenseEntries/canConfirm 完整逻辑（上次缩水至 532 行）
│   │   ├── recon-log-modal.tsx                 # [需校验] ⚠️缺 TX_TYPE_REPOSITORY_OUT(10) 硬编码分录注入 + resolveReconResultLabel
│   │   ├── post-to-suspense-modal-content.tsx  # [需新建] 拆 content 避免 nx lazy 误报（767 行体量）
│   │   └── recon-log-modal-content.tsx         # [需新建] 同上（572 行体量）
│   └── reserve/
│       ├── reserve-post-to-suspense-modal.tsx          # [需校验] ⚠️详情页未挂载入口(R1)；内部可编辑表+leafAccounts 动态下拉需校验
│       ├── reserve-recon-log-modal.tsx                 # [需校验] 双视图(Melt/Mint)+warningText+ComparisonCard
│       ├── reserve-post-to-suspense-modal-content.tsx  # [需新建] 拆 content（629 行）
│       └── reserve-recon-log-modal-content.tsx         # [需新建] 拆 content（496 行）
├── ui/src/lib/
│   ├── reconciliation-section.tsx              # [已有·需校验] props(title/description/extra/children)
│   ├── reconciliation-drawer-card.tsx          # [已有·需校验] props(title/extra/children)
│   ├── reconciliation-metric-card.tsx          # [已有·需校验] props(label/value/icon/extra/className)
│   ├── info-item.tsx                           # [已有·需校验] KV 项
│   ├── amount-pair.tsx                         # [已有·需校验] fiat+token 双行金额（renderAmountPair）
│   ├── copyable-value.tsx                      # [需新建/校验] CopyableValue（middleEllipsis + Tooltip + 复制反馈）多 Modal 复用
│   └── status-badge.tsx                        # [已有·需校验] tx 6 态 + reserve 6 态 Tag/className 映射
└── util/src/lib/
    ├── reconciliation.constants.ts             # [已有·需校验] txTypeLabel/reserveTxTypeLabel/statusTag/reserveStatusTag/*Options + RECONCILIATION_PERMISSIONS
    └── reconciliation.helpers.ts               # [已有·需校验] formatBlockHeight/formatNonZeroNumber/formatCurrencyValue 等纯函数
```

**i18n**（`libs/shared/util-i18n-messages/src/lib/{zh-CN,en-US}/modules/reconciliation.json`）：
`[已有·需补全]` 已有 `MSG_09_00xx` 系列（错误码），需补齐 `reconciliation_0095`~`reconciliation_0233` 业务文案
（超 60 key），命名空间 `modules.reconciliation`，labelKey 用相对 key 不带 `reconciliation.` 前缀。

**注册**（`libs/shared/util-config/src/lib/module-registry.ts`）：`[已有]` `real-time`/`reserve` 两项已注册（动态 import feature barrel）。
**菜单**（`apps/admin/src/configs/<app>.json`）：`[已有]` reconciliation 作 group，2 子项 path 写死。
**路由**（`apps/admin/src/app/[locale]/(app)/[module]/[[...slug]]/page.tsx`）：`[需校验]` group 解析
`/reconciliation/<child>` → realModule=child → loadModulePage(child, pageKey)。详情页路由上次用 `/view`（detail）。

---

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query（queries hook）+ `react-hook-form`（筛选）|
| `Form` / `Form.Item` / `Form.useForm` | `useForm` + `FormField` / `FormSelect` / `FormDatePicker`（RangePicker 用 `type: 'RangePicker'` → FormDatePicker range） |
| `Input` / `Input.TextArea` | `@myorg/shared/ui` Input / TextArea |
| `Select` / `InputNumber` | `@myorg/shared/ui` Select / NumberInput（挂账可编辑表用） |
| `DatePicker`（单日期，挂账 postingDate） | `FormDatePicker`（dayjs，提交转 UTC epoch） |
| `DatePicker.RangePicker` | `FormDatePicker` range（name 拆 `xxxStart`-`xxxEnd`） |
| `Button` | `@myorg/shared/ui` Button |
| `Tag`（statusTag/reserveStatusTag/unmatchedTypeTag） | Tailwind badge / Badge 组件 + util/constants.ts className 映射 |
| `Drawer`（4 个超大抽屉） | `@myorg/shared/ui` Drawer；**拆 content 子组件**避免 nx lazy 误报 |
| `Table`（静态只读，Original/Onchain/Suspense 分录表） | `@myorg/shared/ui` DataTable（静态 dataSource，pagination=false） |
| `Tabs`（Reconciliation List / Investigation Queue） | `@myorg/shared/ui` Tabs |
| `Skeleton` | `@myorg/shared/ui` Skeleton |
| `Tooltip` | `@myorg/shared/ui` Tooltip |
| `message.success/warning/error` | `@myorg/shared/ui` toast / useToast |
| `copy-to-clipboard` + `CopyOutlined` | CopyableValue ui 组件（middleEllipsis + 复制反馈） |
| `ReconciliationSection`/`DrawerCard`/`MetricCard` | ui 层 3 组件（已有，校验 props） |
| `Typography.Paragraph copyable` | CopyableValue（adjustments 独有 ReconciliationCopyableText 不迁移） |
| `Card`/`Alert`/`Empty`（ReconciliationBasePage） | 不迁移（占位页无业务） |

### 6.1 4 个超大 Modal 完整内部结构（重灾区，逐个详述）

#### 6.1.1 `PostToSuspenseModal`（real-time，767 行）— 挂账抽屉
- **打开触发**：real-time 详情页表格 action `key==='PostToSuspense'`，条件 `reconciliationStatus===3 && canPostSuspense===true`。
- **回显数据**：`tx/recon-log`（useSWR key=`[url,{reconciliationTxId}]`）。
- **顶部信息卡**（ReconciliationDrawerCard）：8 格 KV（reconciliationTime/reconciliationNo/txType/tranId|txHash/financeBookName/bookNo/currencySymbol + 第 8 格 `unmatchedTypeTag` 红色差异标签）。
- **Original Entry 表**（只读，4 列：postingDate/direction/accountCode+accountName/amount+tokenCount），空则显示占位文案 `reconciliation_0116`。
- **On-chain Details 表**（只读，6 列：blockHeight/fromAddress/toAddress/amount/txTime/hash），空则 "No Data"。
- **Suspense Entries 块**：postingDate DatePicker（必填）+ 只读表（4 列：direction/accountCode+accountName/amount/transactionId）+ 借贷汇总（drTotal/crTotal/diff，balanced 着色）。数据来自 `suggestedSuspenseEntries`，**前端不可新增/编辑**。
- **Exception Context**：TextArea（必填，maxLength 200，showCount）。
- **footer**：Cancel + Confirm（disabled=`!canConfirm`）。
- **提交**：`postTokenSuspense({reconciliationTxId, postingDate:toPostingDateEpoch(postDate), exceptionContext, suspenseEntries[]})`，code===0 → onSuccess + onClose。
- **关键逻辑**：`resolveDisplayUnmatchedType`（无 original→2 / 无 onchain→1 / 有 suspense→3 / 否则 fallback）、`canConfirm`（balanced && postDate && exceptionContext.trim() && entries.every(accountCode && amount>0)）。

#### 6.1.2 `ReconLogModal`（real-time，572 行）— 只读日志抽屉
- **打开触发**：real-time 详情页 action `key==='ReconLog'`（非挂账场景，即 `!(status===3 && canPostSuspense)`）。
- **回显数据**：`tx/recon-log`。
- **顶部信息卡**：8 格 KV + statusTag（状态 3/5/6 时拼接 resultLabel）+ onchain amount。
- **Original Entry 表**（4 列）；**TX_TYPE_REPOSITORY_OUT(10)** 特殊：硬编码注入 2 行（2002 Stablecoin in Repository Dr / 2003 Stablecoin in Circulation Cr）。
- **On-chain Details 表**（6 列）。
- **Suspense Entries 表**（5 列，**仅当已挂账** suspense.entries 非空展示）+ exceptionContext 文本块。
- **处理信息卡**（processedBy/processedTime，仅当存在）。
- **footer**：Close（只读）。
- **关键逻辑**：`resolveReconResultLabel`（无 onchain→0112 / 无 original→0113 / 有 suspense→0114）、`hasOriginalData`/`hasOnchainData`/`hasSuspenseData`。

#### 6.1.3 `ReservePostToSuspenseModal`（reserve，629 行）— 储备挂账抽屉（详情页未挂载，R1）
- **打开触发**：reserve 详情页源码**未挂载**（详情页 action 只有 ReconLog）；组件完整保留待后端就绪。
- **回显数据**：`reserve/recon-log` + `tx/accounts/leaf`（跨域，financeBookId）。
- **顶部信息卡**（7 格 KV + reserveStatusTag extra）。
- **Mintable Capacity 卡**（3 格：capacity+currency / capacityToken+symbol / snapshotTime）— Reserve 独有。
- **Actual Execution 卡**（6 格：sender/receiver/amount+currency/tokenAmount+symbol/executionTime/executionTxHash）— Reserve 独有。
- **Transaction Request 卡**（7 格：meltingAmount/meltingTokenAmount/tokenName/tokenType/blockchainName/createdBy/createdTime）— Reserve 独有。
- **可编辑 Suspense Entries 表**（5 列：direction Select / accountCode Select 动态 debitAccounts|creditAccounts / amount InputNumber / _txRef Input / 删除按钮）+ 新增行按钮 + 借贷汇总。
- **Exception Context**：TextArea（必填）。
- **footer**：Cancel + Confirm。
- **关键逻辑**：`useEffect` 打开初始化 2 行空白 Dr/Cr（非后端建议）、`updateEntry`、`debitAccounts`/`creditAccounts` 来自 leafAccounts。
- **提交**：`postReserveSuspense({reconciliationReserveId, exceptionContext, suspenseEntries[]})` — **后端端点缺失 R1**。

#### 6.1.4 `ReserveReconLogModal`（reserve，496 行）— 储备只读日志抽屉
- **打开触发**：reserve 详情页 action `key==='ReconLog'`。
- **回显数据**：`reserve/recon-log`。
- **警告条**（`reserveWarningText`：status 3/4/5 硬编码英文：Unauthorized/Over-minting/Failed 警告）。
- **顶部信息卡**（7 格 KV + statusLabel 卡片含金额，`reserveStatusCardClassName`：status 2 绿/其他红）。
- **双视图**：`isReserveOut(type===2)` → "Request vs Execution"（Transaction Request 卡 + Actual Execution 卡，无 request 时显示红色 "No transaction request found" Unauthorized 提示）；`isMint(type===1)` → "Mintable Capacity vs Mint Execution"（Mintable Capacity 卡 + Actual Execution 卡）。
- **footer**：Close（只读，size=large，destroyOnClose）。
- **关键逻辑**：`statusAmountValue` 多来源（mint+overcap 用 mintableCapacity-executionAmount）、`meltActualExecution`（Melt 退款详情）、`reserveDialogTitle`（status 3→"Unauthorized Movement"/4→"Over-minting"）。

### 6.2 adjustments/AdjustmentShared 用途说明

`AdjustmentShared.tsx` 是**共享 UI 组件集**，其中仅 3 个组件被 4 业务页面 + 4 Modal 实际引用：
- `ReconciliationSection`：带标题/描述/extra 的 section 壳（详情页基本信息区、统计卡片区外层）。
- `ReconciliationDrawerCard`：抽屉内 Card 壳（标题 + extra，4 Modal 内每张表的外层）。
- `ReconciliationMetricCard`：统计卡片（label/value/icon/extra，详情页 matched/unmatched/actioned 卡）。

其余 `renderAdjustmentStatusTag`/`ReconciliationCopyableText`/`ReconciliationTransactionText`/
`ReconciliationHistoryEmpty`/`ReconciliationExportButton` + `RECONCILIATION_TABLE_THEME` 属
**adjustments 子系统专用**（adjustments mock.ts 的 `ReconciliationAdjustmentStatus` 6 态等），
**老项目无对应 pages，无页面消费，不迁移**。adjustments 子系统整体（mock 302 行 + 类型）为
"建了模型未接页面"的半成品，不迁移。

### 6.3 状态枚举（照搬 STATUS_ENUMS 完整键值）

> 数据来源：`extract-module-meta.sh` STATUS_ENUMS（已 dump 完整键值，file:line 定位）。
> 合并规则：键值相同合并；不同分常量。写入 `util/reconciliation.constants.ts`。

**txTypeLabel**（real-time 交易类型 → 文案，detail.tsx:48 + PostToSuspense:131 + ReconLog:87 三处同值，合并）：
```
5  → reconciliation_0096
10 → reconciliation_0100
15 → reconciliation_0097
20 → reconciliation_0099
25 → reconciliation_0098
```

**reserveTxTypeLabel**（reserve 交易类型 → 文案，reserve/detail:69 + ReservePostToSuspense:45 + ReserveReconLog:15 三处同值，合并）：
```
1 → reconciliation_0207  (Mint / Reserve In)
2 → reconciliation_0208  (Reserve Out / Melt)
```

**statusTag**（real-time 对账状态 → Tag，detail.tsx:66 + ReconLog:144 同值；6 态）：
```
1 → reconciliation_0103  className='!border-0 !bg-[#f5f5f5] !text-[#595959]'
2 → reconciliation_0104  className='!border-0 !bg-[#f6ffed] !text-[#52c41a]'
3 → reconciliation_0105  className='!border-0 !bg-[#fff1f0] !text-[#f5222d]'
4 → reconciliation_0106  className='!border-0 !bg-[#e6f4ff] !text-[#1677ff]'
5 → reconciliation_0107  className='!border-0 !bg-[#fff7e6] !text-[#fa8c16]'
6 → reconciliation_0108  className='!border-0 !bg-[#f6ffed] !text-[#52c41a]'
```

**reserveStatusTag**（reserve 对账状态 → Tag，reserve/detail:81 + ReservePostToSuspense:57 同值；6 态 0-5）：
```
0 → reconciliation_0209  className='!border-0 !bg-[#f5f5f5] !text-[#595959]'  (Pending)
1 → reconciliation_0210  className='!border-0 !bg-[#f5f5f5] !text-[#595959]'  (ReconExecuted)
2 → reconciliation_0211  className='!border-0 !bg-[#f6ffed] !text-[#52c41a]'  (Matched)
3 → reconciliation_0212  className='!border-0 !bg-[#fff1f0] !text-[#f5222d]'  (Unauthorized)
4 → reconciliation_0213  className='!border-0 !bg-[#fff7e6] !text-[#fa8c16]'  (OverCap)
5 → reconciliation_0214  className='!border-0 !bg-[#fff1f0] !text-[#f5222d]'  (Failed)
```

**txTypeOptions**（detail.tsx:98，**tokenType 条件**：stablecoin(1) 含 5 项全 / TD(5) 与默认 baseOptions 4 项）：
```
全部 → value=''        ⚠️ 目标改 'all'
5    → reconciliation_0096
10   → reconciliation_0100   (仅 stablecoin)
15   → reconciliation_0097
20   → reconciliation_0099   (仅 stablecoin)
25   → reconciliation_0098
```

**statusOptions**（real-time 对账状态筛选，detail.tsx:124）：
```
全部 → value=''    ⚠️ 目标改 'all'
2    → reconciliation_0104
3    → reconciliation_0105
5    → reconciliation_0107
6    → reconciliation_0108
```

**reserveTxTypeOptions**（reserve/detail:113）：
```
全部 → value=''    ⚠️ 目标改 'all'
1    → reconciliation_0207
2    → reconciliation_0208
```

**reserveStatusOptions**（reserve/detail:119）：
```
全部 → value=''    ⚠️ 目标改 'all'
2    → reconciliation_0211
3    → reconciliation_0212
4    → reconciliation_0213
```

**unmatchedTypeTag**（PostToSuspense:192，real-time 红色差异标签）：
```
1 → reconciliation_0112
2 → reconciliation_0113
3 → reconciliation_0114
```

**tdTokenTypeOptions**（real-time/index.tsx:45，tokenType 筛选仅 1/5）+ **tokenTypeLabelMap**（index:36/detail:279，tokenTypeList id→name 映射，非固定枚举）。

> ⚠️ **关键**：所有 `*Options` 的"全部"占位老项目用 `value=''`（PUB_All），目标侧 `ALL_VALUE` **必须改 `'all'`**
> （Radix Select 禁 `SelectItem value=""` 否则 Runtime Error 崩溃，见第 8 章）。

---

## 7. 迁移步骤

1. **校验 scaffold**：data-access（api/model/queries/mutations）+ util（constants/helpers）+ ui（3 共享组件）+ module-manifests + registry 注册 + 菜单 + 路由 group 解析均已存在。先跑 `pnpm nx lint reconciliation` + `pnpm nx test reconciliation` + build 确认基线绿，记录失败项。
2. **补全 i18n**：`modules/reconciliation.json`（zh-CN/en-US）补齐 `reconciliation_0095`~`reconciliation_0233` 业务文案（超 60 key），ICU 单花括号（`{time}` 非 `{{time}}`），labelKey 相对 key 不带 `reconciliation.` 前缀。
3. **校验 model.ts 类型完整性**：对照 mock.ts + data-contracts 补齐 `TxReconLogRespVo.suggestedSuspenseEntries`/`ReserveReconLogRespVo.meltActualExecution`/`ReserveReconDetailRespVo.orderSerialNumber` 等字段（R1/R2 注释已标）。
4. **校验 queries/mutations hooks**：11 查询 + 2 mutation 覆盖 13 endpoint；real-time investigation 查询层 `select` 二次过滤 `status===3`（api.ts 注释 R2 已标，但需确认 query 层落地）。
5. **重写 real-time-detail-page**：补 `INVESTIGATION_STATUSES={3}` 前端过滤（改 total+rows）、`investBadge` 角标轻量请求、`resolveDetailTab(query.tab)`、`canPostSuspense && status===3` 条件 action（PostToSuspense vs ReconLog）。
6. **重写 real-time/post-to-suspense-modal**（+ 拆 content）：补 `resolveDisplayUnmatchedType`/`toPostingDateEpoch`/`mapSuggestedSuspenseEntries`/`canConfirm`/`unmatchedTypeTag` 完整逻辑；suggestedSuspenseEntries 只读回显。
7. **校验 real-time/recon-log-modal**（+ 拆 content）：补 `TX_TYPE_REPOSITORY_OUT(10)` 硬编码分录注入、`resolveReconResultLabel`、statusTag resultLabel 拼接。
8. **校验 reserve-detail-page**：双 Tab（不过滤 R2）+ 2 统计卡片（无 actioned）+ ReconLog action；校验 reserveAmount 多来源渲染。
9. **校验 reserve/reserve-recon-log-modal**（+ 拆 content）：双视图（Melt vs Mint）+ warningText 硬编码英文 + ComparisonCard + statusAmountValue 多来源。
10. **校验 reserve/reserve-post-to-suspense-modal**：可编辑表 + leafAccounts 动态下拉 + 借贷平衡；**详情页不挂载入口**（R1 feature-flag 隐藏），保留组件待后端。
11. **校验 4 列表/筛选下拉**：动态 `updateAvailableOptions`（real-time list）、currency/blockchain/tokenType 三个公共 hook 映射、ALL_VALUE='all'。
12. **拆 content 子组件**：4 个超大 Modal 各拆 `<modal>-content.tsx`，shell 留 Drawer 壳，避免 nx lazy 误报（参照 journal-entries 经验）。
13. **单测 + lint/test/build**：`pnpm nx lint/test/build reconciliation`；verify 子 agent grep `ALL_VALUE\s*=\s*''` 确认无空串。

> 步骤粒度：每步对应一个可独立开发的 loop 任务。步骤 5/6/7/8/9/10 为重灾区（Modal 内部逻辑 + Investigation 过滤），分配 opus；步骤 2/3/4/11/12/13 分配 haiku/sonnet。

---

## 8. 风险与注意事项

### 8.1 上次迁移缺失/缩水清单（本次推倒重写的依据，逐条对照源码）

经逐文件 Read 源码 + grep 对照上次 feature 层产物，确认以下缺失/缩水：

1. **real-time Investigation Queue 前端过滤逻辑全缺**（重灾）：源码 `detail.tsx:43 INVESTIGATION_STATUSES=new Set([3])` + `filterInvestigationRows`（同时改 page.total 与 rows）+ `investBadge` 角标轻量请求（pageSize=1）。上次 `real-time-detail-page.tsx` grep `INVESTIGATION_STATUSES|filterInvestigationRows|investBadge|resolveDetailTab` **全部未命中**（仅命中 2 次 canPostSuspense）。导致 Investigation Tab 显示全集而非仅 status=3，角标数字错误。
2. **real-time PostToSuspenseModal 关键推断逻辑缩水**（重灾）：源码 767 行，上次 532 行（缩水 31%）。grep 确认 `resolveDisplayUnmatchedType`/`toPostingDateEpoch`/`mapSuggestedSuspenseEntries` **缺失**（仅 `suggestedSuspenseEntries` 命中）。导致 unmatchedType 显示标签错乱、postingDate 未转 UTC epoch（提交值类型错误）、建议分录回显断。
3. **real-time ReconLogModal TX_TYPE_REPOSITORY_OUT 特殊分支缺失**：源码 `originalEntries` useMemo 对 `txType===10` 硬编码注入 2002/2003 Stablecoin 分录。上次 `recon-log-modal.tsx` 572→461（缩水 19%），需校验该分支是否保留。
4. **reserve ReserveReconLogModal 双视图 + warningText**：源码 496→上次 495（行数近持平），但 grep 显示 `isReserveOut`/`isMint`/`meltActualExecution`/`ComparisonCard`/`Request vs Execution` 均命中，**疑似完整**，需运行时校验双视图切换与 warningText 英文文案是否渲染。
5. **reserve ReservePostToSuspenseModal 详情页未挂载**：源码 reserve 详情页 action 只有 ReconLog（ReservePostToSuspense 组件存在但无入口，因 R1 后端端点缺失）。上次迁移需保持一致（feature-flag 隐藏入口），**不可擅自挂载**否则运行时调缺失端点 404。
6. **adjustments 子系统**：源码有完整 mock（302 行）+ AdjustmentShared 辅助组件，但**老项目无对应 pages**（半成品）。上次迁移正确地未迁移 adjustments 列表/详情/编辑页。本次维持不迁移，仅确认 3 个共享组件（Section/DrawerCard/MetricCard）已正确落到 ui 层。

### 8.2 运行时坑清单（阶段五 verify 必须 grep 拦截 + 跑应用冒烟）

1. **ALL_VALUE 空串 → 目标改 'all'**：老项目 4 处 `*Options` 的"全部"用 `value=''`（PUB_All）。目标侧 Radix `SelectItem` 禁 `value=""` 否则 `Runtime Error: Select.Item must have value not empty` 崩溃。`ALL_VALUE='all'`，筛选 `!== ALL_VALUE` 时转 `undefined` 不传后端。**verify grep `ALL_VALUE\s*=\s*''` 拦截**（静态可抓）。
2. **ICU 老项目 `{{var}}` → 目标 next-intl `{var}`**：老 i18next 双花括号（如 `reconciliation_0142` 的 `{{time}}`），目标 next-intl 单花括号。抄 message 时 `{{xxx}}`→`{xxx}`，否则 `INVALID_MESSAGE: MALFORMED_ARGUMENT`。
3. **list 请求体 pageNum**：finance 域 list 后端要 `{data, page:{pageNum,pageSize}}`（api.ts postList 已实现）。确保 query hook 走 postList 不绕开。
4. **i18n 双重前缀**：命名空间已 `modules.reconciliation`，labelKey/常量 KEY_PREFIX **不要再带 `reconciliation.` 前缀**，否则拼成 `modules.reconciliation.reconciliation.xxx` → `MISSING_MESSAGE`。
5. **reserve/post-suspense 后端端点缺失（R1）**：老 api.ts 注释明示 mock 顶位。`postReserveSuspense` 函数保留，feature 层 feature-flag 隐藏挂账入口，待后端就绪移除 flag。**不可联调此写操作**。
6. **4 Modal 体量大需拆 content**：767/629/572/496 行，直接放 feature 层易触发 nx lazy/chunk 误报。参照 journal-entries 经验拆 `<modal>-content.tsx`（shell 留 Drawer 壳 + props，content 放表单/表格逻辑）。
7. **跨域 accounts/leaf 复用**：reserve `ReservePostToSuspenseModal` 调 tx 域 `tx/accounts/leaf`（入参 financeBookId），api.ts 已置共享层 `getLeafAccounts`。确认 query hook 复用同一函数。
8. **investigation 前端过滤改 total**：`filterInvestigationRows` 同时改 `page.total`（角标数字）与 `rows`（表格数据）。query 层 select 必须两处都改，否则角标显示全集数、表格却过滤后（数字不一致）。
9. **硬编码英文文案**：ReserveReconLogModal 的 `reserveWarningText`（status 3/4/5）、`reserveDialogTitle`（"Unauthorized Movement"/"Over-minting"）、"Request vs Execution"/"No transaction request found" 等为源码硬编码英文，**非 i18n key**。迁移时按源码照搬硬编码英文（与源一致），不强行 i18n 化（源未提供对应 key）。
10. **action 跳转参数变化**：老项目列表页 Details/PostToSuspense 跳 `/reconciliation/real-time/detail?tokenId=&tab=`；上次迁移路由改 `/reconciliation/real-time/view`（detail，path 参数 + query）。确认 query 解析（tokenId/reserveAccountId/tab）在目标 page.tsx 正确读取。

### 8.3 已知限制（不迁移项）

- `ReconciliationBasePage.tsx`（57 行占位页）：无业务、无 API、未被 4 业务页面引用，不迁移。
- adjustments 子系统（mock 302 行 + AdjustmentShared 辅助组件 + `ReconciliationAdjustmentStatus` 6 态）：老项目无对应 pages，半成品，不迁移。仅迁移其中被业务页面引用的 3 共享组件。
- 3 个 mock.ts（real-time 296 + reserve 324 + adjustments 302）：目标侧不保留 mock（用 TanStack Query 替代 useSWR/customFetch），仅作数据结构参考补 model.ts 字段。
- reserve/post-suspense 写操作：后端端点缺失（R1），组件保留但入口 feature-flag 隐藏，不可联调。
- 老项目 `useSWR`/`customFetch`/`swrFetcher`/`realtimeFetch`/`reserveFetch` 模式 A（MOCK 开关）：目标侧全部替换为 TanStack Query hooks，不保留 mock 路由。

---

## 9. 验收标准

- **列表页（real-time + reserve）**：4 个筛选表单（7/5 项）全部可填可清，RangePicker 正常；汇总表格列完整（10/9 列）、分页正常（pageNum）、统计列（matched/unmatched/actioned、matched/exceptions）着色正确；real-time 动态下拉（blockchain/currency 从 list 行抽取，空则回退通用）可交互；action 跳转详情页带正确 query（tokenId/reserveAccountId/tab）。
- **详情页基本信息 + 统计卡片**：basic-detail 接口（tokenId/reserveAccountId）正确加载，9/8 格 KV 完整，Skeleton 加载态正常；real-time 3 卡片（matched/unmatched/actioned）、reserve 2 卡片（matched/exceptions，无 actioned）数值与着色正确；extra 时间插值（`{time}`）无 INVALID_MESSAGE。
- **详情页双 Tab**：Reconciliation List + Investigation Queue 切换正常；real-time Investigation **仅显示 status===3**（前端过滤生效，角标数字=过滤后数）；reserve Investigation 显示后端全集（R2 不过滤）；角标轻量请求不阻塞主表。
- **PostToSuspenseModal（real-time）**：仅 `status===3 && canPostSuspense` 行可打开；recon-log 回显完整（顶部 8 格 + Original + Onchain + Suspense 只读表 + Exception Context）；`resolveDisplayUnmatchedType` 标签正确（1/2/3）；借贷平衡汇总（drTotal/crTotal/diff）实时计算；`canConfirm` 校验生效（未平衡/未填日期/未填 context 禁用 Confirm）；提交调 `tx/post-suspense` payload 含 `postingDate(UTC epoch)`，code===0 成功后刷新当前 Tab 表格。
- **ReconLogModal（real-time）**：非挂账行可打开；recon-log 回显完整；`TX_TYPE_REPOSITORY_OUT(10)` 行 Original Entry 注入 2002/2003 硬编码分录；statusTag 在 3/5/6 拼接 resultLabel；Suspense Entries 仅已挂账行展示；Close 只读。
- **ReserveReconLogModal（reserve）**：action=ReconLog 可打开；status 3/4/5 渲染 warningText 英文警告条；`isReserveOut(type=2)` 显示 "Request vs Execution" 双卡（无 request 时红色 Unauthorized 提示）；`isMint(type=1)` 显示 "Mintable Capacity vs Mint Execution" 双卡；statusLabel 卡片金额（mint+overcap 用 capacity-execution 推断）正确；Close 只读。
- **ReservePostToSuspenseModal（reserve）**：组件完整存在但**详情页无入口**（R1 feature-flag 隐藏，验收时不强求可打开）；内部可编辑表（direction/accountCode 从 leafAccounts 动态/amount/InputNumber/删除/新增行）+ 借贷平衡逻辑就绪待后端。
- **状态枚举渲染**：txTypeLabel(5/10/15/20/25)、reserveTxTypeLabel(1/2)、statusTag(6 态 real-time)、reserveStatusTag(6 态 0-5)、unmatchedTypeTag(1/2/3) 全部对照源码 className 与文案渲染正确。
- **i18n**：所有 `reconciliation_xxxx`（0095~0233，超 60 key）+ PUB_* 映射到位，无 MISSING_MESSAGE（含双重前缀排查）、无 INVALID_MESSAGE（ICU 单花括号）；硬编码英文（ReserveReconLog warningText/dialogTitle）按源码照搬。
- **静态验收**：`pnpm nx lint reconciliation` 零 error；`pnpm nx test reconciliation` 全绿；`pnpm nx build reconciliation`（或 build 受影响 app）exit 0；verify grep `ALL_VALUE\s*=\s*''` 无命中。
- **运行时冒烟**：登录后 `/reconciliation/real-time` + `/reconciliation/reserve` 列表页 200 非 404（group 机制生效）；逐页打开控制台无 Runtime Error（SelectItem 空串、null.map）；列表有数据；筛选下拉可交互；real-time 详情页对 status===3 行点 PostToSuspense 弹窗能打开、表单可填、提交调正确 API。

---

## 生成 Agent（阶段一）操作约束自检

1. 先跑脚本：✅ 读 `/tmp/reconciliation-meta.txt`（SOURCE_FILES/API_ENDPOINTS/STATUS_ENUMS/I18N_HINTS 作为第 2/3/6 章事实基准）。
2. 读源码补判断：✅ 11 个源文件（4 pages + 7 components）+ 3 mock 全文 Read；api wrapper 采用给定摘要 + 目标侧 api.ts 全文校验。
3. 状态映射完整搬运：✅ txTypeLabel/reserveTxTypeLabel/statusTag/reserveStatusTag/4 个 Options/unmatchedTypeTag 全部照搬完整键值到第 6.3 节。
4. 输出路径：✅ `.codex/plan/modules/reconciliation.md`。
5. 自检迁移率四维度：见下方返回报告。
