# cross-chain 模块迁移计划

## 1. 业务概述

cross-chain 模块管理跨链基础设施五类业务实体：**跨链交易记录（cross-chain-transactions）**、**汇率（fx-rate）**、**流动性池（liquidity-pool）**、**RD-Bridge 跨链桥配置（rd-bridge）**、**代币对（token-pair）**。主要操作：跨链交易/汇率/流动性池/代币对支持「查询列表 + 查看详情」；流动性池额外支持「新增 / 编辑 / 重新授权（reauthorize）/ 转出（transferOut）」+ 钱包生成；rd-bridge 支持「注册 / 编辑 / 启用 / 禁用」+ 操作记录 Drawer 详情；代币对支持「新增 / 编辑 / 启用 / 禁用」。页面构成：**5 个列表页 + 4 个详情页 + 3 个编辑页 = 12 页**（fx-rate 无编辑页，详情页用 CustomTable 而非 Descriptions）。特殊业务规则：① **流动性池三页最复杂**——列表的 reauthorize/transferOut 共用一个动态 Modal（按 title 分支渲染不同字段，含 InputNumber 小数位校验 + keystorePassword AES 加密），编辑页含「生成钱包」Modal（按 blockName 区分 evm/aptos 调 wallet/keystore）；② **代币对编辑页最强联动**——sendToken Select 触发动态 URL `getReceiveTokenApi(tokenId)` 拉目标链代币列表，自动选中首个填充 receive 字段，含 `latestSendTokenIdRef` 竞态保护；③ **3 处动态拼接 URL**（tokenPair/getEndpointId/{blockchainId}、getLiquidityPool/{tokenId}、getReceiveToken/{tokenId}）尾部斜杠后拼动态 id；④ **状态枚举 5 套**键值互不相同（含一处源码拼写错误 `liquidityPooTTransactionStstus`）；⑤ 状态/类型文案大量走 i18n key 动态拼接（`blockchain_code_color_${name}` / `cross_chain_status_${n}` / `liquidity_pool_status_${n}` 等）；⑥ 密码字段统一经 `getEncryptionData`（AES-CBC）加密后传输。

## 2. 源文件清单

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/pages/cross-chain/cross-chain-transactions/index.tsx` | 426 | 跨链交易列表页：筛选（源/目标 token + 源/目标链 + 状态 + 创建时间）+ 表格（transferId/方向/from/to/手续费/汇率）+ 行「查看」（Refund 行操作为注释死代码，不迁移），调用 cross/transactions/listPage + blockchain + stablecoin 下拉 |
| `src/pages/cross-chain/cross-chain-transactions/view.tsx` | 495 | 跨链交易详情页：顶部信息区（8 字段）+ antd `Steps` 垂直时间线（按 index 0–3+ 分支渲染不同日志结构，35=success/20·30=空/40=error 状态机）+ 返回，调用 cross/transactions/detail + getTransactionsTreeDetailApi |
| `src/pages/cross-chain/fx-rate/index.tsx` | 118 | 汇率列表页：筛选（货币对 Select + 时间范围）+ 表格（货币对/汇率/更新时间），调用 fx/v1/rate/list + fx/v1/rate/currency/pair/list 下拉；**无状态枚举**（纯展示） |
| `src/pages/cross-chain/fx-rate/view.tsx` | 96 | 汇率详情页：**用 CustomTable（非 Descriptions）**呈现历史汇率分页列表，筛选（时间范围）+ 表格（货币对/汇率/创建时间），initialValues 带 rateId，调用 fx/v1/rate/detail |
| `src/pages/cross-chain/liquidity-pool/edit.tsx` | 530 | 流动性池新增/编辑共用页（query.id 区分）：tokenId Select + 钱包地址（生成钱包 Modal，调 wallet/keystore）+ deductibleAmount（小数位校验）+ keystore/keystorePassword + threshold + emailRecipients（email 批量校验≤20）+ Checkbox 拉全员邮箱，调用 liquidityPool/new·edit·details·new/emailList·new/tokenList + wallet/keystore |
| `src/pages/cross-chain/liquidity-pool/index.tsx` | 507 | 流动性池列表页：筛选（地址/token/链/状态/更新时间）+ 表格 + 顶部「新增」+ 行操作「查看/编辑/重新授权/转出」（共用动态 Modal），调用 liquidityPool/listPage + reauthorize·transferOut + blockchain + stablecoin 下拉 |
| `src/pages/cross-chain/liquidity-pool/view.tsx` | 567 | 流动性池详情页：4 个 Tabs（基本信息 2 组 Descriptions + transactions 表 + authorization 表 + operationRecords 表），3 个 useCustomTable，含跨模块跳 `/approval-manage/view` + 内部跳 cross-chain-transactions/view，调用 liquidityPool/details/* 4 endpoint |
| `src/pages/cross-chain/rd-bridge/edit.tsx` | 440 | RD-Bridge 注册/编辑共用页（query.id 区分）：链 Select + endpointId + 3 合约地址（hex 校验）+ 4 钱包/监控字段 + notifyEmail（email 批量校验）+ Checkbox 拉全员邮箱，调用 cross/chain/save·edit·getBlockChainList·getCrossChainDetail·getAllUserEmailList |
| `src/pages/cross-chain/rd-bridge/index.tsx` | 368 | RD-Bridge 列表页：筛选（链/endpointId/3 合约地址/状态/创建时间）+ 表格 + 顶部「注册」+ 行操作「查看/编辑/禁用/启用」（Disable 共用 Modal，`isTokenPaired===1` 时弹 warning 拦截），调用 cross/chain/getCrossChainList·update + getBlockChainList 下拉 |
| `src/pages/cross-chain/rd-bridge/view.tsx` | 447 | RD-Bridge 详情页：2 个 Tabs（基本信息 3 组 Descriptions + 操作记录表）+ Drawer 详情（用 CustomInformation），调用 cross/chain/getCrossChainDetail + getCrossChainRecordList·getCrossChainRecordDetail |
| `src/pages/cross-chain/token-pair/edit.tsx` | 458 | 代币对新增/编辑共用页（query.id 区分）：sendToken Select 触发 getReceiveTokenApi 动态拉目标链列表（竞态保护）→ 自动填充 receive 全字段 + crossChainFee（小数位校验），编辑态 getTokenPairDetailApi 回填，调用 tokenPair/getSendToken·getReceiveToken·save·edit·getTokenPairDetail |
| `src/pages/cross-chain/token-pair/index.tsx` | 454 | 代币对列表页：筛选（send/receive token + send/receive 链 + 状态 + 更新时间）+ 表格（方向含色块）+ 顶部「新增」+ 行操作「查看/编辑/禁用/启用」（共用 Modal），调用 tokenPair/queryTokenPairList·update + blockchain/enableList + stablecoin 下拉 |
| `src/pages/cross-chain/token-pair/view.tsx` | 320 | 代币对详情页：2 个 Tabs（基本信息左右两栏 CustomInformation + 中间图标 + 操作记录表），含跨模块跳 `/approval-manage/view`，调用 tokenPair/getTokenPairDetail·queryOperationRecords |

> 数据来源：`extract-module-meta.sh` 的 `SOURCE_FILES` 段（13 文件 / 5226 行）。「用途」由 Agent 逐文件读源码判断。注意：实际写操作 / 动态拼接 endpoint 封装在 `src/lib/api/cross-chain.ts`（27 个导出）+ `src/lib/api/common.ts`（7 个导出），脚本通过 import 解析把整组导出都列进「api 模块封装」组，本模块实际只引用其中一部分（见第 3 章按页面真实 import 裁剪）。

## 3. 依赖的 API

> 数据来源：`extract-module-meta.sh` 的 `API_ENDPOINTS`（页面字面量 22 + api 模块封装 27，有重叠）+ 源码逐文件核对。**脚本通过 import 解析把 `cross-chain.ts`（27）+ `common.ts`（7）整组导出都列入「api 模块封装」，但本模块实际只引用其中一部分**。经逐文件核对真实 import：
> - `cross-chain.ts` 实际被引用：`updateCrossChainApi`、`getTransactionsTreeDetailApi`、`reauthorizeLiquidityPoolApi`、`transferOutLiquidityPoolApi`、`editLiquidityPoolApi`、`getLiquidityPoolDetailsApi`、`getLiquidityPoolEmailListtApi`、`saveLiquidityPoolApi`、`getBlockChainListApi`、`getAllUserEmailListApi`、`getCrossChainDetailApi`、`getCrossChainRecordDetailApi`、`editCrossChainApi`、`saveCrossChainApi`、`crossChainTokenPairUpdateApi`、`getReceiveTokenApi`、`saveTokenPairApi`、`editTokenPairApi`、`getTokenPairDetailApi` = **19 个**（cross-chain.ts 共 27 个导出，余下 8 个中：`getEndpointIdApi`/`getLiquidityPoolApi` token-pair/edit 未 import 但同模块语义相关；其余实际未用）。
> - `common.ts` 实际被引用：`getWalletKeystoreApi` = **1 个**（liquidity-pool/edit 生成钱包）。其余 6 个（downloadApi/modifyPasswordApi/getAccessKeyApi/getTokenTypeApi/getBankListApi/getResourcesApi）**本模块未使用，不迁移**。
> - 页面字面量 useSWR/useCustomTable.url：fx-rate 3 个（currency/pair/list、rate/list、rate/detail）+ cross/transactions/detail·listPage + liquidityPool 多个 + rd-bridge getCrossChainDetail·getCrossChainList·getCrossChainRecordList + token-pair queryTokenPairList·queryOperationRecords·getTokenPairDetail·getSendToken + 公共下拉 3 个。
>
> **去重后实际 endpoint 集合 = 33 个**（页面字面量与封装重叠的，如 `getCrossChainDetail`/`getTokenPairDetail`，按 1 个计）。**不涉及文件下载（无 blob）**——本模块无 download 调用。

### 3.1 列表 API

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/cross/transactions/listPage` | POST | `cross-chain-transactions/index.tsx` 的 `useCustomTable.url` | 跨链交易分页列表查询 |
| `/api/fx/v1/rate/list` | POST | `fx-rate/index.tsx` 的 `useCustomTable.url` | 汇率分页列表查询 |
| `/api/fx/v1/rate/detail` | POST | `fx-rate/view.tsx` 的 `useCustomTable.url`（initialValues 带 `rateId`） | 汇率详情页历史汇率分页列表（**详情页用列表接口**） |
| `/api/manage/v1/cross/liquidityPool/listPage` | POST | `liquidity-pool/index.tsx` 的 `useCustomTable.url` | 流动性池分页列表查询 |
| `/api/manage/v1/cross/liquidityPool/details/operationRecords` | POST | `liquidity-pool/view.tsx` 的 `useCustomTable.url`（initialValues 带 `liquidityPoolId`） | 流动性池详情-操作记录 Tab 分页列表 |
| `/api/manage/v1/cross/liquidityPool/details/transactions` | POST | `liquidity-pool/view.tsx` 的 `useCustomTable1.url`（initialValues 带 `liquidityPoolId`） | 流动性池详情-交易 Tab 分页列表 |
| `/api/manage/v1/cross/liquidityPool/details/authorization` | POST | `liquidity-pool/view.tsx` 的 `useCustomTable2.url`（initialValues 带 `liquidityPoolId`） | 流动性池详情-授权记录 Tab 分页列表 |
| `/api/manage/v1/cross/chain/getCrossChainList` | POST | `rd-bridge/index.tsx` 的 `useCustomTable.url` | RD-Bridge 分页列表查询 |
| `/api/manage/v1/cross/chain/getCrossChainRecordList` | POST | `rd-bridge/view.tsx` 的 `useCustomTable.url`（initialValues 带 `crossChainId`） | RD-Bridge 详情-操作记录 Tab 分页列表 |
| `/api/manage/v1/crossChain/tokenPair/queryTokenPairList` | POST | `token-pair/index.tsx` 的 `useCustomTable.url` | 代币对分页列表查询 |
| `/api/manage/v1/crossChain/tokenPair/queryOperationRecords` | POST | `token-pair/view.tsx` 的 `useCustomTable.url`（initialValues 带 `tokenCrossChainId`） | 代币对详情-操作记录 Tab 分页列表 |

> **分页字段注意（硬约束 #5）**：全部列表接口均通过 `useCustomTable` 走后端，分页请求体字段沿用 RBAC/sys 域约定的 `pageNum`/`pageSize`（参考 blockchain / sys 历史踩坑）。迁移时若复用 admin-platform 的 `DataTable` + TanStack Query，**api 层必须确保请求体用 `pageNum`**（或在 api 层经 `getRbacPaginated` 映射），否则数据不显示。

### 3.2 详情 API

| Endpoint | Method | 调用方文件 | 触发场景 |
|----------|--------|-----------|----------|
| `/api/manage/v1/cross/transactions/detail` | POST | `cross-chain-transactions/view.tsx` 的 `useSWR`（参数 `{ transferId }`） | 跨链交易详情页顶部信息区 |
| `/api/manage/v1/cross/transactions/tree/details` | POST（`getTransactionsTreeDetailApi` 封装） | `cross-chain-transactions/view.tsx` 的 `getTransactionsTreeDetail`（参数 `{ transferId }`） | 跨链交易详情页 Steps 时间线节点数据 |
| `/api/manage/v1/cross/liquidityPool/details/basicInformation` | POST | `liquidity-pool/view.tsx` 的 `useSWR`（参数 `{ liquidityPoolId }`） | 流动性池详情页基本信息区 |
| `/api/manage/v1/cross/liquidityPool/details` | POST（`getLiquidityPoolDetailsApi` 封装） | `liquidity-pool/edit.tsx` 的 `getLiquidityPoolDetails`（参数 `{ liquidityPoolId }`） | 流动性池编辑页回填（含 keystore/threshold/emailRecipients） |
| `/api/manage/v1/cross/chain/getCrossChainDetail` | POST | `rd-bridge/view.tsx` 的 `useSWR`（参数 `{ crossChainId }`）+ `rd-bridge/edit.tsx` 的 `getCrossChainDetailApi`（封装，参数 `{ crossChainId }`） | RD-Bridge 详情页信息区 + 编辑页回填（**两处共用同一 endpoint，去重 1 个**） |
| `/api/manage/v1/cross/chain/getCrossChainRecordDetail` | POST（`getCrossChainRecordDetailApi` 封装） | `rd-bridge/view.tsx` 的 `getCrossChainRecordDetail`（参数 `{ crossChainRecordId }`） | RD-Bridge 操作记录行「查看」→ Drawer 详情 |
| `/api/manage/v1/crossChain/tokenPair/getTokenPairDetail` | POST | `token-pair/view.tsx` 的 `useSWR`（参数 `{ tokenCrossChainId }`）+ `token-pair/edit.tsx` 的 `getTokenPairDetailApi`（封装，参数 `{ tokenCrossChainId }`） | 代币对详情页 + 编辑页回填（**两处共用同一 endpoint，去重 1 个**） |

### 3.3 写操作 / 其他 API（创建 / 编辑 / 启停 / 授权 / 转出 / 钱包生成 / 子查询）

> 来源：`@/lib/api/cross-chain.ts`（19 个被引用）+ `@/lib/api/common.ts`（1 个 wallet/keystore）。均封装在 api 模块，脚本「api 模块封装」组已抓到。**涉及文件下载：否**（无 blob）。

| 函数（源） | Endpoint | Method | 调用方 | 触发场景 |
|-----------|----------|--------|--------|----------|
| `updateCrossChainApi` | `/api/manage/v1/cross/chain/update` | POST | `cross-chain-transactions/index.tsx` Refund Modal（**注释死代码，不迁移**）+ `rd-bridge/index.tsx` Disable/Enable Modal | rd-bridge 启停：传 `status: 50(禁用)/35(启用)` + remarks + crossChainId，成功刷新列表 |
| `getBlockChainListApi` | `/api/manage/v1/cross/chain/getBlockChainList` | POST | `rd-bridge/index.tsx`（下拉）+ `rd-bridge/edit.tsx`（下拉 + 默认选中首个预填 symbol） | RD-Bridge 链下拉（`{ blockChainId, blockChainName, unit }`）—— 注意与 common/blockchain/list 不同 |
| `getAllUserEmailListApi` | `/api/manage/v1/cross/chain/getAllUserEmailList` | POST | `rd-bridge/edit.tsx` Checkbox 拉全员邮箱 | 「使用全员邮箱」勾选时拉取并填 notifyEmail |
| `saveCrossChainApi` | `/api/manage/v1/cross/chain/save` | POST | `rd-bridge/edit.tsx` 的 `onFinish`（无 query.id） | 注册 RD-Bridge，成功 Toast + 返回 |
| `editCrossChainApi` | `/api/manage/v1/cross/chain/edit` | POST | `rd-bridge/edit.tsx` 的 `onFinish`（有 query.id） | 编辑 RD-Bridge（剔除 endpointId/blockchainId），成功返回 |
| `saveLiquidityPoolApi` | `/api/manage/v1/cross/liquidityPool/new` | POST | `liquidity-pool/edit.tsx` 的 `onFinish`（无 query.id） | 新增流动性池，keystorePassword 经 `getEncryptionData` 加密，成功返回 |
| `editLiquidityPoolApi` | `/api/manage/v1/cross/liquidityPool/edit` | POST | `liquidity-pool/edit.tsx` 的 `onFinish`（有 query.id） | 编辑流动性池（剔除 tokenId/keystorePassword 除非改密），select 字段带 Checkbox 态 |
| `reauthorizeLiquidityPoolApi` | `/api/manage/v1/cross/liquidityPool/reauthorize` | POST | `liquidity-pool/index.tsx` Reauthorize Modal | 重新授权：传 `liquidityPoolId + deductibleAmount`，成功刷新 |
| `transferOutLiquidityPoolApi` | `/api/manage/v1/cross/liquidityPool/transferOut` | POST | `liquidity-pool/index.tsx` TransferOut Modal | 转出：传 `liquidityPoolId + amount + keystorePassword(加密) + receiverWalletAddress`，成功刷新 |
| `getLiquidityPoolEmailListtApi` | `/api/manage/v1/cross/liquidityPool/new/emailList` | GET | `liquidity-pool/edit.tsx` Checkbox 拉全员邮箱 | 「使用全员邮箱」勾选时拉取并填 emailRecipients（**注意源码函数名 `Listt` 多一个 t，拼写错误**） |
| `getWalletKeystoreApi` | `/api/manage/v1/util/wallet/keystore` | POST（来自 `common.ts`） | `liquidity-pool/edit.tsx` 的 `setWalletInfo`（生成钱包 Modal） | 按 `chainType: blockName==='Aptos'?'aptos':'evm'` + password(加密) 生成 keystore + walletAddress，回填表单 |
| `crossChainTokenPairUpdateApi` | `/api/manage/v1/crossChain/tokenPair/update` | POST | `token-pair/index.tsx` Disable/Enable Modal | 代币对启停：传 `tokenCrossChainId + remarks + status: 50(禁用)/35(启用)`，成功刷新 |
| `saveTokenPairApi` | `/api/manage/v1/crossChain/tokenPair/save` | POST | `token-pair/edit.tsx` 的 `onFinish`（无 query.id） | 新增代币对（send/receive 全字段），成功返回 |
| `editTokenPairApi` | `/api/manage/v1/crossChain/tokenPair/edit` | POST | `token-pair/edit.tsx` 的 `onFinish`（有 query.id） | 编辑代币对（仅 crossChainFee 可改），成功返回 |
| `getReceiveTokenApi` | **`/api/manage/v1/crossChain/tokenPair/getReceiveToken/${tokenId}`**（动态拼接 URL） | GET | `token-pair/edit.tsx` 的 `getReceiveToken` | sendToken 切换时按 tokenId 拉目标链可选代币列表，含竞态保护 |
| `getEndpointIdApi` | **`/api/manage/v1/crossChain/tokenPair/getEndpointId/${blockchainId}`**（动态拼接 URL） | GET（封装在 cross-chain.ts，**token-pair/edit 当前未 import，预留**） | 按 blockchainId 拉 endpointId（源码未实际调用，迁移时确认是否需要） |
| `getLiquidityPoolApi` | **`/api/manage/v1/crossChain/tokenPair/getLiquidityPool/${tokenId}`**（动态拼接 URL） | GET（封装在 cross-chain.ts，**token-pair/edit 当前未 import，预留**） | 按 tokenId 拉流动性池（源码未实际调用，迁移时确认是否需要） |

> **脚本遗漏（硬约束 #2，第 8 章复述）**：3 个动态拼接 URL 的真实形态是模板字符串 `` `/api/.../getReceiveToken/${tokenId}` ``（尾部斜杠后拼动态 id），脚本静态扫描只抓到 `getEndpointId/`、`getLiquidityPool/`、`getReceiveToken/`（带尾斜杠），拼接规则需从 `cross-chain.ts` 源码补全。其中 `getReceiveTokenApi` 被 token-pair/edit 实际使用（核心联动），`getEndpointIdApi`/`getLiquidityPoolApi` 封装存在但 token-pair/edit 未 import（迁移时按需保留）。

### 3.4 公共下拉数据源

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/common/blockchain/list` | POST（useSWR） | `cross-chain-transactions/index.tsx`、`liquidity-pool/index.tsx` | 「链」下拉，`{ key, value, status }`，`status===1` 可选否则 disabled |
| `/api/manage/v1/common/blockchain/enableList` | POST（useSWR） | `token-pair/index.tsx` | 「链」下拉（**注意是 enableList 非 list**），`{ key, value }`（仅启用链） |
| `/api/manage/v1/common/stablecoin/enabled/searches` | POST（useSWR） | `cross-chain-transactions/index.tsx`、`liquidity-pool/index.tsx`、`token-pair/index.tsx` | 「Token」下拉，`{ stablecoinId, name }` |
| `/api/manage/v1/cross/liquidityPool/new/tokenList` | POST（useSWR） | `liquidity-pool/edit.tsx` | 流动性池新增时 tokenId 下拉，`{ tokenId, tokenName, symbol, decimalPrecision, blockName }`（编辑态默认选中首个） |
| `/api/manage/v1/cross/chain/getBlockChainList` | POST（非 useSWR，手动调） | `rd-bridge/index.tsx`、`rd-bridge/edit.tsx` | RD-Bridge 链下拉（**与 common/blockchain/list 不同**），`{ blockChainId, blockChainName, unit }` |
| `/api/fx/v1/rate/currency/pair/list` | POST（useSWR） | `fx-rate/index.tsx` | 「货币对」下拉，`{ rateId, sendCurrencySymbol, receiveCurrencySymbol }` |

### 3.5 依赖共享组件 / 工具

- `CustomTable` / `useCustomTable` / `CustomTableTitle` / `CustomForms` / `CustomModal` / `useHook`（来自 `libs/components`）
- `CustomIBasicDetailsInfo`（来自 `libs/components/CustomIBasicDetailsInfo`，详情页 Descriptions 展示，liquidity-pool/view + rd-bridge/view 用）
- `CustomInformation`（来自 `@/pages/approval-manage/components/CustomInformation`，**80 行纯展示组件，无外部依赖**，token-pair/view + rd-bridge/view Drawer 用 → **决策：搬到 cross-chain/ui 层复用**，非缺失风险）
- `formatTimestamp` / `getServerSidePropsResult` / `reSet`（来自 `libs/utils`；`reSet` 为金额千分位+2位小数格式化，补 0）
- `getEncryptionData`（来自 `libs/utils/get/getEncryptionData`，**AES-CBC 加密**，CryptoJS，固定 key `reddatespartan25` + iv `hongzao25spartan`；liquidity-pool 三处密码字段加密用 → 迁移需引入 crypto-js + 此工具）
- `showAddress` / `isHexPrefixed`（来自 `@/utils`，钱包地址缩写 + `/^0x/` 正则）
- `request`（来自 `lib/api/axios`，封装 `@/lib/api/cross-chain.ts` 与 `common.ts`）
- `ArrowRightCircleIcon`（`@heroicons/react/24/outline`）、`XMarkIcon`（`@heroicons/react/20/solid`）、`InfoCircleOutlined` / `InformationCircleIcon` / `ExclamationCircleFilled`（`@ant-design/icons` + heroicons）
- `useSWR`（swr，下拉 / 详情数据获取）
- `types/models` 的 `ResultPageInfo`（列表分页响应类型）/ `ResultInfo`（api 封装返回类型）
- i18n 命名空间：`cross-chain`（主），`common` / `router`（getServerSideProps）

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **高** |
| 困难分数 | 4/5 |
| 主要难点 | ① **5 子模块、12 页、33 个 endpoint**（含 3 个动态拼接 URL、5 套状态枚举、1 处拼写错误 `liquidityPooTTransactionStstus`、1 处函数名拼写错误 `getLiquidityPoolEmailListtApi`），规模为迄今最大之一；② **liquidity-pool 三页最复杂**——index 的 Reauthorize/TransferOut 共用一个动态 Modal（按 modalInfo.status 分支渲染 deductibleAmount 单字段 vs receiverWalletAddress+amount+keystorePassword 三字段，含 InputNumber 小数位 validator + keystorePassword AES 加密），edit 含「生成钱包」Modal（chainType evm/aptos 分支 + password 加密 + keystore 回填 + email 批量校验≤20 + 默认选中首个 token），view 是 4 Tabs + 3 useCustomTable（含跨模块跳 `/approval-manage/view` + 内部跳 cross-chain-transactions/view + transactionType===3 显示 N/A 占位）；③ **token-pair/edit 最强联动**——sendToken Select 触发动态 URL `getReceiveTokenApi(tokenId)` 拉目标链列表 → 自动选中首个填充 receive 全字段（endpointId/crossChainAddress/liquidityPoolWalletAddress），含 `latestSendTokenIdRef` 竞态保护（切换 Token 时抛弃过期响应），新增态 `useEffect(sendToken)` 自动选 sendToken[0]，编辑态 `getTokenPairDetailApi` 回填，send 无流动性池时提示跳 `/cross-chain/liquidity-pool/edit`；④ **rd-bridge/index Disable 拦截逻辑**——`isTokenPaired===1` 时弹 warning Modal 阻止禁用（需先用代币对解绑），Enable/Disable 共用 Modal 调 updateCrossChainApi（status:35/50）；⑤ **3 处动态拼接 URL**（getEndpointId/getLiquidityPool/getReceiveToken）尾部斜杠后拼动态 id，脚本静态扫描抓不全拼接规则，需从 cross-chain.ts 源码补全；⑥ **状态枚举 5 套**键值互不相同（cross-chain-transactions 4 值 / liquidity-pool approval 3 值 + transaction 4 值 / rd-bridge 2 值 / token-pair 4 值），合并决策见 6.1；⑦ 状态/类型文案大量走 i18n key 动态拼接（`blockchain_code_color_${name}` / `cross_chain_status_${n}` / `liquidity_pool_status_${n}` / `liquidity_pool_transaction_type_${n}` / `liquidity_pool_authorization_*` / `cross_chain_operation_status_*` / `approval_task_status_color_${n}` / `common_task_status_${n}` / `token_pair_status_${n}` 等），无单一静态映射表；⑧ 密码字段统一经 AES-CBC 加密（CryptoJS），迁移需引入加密工具链。 |
| 建议负责人 | 高级前端（liquidity-pool 三页 + token-pair/edit 联动 + 动态 URL + AES 加密 + 5 子模块 group 注册是主要难点，需对 useCustomTable 完整还原 + react-hook-form 动态字段 + 竞态保护有经验） |

## 5. 迁移后目标文件清单

> 子模块处理：cross-chain 含 **5 个子模块**（cross-chain-transactions / fx-rate / liquidity-pool / rd-bridge / token-pair）。对齐 blockchain / sys group 范本（`/cross-chain/<child>` group 菜单），**同一 `libs/modules/cross-chain/` 库**下用文件名前缀区分子模块，**不拆成五个库**——共用 model/api/constants。group 容器**不进 registry**；每个子模块各自 manifest（id=子模块名，routes component 用通用 key `list`/`detail`/`edit`）。迁移前必读 blockchain manifest 与 sys group 范本对齐（违反 group 机制必 404）。

```text
libs/modules/cross-chain/
├── data-access/
│   └── src/lib/
│       ├── cross-chain.model.ts                 # 类型：5 子模块各自的列表项/查询参数/详情/表单值/树详情节点
│       ├── cross-chain.api.ts                   # 33 个 API 函数（11 list + 7 detail + 14 写/子查询 + 公共下拉），含 3 个动态拼接 URL
│       └── +queries/
│           ├── cross-chain.keys.ts              # Query key 工厂（按子模块分 key）
│           ├── cross-chain.queries.ts           # 列表/详情/下拉查询 hooks
│           └── cross-chain.mutations.ts         # 写操作 hooks（rd-bridge save/edit/update、liquidity-pool save/edit/reauthorize/transferOut/wallet、token-pair save/edit/update）
├── feature/
│   └── src/lib/
│       ├── cross-chain-transactions-list-page.tsx
│       ├── cross-chain-transactions-detail-page.tsx          # 含 Steps 时间线（按 index 分支）
│       ├── fx-rate-list-page.tsx
│       ├── fx-rate-detail-page.tsx                           # 用 DataTable 呈现历史汇率（非常规详情）
│       ├── liquidity-pool-list-page.tsx                      # 含 Reauthorize/TransferOut 共用动态 Modal
│       ├── liquidity-pool-detail-page.tsx                    # 4 Tabs + 3 DataTable
│       ├── liquidity-pool-edit-page.tsx                      # 含生成钱包 Modal（本模块最复杂之一）
│       ├── rd-bridge-list-page.tsx                           # 含 Disable/Enable Modal + isTokenPaired 拦截
│       ├── rd-bridge-detail-page.tsx                         # 2 Tabs + Drawer（CustomInformation）
│       ├── rd-bridge-edit-page.tsx
│       ├── token-pair-list-page.tsx                          # 含 Disable/Enable Modal
│       ├── token-pair-detail-page.tsx                        # 2 Tabs（左右 CustomInformation + 中间图标）
│       ├── token-pair-edit-page.tsx                          # send/receive 联动 + 竞态保护（本模块最复杂之一）
│       └── module-manifest.ts                                # 5 个子模块 manifest（group 注册）
├── ui/
│   └── src/lib/
│       ├── cross-chain-status-badge.tsx                      # 状态 Badge（按子模块取不同常量）
│       ├── custom-information.tsx                            # 搬自 approval-manage（80 行纯展示，token-pair/view + rd-bridge/view 共用）
│       └── liquidity-pool-action-modal.tsx                   # Reauthorize/TransferOut 共用动态 Modal（从 list 拆出避免大文件）
└── util/
    └── src/lib/
        ├── cross-chain.constants.ts                          # 5 套状态枚举 + 18 个 limit 权限码 + i18n key 前缀常量 + 状态值枚举
        └── get-encryption-data.ts                            # AES-CBC 加密工具（搬自 libs/utils/get/getEncryptionData.ts，依赖 crypto-js）
```

## 6. UI 组件映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable`（11 处列表/详情分页） | `DataTable` + TanStack Query + `react-hook-form`（**分页请求体用 `pageNum` 非 `page`**） |
| `CustomTableTitle`（表格标题 + 顶部按钮） | `DataTable` 工具栏 + `@myorg/shared/ui` Button |
| `CustomModal`（liquidity-pool/rd-bridge/token-pair 的 4 个操作 Modal + liquidity-pool/edit 生成钱包 Modal） | `@myorg/shared/ui` Dialog / Drawer |
| `CustomForms`（Modal 内表单） | `react-hook-form` + `FormField`（Modal 内 form 场景） |
| `Form` / `Form.Item` / `Form.useForm`（3 个 edit 表单 + 4 个 Modal form + 多个 list 筛选 form） | `react-hook-form` + `useForm` + `FormField` / `FormSelect` |
| `Select` / `Input` / `InputNumber` / `Input.Password` / `Input.TextArea` / `Checkbox` | `@myorg/shared/ui` 同名组件 + `FormNumberField` / `FormCheckbox` |
| `DatePicker.RangePicker`（8 处时间筛选） | `FormDatePicker` |
| `Tabs`（liquidity-pool/view 4 Tab + rd-bridge/view 2 Tab + token-pair/view 2 Tab） | `@myorg/shared/ui` Tabs |
| `Steps`（cross-chain-transactions/view 垂直时间线） | `@myorg/shared/ui` Stepper 或自定义（按 index 0–3+ 分支渲染，非标准 steps） |
| `Drawer`（rd-bridge/view 操作记录详情） | `@myorg/shared/ui` Drawer |
| `Table`（无，详情分页均走 useCustomTable） | — |
| `CustomIBasicDetailsInfo`（详情 Descriptions） | `@myorg/shared/ui` Descriptions 或复用 mmf 的 `mmf-basic-details.tsx`（liquidity-pool/view + rd-bridge/view） |
| `CustomInformation`（搬自 approval-manage） | `ui/custom-information.tsx`（自包含，无外部依赖） |
| `Typography.Paragraph`（copyable，地址/txHash 复制） | `@myorg/shared/ui` Copy 组件 / `CopyableEllipsisText` |
| `Tag`（状态色） | Tailwind badge / Badge 组件 + util/constants.ts 映射 |
| `Image`（token-pair 中间图标 + liquidity-pool/edit 提示图） | `@myorg/shared/ui` Image（静态 svg `/stablecoin/images/*.svg`） |
| `Tooltip` + `InfoCircleOutlined`（liquidity-pool/edit deductibleAmount 提示） | `@myorg/shared/ui` Tooltip + lucide-react Info 图标 |
| `Modal.useModal`（rd-bridge/index warning + liquidity-pool/edit confirm） | `@myorg/shared/ui` Dialog imperative API |
| `Spin`（edit 页 loading） | `@myorg/shared/ui` Spinner |
| `message.success` | `@myorg/shared/ui` Toast |
| `ArrowRightCircleIcon` / `XMarkIcon` / `InformationCircleIcon`（heroicons） | lucide-react 同名图标（ArrowRightCircle / X / Info） |
| `ExclamationCircleFilled` / `InfoCircleOutlined`（antd icons） | lucide-react AlertCircle / Info |
| `formatTimestamp` / `reSet` / `getServerSidePropsResult`（libs/utils） | `@myorg/shared/util` 对应工具（`reSet` 为金额格式化，迁移时确认目标库已有，否则补） |
| `getEncryptionData`（AES 加密） | `util/get-encryption-data.ts`（搬入 + crypto-js 依赖） |
| `showAddress` / `isHexPrefixed`（`@/utils`） | `@myorg/shared/util`（钱包地址缩写 + `/^0x/` 校验） |
| `useHook(['cross-chain'])` + `t('key')` | i18n hook + `modules.cross-chain` 命名空间 |
| 状态/类型 i18n key 动态拼接 | 保留拼接 + util/constants.ts 存 key 前缀（见 6.1） |

### 6.1 状态/枚举映射（完整搬运，写入 `util/cross-chain.constants.ts`）

> 数据来源：`extract-module-meta.sh` 的 `STATUS_ENUMS` 段（已 dump 完整键值，5 套 + fx-rate 确认无）。**合并决策**：5 套 `approvalTaskStatus` 键值互不相同 → 各自独立常量；`liquidityPooTTransactionStstus`（liquidity-pool/view 独有，含拼写错误）独立常量；fx-rate 读源码确认**无状态枚举**（纯展示列表）。另有详情页 status 列走 i18n key 动态拼接（`approval_task_status_color_${n}` + `common_task_status_${n}`），保留拼接模式。

**① cross-chain-transactions `approvalTaskStatus`（index + view 共用，4 值）**

```ts
// cross-chain-transactions 列表/详情 status Tag 配色
export const CROSS_CHAIN_TX_STATUS_COLOR: Record<number, string> = {
  20: 'orange',     // 待处理/待审批
  30: 'processing', // 处理中
  35: 'success',    // 成功
  40: 'error'       // 失败
};
// 文案 key 前缀：cross_chain_transactions_status_${status}
export const CROSS_CHAIN_TX_STATUS_LABEL_KEY_PREFIX = 'cross-chain.cross_chain_transactions_status_';
```

**② liquidity-pool `approvalTaskStatus`（index + view 共用，3 值）**

```ts
// liquidity-pool 列表/详情 status Tag 配色（注意键值与 cross-chain-transactions 不同）
export const LIQUIDITY_POOL_STATUS_COLOR: Record<number, string> = {
  0: 'default',     // 未授权
  5: 'success',     // 已授权
  1: 'processing'   // 授权中
};
// 文案 key 前缀：liquidity_pool_status_${status}
export const LIQUIDITY_POOL_STATUS_LABEL_KEY_PREFIX = 'cross-chain.liquidity_pool_status_';
```

**③ liquidity-pool `liquidityPooTTransactionStstus`（view 独有，4 值，**拼写错误 PooT→Pool / Ststus→Status，迁移时纠正命名保留语义**）**

```ts
// liquidity-pool 详情 transactions/authorization 表 status Tag 配色
// 源码拼写：liquidityPooTTransactionStstus → 迁移纠正为 LIQUIDITY_POOL_TX_STATUS_COLOR
export const LIQUIDITY_POOL_TX_STATUS_COLOR: Record<number, string> = {
  30: 'processing',
  35: 'success',
  40: 'error',
  50: 'error'
};
// 文案 key 前缀：liquidity_pool_transaction_ststus_${status}（**注意源码 i18n key 也是 ststus 拼写错误，需保留以匹配已存在的翻译**）
export const LIQUIDITY_POOL_TX_STATUS_LABEL_KEY_PREFIX = 'cross-chain.liquidity_pool_transaction_ststus_';
```

**④ rd-bridge `approvalTaskStatus`（index + view 共用，2 值）**

```ts
// rd-bridge 列表/详情 status Tag 配色
export const RD_BRIDGE_STATUS_COLOR: Record<number, string> = {
  35: 'success',  // 启用
  50: 'gray'      // 禁用
};
// 文案 key 前缀：cross_chain_status_${status}
export const RD_BRIDGE_STATUS_LABEL_KEY_PREFIX = 'cross-chain.cross_chain_status_';
// rd-bridge update 入参 status 枚举
export const RD_BRIDGE_STATE = { ENABLE: 35, DISABLE: 50 } as const;
```

**⑤ token-pair `approvalTaskStatus`（index + view 共用，4 值）**

```ts
// token-pair 列表/详情 status Tag 配色
export const TOKEN_PAIR_STATUS_COLOR: Record<number, string> = {
  1: 'processing',  // 处理中
  3: 'gray',        // 禁用
  5: 'success',     // 启用
  10: 'gray'        // 禁用（另一禁用态）
};
// 文案 key 前缀：token_pair_status_${status}
export const TOKEN_PAIR_STATUS_LABEL_KEY_PREFIX = 'cross-chain.token_pair_status_';
// token-pair update 入参 status 枚举（注意：Disable 传 50、Enable 传 35，与列表显示的 1/3/5/10 不同语义）
export const TOKEN_PAIR_UPDATE_STATE = { ENABLE: 35, DISABLE: 50 } as const;
```

**⑥ fx-rate：无状态枚举（确认）** — 读源码 fx-rate/index.tsx + view.tsx 确认：纯展示列表/分页详情，**无 status 字段、无 Tag、无状态枚举对象**。无需状态常量。

**⑦ 详情页 status 列走 i18n key 动态拼接（非静态对象，liquidity-pool/view 操作记录 + token-pair/view 操作记录共用）**

```ts
// 操作记录表 status：配色 + 文案均走 common 全局约定
// liquidity-pool/view operationRecords: color = t(`approval_task_status_color_${status}`), text = t(`common_task_status_${status}`)
// token-pair/view operationRecords: 同上
// rd-bridge/view 操作记录: color = t(`cross_chain_operation_status_color_${status}`), text = t(`cross_chain_operation_status_${status}`)
export const COMMON_TASK_STATUS_COLOR_KEY_PREFIX = 'common.approval_task_status_color_';
export const COMMON_TASK_STATUS_LABEL_KEY_PREFIX = 'common.common_task_status_';
export const CROSS_CHAIN_OPERATION_STATUS_COLOR_KEY_PREFIX = 'cross-chain.cross_chain_operation_status_color_';
export const CROSS_CHAIN_OPERATION_STATUS_LABEL_KEY_PREFIX = 'cross-chain.cross_chain_operation_status_';
// 确认目标 i18n 已有 common_task_status_* / approval_task_status_color_*（全局约定，blockchain 等模块已用）
```

**⑧ 区块链色块（多页共用，token-pair + cross-chain-transactions/view）**

```ts
// 色块背景：t(`blockchain_code_color_${blockName}`)，返回 antd/Tailwind 色名
export const BLOCKCHAIN_CODE_COLOR_KEY_PREFIX = 'blockchain.blockchain_code_color_';
```

### 6.2 limit 权限码（按钮可见性，写入 constants.ts）

> 来源：脚本 `LIMIT_PERMISSIONS`（18 个）+ 源码逐一定位调用点（按子模块分组）。

```ts
export const CROSS_CHAIN_PERMISSIONS = {
  // cross-chain-transactions 子模块
  CROSS_CHAIN_TX_VIEW_BTN: '48414a6283914f03bc6b16f3e1c91f30', // cross-chain-transactions 列表行「查看」→ 跳 view?transferId=
  // cross-chain-transactions Refund（权限码 670504... 在脚本列表中，但源码为注释死代码，不迁移）
  // fx-rate 子模块
  FX_RATE_VIEW_BTN: '2ba9e846da974e3895b2bed3bddce9db', // fx-rate 列表行「查看」→ 跳 view?rateId=
  // liquidity-pool 子模块
  LIQUIDITY_POOL_ADD_BTN:     '414f3bd435b941eeb873d5ea50263dfa', // liquidity-pool 列表顶部「新增」→ 跳 edit（无参）
  LIQUIDITY_POOL_VIEW_BTN:    'd84423b56a0a422bbcb1597960a5011c', // liquidity-pool 列表行「查看」→ 跳 view?liquidityPoolId=
  LIQUIDITY_POOL_EDIT_BTN:    '72711b9dd25e4d90abb95605ee037b9a', // liquidity-pool 列表行「编辑」(status===5||0 可用)→ 跳 edit?liquidityPoolId=
  LIQUIDITY_POOL_REAUTH_BTN:  '4dfc6f2893f24ccd981950ff5f723f7e', // liquidity-pool 列表行「重新授权」(status===5 可用)→ Modal
  LIQUIDITY_POOL_TRANSFER_BTN:'a462efc14ddd401d8ea06028c83b453f', // liquidity-pool 列表行「转出」(status===5 可用)→ Modal
  // liquidity-pool/view 操作记录行「查看」（复用权限码）
  LIQUIDITY_POOL_OP_VIEW_BTN: 'e338a3b41c21413db1d2ac7a90a65f5f', // liquidity-pool/view 操作记录行「查看」→ 跳 /approval-manage/view
  // rd-bridge 子模块
  RD_BRIDGE_ADD_BTN:     '6c7b7ced88c849a28cdd3ae1bbd43729', // rd-bridge 列表顶部「注册」→ 跳 edit（无参）
  RD_BRIDGE_VIEW_BTN:    '7b09808a65994948843124b2dcf90a5c', // rd-bridge 列表行「查看」→ 跳 view?crossChainId=
  RD_BRIDGE_EDIT_BTN:    '7bc9b74a58654aa88ac7b2f6b1dbbf57', // rd-bridge 列表行「编辑」(status===50 可用)→ 跳 edit?crossChainId=
  RD_BRIDGE_DISABLE_BTN: '5e0aff44aff047c48af9c707f31c6c50', // rd-bridge 列表行「禁用」(status===35 可用)→ Modal（isTokenPaired===1 拦截）
  RD_BRIDGE_ENABLE_BTN:  'cba987d291d2487b95de872c996115e4', // rd-bridge 列表行「启用」(status===50 可用)→ Modal
  // rd-bridge/view 操作记录行「查看」（复用权限码）
  RD_BRIDGE_OP_VIEW_BTN: 'e338a3b41c21413db1d2ac7a90a65f5f', // rd-bridge/view 操作记录行「查看」→ Drawer
  // token-pair 子模块
  TOKEN_PAIR_ADD_BTN:     'f4880fa61c914180a054032fafbd1908', // token-pair 列表顶部「新增」→ 跳 edit（无参）
  TOKEN_PAIR_VIEW_BTN:    'cf368f08de3446a29f75441f6aba0e36', // token-pair 列表行「查看」→ 跳 view?tokenCrossChainId=
  TOKEN_PAIR_EDIT_BTN:    'f21920aa8dc342aebec361392cde8d01', // token-pair 列表行「编辑」(status∈{3,5,10} 可用)→ 跳 edit?tokenCrossChainId=
  TOKEN_PAIR_DISABLE_BTN: 'a2b3704470444a778d4a07eb9265679d', // token-pair 列表行「禁用」(status===5 可用)→ Modal
  TOKEN_PAIR_ENABLE_BTN:  '670504d5c9ae48afb4504f97c12450e6', // token-pair 列表行「启用」(status===10 可用)→ Modal
  // token-pair/view 操作记录行「查看」（复用权限码）
  TOKEN_PAIR_OP_VIEW_BTN: 'e338a3b41c21413db1d2ac7a90a65f5f'  // token-pair/view 操作记录行「查看」→ 跳 /approval-manage/view
} as const;
```

> 注：`670504d5c9ae48afb4504f97c12450e6` 在 cross-chain-transactions 源码中是 Refund 按钮权限码（已注释为死代码），在 token-pair 源码中是 Enable 按钮权限码 —— **以 token-pair Enable 实际使用为准**（Refund 不迁移）。`e338a3b41c21413db1d2ac7a90a65f5f` 被 liquidity-pool/rd-bridge/token-pair 三个详情页的操作记录「查看」共用。

## 7. 迁移步骤

> 按子模块依赖顺序分组（基础 → 类型 → api → hooks → 各子模块 list/view/edit → manifest → 注册）。每步对应一个可独立开发的 loop 任务。建议任务数 **20 个**。

1. **Nx generator 建 `cross-chain` 库**（data-access / feature / ui / util 四层），在 `module-registry.ts` 注册 5 个子模块 entry（**group 机制，容器不进 registry，参考 blockchain / sys 范本**）；i18n 新增 `modules/cross-chain.json`（命名空间 `modules.cross-chain`，迁入 `cross-chain` 命名空间全部 key + 复用 `common`/`router`/`blockchain` 的 `blockchain_code_color_*` / `common_task_status_*` / `approval_task_status_color_*`）；**在 `apps/admin/tsconfig.json` 的 paths 登记 cross-chain 库路径**（防 nx 误报 lazy，见 memory sys-migration-status）；在 `apps/admin/configs/<app>.json` 把 cross-chain 配成 group 菜单（children path `/cross-chain/<child>`），`page.tsx` 的 `GROUP_ENABLED_KEY` 加 `cross-chain`。
2. **类型定义（`cross-chain.model.ts`，haiku）**：5 子模块各自的 ListItem（CrossChainTxItem / FxRateItem / LiquidityPoolItem / RdBridgeItem / TokenPairItem）、查询参数、Detail（CrossChainTxDetail / LiquidityPoolDetail / RdBridgeDetail / TokenPairDetail / FxRateDetail）、表单值（LiquidityPoolEditForm / RdBridgeEditForm / TokenPairEditForm）、树详情节点（TransactionTreeNode）、操作记录项（OperationRecordItem / TransactionRecordItem / AuthorizationRecordItem）、各类下拉选项类型。
3. **常量 + 加密工具（`util/cross-chain.constants.ts` + `util/get-encryption-data.ts`，haiku）**：搬运 6.1 的 5 套状态枚举常量 + i18n key 前缀 + RD_BRIDGE_STATE / TOKEN_PAIR_UPDATE_STATE + 6.2 的 18 个权限码（`CROSS_CHAIN_PERMISSIONS`）+ `getEncryptionData`（引入 crypto-js 依赖，固定 key/iv）。
4. **API 函数（`cross-chain.api.ts` + queries/keys，haiku）**：33 个 endpoint 函数（11 list + 7 detail + 14 写/子查询 + 公共下拉）+ Query key 工厂（按子模块分）+ 列表/详情/下拉 TanStack Query hooks。**关键：① 全部 list 请求体用 `pageNum`/`pageSize`；② 3 个动态拼接 URL（getReceiveToken/getEndpointId/getLiquidityPool）用模板字符串拼 id；③ fx-rate list/detail/rate 是 `/api/fx/v1/rate/*` 不同前缀（非 manage）**。
5. **mutations（`cross-chain.mutations.ts`，haiku）**：rd-bridge（saveCrossChain / editCrossChain / updateCrossChain）、liquidity-pool（saveLiquidityPool / editLiquidityPool / reauthorize / transferOut / generateWallet）、token-pair（saveTokenPair / editTokenPair / updateTokenPair），成功后 invalidate 对应 list key。
6. **基础组件搬迁（`ui/custom-information.tsx` + `ui/liquidity-pool-action-modal.tsx`，sonnet）**：搬 CustomInformation（80 行纯展示，无依赖）到 ui 层；liquidity-pool Reauthorize/TransferOut 共用动态 Modal 拆为独立组件（按 status 分支渲染字段，含 InputNumber 小数位 validator + keystorePassword 加密）。
7. **fx-rate 列表页（`fx-rate-list-page.tsx`，sonnet，最简单先做）**：`react-hook-form` 筛选（货币对 Select（currency/pair/list 下拉）/ 时间范围）+ `DataTable`（货币对/汇率/更新时间）+ 行「查看」跳 `/cross-chain/fx-rate/view?rateId=`。**无状态枚举、无写操作、纯展示**。
8. **fx-rate 详情页（`fx-rate-detail-page.tsx`，sonnet）**：**用 DataTable 呈现历史汇率分页列表**（非常规 Descriptions），initialValues 带 rateId，筛选（时间范围）+ 表格（货币对/汇率/创建时间）+ 返回。调用 fx/v1/rate/detail。
9. **cross-chain-transactions 列表页（`cross-chain-transactions-list-page.tsx`，sonnet）**：`react-hook-form` 筛选（源 token / 目标 token / 源链（status===1 可选）/ 目标链 / 状态（20/30/35/40）/ 创建时间）+ `DataTable`（transferId / 方向含 ArrowRightCircle / from·to 含 showAddress + copyable / 手续费 / 汇率 / 创建时间 / 状态 Tag 走 `cross_chain_transactions_status_${status}` + `CROSS_CHAIN_TX_STATUS_COLOR`）+ 行「查看」跳 `/cross-chain/cross-chain-transactions/view?transferId=`。**Refund 行操作为注释死代码，不迁移**。
10. **cross-chain-transactions 详情页（`cross-chain-transactions-detail-page.tsx`，sonnet，含 Steps 分支逻辑）**：顶部信息区（8 字段，含区块链色块 `blockchain_code_color_${name}`）+ antd Steps 垂直时间线（**按 index 0/1/2/3/+ 分支渲染不同日志结构**，35=success 详细、20·30=空、40=error 简略，含 txHash 外链 `browserUrl + 'tx/' + txHash`）+ `current` 自动定位首个非成功节点 + `isErrorStatus` 检测 40 + 返回。调用 transactions/detail + tree/details。
11. **liquidity-pool 列表页（`liquidity-pool-list-page.tsx`，sonnet，含动态 Modal）**：`react-hook-form` 筛选（地址 Input / token Select / 链 Select（status===1 可选）/ 状态（0/1/5）/ 更新时间）+ `DataTable`（liquidityPoolId / 地址 / token / 链 / balance / authorized / 更新时间 / 状态 Tag 走 `LIQUIDITY_POOL_STATUS_COLOR`）+ 顶部「新增」跳 `/cross-chain/liquidity-pool/edit` + 行操作「查看/编辑(status∈{0,5})/重新授权(status===5)/转出(status===5)」。Reauthorize/TransferOut 调 `liquidity-pool-action-modal` 组件，分别调 reauthorize（deductibleAmount）/ transferOut（amount + receiverWalletAddress + keystorePassword 加密），成功刷新。
12. **liquidity-pool 详情页（`liquidity-pool-detail-page.tsx`，sonnet，4 Tabs + 3 DataTable）**：Tab1 基本信息（2 组 Descriptions：基本信息 8 字段 + threshold/emailRecipients）+ Tab2 transactions 表（筛选：地址/类型/txHash/状态(30,35,40)/时间；列含 transactionType===3 显示 N/A 占位 + transactionType===2 绿色否则红色 + serviceFee/fxrate 在 type===3 时为 0/N/A；行「查看」(type≠3) 跳 cross-chain-transactions/view）+ Tab3 authorization 表（筛选：操作类型(0,1)/操作时间/txHash/交易时间/状态(30,35,40,50)）+ Tab4 operationRecords 表（筛选：操作类型(1,2)；行「查看」跳 `/approval-manage/view?id=&busCode=`）+ 返回。调用 basicInformation + 3 个 list。
13. **liquidity-pool 编辑页（`liquidity-pool-edit-page.tsx`，sonnet，本模块最复杂之一）**：新增/编辑共用（query.id 区分）。tokenId Select（新增态从 new/tokenList 选，onChange 设 symbol/decimalPrecision/blockName；编辑态 disabled）+ liquidityPoolWalletAddress（Input + 「生成钱包」入口，`isHexPrefixed` 校验）+ deductibleAmount（InputNumber 小数位 validator）+ keystore（TextArea）+ keystorePassword（Password，提交时 `getEncryptionData` 加密）+ threshold + emailRecipients（email 批量校验≤20，Checkbox 拉全员邮箱调 new/emailList）。生成钱包 Modal：先 validate liquidityPoolWalletAddress，已有值则弹 confirm（提示覆盖），输入 password（加密）→ 调 wallet/keystore（chainType 按 blockName===Aptos?'aptos':'evm'）→ 回填 keystore/keystorePassword/liquidityPoolWalletAddress。onFinish 按 query.id 分支 save/edit（编辑态 keystorePassword 未改则原样传），成功 Toast + 返回。
14. **rd-bridge 列表页（`rd-bridge-list-page.tsx`，sonnet，含 Disable 拦截）**：`react-hook-form` 筛选（链 Select（getBlockChainList 下拉）/ endpointId / 3 合约地址 / 状态(35,50) / 创建时间）+ `DataTable`（crossChainId / 链名 / endpointId / 3 合约地址 / 创建时间 / 状态 Tag 走 `RD_BRIDGE_STATUS_COLOR`）+ 顶部「注册」跳 `/cross-chain/rd-bridge/edit` + 行操作「查看/编辑(status===50)/禁用(status===35)/启用(status===50)」。**Disable 时若 `isTokenPaired===1` 弹 warning Modal 拦截**（提示先解绑代币对）；否则共用 Disable/Enable Modal（blockchainName/endpointId 只读 + remarks 必填）调 update（status:50/35），成功刷新。
15. **rd-bridge 详情页（`rd-bridge-detail-page.tsx`，sonnet，2 Tabs + Drawer）**：Tab1 基本信息（3 组 Descriptions：基础信息 4 字段 + 合约地址 4 字段含 copyable + 监控配置 5 字段含 verifierWalletAddress/submitterWalletAddress 余额色块 + notifyEmail，用 `reSet` 格式化金额）+ Tab2 操作记录表（筛选：操作类型(1,2,3,4)；列含 status 走 `cross_chain_operation_status_color_${status}` + 文案；行「查看」→ 调 getCrossChainRecordDetail → Drawer 用 CustomInformation 展示 4 组信息）+ 返回。调用 getCrossChainDetail + getCrossChainRecordList + getCrossChainRecordDetail。
16. **rd-bridge 编辑页（`rd-bridge-edit-page.tsx`，sonnet）**：新增/编辑共用（query.id 区分）。链 Select（getBlockChainList 下拉，编辑态 disabled，新增态默认选首项设 symbol）+ endpointId（InputNumber，编辑态 disabled）+ 3 合约地址（Input maxLength=42 + `isHexPrefixed` 校验）+ 4 监控字段（verifier/submitter WalletAddress hex 校验 + MonitorValue InputNumber）+ notifyEmail（email 批量校验≤20，Checkbox 拉全员邮箱调 getAllUserEmailList）。onFinish 按 query.id 分支 save/edit（编辑态剔除 endpointId/blockchainId），成功 Toast + 返回。
17. **token-pair 列表页（`token-pair-list-page.tsx`，sonnet，含 Disable/Enable Modal）**：`react-hook-form` 筛选（send token / receive token / send 链（enableList 下拉）/ receive 链 / 状态(1,3,5,10) / 更新时间）+ `DataTable`（tokenCrossChainId / 方向含色块 `blockchain_code_color_${shortName}` + ArrowRightCircle / crossChainFee（`reSet` 格式化）/ 更新时间 / 状态 Tag 走 `TOKEN_PAIR_STATUS_COLOR`）+ 顶部「新增」跳 `/cross-chain/token-pair/edit` + 行操作「查看/编辑(status∈{3,5,10})/禁用(status===5)/启用(status===10)」。Disable/Enable 共用 Modal（方向信息展示 + remarks 必填）调 update（status:50/35），成功刷新。
18. **token-pair 详情页（`token-pair-detail-page.tsx`，sonnet，2 Tabs 左右栏）**：Tab1 基本信息（**左右两栏 CustomInformation + 中间 Image 图标**：左 send（token+色块/链/endpointId/合约地址 copyable/钱包地址 copyable）+ 中间图 + 右 receive（同结构）；额外含 crossChainFee/更新人/更新时间/状态 Tag 走 `TOKEN_PAIR_STATUS_COLOR`）+ Tab2 操作记录表（筛选：操作类型(1,2,3,4)；列含 status 走 `approval_task_status_color_${status}` + `common_task_status_${status}`；行「查看」跳 `/approval-manage/view`）+ 返回。调用 getTokenPairDetail + queryOperationRecords。
19. **token-pair 编辑页（`token-pair-edit-page.tsx`，sonnet，本模块最复杂之一）**：新增/编辑共用（query.id 区分）。sendToken Select（新增态从 getSendToken 选，编辑态 disabled）触发 `getReceiveTokenApi(stablecoinId)`（**动态 URL**）拉目标链列表 → `latestSendTokenIdRef` 竞态保护 → 自动选中 receiveToken[0] 填充 receive 全字段（endpointId/crossChainAddress/liquidityPoolWalletAddress + balance/authorized 展示）。新增态 useEffect(sendToken) 自动选 sendToken[0]。send 无流动性池时（isLiquidityPoolWalletAddress=false）提示跳 `/cross-chain/liquidity-pool/edit`。crossChainFee（InputNumber 小数位 validator）。编辑态 getTokenPairDetailApi 回填。onFinish 按 query.id 分支（编辑态仅 crossChainFee 可改），成功 Toast + 返回。调用 getSendToken + getReceiveToken + save/edit + getTokenPairDetail。
20. **module-manifest + 单测 + `pnpm nx lint/test cross-chain` + build**。重点覆盖：token-pair/edit 竞态保护与联动填充、liquidity-pool/edit 生成钱包 Modal + AES 加密、liquidity-pool action-modal 动态分支、rd-bridge Disable isTokenPaired 拦截、3 个动态拼接 URL、5 套状态枚举配色、18 个权限码可见性、`pageNum` 分页字段。

## 8. 风险与注意事项

- **CustomInformation 误判为缺失（已修正，中优）**：任务说明称 `@/pages/approval-manage/components/CustomInformation` 目录 ls 失败/不存在，**但实测该文件存在**（`/Users/zhangxuefeng/reddate/poc/td-manage/src/pages/approval-manage/components/CustomInformation.tsx`，80 行纯展示组件，无外部依赖，props `detailsInfo: [{title, list:[{label,value,showBorder,isTable}]}]`）。token-pair/view + rd-bridge/view Drawer 用它。**迁移决策：搬到 `cross-chain/ui/custom-information.tsx`**（自包含，无跨模块依赖），非缺失风险。admin-platform 目标侧 mmf 模块已有 `mmf-basic-details.tsx`（疑似等价），迁移时确认是否直接复用或新建。
- **getEncryptionData 加密工具（高优）**：`libs/utils/get/getEncryptionData.ts`（repo 根 libs，非 src）为 AES-CBC 加密（CryptoJS，固定 key `reddatespartan25` + iv `hongzao25spartan`），liquidity-pool 三处密码字段（edit keystorePassword / index transferOut keystorePassword / edit 生成钱包 password）依赖它。迁移需在 cross-chain util 层引入 crypto-js + 搬此工具，**密钥/IV 必须与后端约定一致**（否则后端解密失败）。迁移时确认目标项目是否有统一加密工具，避免重复。
- **3 个动态拼接 URL（高优，硬约束 #2）**：`getReceiveTokenApi`（token-pair/edit 核心联动，实际使用）/ `getEndpointIdApi`（封装存在但 token-pair/edit 未 import）/ `getLiquidityPoolApi`（同）的真实形态是模板字符串 `` `/api/manage/v1/crossChain/tokenPair/getReceiveToken/${tokenId}` ``（尾部斜杠后拼动态 id，GET）。脚本静态扫描只抓到带尾斜杠的片段。`cross-chain.api.ts` 必须实现 3 个函数的拼接规则。`getEndpointId`/`getLiquidityPool` 虽当前未调用，但同模块语义相关，建议保留实现（迁移时确认业务是否需要）。
- **liquidityPooTTransactionStstus 拼写错误（中优）**：liquidity-pool/view.tsx 的常量名 `liquidityPooTTransactionStstus`（PooT→Pool / Ststus→Status）+ 对应 i18n key `liquidity_pool_transaction_ststus_${status}`（也带拼写错误）。**迁移决策：常量名纠正为 `LIQUIDITY_POOL_TX_STATUS_COLOR`，但 i18n key 保留原拼写**（`ststus`，以匹配源项目已存在的翻译文件，避免文案丢失）。
- **getLiquidityPoolEmailListtApi 函数名拼写错误（低优）**：cross-chain.ts 函数名 `getLiquidityPoolEmailListtApi`（Listt 多一个 t）。迁移时纠正命名（`getLiquidityPoolEmailList`），endpoint `/api/manage/v1/cross/liquidityPool/new/emailList` 不变。
- **liquidity-pool 三页复杂度（高优）**：index 的 Reauthorize/TransferOut 共用一个动态 Modal（按 modalInfo.status 分支渲染 1 字段 vs 3 字段 + 不同 validator），edit 含生成钱包 Modal（chainType evm/aptos 分支 + password 加密 + keystore 回填 + email 批量校验≤20），view 是 4 Tabs + 3 useCustomTable（含跨模块跳 `/approval-manage/view` + 内部跳 cross-chain-transactions/view + transactionType===3 显示 N/A 占位 + transactionType===2 绿色否则红色金额色 + serviceFee/fxrate 在 type===3 时为 0/N/A）。这三页是本模块最复杂部分，建议拆 action-modal 为独立 ui 组件、edit 生成钱包逻辑独立 hook，避免单文件过大触发 nx lazy 误报（参考 journal-entries edit 拆 content 的经验）。
- **token-pair/edit 联动与竞态保护（高优）**：sendToken Select 触发动态 URL `getReceiveTokenApi` 拉目标链列表，`latestSendTokenIdRef` 在响应返回前若 Token 已切换则抛弃过期响应（竞态保护）。新增态 `useEffect(sendToken)` 自动选 sendToken[0]。react-hook-form 下联动需用 `watch` + `setValue`，竞态保护用 ref。`resetReceiveTokenInfo` 在每次切换时清空 receive 全字段（避免残留）。迁移时完整搬运时序逻辑，勿简化。
- **5 子模块 group 机制注册（高优，违反必 404）**：cross-chain 是 5 子模块 group（`/cross-chain/<child>`），必须用 group 机制（对齐 blockchain / sys 范本）：group 容器**不进 registry**；每个子模块各自 manifest（id=子模块名，routes component 用通用 key `list`/`detail`/`edit`）；`page.tsx` 的 `GROUP_ENABLED_KEY` 加 `cross-chain`；configs 把模块配成 group。**scaffold 任务（建库/manifest/registry）必须先读 sys/blockchain group 范本对齐**，否则 `/<group>/<child>` 被解析成 pageKey=`detail` → registry 无 → 404（mmf/blockchain 曾中招）。
- **跨模块跳转 `/approval-manage/view`（硬约束 #6）**：liquidity-pool/view 操作记录 + token-pair/view 操作记录的行「查看」跳 `/approval-manage/view?id=&busCode=`（approval-manage 模块）。迁移时确认 admin-platform 已有 approval-manage 模块（或先迁移），否则跳转 404。8 个 cross-chain 内部跳转（见 CROSS_MODULE_ROUTES）需在 manifest 注册对应路由。
- **`/api/fx/v1/rate/*` 不同 API 前缀（中优）**：fx-rate 的 3 个 endpoint（currency/pair/list、rate/list、rate/detail）前缀是 `/api/fx/v1/`（非 `/api/manage/v1/`），与其他子模块不同。迁移时 api 函数注意前缀区分。
- **rd-bridge 链下拉用 getBlockChainList 非 common/blockchain/list（中优）**：rd-bridge 的链下拉（index + edit）调 `/api/manage/v1/cross/chain/getBlockChainList`（`{ blockChainId, blockChainName, unit }`），与 cross-chain-transactions/liquidity-pool 用的 `common/blockchain/list`（`{ key, value, status }`）和 token-pair 用的 `common/blockchain/enableList`（`{ key, value }`）**三个不同的链下拉接口**，迁移时勿混淆。
- **token-pair 启停 status 语义陷阱（中优）**：token-pair 列表显示 status ∈ {1,3,5,10}（1=处理中/3,10=禁用/5=启用），但 Disable/Enable 调 update 传 status ∈ {50(禁用),35(启用)}（与 rd-bridge 启停值一致但与列表显示值不同）。迁移时 `TOKEN_PAIR_UPDATE_STATE` 与 `TOKEN_PAIR_STATUS_COLOR` 分开定义，勿混用。
- **i18n key 齐全性（中优，硬约束 #7）**：状态/类型文案大量走 i18n key 动态拼接（blockchain_code_color_ / cross_chain_status_ / liquidity_pool_status_ / liquidity_pool_transaction_type_ / liquidity_pool_transaction_ststus_(拼写错误) / liquidity_pool_authorization_* / liquidity_pool_operation_type_ / cross_chain_operation_status_ / cross_chain_operation_type_ / approval_task_status_color_ / common_task_status_ / token_pair_status_ / token_pair_operation_type_）。迁移时确认 `modules/cross-chain.json` 含全部 key（`blockchain_code_color_*` / `common_task_status_*` / `approval_task_status_color_*` 属全局 common/blockchain 约定，确认已存在或迁入）。
- **antd Tag color 映射**：源用 antd 内置色（success/orange/processing/error/default/gray）+ i18n key 返回的色名（`approval_task_status_color_*` / `cross_chain_operation_status_color_*`）。目标若用 Tailwind Badge variant，需建色名映射表（`success→success` / `processing→warning` / `gray→neutral` 等），并处理 `gray`（antd 有，Tailwind 需映射 neutral）。
- **fx-rate 详情页用 DataTable 非常规 Descriptions（低优）**：fx-rate/view 用 CustomTable 呈现历史汇率分页列表（initialValues 带 rateId 筛选），而非 Descriptions 展示单条。迁移时保留 DataTable 模式，勿套用其他详情页的 Descriptions 模式。
- **cross-chain-transactions Refund 死代码（已知限制）**：cross-chain-transactions/index.tsx 的 Refund 行操作（权限码 `670504...`）+ 对应 Modal（onFinish 调 updateCrossChainApi）在源码中**已被注释**（actions 数组里 Refund 项被注释）。**不迁移**，但注意 `670504...` 权限码在 token-pair Enable 实际使用（见 6.2），勿因 Refund 死代码误删该权限码。

## 9. 验收标准

- cross-chain-transactions 列表页支持全部 6 个筛选条件（源 token / 目标 token / 源链（status===1 可选否则 disabled）/ 目标链 / 状态（20/30/35/40）/ 创建时间），正确分页（**请求体 `pageNum`**），from/to 列含 showAddress 缩写 + copyable，状态列色值走 `CROSS_CHAIN_TX_STATUS_COLOR` + 文案 `cross_chain_transactions_status_${status}`，行「查看」跳 view?transferId=（**Refund 不迁移，无该按钮**）。
- cross-chain-transactions 详情页顶部信息区 8 字段完整（含区块链色块 `blockchain_code_color_${name}`），Steps 时间线按 index 0/1/2/3+ 分支渲染正确（35=success 详细含 txHash 外链、20·30=空、40=error 简略），`current` 自动定位首个非成功节点，`isErrorStatus` 检测 40 显示 error 态。
- fx-rate 列表页支持 2 个筛选条件（货币对 Select（currency/pair/list 下拉）/ 时间范围），正确分页，货币对列 `send/receive` 拼接，无状态列（纯展示），行「查看」跳 view?rateId=。
- fx-rate 详情页用 DataTable 呈现历史汇率分页列表（initialValues 带 rateId），支持时间范围筛选，货币对/汇率/创建时间 3 列完整，返回可用。
- liquidity-pool 列表页支持全部 5 个筛选条件（地址 / token / 链（status===1 可选）/ 状态（0/1/5）/ 更新时间），正确分页，balance/authorized 列含 symbol，状态列走 `LIQUIDITY_POOL_STATUS_COLOR`，顶部「新增」跳 edit，行操作「查看/编辑(status∈{0,5})/重新授权(status===5)/转出(status===5)」可用。
- liquidity-pool Reauthorize/TransferOut 动态 Modal 正确分支：Reauthorize 仅 deductibleAmount（InputNumber 小数位 validator），TransferOut 含 receiverWalletAddress（isHexPrefixed 校验）+ amount（InputNumber 小数位 validator + max=balance）+ keystorePassword（AES 加密），成功刷新列表。
- liquidity-pool 详情页 4 Tabs 完整：Tab1 基本信息 2 组 Descriptions（8 字段 + threshold/emailRecipients），Tab2 transactions 表（transactionType===3 显示 N/A 占位 + 行「查看」(type≠3) 跳 cross-chain-transactions/view + type===2 绿色否则红色金额 + serviceFee/fxrate 在 type===3 时为 0/N/A），Tab3 authorization 表（状态(30,35,40,50)），Tab4 operationRecords 表（行「查看」跳 `/approval-manage/view`），状态色走 `LIQUIDITY_POOL_TX_STATUS_COLOR`（i18n key 保留 `ststus` 拼写）。
- liquidity-pool 编辑页新增/编辑共用（query.id 区分）：tokenId Select onChange 设 symbol/decimalPrecision/blockName，liquidityPoolWalletAddress（isHexPrefixed 校验）+「生成钱包」Modal（chainType 按 blockName===Aptos?'aptos':'evm' + password AES 加密 → 回填 keystore/keystorePassword/地址，已有地址时弹 confirm 覆盖），deductibleAmount（小数位 validator），keystorePassword（提交时加密，编辑态未改则原样传），emailRecipients（email 批量校验≤20 + Checkbox 拉全员邮箱），onFinish 按分支 save/edit 成功 Toast + 返回。
- rd-bridge 列表页支持全部 7 个筛选条件（链（getBlockChainList 下拉）/ endpointId / 3 合约地址 / 状态(35,50) / 创建时间），正确分页，状态列走 `RD_BRIDGE_STATUS_COLOR`，顶部「注册」跳 edit，行操作「查看/编辑(status===50)/禁用(status===35，isTokenPaired===1 弹 warning 拦截)/启用(status===50)」，Disable/Enable 共用 Modal 调 update（status:50/35）成功刷新。
- rd-bridge 详情页 2 Tabs：Tab1 基本信息 3 组 Descriptions（基础 4 字段 + 合约地址 4 字段 copyable + 监控配置 5 字段含 `reSet` 格式化金额 + notifyEmail），Tab2 操作记录表（操作类型(1,2,3,4) + status 走 `cross_chain_operation_status_color_${status}`），行「查看」→ Drawer 用 CustomInformation 展示 4 组信息，返回可用。
- rd-bridge 编辑页新增/编辑共用：链 Select（编辑态 disabled，新增态默认选首项）+ endpointId（InputNumber，编辑态 disabled）+ 3 合约地址（maxLength=42 + isHexPrefixed 校验）+ 4 监控字段 + notifyEmail（email 批量校验≤20 + Checkbox 拉全员邮箱调 getAllUserEmailList），onFinish 按分支 save/edit（编辑态剔除 endpointId/blockchainId）成功 Toast + 返回。
- token-pair 列表页支持全部 6 个筛选条件（send token / receive token / send 链（enableList）/ receive 链 / 状态(1,3,5,10) / 更新时间），正确分页，方向列含色块 `blockchain_code_color_${shortName}` + ArrowRightCircle，crossChainFee 走 `reSet` 格式化，状态列走 `TOKEN_PAIR_STATUS_COLOR`，顶部「新增」跳 edit，行操作「查看/编辑(status∈{3,5,10})/禁用(status===5)/启用(status===10)」，Disable/Enable 共用 Modal 调 update（status:50/35）成功刷新。
- token-pair 详情页 2 Tabs：Tab1 基本信息左右两栏 CustomInformation + 中间 Image 图标（send/receive 各含 token+色块/链/endpointId/合约地址 copyable/钱包地址 copyable + crossChainFee/更新人/更新时间/状态），Tab2 操作记录表（status 走 `approval_task_status_color_${status}` + `common_task_status_${status}`，行「查看」跳 `/approval-manage/view`），返回可用。
- token-pair 编辑页新增/编辑共用：sendToken Select 触发 `getReceiveTokenApi(stablecoinId)`（动态 URL）拉目标链列表 + `latestSendTokenIdRef` 竞态保护（切换 Token 时抛弃过期响应）+ 自动选中 receiveToken[0] 填充 receive 全字段，新增态 useEffect(sendToken) 自动选 sendToken[0]，send 无流动性池时提示跳 `/cross-chain/liquidity-pool/edit`，crossChainFee（InputNumber 小数位 validator），编辑态 getTokenPairDetailApi 回填，onFinish 按分支（编辑态仅 crossChainFee 可改）成功 Toast + 返回。
- 18 个 limit 权限码（`CROSS_CHAIN_PERMISSIONS`）正确控制全部按钮可见性（5 子模块全覆盖，复用权限码 `e338a3b41c21413db1d2ac7a90a65f5f` 被 3 个详情页操作记录共用）。
- 33 个 endpoint（含 3 个动态拼接 URL、5 套状态枚举对应的配色、拼写错误的 i18n key 保留）全部在 `cross-chain.api.ts` 实现，迁移率 ≥98%。
- 所有文案 i18n 化（`modules.cross-chain` + 复用 `common`/`router`/`blockchain`，含动态拼接的 `blockchain_code_color_*`/`cross_chain_status_*`/`liquidity_pool_status_*`/`liquidity_pool_transaction_ststus_*`(拼写保留)/`cross_chain_operation_status_*`/`approval_task_status_color_*`/`common_task_status_*`/`token_pair_status_*`），无硬编码中文。
- AES 加密工具（`getEncryptionData`，crypto-js + 固定 key/iv）正确用于 liquidity-pool 三处密码字段。
- `pnpm nx lint cross-chain` / `pnpm nx test cross-chain` / build 通过；5 子模块 group 路由（`/cross-chain/<child>`）全部可访问无 404。
