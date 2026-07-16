/**
 * tokenized-deposit 模块业务类型定义。
 *
 * 来源：td-manage tokenized-deposit 模块（index/view/edit/t_edit + edit 组件群 19 文件 + coa-setup）。
 * 覆盖：ListItem（12 种）/ Detail（5 种）/ Form（4 种）/ Params / 公共类型。
 * 列表行注入字符串 `id`（= String(主键)）满足 DataTable `{ id: string }` 契约。
 *
 * ## 字段命名转换（表单 ↔ API，双向）
 *
 * | 表单字段             | API 字段              | 说明             |
 * | -------------------- | --------------------- | ---------------- |
 * | `decimals`           | `decimalPrecision`    | 小数精度         |
 * | `keyServiceName`     | `keyServiceCode`      | 密钥服务标识     |
 * | `accountTemplateCode`（string） | `bookTemplateId`（number） | COA 科目模板 ID  |
 *
 * ## 注意
 *
 * - 分页请求体统一使用 `pageNum` / `pageSize`（非 `page`）。
 * - 金额字段为 string（避免 JS 浮点精度问题）。
 * - 枚举值使用 constants.ts 中 `as const` 对象的 value 类型。
 * - `[key: string]: unknown` 索引签名用于 API 透传额外字段。
 */

// ═══════════════════════════════════════════════════════════════════
// 公共类型
// ═══════════════════════════════════════════════════════════════════

/** 分页响应元信息（对齐 RBAC/sys 域后端返回）。 */
export interface ResultPageInfo {
  total?: number;
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

/** 标准 API 响应包裹（对齐 td-manage ResultInfo）。 */
export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  data: T;
}

/** 分页列表响应通用结构。 */
export interface PaginatedResponse<T> {
  page?: ResultPageInfo;
  rows: T[];
}

// ═══════════════════════════════════════════════════════════════════
// 1. 列表项（ListItem，12 种）
// ═══════════════════════════════════════════════════════════════════

/**
 * TDRecordItem — 铸销记录列表项。
 * endpoint: POST /api/manage/v1/td/manage/searches/record
 * rowKey: recordId
 */
export interface TDRecordItem {
  /** DataTable 契约 id（= String(recordId)）。 */
  id: string;
  recordId?: string;
  from?: string;
  to?: string;
  /** 记录类型（stablecoin_record_type_${recordType}）。 */
  recordType?: number;
  amount?: string;
  createUser?: string;
  createTime?: number;
  transactionHash?: string;
  transactionTime?: number;
  /** 状态（common_task_status_${status}）。 */
  status?: number;
  symbol?: string;
  /** 审批 ID（跳 /approval-manage/view 用）。 */
  taskId?: number;
  /** 业务编码（跳 /approval-manage/view 用）。 */
  businessCode?: string;
  /** 区块链浏览器 URL 前缀。 */
  browserUrl?: string;
}

/**
 * SPRecordItem — SP 直铸记录列表项。
 * endpoint: POST /api/manage/v1/transaction/getDirectMintingTxList
 * rowKey: orderNumber
 */
export interface SPRecordItem {
  /** DataTable 契约 id（= String(orderNumber)）。 */
  id: string;
  recordId?: string;
  spName?: string;
  walletAddress?: string;
  /** 交易类型（order_type_${txType}）。 */
  txType?: number;
  txAmount?: string;
  createTime?: number;
  txTime?: number;
  txHash?: string;
  /** 状态（common_task_status_${status}）。 */
  status?: number;
  symbol?: string;
  orderNumber?: string;
  /** 审批 ID。 */
  taskId?: number;
  /** 业务编码。 */
  businessCode?: string;
  /** 区块链浏览器 URL 前缀。 */
  browserUrl?: string;
}

/**
 * WalletItem — 钱包列表项。
 * endpoint: POST /api/manage/v1/td/wallet/listPage 或 /api/manage/v1/td/wallet/balance
 * rowKey: accountId
 */
export interface WalletItem {
  /** DataTable 契约 id（= String(accountId)）。 */
  id: string;
  accountId?: number;
  /** 钱包类型（admin_wallet_type_${type}）。 */
  type?: number;
  blockchainName?: string;
  walletAddress?: string;
  balance?: string;
  unit?: string;
  updateTime?: number;
  /** 审批状态（>0 表示有待处理审批项）。 */
  approvalStatus?: number;
  /** 操作状态（35=已生效）。 */
  operateStatus?: number;
  /** 托管类型（key_keystore | rigsec | fireblocks）。 */
  storageType?: string;
  /** 链类型（evm | aptos）。 */
  chainType?: string;
  /** 链编码。 */
  blockchainCode?: string;
  /** 虚拟机编码（tron | evm）。 */
  virtualMachineCode?: string;
  /** TD 名称。 */
  tdName?: string;
  /** 稳定币 ID。 */
  stablecoinId?: number;
}

/**
 * OperationRecordItem — 操作记录列表项。
 * endpoint: POST /api/manage/v1/td/records/listPage
 * rowKey: recordId
 */
export interface OperationRecordItem {
  /** DataTable 契约 id（= String(recordId)）。 */
  id: string;
  recordId?: number;
  /** 操作记录类型（record_type_${recordType}）。 */
  recordType?: number;
  createUser?: string;
  createTime?: number;
  /** 交易 hash（别名 txHash，与接口字段一致）。 */
  txHash?: string;
  txTime?: number;
  /** 状态（common_task_status_${state}）。 */
  state?: number;
  /** 审批 ID。 */
  taskId?: number;
  /** 业务编码（别名 busCode，与接口字段一致）。 */
  busCode?: string;
  /** 区块链浏览器 URL 前缀。 */
  browserUrl?: string;
}

/**
 * MMFSummaryItem — MMF 基金汇总列表项。
 * endpoint: POST /api/manage/v1/td/mmf/summary/listPage
 * rowKey: walletTypeCode
 */
export interface MMFSummaryItem {
  /** DataTable 契约 id（= walletTypeCode）。 */
  id: string;
  walletTypeCode?: string;
  walletTypeName?: string;
  /** fundType（1-7，硬编码英文映射）。 */
  fundType?: number;
  /** riskLevel（1-4，硬编码英文映射）。 */
  riskLevel?: number;
  fundAssetValue?: number;
  fundInceptionTime?: number;
  totalTokenCount?: number;
  totalFundAmount?: number;
  walletCount?: number;
  fundLastPayoutTime?: number;
  totalTokenCountSymbol?: string;
  totalFundAmountSymbol?: string;
}

/**
 * ContractPackageItem — 合约包列表项（已部署合约概览）。
 * endpoint: POST /api/manage/v1/td/contract/latestInfo
 * rowKey: packageName（或其他唯一业务键，由 DataTable 调用方注入 id）
 */
export interface ContractPackageItem {
  /** DataTable 契约 id（= String(index) 或 packageName）。 */
  id: string;
  packageName?: string;
  blockchainName?: string;
  packageVersion?: string;
  contractLanguage?: string;
  releaseTime?: number;
  deployTime?: number;
  /** 状态（smart_contract_status_${state}）。 */
  state?: number;
  /** 升级标记：1=已升级 / 0=未升级。 */
  upgraded?: number;
  /** 渲染标记（type===1 升级型 TD，由调用方按需注入；未注入视为普通行）。 */
  __tdType?: number;
  /** 部署任务编码。 */
  taskCode?: string;
  /** 升级任务编码。 */
  upgradeTaskCode?: string;
}

/**
 * ContractDetailItem — 合约明细列表项。
 * endpoint: POST /api/manage/v1/td/contract/detail
 * rowKey: contractName（或其他唯一键）
 */
export interface ContractDetailItem {
  /** DataTable 契约 id。 */
  id: string;
  contractName?: string;
  contractVersion?: string;
  contractAddress?: string;
  contractHash?: string;
  deployTime?: number;
  /** 状态（smart_contract_status_${state}）。 */
  state?: number;
}

/**
 * DeployHistoryItem — 部署历史项。
 * endpoint: POST /api/manage/v1/td/contract/deploy/history
 * 接口返回 data[0] 为单条历史记录。
 */
export interface DeployHistoryItem {
  /** DataTable 契约 id。 */
  id: string;
  tdName?: string;
  packageName?: string;
  packageVersion?: string;
  deployTime?: number;
  /** 合约明细子列表。 */
  detailList?: ContractDetailItem[];
}

/**
 * WalletDetailItem — 钱包详情 / 历史项。
 * endpoint: POST /api/manage/v1/td/wallet/detail 或 /api/manage/v1/td/wallet/history
 * rowKey: recordId
 */
export interface WalletDetailItem {
  /** DataTable 契约 id（= String(recordId)）。 */
  id: string;
  originalWalletAddress?: string;
  walletAddress?: string;
  /** 钱包类型。 */
  type?: number;
  createTime?: number;
  createUser?: string;
  /** 状态。 */
  status?: number;
  recordId?: number;
}

/**
 * ApplyListItem — TD 标题列表项（index 顶部 TD 切换 + 概览数据源）。
 * endpoint: POST /api/manage/v1/td/apply/list
 */
export interface ApplyListItem {
  /** DataTable 契约 id（= code）。 */
  id: string;
  /** 稳定币名称。 */
  name?: string;
  /** TD 类型（token_type_${type}）。 */
  type?: number;
  /** 启停状态：0=未生效 / 1=启用 / 2=禁用。 */
  state?: number;
  /** 铸币方法（源字段名 tokenType）：1=Stablecoin / 5=TD / 20=MMF。 */
  mintMethod?: number;
  /** 审批状态：1=待审批 / 5/15=审批中 / 20=待部署 / 35=已生效。 */
  applyStatus?: number;
  /** 链短名。 */
  blockchainNameAbbreviation?: string;
  /** 业务编码（查询参数用）。 */
  code?: string;
  /** 稳定币 ID（查询参数用）。 */
  stablecoinId?: string;
  /** 链名称。 */
  blockchainName?: string;
  /** 代币符号。 */
  symbol?: string;
  /** 币种符号。 */
  currencySymbol?: string;
  /** 储备账户 ID。 */
  reserveAccount?: number;
  /** 质押类型：0=SP 直铸 / 1=质押铸造。 */
  pledgeType?: number;
  // ── 概览卡统计字段（applyList 响应透传，概览卡 + 储备区读取）──
  /** 储备余额（储备区 + Mint/Melt Modal 拉取覆盖）。 */
  reserveBalance?: number;
  /** 总发行量（issueCount）。 */
  issueCount?: number;
  /** 总销毁量（removeCount）。 */
  removeCount?: number;
  /** 总剩余（surplusCount，质押稳定币储备账户余额）。 */
  surplusCount?: number;
  /** 流通量（circulationCount）。 */
  circulationCount?: number;
  /** 1 单位代币兑换的法币数量（stablecoinCount 个代币 = usPrice 法币）。 */
  stablecoinCount?: number;
  /** 法币价格。 */
  usPrice?: number;
  /** 小数精度。 */
  decimalPrecision?: number;
}

/**
 * RoleWalletItem — 角色钱包列表项（mock 数据）。
 * 函数: getRoleWalletsListApi（mock，setTimeout 300ms）
 * rowKey: roleWalletId
 */
export interface RoleWalletItem {
  /** DataTable 契约 id（= roleWalletId）。 */
  id: string;
  roleWalletId?: string;
  tokenId?: string;
  roleName?: string;
  walletAddress?: string;
  blockchain?: string;
  /** 钱包属性：'Hot Wallet' | 'Cold Wallet'。 */
  walletAttribute?: string;
  description?: string;
  /** 状态：'Unconfigured' | 'Processing' | 'Active'。 */
  status?: string;
  createdTime?: number;
  updatedTime?: number;
  createdBy?: string;
  updatedBy?: string;
  /** 操作历史列表（详情接口返回）。 */
  operations?: RoleWalletOperation[];
}

/**
 * RoleWalletOperation — 角色钱包操作记录（mock 详情子数据）。
 */
export interface RoleWalletOperation {
  /** DataTable 契约 id（= operationId，由 API 层注入）。 */
  id: string;
  operationId?: string;
  operationType?: string;
  txHash?: string;
  description?: string;
  timestamp?: number;
  operator?: string;
  status?: string;
}

/**
 * AdminWalletListItem — 管理员钱包列表项（edit 页自动拉取）。
 * endpoint: POST /api/manage/v1/td/apply/admin/wallet/list
 * 用于 Ethereum Sepolia + Huawei KMS 场景下自动填充钱包字段。
 */
export interface AdminWalletListItem {
  /** DataTable 契约 id。 */
  id: string;
  /** 账户类型（钱包角色）。 */
  accountType?: number;
  walletAddress?: string;
}

// ═══════════════════════════════════════════════════════════════════
// 2. 详情（Detail，5 种）
// ═══════════════════════════════════════════════════════════════════

/**
 * TDEditDetail — 编辑详情回填。
 * endpoint: GET /api/manage/v1/td/operation/edit/detail/{code}
 * 字段来源：getDetailApi 返回的 data.data。
 *
 * ## 字段命名转换（回填时由 useDetailInit 处理）
 *
 * - API `decimalPrecision` → 表单 `decimals`
 * - API `keyServiceCode`   → 表单 `keyServiceName`
 * - API `bookTemplateId`（number）  → COA `accountTemplateCode`（string）
 */
export interface TDEditDetail {
  /** 审批状态。 */
  applyStatus?: number;
  /** 铸币方法：1=Stablecoin / 5=TD / 20=MMF。 */
  mintMethod?: number;
  /** 区块链 ID。 */
  blockchainId?: number;
  /** 币种符号。 */
  currencySymbol?: string;
  /** 托管类型（key_keystore | rigsec | fireblocks）。 */
  storageType?: string;
  /** 密钥服务编码（keyServiceCode，回填时映射到表单 keyServiceName）。 */
  keyServiceCode?: string;
  /** 是否启用 Token 对账：0=未启用 / 1=启用。 */
  enableTokenReconciliation?: number;
  /** 是否启用储备资产对账：0=未启用 / 1=启用。 */
  enableReserveAssetReconciliation?: number;
  /** Token 对账生效时间（epoch ms）。 */
  tokenReconEffectiveTime?: number;
  /** 储备资产对账生效时间（epoch ms）。 */
  reserveReconEffectiveTime?: number;
  /** 小数精度（API decimalPrecision，回填时映射到表单 decimals）。 */
  decimalPrecision?: number;
  /** 代币名称。 */
  name?: string;
  /** 代币符号。 */
  symbol?: string;
  /** USD 单价。 */
  usPrice?: string;
  /** 智能合约包 ID（string 化用）。 */
  smartContractPackageId?: number;
  /** 账户类型列表（number[]）。 */
  accountTypeList?: number[];
  /** metaType：1=Tron / 其他。 */
  metaType?: number;
  /** 储备账户 ID。 */
  reserveAccountId?: number;
  /** 管理员钱包 DTO 列表（storageType===key_keystore 时使用）。 */
  adminWalletDTOList?: Array<{
    accountType?: number;
    walletAddress?: string;
    keyStore?: string;
  }>;
  /** 钱包列表（通用）。 */
  walletList?: Array<{
    accountType?: number;
    walletAddress?: string;
    keyStore?: string;
  }>;
  /** 角色钱包 DTO 列表（storageType 为 rigsec/fireblocks 时使用）。 */
  roleWalletDTOList?: Array<{
    accountType?: number;
    walletAddress?: string;
  }>;
  /** Financial Book 名称。 */
  bookName?: string;
  /** 科目模板 ID（number，回填时映射到 COA accountTemplateCode）。 */
  bookTemplateId?: number;
  /** 科目模板名称。 */
  bookTemplateName?: string;
  /** 时区。 */
  timeZone?: string;
  /** EOD 截止日期。 */
  eodCutoffDate?: string;
  [key: string]: unknown;
}

/**
 * ReserveBalance — 储备/可销毁余额。
 * endpoint: POST /api/manage/v1/td/manage/reserve/balance
 */
export interface ReserveBalance {
  reserveBalance?: string;
  currencySymbol?: string;
  /** 可用余额（Mint 校验用）。 */
  availableBalance?: number;
  /** 代币符号。 */
  symbol?: string;
  /** 可销毁数量（surplusCount，Melt 校验用）。 */
  surplusCount?: number;
}

/**
 * DeployStepDetail — 部署步骤详情。
 * endpoint: POST /api/manage/v1/td/contract/deploy/stepDetail
 * 返回 data[0].stepDetailList
 */
export interface DeployStepDetail {
  /** 部署状态。 */
  deployState?: number;
  /** 部署类型。 */
  deployType?: string;
  /** 步骤详情列表。 */
  stepDetailList?: StepItem[];
}

/** 单条部署步骤。 */
export interface StepItem {
  /** 步骤状态：3=待处理 / 4=进行中 / 5=成功。 */
  status?: number;
  /** 步骤名称。 */
  name?: string;
}

/**
 * StablecoinInfo — 稳定币信息（view 页用）。
 * endpoint: POST /api/manage/v1/stablecoin/get
 */
export interface StablecoinInfo {
  /** 可销毁余额。 */
  surplusCount?: number;
  [key: string]: unknown;
}

/**
 * GenerateWalletResult — 生成钱包 keystore 响应。
 * endpoint: POST /api/manage/v1/util/wallet/keystore
 */
export interface GenerateWalletResult {
  keystore?: string;
  walletAddress?: string;
}

// ═══════════════════════════════════════════════════════════════════
// 3. 表单值（Form，4 种）
// ═══════════════════════════════════════════════════════════════════

/**
 * TDEditFormValues — TD 编辑/新增表单值（react-hook-form）。
 *
 * 26 字段覆盖：代币基本信息 + 密钥托管 + 管理员钱包(3 角色) + 阈值/白名单 + 对账配置。
 *
 * ## 提交时的字段命名转换
 *
 * - `decimals`           → `decimalPrecision`
 * - `keyServiceName`     → `keyServiceCode`
 * - (COA) `accountTemplateCode` → `bookTemplateId`（number）
 */
export interface TDEditFormValues {
  // ── 基本信息 ──
  /** 铸币方法：1=Stablecoin / 5=TD / 20=MMF。 */
  mintMethod?: number;
  /** 代币名称。 */
  name?: string;
  /** 代币符号。 */
  symbol?: string;
  /** 小数精度（表单字段名 decimals，提交时映射 API decimalPrecision）。 */
  decimals?: number;
  /** 币种符号。 */
  currencySymbol?: string;
  /** USD 单价。 */
  usPrice?: string;
  /** 储备账户 ID。 */
  reserveAccountId?: number;
  /** 区块链 ID（string 化用）。 */
  blockchainId?: string;
  /** 智能合约包 ID。 */
  smartContractPackageId?: string;
  /** metaType：1=Tron / 其他。 */
  metaType?: number;

  // ── 白名单 / 阈值 ──
  /** 白名单模式（目前仅 'full'）。 */
  whitelistMode?: string;
  /** 阈值类型。 */
  thresholdType?: string;
  /** 阈值频率。 */
  thresholdFrequency?: string;
  /** 阈值金额。 */
  thresholdValue?: string;

  // ── 账户类型 ──
  /** 账户类型列表（[1=永久, 2=可选]）。 */
  accountTypeList?: number[];

  // ── 对账配置 ──
  /** 是否启用 Token 对账。 */
  enableTokenReconciliation?: number;
  /** 是否启用储备资产对账。 */
  enableReserveAssetReconciliation?: number;

  // ── 密钥托管 ──
  /** 密钥服务名称（表单字段名 keyServiceName，提交时映射 API keyServiceCode）。 */
  keyServiceName?: string;

  // ── 管理员钱包（3 角色） ──
  /** Contract Owner 钱包地址。 */
  walletAddressContractOwner?: string;
  /** Gas Payment 钱包地址。 */
  walletAddressPaymentOfGasFee?: string;
  /** Management 钱包地址。 */
  walletAddressManagementWallet?: string;
  /** Contract Owner keystore。 */
  keyStoreContractOwner?: string;
  /** Gas Payment keystore。 */
  keyStorePaymentOfGasFee?: string;
  /** Management keystore。 */
  keyStoreManagementWallet?: string;
  /** Contract Owner AES 密码。 */
  passWordContractOwner?: string;
  /** Gas Payment AES 密码。 */
  passWordPaymentOfGasFee?: string;
  /** Management AES 密码。 */
  passWordManagementWallet?: string;
}

/**
 * CoaSetupStatus — COA 设置状态。
 */
export type CoaSetupStatus = 'configured' | 'setup_required';

/**
 * CoaSetupInfo — COA Financial Book 初始化数据。
 */
export interface CoaSetupInfo {
  /** 储备账户 ID。 */
  reserveAccountId?: number | string;
  /** 状态：configured（只读） / setup_required（可编辑）。 */
  status: CoaSetupStatus;
  /** Financial Book 名称。 */
  financialBookName?: string;
  /** 科目模板编码（string，提交时转 number bookTemplateId）。 */
  accountTemplateCode?: string;
  /** 科目模板名称。 */
  accountTemplateName?: string;
  /** EOD 截止时间（HH:mm:ss）。 */
  eodCutOffTime?: string;
  /** 时区值。 */
  timeZone?: string;
  /** 时区标签。 */
  timeZoneLabel?: string;
  /** 关联提示。 */
  linkedMessage?: string;
  /** 头部注释。 */
  headerNote?: string;
}

/**
 * CoaSetupErrors — COA 字段校验错误映射（Partial）。
 */
export type CoaSetupErrors = Partial<
  Record<
    'financialBookName' | 'accountTemplateCode' | 'eodCutOffTime' | 'timeZone',
    string
  >
>;

/**
 * CoaSetupOption — COA 下拉选项（科目模板 / 时区）。
 */
export interface CoaSetupOption {
  value: string;
  label: string;
}

/**
 * CoaSetupCardProps — COA 卡片组件 Props（完全受控组件）。
 */
export interface CoaSetupCardProps {
  data: CoaSetupInfo;
  loading?: boolean;
  /** 只读模式（stablecoin configured 态）。 */
  readonly?: boolean;
  /** 科目模板下拉选项。 */
  accountTemplateOptions?: CoaSetupOption[];
  /** 时区下拉选项。 */
  timezoneOptions?: CoaSetupOption[];
  /** 校验错误。 */
  errors?: CoaSetupErrors;
  /** 字段变更回调。 */
  onChange?: (data: CoaSetupInfo) => void;
  className?: string;
}

/**
 * MintMeltFormValues — 铸币 / 销毁 Modal 表单值。
 */
export interface MintMeltFormValues {
  /** 铸造/销毁金额（number，校验 >0、≤6 位小数、≤可用余额）。 */
  amount?: number;
}

/**
 * AdminWalletFormValues — 管理员钱包 Update 表单值。
 * endpoint: POST /api/manage/v1/td/wallet/update
 */
export interface AdminWalletFormValues {
  /** 链账户地址。 */
  chainAccountAddress?: string;
  /** 私钥。 */
  privateKey?: string;
  /** AES 加密后的密码。 */
  password?: string;
  /** 记录 ID（审批时用）。 */
  recordId?: string;
  /** 备注（审批时用）。 */
  remark?: string;
  /** 审批状态（审批时用）。 */
  state?: string;
}

// ═══════════════════════════════════════════════════════════════════
// 4. 请求参数（Params）
// ═══════════════════════════════════════════════════════════════════

/** 通用列表查询基础参数。 */
export interface BaseListParams {
  pageNum: number;
  pageSize: number;
  [key: string]: unknown;
}

// ── 4.1 铸销记录 ──

/**
 * TDRecordListParams — 铸销记录列表查询参数。
 * endpoint: POST /api/manage/v1/td/manage/searches/record
 */
export interface TDRecordListParams extends BaseListParams {
  /** 稳定币编码（initialValues）。 */
  stablecoinCode?: string;
}

// ── 4.2 SP 直铸记录 ──

/**
 * SPRecordListParams — SP 直铸记录列表查询参数。
 * endpoint: POST /api/manage/v1/transaction/getDirectMintingTxList
 */
export interface SPRecordListParams extends BaseListParams {
  /** 稳定币 ID（initialValues）。 */
  stablecoinId?: string;
}

// ── 4.3 钱包 ──

/**
 * WalletListParams — 钱包列表查询参数。
 * endpoint: POST /api/manage/v1/td/wallet/listPage 或 /api/manage/v1/td/wallet/balance
 */
export interface WalletListParams extends BaseListParams {
  /** 稳定币编码。 */
  stablecoinCode?: string;
}

/**
 * WalletDetailParams — 钱包详情列表查询参数。
 * endpoint: POST /api/manage/v1/td/wallet/detail 或 /api/manage/v1/td/wallet/history
 */
export interface WalletDetailParams extends BaseListParams {
  /** 稳定币 ID。 */
  stablecoinId?: number;
  /** 账户类型。 */
  accountType?: number;
}

// ── 4.4 操作记录 ──

/**
 * OperationRecordListParams — 操作记录列表查询参数。
 * endpoint: POST /api/manage/v1/td/records/listPage
 */
export interface OperationRecordListParams extends BaseListParams {
  /** 稳定币编码。 */
  stablecoinCode?: string;
}

// ── 4.5 MMF 汇总 ──

/**
 * MMFSummaryListParams — MMF 基金汇总查询参数。
 * endpoint: POST /api/manage/v1/td/mmf/summary/listPage
 */
export interface MMFSummaryListParams extends BaseListParams {
  /** Token 编码。 */
  tokenCode?: string;
}

// ── 4.6 合约 ──

/**
 * ContractPackageListParams — 合约包列表查询参数。
 * endpoint: POST /api/manage/v1/td/contract/latestInfo
 */
export interface ContractPackageListParams extends BaseListParams {
  /** 稳定币编码。 */
  stablecoinCode?: string;
}

/**
 * ContractDetailListParams — 合约明细查询参数。
 * endpoint: POST /api/manage/v1/td/contract/detail
 */
export interface ContractDetailListParams extends BaseListParams {
  /** 稳定币编码。 */
  stablecoinCode?: string;
}

// ── 4.7 稳定币记录（view 页） ──

/**
 * StablecoinRecordListParams — view 页铸销记录查询参数。
 * endpoint: POST /api/manage/v1/stablecoin/record/query
 */
export interface StablecoinRecordListParams extends BaseListParams {
  /** 交易 hash。 */
  txHash?: string;
}

// ── 4.8 角色钱包（mock） ──

/**
 * RoleWalletListParams — 角色钱包列表查询参数（mock）。
 */
export interface RoleWalletListParams extends BaseListParams {
  tokenId?: string;
  roleName?: string;
  walletAddress?: string;
}

// ── 4.9 公共下拉 ──

/**
 * CommonBlockchainListParams — 区块链下拉查询参数。
 * endpoint: GET /api/manage/v1/common/blockchain/list
 */
export interface CommonBlockchainListParams {
  /** 无额外筛选字段（GET 请求）。 */
  [key: string]: unknown;
}

/**
 * FinanceBookByReserveParams — 按储备账户查 Financial Book。
 * endpoint: GET /api/finance/v1/finance/book/by-reserve/{reserveAccountId}
 */
export interface FinanceBookByReserveParams {
  reserveAccountId: number | string;
}

/**
 * FinanceTemplateListParams — 科目模板下拉查询参数。
 * endpoint: GET /api/finance/v1/finance/template/list
 */
export interface FinanceTemplateListParams {
  /** Token 类型：1=Stablecoin / 5=TD。 */
  tokenType?: number;
}

/**
 * FinanceTemplateOption — 科目模板下拉选项。
 * endpoint: GET /api/finance/v1/finance/template/list 响应项。
 *
 * 字段与 util `coa-setup-utils.ts` 消费方一致：useCoaSetup 映射
 * `FinanceTemplateOption → CoaSetupOption`（value=String(bookTemplateId)||bookTemplateName,
 * label=bookTemplateName）。td-11 hooks 引用本类型。
 */
export interface FinanceTemplateOption {
  bookTemplateId?: number;
  bookTemplateName?: string;
  templateCode?: string;
  templateName?: string;
  [key: string]: unknown;
}

/**
 * FinanceBookInfo — Financial Book 信息（by-reserve 拉取，stablecoin COA configured 态只读回填）。
 * endpoint: GET /api/finance/v1/finance/book/by-reserve/{reserveAccountId} 响应。
 *
 * 字段与 util `mapFinanceBookToCoaSetup` 消费方逐一对齐（行 160-184）：
 * financeBookId / bookTemplateId / bookName / bookTemplateName / eodCutoffDate / timeZone。
 * 注意 `eodCutoffDate`（API 字段）≠ 前端 `eodCutOffTime`（util 内部做字符串传递转换）。
 */
export interface FinanceBookInfo {
  financeBookId?: number;
  bookTemplateId?: number;
  bookName?: string;
  bookTemplateName?: string;
  timeZone?: string;
  eodCutoffDate?: string;
  [key: string]: unknown;
}

// ── 4.10 TD 标题列表 ──

/**
 * ApplyListParams — TD 标题列表查询参数。
 * endpoint: POST /api/manage/v1/td/apply/list
 * 接口无额外请求参数。
 */
export type ApplyListParams = Record<string, never>;

// ── 4.11 储备余额 ──

/**
 * ReserveBalanceParams — 储备余额查询参数。
 * endpoint: POST /api/manage/v1/td/manage/reserve/balance
 */
export interface ReserveBalanceParams {
  /** 稳定币编码。 */
  stablecoinCode?: string;
  /** 代币符号。 */
  symbol?: string;
}

// ── 4.12 部署步骤详情 ──

/**
 * DeployStepDetailParams — 部署步骤详情查询参数。
 * endpoint: POST /api/manage/v1/td/contract/deploy/stepDetail
 */
export interface DeployStepDetailParams {
  /** 任务编码。 */
  taskCode: string;
}

// ── 4.13 密钥服务下拉 ──

/**
 * KeyServiceListParams — 密钥服务列表查询参数。
 * endpoint: POST /api/manage/v1/td/apply/key/service/list
 */
export interface KeyServiceListParams {
  /** 区块链 ID。 */
  blockchainId: string;
}

// ── 4.14 管理员钱包列表（edit 页） ──

/**
 * AdminWalletListParams — 管理员钱包列表查询参数（edit 页自动拉取）。
 * endpoint: POST /api/manage/v1/td/apply/admin/wallet/list
 */
export interface AdminWalletListParams {
  /** 区块链 ID。 */
  blockchainId: string;
}

// ── 4.15 储备账户下拉 ──

/**
 * ReserveListParams — 储备账户下拉查询参数。
 * endpoint: POST /api/manage/v1/td/apply/reserve/list
 */
export interface ReserveListParams {
  /** 币种符号。 */
  currencySymbol: string;
}

// ═══════════════════════════════════════════════════════════════════
// 5. 分页列表响应类型别名
// ═══════════════════════════════════════════════════════════════════

/** 铸销记录列表响应。 */
export type TDRecordListResponse = PaginatedResponse<TDRecordItem>;

/** SP 直铸记录列表响应。 */
export type SPRecordListResponse = PaginatedResponse<SPRecordItem>;

/** 钱包列表响应。 */
export type WalletListResponse = PaginatedResponse<WalletItem>;

/** 操作记录列表响应。 */
export type OperationRecordListResponse = PaginatedResponse<OperationRecordItem>;

/** MMF 汇总列表响应。 */
export type MMFSummaryListResponse = PaginatedResponse<MMFSummaryItem>;

/** 合约包列表响应。 */
export type ContractPackageListResponse = PaginatedResponse<ContractPackageItem>;

/** 合约明细列表响应。 */
export type ContractDetailListResponse = PaginatedResponse<ContractDetailItem>;

/** 钱包详情列表响应。 */
export type WalletDetailListResponse = PaginatedResponse<WalletDetailItem>;

/** TD 标题列表响应（data 直接为数组，无 page/rows 包裹）。 */
export type ApplyListResponse = ApplyListItem[];

/** 角色钱包列表响应（mock）。 */
export type RoleWalletListResponse = PaginatedResponse<RoleWalletItem>;

// ═══════════════════════════════════════════════════════════════════
// 6. 下拉选项类型
// ═══════════════════════════════════════════════════════════════════

/**
 * BlockchainOption — 区块链下拉选项。
 * endpoint: GET /api/manage/v1/common/blockchain/list
 */
export interface BlockchainOption {
  key: string;
  value: string;
  status: number;
  /** 虚拟机编码（tron | evm）。 */
  virtualMachineCode?: string;
}

/**
 * CurrencyOption — 币种下拉选项。
 * endpoint: GET /api/manage/v1/common/currency/list
 */
export interface CurrencyOption {
  key: string;
  value: string;
}

/**
 * TokenTypeOption — Token 类型下拉选项。
 * endpoint: GET /api/manage/v1/common/tokenType/list
 */
export interface TokenTypeOption {
  tokenTypeId?: number;
  tokenTypeName?: string;
  /** status===0 时 disabled。 */
  status?: number;
}

/**
 * ReserveAccountOption — 储备账户下拉选项。
 * endpoint: POST /api/manage/v1/td/apply/reserve/list
 */
export interface ReserveAccountOption {
  /** 储备账户 ID。 */
  reserveAccountId?: number;
  /** 储备账户名称。 */
  reserveAccountName?: string;
  [key: string]: unknown;
}

/**
 * KeyServiceOption — 密钥服务下拉选项。
 * endpoint: POST /api/manage/v1/td/apply/key/service/list
 */
export interface KeyServiceOption {
  /** 密钥服务编码。 */
  keyServiceCode?: string;
  /** 密钥服务名称。 */
  keyServiceName?: string;
  [key: string]: unknown;
}

/**
 * TimezoneOption — 时区下拉选项。
 * endpoint: GET /api/manage/v1/common/timezone/list
 */
export interface TimezoneOption {
  value: string;
  label: string;
  [key: string]: unknown;
}

/**
 * SmartContractOption — 智能合约包下拉选项。
 * endpoint: POST /api/manage/v1/common/contract/getNewDeployment
 */
export interface SmartContractOption {
  key?: string;
  value?: string;
  [key: string]: unknown;
}
