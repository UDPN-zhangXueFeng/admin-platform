# tokenized-deposit 模块迁移计划

> **迁移率目标：99%**（用户要求，高于 skill 默认 98%）
> **复杂度：迄今最高**（~8952 行 / 35 源文件 / 41 唯一 endpoint，超过 statements 1495 行、cross-chain 5 子模块）
> 生成依据：`extract-module-meta.sh` 事实输出 + opus 深度读源码（4 个并行 Agent 覆盖 index.tsx/view+t_edit/edit 组件群 19 文件/coa-setup）+ 主循环逐行核对 4 个 API 模块 + grep 精确锁定 API 使用边界。

---

## 1. 业务概述

tokenized-deposit 是**稳定币 / 代币化存款（Tokenized Deposit, TD）/ MMF Token 的一体化管理模块**，业务横跨六个子领域：代币发行设置、铸造/销毁运营、智能合约部署/升级、管理员/角色钱包、Financial Book（COA）初始化、Token Onboard 登记审批。

**核心业务实体**：单个 Token（由 `mintMethod` 区分类型：`1=Stablecoin` / `5=Tokenized Deposit` / `20=MMF Token`；由 `pledgeType` 区分质押模式 `0=SP直铸` / `1=质押铸造`），贯穿 `applyStatus` 审批状态机（`1=待审批` / `5,15=审批中` / `20=待部署` / `35=已生效`）与 `state` 启停状态（`0=未生效` / `1=启用` / `2=禁用`）。

**主要操作**：铸造（Mint）/ 销毁（Melt，需校验储备余额与可销毁余额 surplusCount）、智能合约部署/升级（按 taskCode 走步骤进度）、启用/禁用、删除（仅待审批态）、编辑 Token 设置、管理员钱包更新/审批、COA Financial Book 初始化、跳转交易流水与用户钱包。

**页面构成**（5 个页面 + 4 个内嵌组件）：
- `index.tsx`（2666 行）：**稳定币运营总览页**——顶部 TD 切换 + 概览信息卡 + 9 个操作按钮 + 4 Tab（铸销记录 / 合约部署 / 钱包 / 操作记录），5 个 Modal。这是模块主入口与最复杂页面。
- `view.tsx`（717 行）：**单币种详情运营页**——3 Tab（铸销记录+Mint/Melt / 合约部署 mock / 角色钱包 mock）。组件名 `STABLECOINView`（拷贝 stablecoin 模块痕迹）。
- `edit.tsx`（386 行）+ `lib/components/tokenized-deposit/edit/`（19 文件 3066 行）：**稳定币设置编辑/创建页**——代币基本信息 + COA 设置 + 对账配置 + 密钥托管 + 管理员钱包（keystore/rigsec 双路径）+ 账户类型 + MMF 账户配置。edit.tsx 是壳，真正逻辑在 19 个组件/hook。
- `t_edit.tsx`（724 行）：**Token Onboard 登记表单页**——100% mock（无真实 API），新建 Token 的前端原型。
- 内嵌组件：`summary.tsx`（MMF 基金汇总表）、`role-wallets.tsx`（角色钱包，100% mock）、`_accountConfigurationMMF.tsx`（MMF 账户配置）、`coa-setup/`（Financial Book 初始化卡片）。

**特殊业务规则**：
1. **AES 钱包加密**：管理员钱包 password 经 `getEncryptionData`（AES-128-CBC，硬编码 key `reddatespartan25` / iv `hongzao25spartan`，输出大写 Base64 ciphertext）加密后提交，**必须与后端一致**。
2. **mintMethod 分支**：决定 reserveAccount / COA / 对账 / 阈值 / 钱包 payload 形态的显隐与提交结构。
3. **钱包生成双路径**：`storageType==='key_keystore'` → keystore 模式（密码 AES 加密，调 `util/wallet/keystore`）；否则（rigsec/fireblocks）→ RigSec Modal（选 Hot/Cold Wallet，不传 password）。
4. **审批流**：Mint/Melt/编辑/钱包变更走审批（`/approval-manage/view`），部分操作有 `applyStatus` 状态机拦截。

---

## 2. 源文件清单（35 文件）

### 2.1 页面层 `src/pages/tokenized-deposit/`（7 文件，5125 行）

| 文件 | 行数 | 用途 |
|------|------|------|
| `index.tsx` | 2666 | **运营总览页**：TD 切换(CustomTab) + 概览卡 + 9 操作按钮 + 4 Tab(铸销记录/合约部署/钱包/操作记录) + 5 Modal(Mint-Melt/部署/部署历史/管理钱包/生成钱包-RigSec)。调 applyListApi 拉标题列表，按 mintMethod/pledgeType 三分支渲染 Tab1。 |
| `view.tsx` | 717 | **单币种详情运营页**(`STABLECOINView`)：3 Tab(铸销记录+Mint/Melt Modal / 合约部署 mock 表 / 角色钱包)。query.current('0'/'1') 定币种 HSBCoin/CBCoin。调 stablecoin-manage 4 函数。 |
| `edit.tsx` | 386 | **稳定币设置编辑页壳**(`StablecoinSettingsEdit`)：组装 19 个 edit 子组件 + 2 Modal(GenerateWallet/Rigsec)。query.code 区分新增/编辑。 |
| `t_edit.tsx` | 724 | **Token Onboard 表单页**(mock)：tokenType 三选 + 基本信息 + 密钥托管 + 角色钱包(4 行 generateWallet mock)。无真实 API。 |
| `role-wallets.tsx` | 405 | **角色钱包组件**(mock)：列表 + 配置 Modal + 详情 Modal(操作历史)。调 3 个 mock 函数。被 view.tsx Tab3 引用。 |
| `summary.tsx` | 150 | **MMF 基金汇总表组件**：useCustomTable 拉 td/mmf/summary/listPage，10 列(walletType/fundType 1-7/riskLevel 1-4/金额/时间)。被 index.tsx Tab1 MMF 分支引用。 |
| `_accountConfigurationMMF.tsx` | 77 | **MMF 账户配置组件**：Checkbox.Group(accountTypeList=[3] 固定 Yield-Bearing)。被 edit.tsx mintMethod===20 分支引用。 |

### 2.2 编辑组件群 `src/lib/components/tokenized-deposit/edit/`（19 文件，2682 行）

| 文件 | 行数 | 用途 |
|------|------|------|
| `index.ts` | 18 | barrel：re-export 全部 19 文件 |
| `constants.ts` | 23 | `STABLECOIN_TOKEN_TYPE=1` / `TOKENIZED_DEPOSIT_TOKEN_TYPE=5` / `MMF_TOKEN_TYPE=20` / `RECON_DISABLED=0` / `RECON_ENABLED=1` / FINANCIAL_BOOK_NAME 校验常量 |
| `types.ts` | 36 | `TokenMintMethod` / `WalletRoleType(1/2/3)` / `WalletAttributeType(1/5)` / `ModalInfo` / `TokenDetailInfo` / `SelectOption` |
| `utils.ts` | 232 | 13 个 COA 工具函数（mintMethod→tokenType 映射 / FinanceBook↔CoaSetup 映射 / 校验 / payload 转换 / 时区归一） |
| `TokenBasicInfoSection.tsx` | 406 | **代币基本信息区**(最大组件)：mintMethod/name/symbol/decimals/currency/usPrice/reserveAccount/blockchain/smartContract/metaType/whitelistMode/threshold 共 15 字段 |
| `AccountTypeSection.tsx` | 84 | 账户类型选择(Checkbox.Group accountTypeList，1 永久 disabled，2 可选) |
| `ReconciliationConfigSection.tsx` | 129 | 对账配置(Token 对账 + 储备资产对账 Checkbox，含账户级锁定逻辑) |
| `KeyCustodySection.tsx` | 48 | 密钥托管服务选择(keyServiceName Select，硬编码英文) |
| `AdminWalletSection.tsx` | 132 | 管理员钱包区(3 角色：Contract Owner/Gas Payment/Management，委托 WalletFieldGroup) |
| `WalletFieldGroup.tsx` | 115 | 单组钱包字段(地址 + 可选 keystore/password + Generate Wallet 链接) |
| `GenerateWalletModal.tsx` | 89 | keystore 生成钱包密码 Modal(CustomModal+CustomForms) |
| `RigsecWalletModal.tsx` | 94 | rigsec/fireblocks 生成钱包 Modal(选 Hot/Cold Wallet，硬编码英文) |
| `SubmitActions.tsx` | 26 | 底部返回/提交按钮组 |
| `hooks/useCoaSetup.ts` | 299 | **COA 数据 hook**：双套 COA state(stablecoin+TD) + 模板/时区下拉 + by-reserve 查询 + 浏览器时区自适应。调 3 个 typings API。 |
| `hooks/useKeyService.ts` | 34 | 密钥服务列表 hook：调 tdApplyKeyServiceListApi，默认选首项 |
| `hooks/useTokenizedDepositSubmit.ts` | 261 | **提交 hook**：confirm + 组装 payload(adminWalletDTOList/roleWalletDTOList + coaPayload + AES 加密 password) + COA 校验 + 新增走 tdApplyAddApi/编辑走 tdOperationEditApi |
| `hooks/useWalletManagement.tsx` | 395 | **钱包管理 hook**(最复杂)：生成钱包双路径(keystore AES / rigsec) + 钱包字段回填 + Ethereum Sepolia+Huawei KMS 特殊隐藏 + tokenName 变化重置。调 utilWalletKeystoreApi / tdApplyAdminWalletListApi |
| `hooks/useBlockchainEffect.ts` | 115 | 区块链加载/切换联动：默认选首条 status===1 链 + 联动储备/合约/密钥服务/chainType(tron→metaType=1) |
| `hooks/useDetailInit.ts` | 146 | 编辑回填：调 getDetailApi(code) + 按 mintMethod 分支回填 COA + 钱包字段 + 字段命名转换(decimalPrecision↔decimals) |

### 2.3 COA 设置卡片 `src/lib/components/tokenized-deposit/coa-setup/`（4 文件，384 行）

| 文件 | 行数 | 用途 |
|------|------|------|
| `index.ts` | 3 | barrel：re-export types/CoaSetupCard/mock |
| `types.ts` | 107 | `CoaSetupStatus(configured/setup_required)` / `CoaSetupInfo` / `CoaSetupErrors` / `CoaSetupOption` / `CoaSetupCardProps` + 3 校验纯函数 + 校验常量 |
| `CoaSetupCard.tsx` | 252 | **Financial Book 初始化卡片**：完全受控(无内部 state)，4 字段(financialBookName/accountTemplate/eodCutOffTime/timeZone)，fallback option 机制，状态徽标配色 |
| `mock.ts` | 22 | `setupRequiredCoaSetupMock`(运行时 fallback 初始态，**保留**) / `configuredCoaSetupMock`(未被引用，**丢弃**) |

### 2.4 API 模块 `src/lib/api/`（4 文件，720 行，仅迁移本模块实际调用函数）

| 文件 | 行数 | 用途 |
|------|------|------|
| `common.ts` | 71 | 公共 API：本模块仅用 `getWalletKeystoreApi`(util/wallet/keystore)。其余(downloadApi/modifyPasswordApi/getAccessKeyApi/getTokenTypeApi/getBankListApi/getResourcesApi)属其他模块，**不迁移**。 |
| `stablecoin.ts` | 385 | 稳定币 API + **role-wallets 3 个 mock 函数**。本模块用 8 个真实函数 + 3 mock。 |
| `stablecoin-manage.ts` | 169 | TD apply/合约/部署/启停/删除 API。本模块用 10 个函数。**价格系列(stablecoin/price/*)经 grep 确认非本模块调用，不迁移。** |
| `stablecoin-settings.ts` | 95 | 设置/详情/储备/合约包 API。本模块用 3 个函数(getDetailApi/getReserveListApi/getSmartContractNameApi)。价格系列不迁移。 |

### 2.5 Hook `src/lib/hooks/useTokenTypeOptions.ts`（1 文件，41 行）

| 文件 | 行数 | 用途 |
|------|------|------|
| `useTokenTypeOptions.ts` | 41 | token 类型下拉 hook：useSWR 拉 common/tokenType/list，返回 `{value:tokenTypeId, label:tokenTypeName, disabled:status===0}`。被 edit.tsx 使用。 |

> 数据来源：`extract-module-meta.sh` SOURCE_FILES + `find` 递归统计（lib/components 子目录脚本未覆盖，由 Read 补全）。

---

## 3. 依赖的 API（41 个唯一 endpoint）

> 数据来源：脚本 `API_ENDPOINTS`（页面字面量 + api 模块封装）+ grep 精确锁定本模块实际 import 的函数 + Read api 模块逐行核对 method + typings 自动生成文件确认动态 endpoint。
> **命名警示**：api 模块函数名与真实 endpoint 经常不一致（历史遗留），下表以 **endpoint 为准**，函数名仅作调用方索引。

### 3.1 列表 / 分页查询 API（useCustomTable URL，12 个）

| Endpoint | Method | 调用方 | 用途 |
|----------|--------|--------|------|
| `/api/manage/v1/td/manage/searches/record` | POST | index customTable | 铸销记录（质押铸造 mintMethod=1+pledgeType=1），initialValues stablecoinCode |
| `/api/manage/v1/transaction/getDirectMintingTxList` | POST | index customTableSp | SP 直铸记录（mintMethod=20+pledgeType=0），initialValues stablecoinId |
| `/api/manage/v1/td/wallet/balance` | POST | index customTable2 | 钱包余额（isOnclick=true 时，刷新按钮触发） |
| `/api/manage/v1/td/wallet/listPage` | POST | index customTable2 | 钱包列表（isOnclick=false 默认） |
| `/api/manage/v1/td/wallet/detail` | POST | index adminDetialCustomTable | 钱包详情 Modal 表 |
| `/api/manage/v1/td/wallet/history` | POST | index adminHistoryCustomTable | 钱包历史 Modal 表 |
| `/api/manage/v1/td/records/listPage` | POST | index customTable3 | 操作记录 |
| `/api/manage/v1/td/mmf/summary/listPage` | POST | summary.tsx | MMF 基金汇总（index Tab1 MMF 分支） |
| `/api/manage/v1/stablecoin/record/query` | POST | view customTable1 | 稳定币铸销记录 |
| `/api/manage/v1/common/blockchain/list` | GET | edit.tsx useSWR | 区块链下拉 |
| `/api/manage/v1/common/currency/list` | GET | edit.tsx useSWR | 币种下拉 |
| `/api/manage/v1/common/tokenType/list` | GET | useTokenTypeOptions useSWR | token 类型下拉 |

### 3.2 详情 / 标题 / 子查询 API（10 个）

| Endpoint | Method | 调用方函数 | 用途 |
|----------|--------|-----------|------|
| `/api/manage/v1/td/apply/list` | POST | applyListApi (stablecoin-manage) | TD 标题列表（index 顶部切换 + 概览数据源） |
| `/api/manage/v1/stablecoin/list` | POST | getStablecoinListApi (stablecoin-manage) | 稳定币列表（view mount 拉，取 [0]） |
| `/api/manage/v1/stablecoin/get` | POST | getStablecoinInfoApi (stablecoin-manage) | 稳定币信息（view useSWR 字面量 key + fetcher 内部调此 POST 函数，surplusCount 可销毁余额） |
| `/api/manage/v1/td/contract/latestInfo` | POST | getNewSmartListApi | 合约包列表（index Tab2 上表，body stablecoinCode） |
| `/api/manage/v1/td/contract/detail` | POST | getContractInfoApi | 合约明细（index Tab2 下表） |
| `/api/manage/v1/td/contract/deploy/history` | POST | getContractHistoryApi | 部署历史（index 部署历史 Modal，取 data[0]） |
| `/api/manage/v1/td/contract/deploy/stepDetail` | POST | getDeployInfoApi | 部署步骤详情（body taskCode，取 data[0].stepDetailList） |
| `/api/manage/v1/td/manage/reserve/balance` | POST | getReservBalanceApi | 储备/可销毁余额（Mint/Melt 前拉，组装 modalInfo） |
| `/api/manage/v1/td/manage/search/pending/melt` | POST | isShowMeltApi | 是否有待处理销毁（控制 Melt 按钮禁用） |
| `/api/manage/v1/td/apply/reserve/list` | POST | getReserveListApi (stablecoin-settings) | 储备账户下拉（body currencySymbol，默认选首项） |

### 3.3 写操作 API（创建/编辑/审批/铸销/部署/启停/删除/钱包，13 个）

| Endpoint | Method | 调用方函数 | 用途 |
|----------|--------|-----------|------|
| `/api/manage/v1/td/apply/add` | POST | tdApplyAddApi (typings) | **新增 TD 提交**（useTokenizedDepositSubmit，query.code 为空）。注：stablecoin-manage.ts 有同 endpoint 的 `saveStablecoinPriceApi`（误导命名），但本模块未调用 |
| `/api/manage/v1/td/operation/edit` | POST | tdOperationEditApi (typings) | **编辑 TD 提交**（query.code 存在）。注：stablecoin-manage.ts 有同 endpoint 的 `updateStablecoinPriceApi`（误导命名），但本模块未调用 |
| `/api/manage/v1/td/manage/add/mint/melt` | POST | stablecoinApi (stablecoin) | 铸造(type=1)/销毁(type=2)（body amount/stablecoinCode/type） |
| `/api/manage/v1/stablecoin/issue` | POST | issueStablecoinApi | view 铸造（body stablecoinCount/stablecoinId/Name/Unit） |
| `/api/manage/v1/stablecoin/remove` | POST | removeStablecoinApi | view 销毁（body stablecoinCount/stablecoinId） |
| `/api/manage/v1/td/contract/deploy` | POST | getDeployApi | 合约部署/升级（body taskCode） |
| `/api/manage/v1/td/operation/enable` | POST | statusUpdateApi / updateStatusApi(重复) | 启用(enable=1)/禁用(enable=0)（body code/enable） |
| `/api/manage/v1/td/operation/delete` | POST | deleteApi | 删除待审批 TD（body code） |
| `/api/manage/v1/td/wallet/update` | POST | updateAdminWalletApi | 管理员钱包更新（body accountId/chainAccountAddress/password=AES/privateKey） |
| `/api/manage/v1/td/wallet/approval` | POST | approvalAdminWalletApi | 管理员钱包审批（body recordId/remark/state） |
| `/api/manage/v1/td/wallet/geModificationRecord` | POST | geModificationRecordApi | 钱包变更记录（**死代码 action，actionClick case 'Examine' 保留但 action 项被注释**） |
| `/api/manage/v1/util/wallet/keystore` | POST | getWalletKeystoreApi (common) / utilWalletKeystoreApi (typings) | **生成钱包 keystore**（双实现同 endpoint；body chainType/password=AES 或 chainType/walletType/storageType/roleName/blockchainCode/tokenName/ifAdd） |
| `/api/manage/v1/common/contract/getNewDeployment` | POST | getSmartContractNameApi | 合约包下拉（body contractLanguage/tokenType） |

### 3.4 编辑页专属子查询 API（typ‌ings 自动生成，5 个）

| Endpoint | Method | 调用方函数 | 用途 |
|----------|--------|-----------|------|
| `/api/manage/v1/td/operation/edit/detail/{code}` | **GET（动态 URL）** | getDetailApi (stablecoin-settings) | 编辑详情回填（模板字符串拼 code） |
| `/api/manage/v1/td/apply/key/service/list` | POST | tdApplyKeyServiceListApi | 密钥服务下拉（body blockchainId，默认选首项 keyServiceCode） |
| `/api/manage/v1/td/apply/admin/wallet/list` | POST | tdApplyAdminWalletListApi | 管理员钱包列表（body blockchainId，仅 Ethereum Sepolia+Huawei KMS 场景自动拉） |
| `/api/finance/v1/finance/template/list` | GET | financeTemplateListApi | 科目模板下拉（query tokenType=1/5） |
| `/api/finance/v1/finance/book/by-reserve/{reserveAccountId}` | **GET（动态 URL）** | financeBookBy_reserveApi | 按 reserveAccountId 查 Financial Book（stablecoin COA） |

### 3.5 公共下拉 / 其他（1 个）

| Endpoint | Method | 调用方函数 | 用途 |
|----------|--------|-----------|------|
| `/api/manage/v1/common/timezone/list` | GET | commonTimezoneListApi | 时区下拉（COA 设置用） |

### 3.6 Mock API（无真实 endpoint，3 个，保留 mock）

| Mock 函数 | 来源 | 用途 | 迁移决策 |
|-----------|------|------|----------|
| `getRoleWalletsListApi` | stablecoin.ts | 角色钱包列表（role-wallets.tsx customFetch） | **保留 mock**（setTimeout 模拟 + 本地 generateMockRoleWallets） |
| `getRoleWalletDetailApi` | stablecoin.ts | 角色钱包详情（含 operations） | **保留 mock** |
| `configureRoleWalletApi` | stablecoin.ts | 配置角色钱包提交 | **保留 mock** |

> **不纳入本模块的 API**（经 grep 确认未被 tokenized-deposit 调用）：
> - 价格系列：`/stablecoin/price/{add,update,examine,get,auditPrice,getUsablePrice,getUnenforcedPrice}`（属 stablecoin 价格管理模块）
> - 审批：`/td/manage/audit/record`(approvalApi)、`/td/apply/audit`(approvalTdApi)、`/td/operation/audit`(approvalTdEditApi)
> - common.ts 其余：`/rbac/v1/user/password/modify`、`/rbac/v1/user/accessKey/get`、`/common/bank/list`、`/common/resources/search`、sftp/download
> - coa 占位：`/td/apply/coa/detail`(getCoaSetupByReserveApi，TODO 未实装，实际用 finance/book/by-reserve)

### 3.7 依赖共享组件 / 工具

- `libs/components`：`CustomTable` / `useCustomTable` / `CustomTableTitle` / `CustomForms` / `CustomModal` / `CustomTab`(CustomTabs) / `CustomCopy` / `useHook`(i18n+router+query)
- `libs/utils`：`formatTimestamp` / `reSet`(金额格式化) / `getLS` / `getServerSidePropsResult` / `getEncryptionData`(**AES-CBC 加密**，`libs/utils/get/getEncryptionData.ts`)
- `@/typings/token-manage/V1`：6 个自动生成 API（tdApplyAdd/tdOperationEdit/tdApplyKeyServiceList/tdApplyAdminWalletList/utilWalletKeystore/commonTimezoneList）+ 类型（TdApplyAddReqVo 等）
- `@/typings/token-finance/V1`：2 个 API（financeBookBy_reserve/financeTemplateList）+ 类型（FinanceBookRespVo）
- `@/typings/manage/data-contracts`：QueryTokenTypesRespVo（useTokenTypeOptions）

---

## 4. 复杂度评估

| 维度 | 评估 |
|------|------|
| 复杂度等级 | **极高**（迄今最高，超过 statements / cross-chain） |
| 困难分数 | **5/5** |
| 主要难点 | ① index.tsx 2666 行单文件（4 Tab×3 分支 + 5 Modal + 9 按钮 + 动态双 URL）；② edit 组件群 19 文件 hook 间深度耦合（useWalletManagement×useTokenizedDepositSubmit×useCoaSetup×useDetailInit）；③ AES 钱包加密 + 双生成路径(keystore/rigsec)；④ 41 endpoint 跨 4 个命名混乱的 api 模块；⑤ mintMethod/applyStatus/state/pledgeType 四状态机交叉；⑥ COA Financial Book 双套数据(stablecoin configured 只读 / TD setup_required 可编辑)；⑦ 字段命名转换(decimals↔decimalPrecision, keyServiceName↔keyServiceCode)；⑧ 2 个 100% mock 页(t_edit/role-wallets) |
| 建议负责人 | **高级前端 / 架构组成员**（index.tsx 与 edit 组件群需架构级拆分） |
| 风险点 | AES key/iv 必须与后端一致；index.tsx 直接迁移会触发 nx lazy 误报，必须拆；edit hook 链时序敏感（竞态/联动）；mock 页需决策是否补 API |

---

## 5. 迁移后目标文件清单

```text
libs/modules/tokenized-deposit/
├── data-access/src/lib/
│   ├── tokenized-deposit.model.ts          # 全部类型（ListItem/Detail/Form/COA/Wallet/Contract/RoleWallet）
│   ├── tokenized-deposit.api.ts            # 41 endpoint 函数（去重 + 重命名去误导）
│   ├── get-encryption-data.ts              # AES-CBC 加密（key/iv 硬编码，与后端一致）
│   └── +queries/
│       ├── tokenized-deposit.keys.ts       # Query key 工厂（按 index/view/edit/summary 分组）
│       ├── tokenized-deposit.queries.ts    # 查询 hooks（列表/详情/下拉/COA）
│       └── tokenized-deposit.mutations.ts  # 写操作 hooks（铸销/部署/启停/删除/钱包/提交）
├── feature/src/lib/
│   ├── tokenized-deposit-overview-page.tsx       # index.tsx 运营总览（拆为 shell + 4 tab content + 5 modal）
│   ├── tokenized-deposit-overview/
│   │   ├── overview-info-card.tsx                # 顶部概览卡（TD 基本信息 + 储备 + 统计）
│   │   ├── overview-action-buttons.tsx           # 9 操作按钮（权限过滤）
│   │   ├── mint-melt-modal.tsx                   # Mint/Melt Modal（储备余额校验）
│   │   ├── deploy-contract-modal.tsx             # 合约部署/升级 Modal（步骤进度）
│   │   ├── deploy-history-modal.tsx              # 部署历史 Modal
│   │   ├── admin-wallet-modal.tsx                # 管理钱包 Modal（4 态：Update/Approval/Details/History）
│   │   ├── generate-wallet-modal.tsx             # 生成钱包 keystore Modal
│   │   ├── rigsec-wallet-modal.tsx               # RigSec 钱包 Modal
│   │   ├── tab-records.tsx                       # Tab1 铸销记录（3 分支：质押/SP/MMF）
│   │   ├── tab-contracts.tsx                     # Tab2 合约部署（Steps + 包表 + 明细表）
│   │   ├── tab-wallets.tsx                       # Tab3 钱包（列表 + Additional Wallets 静态表）
│   │   └── tab-operation-records.tsx             # Tab4 操作记录
│   ├── tokenized-deposit-view-page.tsx           # view.tsx 单币种详情（3 Tab）
│   ├── tokenized-deposit-edit-page.tsx           # edit.tsx 稳定币设置编辑（壳，组装 sections）
│   ├── tokenized-deposit-edit/
│   │   ├── token-basic-info-section.tsx          # 代币基本信息（15 字段）
│   │   ├── account-type-section.tsx              # 账户类型
│   │   ├── reconciliation-config-section.tsx     # 对账配置
│   │   ├── key-custody-section.tsx               # 密钥托管
│   │   ├── admin-wallet-section.tsx              # 管理员钱包（3 角色）
│   │   ├── wallet-field-group.tsx                # 单组钱包字段
│   │   ├── account-configuration-mmf.tsx         # MMF 账户配置
│   │   ├── submit-actions.tsx                    # 返回/提交按钮
│   │   └── hooks/
│   │       ├── use-coa-setup.ts                  # COA 数据（双套 + 模板/时区）
│   │       ├── use-key-service.ts                # 密钥服务列表
│   │       ├── use-tokenized-deposit-submit.ts   # 提交（payload + AES + COA 校验）
│   │       ├── use-wallet-management.ts          # 钱包管理（双生成路径）
│   │       ├── use-blockchain-effect.ts          # 区块链联动
│   │       └── use-detail-init.ts                # 编辑回填
│   ├── tokenized-deposit-onboard-page.tsx        # t_edit.tsx Token Onboard（mock 保留）
│   ├── role-wallets.tsx                          # 角色钱包（mock 保留，view Tab3 + 复用）
│   ├── summary.tsx                               # MMF 基金汇总表
│   └── module-manifest.ts                        # 菜单/路由/权限注册
├── ui/src/lib/
│   ├── coa-setup-card.tsx                        # Financial Book 初始化卡片（完全受控）
│   ├── tokenized-deposit-status-badge.tsx        # 状态徽标（任务/合约/步骤/TD-state 多套配色）
│   └── tokenized-deposit-copy.tsx                # CopyableEllipsisText（地址/txHash + 浏览器跳转）
└── util/src/lib/
    ├── tokenized-deposit.constants.ts            # mintMethod/applyStatus/state/pledgeType 枚举 + 权限码(17) + 状态色 i18n key 前缀
    └── coa-setup-utils.ts                        # COA 工具函数（13 个，去重 types.ts/utils.ts 重复定义）
```

> **不拆库**：所有内容归 `libs/modules/tokenized-deposit/` 单库四层。index.tsx 与 edit 组件群在 feature 层用子目录前缀拆分（避免单文件过大触发 nx lazy 误报，参考 journal-entries/statements 经验）。

---

## 6. UI 组件映射

### 6.1 组件库映射

| 源组件（antd / libs） | 目标替代（admin-platform） |
|----------------------|---------------------------|
| `CustomTable` / `useCustomTable` | `DataTable` + TanStack Query + `react-hook-form`（保留 form.items / table.columns / actions 完整还原） |
| `CustomTab`(CustomTabs) | 自定义 Tab 组件（TD 切换，select/from props） |
| `CustomForms` + `CustomModal` | `react-hook-form` + shared/ui `Dialog` |
| `Form` / `Form.Item` / `Form.useWatch` / `Form.useForm` | `react-hook-form` + `useWatch` + `FormField` / `FormSelect` |
| `Input` / `Input.TextArea` / `Input.Password` / `InputNumber` | shared/ui 同名组件 |
| `Select` / `Radio.Group` / `Checkbox.Group` / `Checkbox` | shared/ui Select / RadioGroup / CheckboxGroup |
| `DatePicker.RangePicker` | `FormDatePicker`（本模块未直接用，时间筛选在 useCustomTable 内） |
| `TimePicker`（COA EOD） | shared/ui TimePicker（format HH:mm:ss，dayjs 转换） |
| `Button` / `Tooltip` / `Spin` / `Image` / `Progress` / `Steps` / `Tabs` / `Tag` | shared/ui 同名 + Tailwind badge（Tag→Badge variant 映射） |
| `CopyableEllipsisText` / `CustomCopy` | `tokenized-deposit-copy.tsx`（地址/txHash + `isHref` 浏览器跳转 `browserUrl+'tx/'+txHash`） |
| `useHook(['ns'])` + `t('key')` | i18n hook + `modules.tokenized-deposit` 命名空间 |
| `getServerSidePropsResult` + `serverSideTranslations` | 客户端 i18n（CSR/SPA，无需 SSP） |
| `Modal.useModal()`（命令式 confirm） | shared/ui Dialog 命令式 / `useDialog` |
| `message.success` | shared/ui toast |

### 6.2 状态枚举 / 配色映射（完整键值，照搬 constants.ts）

> **全部走 i18n 动态拼接**（无硬编码 JS map），迁移时常量只存 i18n key 前缀 + Badge variant 映射规则。

| 业务维度 | 色 i18n key 前缀 | 文案 i18n key 前缀 | Badge variant 映射 |
|----------|------------------|-------------------|-------------------|
| 任务/记录/钱包/操作状态 | `approval_task_status_color_{status}` | `common_task_status_{status}` | 查 common/router locale 取色→success/warning/destructive/neutral |
| 智能合约状态 | `smart_contract_status_color_{state}` | `smart_contract_status_{state}` | 同上 |
| 铸销类型 | — | `stablecoin_record_type_{recordType}` | 纯文案 |
| 操作记录类型 | — | `record_type_{recordType}` | 纯文案 |
| SP 交易类型 | — | `order_type_{txType}` | 纯文案 |
| Token 类型 | — | `token_type_{mintMethod}` | 纯文案 |
| 钱包类型 | — | `admin_wallet_type_{type}` | 纯文案 |
| 合约名（历史） | — | `contractName_{Number(name)}` | 纯文案 |
| 步骤状态（部署 Modal） | 前端硬色：3=#d4865f FieldTimeOutlined / 4=#F4AA00 LoadingOutlined / 其它=#87ca87 CheckCircleIcon | `step_status_{status}` | — |
| TD state 图标（概览卡） | state:0=ClockIcon #d4865f / 1=CheckCircleIcon #87ca87 / 2=NoSymbolIcon #fe5945 | — | — |
| 角色钱包 status（mock） | Unconfigured=default / Processing=processing / Active=success | `role_wallet_status_{lowercase}` | Tag color→Badge variant |
| fundType（summary） | — | 1-7 英文硬编码（Retail Advantage/Institutional Prime/...） | 纯文案 |
| riskLevel（summary） | — | 1-4 英文硬编码（Low R1/Moderately Low R2/...） | 纯文案 |
| COA 状态（coa-setup） | configured=bg-#ECFDF3 text-#16A34A / setup_required=bg-#D9ECFF text-#1677FF | `tokenized_deposit_coa_status_{configured/setup_required}` | 自定义徽标 |
| review_submit_state（view） | — | `review_submit_state_{1,2,4,5,6,7}`（3 注释） | 纯文案 |
| walletAttribute（edit） | — | Hot Wallet=1 / Cold Wallet=5 | RadioGroup |

### 6.3 权限码（17 个，照搬 constants.ts）

```
0574278982bc44e799c45191d82bd2d7  — customTable View（铸销记录查看）
09f612c2ce4b49e99371d86744579822  — Melt 按钮
2b651d39ec9b4c819b60c6000b118754  — Examine（死代码 action，权限码保留勿删）
61dea32a80a14c69a510997acc88c48d  — customTable3 View（操作记录查看）
76b7b9b7052247149925a5b587f8b557  — Delete 按钮
8d1bfde1bc76454daaffb370bda04fae  — History（钱包历史）
91258be4d91611ed93560242ac120002  — view Mint/Melt title 按钮
98742389681641dda0fd40206fcc5dfd  — Contracts 按钮
b12984b910d2455fafccbfd02d16d693  — Disable 按钮
bef40ba1d91611ed93560242ac120002  — Mint 按钮
c41bb38a01664119937a712e65e81c11  — Enable 按钮
cbb239787ec6457493d7cb530951baeb  — Edit 按钮
d39da78531944d5ba4b8736db471e4b2  — customTable2 View（钱包查看）
d8beb010d6e34b1a8cd7621cf2425aaf  — Transactions 按钮
da8cd0e9325d4e91a6465d6aaff8be18  — customTable2 Edit（钱包编辑）
dc7fe650ac34468cbae16b58de2447ab  — Wallets 按钮
fc9aa241ea434a42af0b2c1d3cdc3e2c  — DeploymentHistory 按钮
```
另：合约表内联按钮权限码 `b010a49839e0479eb514ba1e2305cf2a`(Upgrade/Deploy type=1) / `14f35a319d9d49f5ab2b5f7678cc35dd`(Deploy type≠1)。

### 6.4 跨模块跳转（5 个，第 8 章记录迁移依赖）

| 目标路径 | query | 触发 |
|----------|-------|------|
| `/approval-manage/view` | `{id:taskId, busCode}` | 铸销/SP/操作/钱包记录 View |
| `/transaction-flow/stablecoin` | `{stablecoinId}` | Transactions 按钮 |
| `/tokenized-deposit/edit` | `{code}` | Edit 按钮 |
| `/tokenized-deposit/approval-td-add` | `{code}` | **死分支**（actionClick case 'Approval'，无按钮触发） |
| `/wallet/user-wallet` | `{stablecoinId}` | Wallets 按钮 |

---

## 7. 迁移步骤

> 步骤粒度：每步对应一个可独立开发的 loop 任务（详见阶段三任务拆分）。

### 阶段 A：基础层（data-access / util，haiku）

1. **Nx generator 建库**：`libs/modules/tokenized-deposit/{data-access,feature,ui,util}` 四层 + `apps/admin/tsconfig.json` paths 登记（**历史踩坑：不登记 nx 误报 lazy**）。
2. **i18n**：新增 `libs/shared/util-i18n-messages/.../modules/tokenized-deposit.json`，迁入 `tokenized-deposit` / `stablecoin-settings` / `stablecoin-manage` / `dashboard` / `transaction-flow` 命名空间下本模块用到的全部 key（**注意 ICU 单花括号 `{var}`，老项目 `{{var}}` 必须转换**）。`****` 占位符约定保留。
3. **常量** `util/constants.ts`：mintMethod/applyStatus/state/pledgeType 枚举 + 17 权限码 + 状态色 i18n key 前缀 + COA 状态色 + fundType/riskLevel 映射 + `tokenized_deposit_coa_*` key。
4. **AES 加密** `data-access/get-encryption-data.ts`：搬 `getEncryptionData`（AES-128-CBC，key `reddatespartan25` / iv `hongzao25spartan`，PKCS7，输出大写）。**先读源 `libs/utils/get/getEncryptionData.ts` 确认 key/iv 与后端一致**。修复原 `let key` 全局污染 bug（改 const 局部）。
5. **类型** `data-access/model.ts`：ListItem（铸销记录/SP记录/钱包/操作记录/MMF 汇总/合约包/合约明细/部署历史/角色钱包）/ Detail（TD detail/合约 stepDetail/钱包 detail/RoleWallet detail）/ Form（TD Edit Form 26 字段 + COA + Onboard Form）/ Contract / Wallet。
6. **API** `data-access/api.ts`：41 endpoint 函数，**去重 + 重命名去误导**（如 `saveStablecoinPriceApi`→`createTDApply`，`updateStablecoinPriceApi`→`editTDOperation`）。标注 2 个动态 URL（edit/detail/{code}、book/by-reserve/{id}）。3 个 mock 函数单独标注保留 mock。
7. **Query key + hooks**：keys.ts（按 overview/view/edit/summary/role-wallet 分组）+ queries.ts（列表/详情/下拉/COA 子查询）+ mutations.ts（铸销/部署/启停/删除/钱包更新审批/生成钱包/TD 新增编辑）。**下拉 query hook 的 `select` 过滤 null/非数组**（运行时坑）。
8. **COA 工具** `util/coa-setup-utils.ts`：13 个函数，**去重**（types.ts 与 utils.ts 重复的校验函数只保留一份；`mapCoaSetupToPayload`/`mapCoaSetupToApplyAddPayload` 合并为一个）。丢弃未引用的 `configuredCoaSetupMock`。

### 阶段 B：UI 组件层（ui，haiku/opus）

9. **COA 卡片** `ui/coa-setup-card.tsx`：完全受控（无内部 state），4 字段 + fallback option 机制 + 状态徽标。dayjs 时间转换。
10. **状态徽标** `ui/tokenized-deposit-status-badge.tsx`：按维度取不同 i18n key 前缀 + Badge variant 映射。
11. **复制组件** `ui/tokenized-deposit-copy.tsx`：地址/txHash + 浏览器跳转 `browserUrl+'tx/'+txHash`。

### 阶段 C：edit 组件群（feature/tokenized-deposit-edit/，opus，最复杂）

12. **edit hooks**（6 个）：use-blockchain-effect → use-key-service → use-detail-init → use-coa-setup → use-wallet-management → use-tokenized-deposit-submit。**严格搬运时序**：区块链联动链、钱包生成双路径（keystore AES / rigsec）、COA 双套数据、提交 payload 组装（decimals→decimalPrecision 命名转换、AES password、walletPayload 按 storageType 分支）。
13. **edit sections**（8 个）：token-basic-info-section（15 字段，含 reserveAccount/blockchain 联动）/ account-type-section / reconciliation-config-section（账户级锁定逻辑）/ key-custody-section / admin-wallet-section（3 角色）/ wallet-field-group / account-configuration-mmf / submit-actions。
14. **edit 页壳** `tokenized-deposit-edit-page.tsx`：组装 sections + 2 Modal（GenerateWallet keystore / Rigsec）。query.code 区分新增/编辑。useDetailInit 回填。

### 阶段 D：index 运营总览页（feature/tokenized-deposit-overview/，opus，最复杂）

15. **overview shell + 信息卡 + 按钮**：CustomTab TD 切换 + 概览卡（state 图标 + 储备 copyable + 4 统计）+ 9 操作按钮（权限过滤 + state/applyStatus 拦截）。
16. **4 Tab content**：tab-records（3 分支：质押 customTable / SP customTableSp / MMF Summary）/ tab-contracts（Steps + 合约包表 + 明细表 + 内联部署按钮）/ tab-wallets（customTable2 双 URL 切换 + Additional Wallets 静态 mock 表）/ tab-operation-records。
17. **5 Modal**：mint-melt-modal（储备余额校验 + amount validator ≤6 位小数 ≤可用）/ deploy-contract-modal（步骤进度 + 部署按钮）/ deploy-history-modal / admin-wallet-modal（4 态：Update/Approval/Details/History）/ generate-wallet-modal + rigsec-wallet-modal。
18. **applyListApi 标题列表联动**：mount + active/activeKey 变化 + 切 TD + 删除后刷新；按 state/applyStatus 决定 active Tab；setTimeout 500ms loadTable 防闪变。

### 阶段 E：view + onboard + 其余页面（feature，opus）

19. **view 页** `tokenized-deposit-view-page.tsx`：3 Tab（铸销记录+Mint/Melt Modal / 合约部署 mock 表 / 角色钱包）。query.current 定币种。**保留 mock 合约表 + 修复 actionClick Melt 分支 bug**（原误设 Issuance 文案）。
20. **role-wallets 组件**：列表 + 配置 Modal + 详情 Modal（操作历史）。**保留 3 个 mock 函数**。
21. **summary 组件**：MMF 基金汇总表（10 列，fundType/riskLevel 映射）。
22. **onboard 页** `tokenized-deposit-onboard-page.tsx`（t_edit）：tokenType 三选 + 基本信息 + 密钥托管 + 4 角色钱包 generateWallet mock。**保留 100% mock**（setTimeout + addressMap）。**i18n 化决策**：源码几乎全英文硬编码，迁移时按需补 i18n 或保留英文（建议补，避免 MISSING_MESSAGE 风险低但一致性差）。

### 阶段 F：注册 + 终验（haiku/opus）

23. **module-manifest**：菜单/路由注册。**确认 group 机制**（本模块是否需 group？index/view/edit/onboard 是独立菜单项还是子路由）。**apps/admin/configs/<app>.json 配菜单**，page.tsx GROUP_ENABLED_KEY 加 'tokenized-deposit' 若用 group。参照 sys/blockchain group 范本。
24. **lint + test + build**：`pnpm nx lint/test/build tokenized-deposit` 全绿。
25. **运行时冒烟**（`/verify` 跑应用）：逐页打开看控制台无 Runtime Error / MISSING_MESSAGE / INVALID_MESSAGE；列表有数据；筛选/写操作可交互；AES 加密正确；COA 双态切换；4 Tab×3 分支全覆盖。

---

## 8. 风险与注意事项

### 8.1 高风险（迁移成败关键）

1. **AES key/iv 必须与后端一致**：`reddatespartan25`(key) / `hongzao25spartan`(iv)，AES-128-CBC PKCS7，输出大写。**迁移前先读源 `libs/utils/get/getEncryptionData.ts` 三次确认**。错了所有钱包提交失败。修复原 `let key` 闭包重赋值污染全局的 bug。
2. **index.tsx 2666 行直接迁移必触发 nx lazy 误报**：必须按阶段 D 拆为 shell + 4 tab content + 5 modal 子文件（参考 journal-entries/statements detail shell 拆 content 经验）。单文件 >800 行高风险。
3. **edit hook 链时序敏感**：useDetailInit（回填）→ useBlockchainEffect（联动）→ useWalletManagement（钱包生成）→ useTokenizedDepositSubmit（提交）有严格调用顺序与依赖。useWalletManagement 的 `previousTokenNameRef`/`shouldResetWalletOnTokenNameChange` 竞态保护、utilWalletKeystoreApi 的 ifAdd（新增 true/编辑 false）参数、Ethereum Sepolia+Huawei KMS 隐藏生成按钮特殊分支——**完整搬运，勿简化**。
4. **字段命名转换**：表单 `decimals` ↔ API `decimalPrecision`；表单 `keyServiceName` ↔ API `keyServiceCode`；`accountTemplateCode`(string) ↔ `bookTemplateId`(number)。提交与回填双向都要转换，错了数据错位。
5. **2 个动态 URL**：`/td/operation/edit/detail/{code}`（GET）、`/finance/v1/finance/book/by-reserve/{reserveAccountId}`（GET）。模板字符串拼 id，api.ts 必须正确实现。
6. **customTable2 双 URL 切换**：`isOnclick` 控制走 balance 还是 listPage，刷新按钮触发，切 TD 时 useEffect 复位。状态管理易错。
7. **41 endpoint 跨 4 个命名混乱 api 模块**：函数名严重误导（`saveStablecoinPriceApi` 实际打 `/td/apply/add`），且多个函数指向同 endpoint（`updateStatusApi`/`statusUpdateApi` 都打 `/td/operation/enable`；`getWalletKeystoreApi`/`utilWalletKeystoreApi` 都打 `util/wallet/keystore`）。**api.ts 去重重命名时必须以 endpoint 为准**，逐一核对，错一个就调错接口。

### 8.2 运行时坑（静态 verify 覆盖不到，必做冒烟）

8. **i18n 双重前缀**：页面 `useTranslations('modules.tokenized-deposit')` 已在 namespace，常量 labelKey/KEY_PREFIX **不要再带 `tokenized-deposit.` 前缀**（否则 `modules.tokenized-deposit.tokenized-deposit.key` → MISSING_MESSAGE）。
9. **Radix Select 禁止 SelectItem value 空串**：原生 Select（per-option disabled 用）的"全部"选项用 `'all'` 非 `''`。
10. **i18n ICU 语法**：admin-platform 用 next-intl 单花括号 `{var}`，老项目 i18next 双花括号 `{{var}}` 必须转换，否则 INVALID_MESSAGE。
11. **下拉数据防御**：blockchain/currency/tokenType/timezone/template/reserve/keyService 下拉 hook 的 `select` 里过滤 null/非数组（`Array.isArray ? filter(o=>o!=null) : []`），一处覆盖所有消费页面。
12. **金额格式化 reSet**：铸销金额、储备余额、统计数字都用 `reSet`（libs/utils），迁移到 admin-platform 对应工具，保持一致。

### 8.3 业务正确性

13. **mintMethod 四状态机交叉**：1=Stablecoin（显 reserveAccount/COA configured/储备对账/阈值）、5=TD（隐 reserveAccount/COA setup_required）、20=MMF（隐 reserveAccount/无 COA/显 AccountConfigurationMMF）。显隐与 payload 结构都依赖，错了 UI 错乱。
14. **applyStatus 状态机**：1=待审批（Edit/Contracts/Delete 可用）、5/15=审批中（→active '4'）、20=待部署（→active '2'）、35=已生效（编辑只读判定贯穿 6 处）。按钮显隐与 active Tab 联动。
15. **COA 双套数据互斥**：stablecoin（configured 只读，by-reserve 拉取）/ TD（setup_required 可编辑，本地）。edit.tsx 至多渲染一个 CoaSetupCard。提交时按 mintMethod 校验对应套。
16. **storageType 钱包分支**：key_keystore → adminWalletDTOList（含 AES password + keyStore）；rigsec/fireblocks → roleWalletDTOList（仅 walletAddress）。提交 payload 形态完全不同。
17. **Mint/Melt 校验**：amount >0、≤6 位小数、≤availableBalance(Mint)/surplusCount(Melt)。getReservBalanceApi 先拉余额组装 modalInfo。

### 8.4 已知限制 / 死代码（不迁移，但标注）

18. **t_edit.tsx 100% mock**：无真实 API（setTimeout + 本地 addressMap）。`burnWalletAddress`/'To-be Burn' 预留死代码（UI 无入口）。`enableWhitelist` 永久 disabled + `whitelistMode` partial 选项 disabled。**保留 mock 迁移**，第 8 章记录。
19. **role-wallets 100% mock**：3 个函数（getRoleWalletsListApi/getRoleWalletDetailApi/configureRoleWalletApi）全 setTimeout + 本地 generateMockRoleWallets。**保留 mock**。
20. **view.tsx 拷贝痕迹**：组件名 `STABLECOINView`、actionClick Melt 分支误设 Issuance 文案 bug、customTable1.ref.mutate() 注释（提交后不刷新）、Tab2 合约表全 mock、stablecoin-settings namespace 重复加载。**迁移时修复 Melt bug + 决定是否补刷新**。
21. **index.tsx 死代码**：customTable 的 `to` 列整列注释、customTable2 的 `Examine` action 项注释（actionClick case 保留）、Additional Wallets 的 Force Transfer 行注释、`GeneratemodalInfo`/`table2InitialValues`/`table2Form`/`walletAttribute`/`stepOneProgress` 未使用 state、actionClick case 'Approval' 死分支（无按钮）。**不迁移死代码**，但权限码 `2b651d39...`(Examine) 保留勿删（token-pair 经验：死代码权限码可能被复用）。
22. **utils.ts 与 coa-setup/types.ts 重复定义**：3 个校验函数 + 2 个常量重复，`mapCoaSetupToPayload`/`mapCoaSetupToApplyAddPayload` 逐字符相同。**迁移时去重，保留一份**（Rule 7 冲突，coa-setup 版本更新，保留之）。
23. **价格系列 API 不属本模块**：`/stablecoin/price/*` 7 个 endpoint 经 grep 确认未被 tokenized-deposit 调用，属 stablecoin 价格管理模块。**不迁移**。
24. **coa-setup 不可复用 chart-of-accounts**：前者操作 Finance Book 初始化（book 级，3 endpoint：template/book-by-reserve/timezone），后者操作 COA 科目账户树（account 级，/finance/coa/* 系列）。**零 API 交集，不同层级**，coa-setup 独立迁移为 tokenized-deposit ui 子组件。
25. **硬编码英文**：t_edit 几乎全英文、view Tab2 合约表、index Additional Wallets、KeyCustodySection、RigsecWalletModal、whitelist/threshold 区、`Serial No.`/`Chain Name`。迁移时按需补 i18n（优先级：影响功能的 > 纯展示的）。

---

## 9. 验收标准

> 每项可客观验证（能跑 / 能看到 / 能对照）。验收率目标 **99%**。

### 9.1 页面可访问与渲染

- [ ] `/tokenized-deposit`（运营总览）可访问，无 404；applyListApi 有数据时显示 TD 列表 + 概览卡 + 4 Tab；无数据时显示 Empty 空页。
- [ ] `/tokenized-deposit/view`（单币种详情）3 Tab 可切换；query.current 定币种正确。
- [ ] `/tokenized-deposit/edit`（设置编辑）新增/编辑（query.code）两种态正确；edit 组件群 8 section + 2 Modal 渲染完整。
- [ ] `/tokenized-deposit/onboard`（t_edit，路由名待定）tokenType 三选切换正常（mock）。
- [ ] 控制台无 Runtime Error / MISSING_MESSAGE / INVALID_MESSAGE（逐页验证）。

### 9.2 列表与详情

- [ ] index 4 Tab×3 分支（质押铸销/SP 直铸/MMF 汇总）数据正确显示，分页正常。
- [ ] index Tab2 合约包表 + 合约明细表 + 部署历史 Modal 数据正确。
- [ ] index Tab3 钱包表 customTable2 双 URL（listPage/balance）切换正确，刷新按钮触发 balance。
- [ ] index Tab4 操作记录数据正确，行查看跳 `/approval-manage/view`。
- [ ] view 铸销记录表数据正确，Mint/Melt Modal 金额校验（>0/≤6 位小数/≤可用）生效。
- [ ] view Tab3 角色钱包（mock）列表 + 配置 Modal + 详情 Modal 可交互。
- [ ] summary MMF 汇总表 10 列（fundType 1-7 / riskLevel 1-4 映射）正确。

### 9.3 写操作

- [ ] index Mint/Melt：getReservBalanceApi 拉余额 → Modal → stablecoinApi(type=1/2) 提交 → 刷新 + isShowMelt 更新。
- [ ] index 合约部署/升级：getDeployInfoApi 拉步骤 → getDeployApi(taskCode) 部署 → 进度更新 + 刷新合约表。
- [ ] index Disable/Enable：statusUpdateApi(enable=0/1) → 刷新。
- [ ] index Delete：deleteApi(code) → 切 activeKey 0 + 刷新标题列表。
- [ ] index 管理员钱包 Update：updateAdminWalletApi（AES password）→ 刷新钱包表。
- [ ] index 生成钱包 keystore：getWalletKeystoreApi（AES password）→ 回填地址/keystore。
- [ ] edit 新增提交：tdApplyAddApi（payload 含 AES password + coaPayload + walletPayload 按 storageType）→ 成功 Toast + 返回。
- [ ] edit 编辑提交：tdOperationEditApi → 成功 + 返回。
- [ ] edit 编辑回填：getDetailApi(code) → 字段命名转换正确（decimalPrecision→decimals）。
- [ ] COA 设置：financeTemplateListApi/commonTimezoneListApi 下拉 + financeBookBy_reserveApi 拉取（stablecoin configured 只读 / TD setup_required 可编辑）+ 浏览器时区自适应。

### 9.4 状态机与权限

- [ ] mintMethod 分支：1/5/20 显隐正确（reserveAccount/COA/对账/阈值/AccountConfigurationMMF）。
- [ ] applyStatus 状态机：按钮显隐（1 待审批/35 已生效只读）+ active Tab 联动正确。
- [ ] 17 权限码按钮可见性正确（userPermission 过滤）。
- [ ] 状态徽标配色（任务/合约/步骤/TD-state/COA）与源码一致。

### 9.5 工程质量

- [ ] `pnpm nx lint tokenized-deposit` 全绿（无 lazy 误报 → 证明大文件拆分成功）。
- [ ] `pnpm nx test tokenized-deposit` 全绿。
- [ ] `pnpm nx build tokenized-deposit` 全绿。
- [ ] AES 加密单测：getEncryptionData 输出与源码一致（固定 key/iv 测试向量）。
- [ ] COA 工具函数单测：mapFinanceBookToCoaSetup / mapCoaSetupToPayload / validateCoaSetup。
- [ ] apps/admin/tsconfig.json paths 已登记 tokenized-deposit（无 nx 误报）。
- [ ] i18n key 齐全（tokenized-deposit/stablecoin-settings/stablecoin-manage/dashboard/transaction-flow 命名空间下本模块 key 全迁入，ICU 语法正确）。

### 9.6 跨模块

- [ ] 5 个跨模块跳转（/approval-manage/view、/transaction-flow/stablecoin、/tokenized-deposit/edit、/wallet/user-wallet；/tokenized-deposit/approval-td-add 死分支标注不实现）路由可达。
- [ ] 复用 chart-of-accounts：确认未误并（coa-setup 独立）。
- [ ] 复用 wallet/mmf/blockchain 模块：确认下拉/工具复用关系正确。

---

## 附录：源码地图（供开发阶段快速定位）

| 目标产物 | 源文件 | 关键行 |
|---------|--------|--------|
| overview shell | index.tsx | 主组件 + state(50+) + useEffect 联动 |
| applyListApi 标题列表 | index.tsx getTilteList | — |
| 9 操作按钮 | index.tsx buttons useMemo | limit 权限码 |
| Mint/Melt Modal | index.tsx modalInfo + form2 + getReservBalance | amount validator |
| 部署 Modal | index.tsx isModalOpenDelopy + getDeployInfo/getDeploy | stepDetailList |
| 管理钱包 Modal | index.tsx adminWalletModalOpen (4 态) | updateAdminWalletApi/approvalAdminWalletApi |
| 生成钱包 Modal | index.tsx generateIsModalOpen + setWalletInfo | getWalletKeystoreApi AES |
| RigSec Modal | index.tsx isRigsecModalOpen | utilWalletKeystoreApi |
| edit 壳 | edit.tsx | 组装 sections + 2 Modal |
| useDetailInit 回填 | edit/hooks/useDetailInit.ts | getDetailApi + 字段转换 |
| useWalletManagement | edit/hooks/useWalletManagement.tsx | 双生成路径 + Ethereum Sepolia 特殊 |
| useTokenizedDepositSubmit | edit/hooks/useTokenizedDepositSubmit.ts | payload + AES + COA 校验 |
| useCoaSetup | edit/hooks/useCoaSetup.ts | 双套 + 模板/时区 + by-reserve |
| COA 卡片 | coa-setup/CoaSetupCard.tsx | 4 字段受控 + fallback |
| AES 加密 | libs/utils/get/getEncryptionData.ts | key/iv（迁移前三次确认） |
| view 3 Tab | view.tsx | Mint/Melt + 合约 mock + role-wallets |
| onboard mock | t_edit.tsx | tokenType + addressMap + setTimeout |
| role-wallets mock | role-wallets.tsx + stablecoin.ts mock 函数 | 3 mock 函数 |
| summary MMF | summary.tsx | fundType/riskLevel 映射 |
