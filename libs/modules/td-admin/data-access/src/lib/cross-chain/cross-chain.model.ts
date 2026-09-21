/**
 * Cross-Chain 模块类型定义。
 *
 * 类型来源：td-manage cross-chain（cross-chain-transactions / fx-rate / liquidity-pool / rd-bridge / token-pair）。
 * 5 个子模块覆盖：列表项、查询参数、详情、表单值、操作记录项、树详情节点、下拉选项。
 * 列表行注入字符串 `id`（= String(主键)）满足 DataTable `{ id: string }` 契约。
 *
 * 注意：
 * - 分页请求体统一使用 pageNum/pageSize（非 page）。
 * - 金额字段注意 decimalPrecision（源码有小数位校验）。
 * - 枚举值用字面量联合，对齐源码常量（approvalTaskStatus / liquidityPooTTransactionStstus 等）。
 */

// ── 通用 ──

/** 分页响应元信息（对齐 RBAC/sys 域后端返回）。 */
export interface ResultPageInfo {
  total?: number;
  pageNum?: number;
  pageSize?: number;
  pages?: number;
}

// ── 下拉选项 ──

/** 区块链选项（common/blockchain/list 下拉，status===1 可选否则 disabled）。 */
export interface BlockchainOption {
  key: string;
  value: string;
  status: number;
}

/** 区块链选项（common/blockchain/enableList 下拉，仅启用链，无 status 字段）。 */
export interface BlockchainEnableOption {
  key: string;
  value: string;
}

/** 稳定币 / Token 选项（common/stablecoin/enabled/searches 下拉）。 */
export interface TokenOption {
  stablecoinId: string;
  name: string;
}

/** 流动性池 tokenList 选项（liquidityPool/new/tokenList 下拉，含 decimalPrecision / blockName）。 */
export interface LiquidityPoolTokenOption {
  tokenId: number;
  tokenName: string;
  symbol: string;
  decimalPrecision: number;
  blockName: string;
}

/** RD-Bridge 链选项（cross/chain/getBlockChainList 下拉，与 common/blockchain/list 不同）。 */
export interface RdBridgeBlockchainOption {
  blockChainId: number;
  blockChainName: string;
  unit: string;
}

/** 货币对选项（fx/v1/rate/currency/pair/list 下拉）。 */
export interface CurrencyPairOption {
  rateId: number;
  sendCurrencySymbol: string;
  receiveCurrencySymbol: string;
}

/** endpointId 选项（getEndpointId 动态 URL 返回）。 */
export interface EndpointIdOption {
  endpointId: number;
}

/** 全员邮箱列表项。 */
export type EmailOption = string;

/** 发送 Token 选项（tokenPair/getSendToken 下拉，含完整字段用于联动填充）。 */
export interface SendTokenOption {
  stablecoinId: string;
  stablecoinName: string;
  approveTokenCount?: string;
  stablecoinCount?: string;
  crossChainAddress?: string;
  endpointId?: string;
  liquidityPoolWalletAddress?: string;
  symbol?: string;
  decimalPrecision?: number;
}

/** 接收 Token 选项（tokenPair/getReceiveToken 动态 URL 返回）。 */
export interface ReceiveTokenOption {
  stablecoinId: string;
  stablecoinName: string;
  approveTokenCount?: string;
  stablecoinCount?: string;
  crossChainAddress?: string;
  endpointId?: string;
  liquidityPoolWalletAddress?: string;
  symbol?: string;
}

// ═══════════════════════════════════════════════════════════════════
// 1. cross-chain-transactions（跨链交易记录）
// ═══════════════════════════════════════════════════════════════════

/** 跨链交易列表项。rowKey: transferId。 */
export interface CrossChainTxItem {
  /** DataTable 契约 id（= String(transferId)）。 */
  id: string;
  transferId?: number;
  sourceTokenName?: string;
  sourceBlockName?: string;
  sourceCurrencySymbol?: string;
  sourceSymbol?: string;
  destinationTokenName?: string;
  destinationBlockName?: string;
  destinationCurrencySymbol?: string;
  destinationSymbol?: string;
  fromAddress?: string;
  fromCount?: string;
  toAddress?: string;
  toCount?: string;
  serviceFee?: string;
  fxRate?: string;
  createdOn?: number;
  /** 状态：20 待处理 / 30 处理中 / 35 成功 / 40 失败。 */
  status?: 20 | 30 | 35 | 40;
}

/** 跨链交易列表请求筛选字段。 */
export interface CrossChainTxListFilters {
  /** 源 token ID（stablecoinId）。 */
  sourceTokenId?: string;
  /** 源链 ID。 */
  sourceBlockchainId?: string;
  /** 目标 token ID（stablecoinId）。 */
  destinationTokenId?: string;
  /** 目标链 ID。 */
  destinationBlockchainId?: string;
  /** 状态：20/30/35/40。 */
  status?: string;
  /** RangePicker 透传 key: createdTimeStart-createdTimeEnd。 */
  createdTimeStart?: number;
  createdTimeEnd?: number;
}

/** 跨链交易列表查询参数（分页用 `pageNum` 非 `page`）。 */
export interface CrossChainTxListParams {
  pageNum: number;
  pageSize: number;
  filters?: CrossChainTxListFilters;
  [key: string]: unknown;
}

/** 跨链交易列表响应。 */
export interface CrossChainTxListResponse {
  page?: ResultPageInfo;
  rows: CrossChainTxItem[];
}

/** 跨链交易详情（transactions/detail 接口返回的顶部信息区字段）。 */
export interface CrossChainTxDetail {
  sourceTokenName?: string;
  sourceBlockName?: string;
  fromCount?: string;
  sourceSymbol?: string;
  sourceCurrencySymbol?: string;
  toCount?: string;
  destinationSymbol?: string;
  destinationCurrencySymbol?: string;
  destinationTokenName?: string;
  destinationBlockName?: string;
  fromAddress?: string;
  toAddress?: string;
  serviceFee?: string;
  fxRate?: string;
  createdOn?: number;
  status?: 20 | 30 | 35 | 40;
}

/** 跨链交易 Steps 时间线节点（transactions/tree/details 接口返回的单条）。 */
export interface TransactionTreeNode {
  /** 节点 index：0=源链, 1=跨链桥, 2=目标链, 3+=其他。 */
  index?: number;
  /** 节点状态：20 待处理 / 30 处理中 / 35 成功 / 40 失败。 */
  txStatus?: 20 | 30 | 35 | 40;
  /** 时间戳。 */
  txTime?: number;
  /** 格式化后时间戳（前端格式化）。 */
  timestampFormatted?: string;
  /** 交易 hash（index=0 / index>=3 且有 txHash 时展示，可外链 browserUrl + 'tx/' + txHash）。 */
  txHash?: string;
  /** 区块链浏览器 URL 前缀。 */
  browserUrl?: string;
  /** 交易 ID（index=0 展示）。 */
  transactionId?: string;
  /** 代币数量（index=0: tokenCount + tokenSymbol + 方向文案; index>=3: 同上但方向相反）。 */
  tokenCount?: string;
  /** 代币符号。 */
  tokenSymbol?: string;
  /** 区块链短名（用于色块 `blockchain_code_color_${blockShortName}`）。 */
  blockShortName?: string;
  /** 备注（index=2 展示）。 */
  remarks?: string;
}

// ═══════════════════════════════════════════════════════════════════
// 2. fx-rate（汇率）
// ═══════════════════════════════════════════════════════════════════

/** 汇率列表项。rowKey: rateId。 */
export interface FxRateItem {
  /** DataTable 契约 id（= String(rateId)）。 */
  id: string;
  rateId?: number;
  /** 源货币符号（渲染：sendCurrencySymbol / receiveCurrencySymbol）。 */
  sendCurrencySymbol?: string;
  /** 目标货币符号。 */
  receiveCurrencySymbol?: string;
  /** 汇率。 */
  exchangeRate?: string;
  /** 更新时间（时间戳字符串）。 */
  updateTime?: string;
}

/** 汇率列表请求筛选字段（fx-rate 无 status 枚举，纯展示）。 */
export interface FxRateListFilters {
  /** 货币对 ID。 */
  rateId?: string;
  /** RangePicker 透传 key: startTime-endTime。 */
  startTime?: number;
  endTime?: number;
}

/** 汇率列表查询参数（分页用 `pageNum` 非 `page`）。 */
export interface FxRateListParams {
  pageNum: number;
  pageSize: number;
  filters?: FxRateListFilters;
  [key: string]: unknown;
}

/** 汇率列表响应。 */
export interface FxRateListResponse {
  page?: ResultPageInfo;
  rows: FxRateItem[];
}

/**
 * 汇率详情页历史汇率列表项（fx/v1/rate/detail 分页列表）。
 * fx-rate 无单条详情，详情页用 DataTable 呈现历史汇率列表。
 * rowKey: rateRecordId。
 */
export interface FxRateDetailItem {
  /** DataTable 契约 id（= String(rateRecordId)）。 */
  id: string;
  rateRecordId?: number;
  sendCurrencySymbol?: string;
  receiveCurrencySymbol?: string;
  exchangeRate?: string;
  createTime?: number;
}

/** 汇率详情请求参数（带 rateId 固定筛选）。 */
export interface FxRateDetailParams {
  rateId: number;
  startTime?: number;
  endTime?: number;
  pageNum?: number;
  pageSize?: number;
  [key: string]: unknown;
}

/** 汇率详情分页列表响应。 */
export interface FxRateDetailResponse {
  page?: ResultPageInfo;
  rows: FxRateDetailItem[];
}

/** 汇率详情（fx-rate 无传统单条 Descriptions 详情，此处为聚合类型别名）。 */
export type FxRateDetail = FxRateDetailItem;

// ═══════════════════════════════════════════════════════════════════
// 3. liquidity-pool（流动性池）
// ═══════════════════════════════════════════════════════════════════

/** 流动性池列表项。rowKey: liquidityPoolId。 */
export interface LiquidityPoolItem {
  /** DataTable 契约 id（= String(liquidityPoolId)）。 */
  id: string;
  liquidityPoolId?: number;
  tokenName?: string;
  tokenId?: string;
  blockchain?: string;
  liquidityPoolWalletAddress?: string;
  balance?: string;
  authorized?: string;
  symbol?: string;
  decimalPrecision?: number;
  updatedOn?: number;
  /** 状态：0 未授权 / 1 授权中 / 5 已授权。 */
  status?: 0 | 1 | 5;
}

/** 流动性池列表请求筛选字段。 */
export interface LiquidityPoolListFilters {
  liquidityPoolWalletAddress?: string;
  tokenId?: string;
  blockchain?: string;
  /** 状态：0/1/5。 */
  status?: string;
  /** RangePicker 透传 key: updatedTimeStart-updatedTimeEnd。 */
  updatedTimeStart?: number;
  updatedTimeEnd?: number;
}

/** 流动性池列表查询参数（分页用 `pageNum` 非 `page`）。 */
export interface LiquidityPoolListParams {
  pageNum: number;
  pageSize: number;
  filters?: LiquidityPoolListFilters;
  [key: string]: unknown;
}

/** 流动性池列表响应。 */
export interface LiquidityPoolListResponse {
  page?: ResultPageInfo;
  rows: LiquidityPoolItem[];
}

/** 流动性池基本信息（basicInformation 接口返回）。 */
export interface LiquidityPoolBasicInfo {
  tokenName?: string;
  blockchain?: string;
  liquidityPoolWalletAddress?: string;
  status?: 0 | 1 | 5;
  updatedOn?: number;
  balance?: string;
  updatedby?: string;
  authorized?: string;
  symbol?: string;
  threshold?: string;
  emailRecipients?: string;
}

/** 流动性池完整详情（聚合 basicInformation + 3 个子列表）。 */
export interface LiquidityPoolDetail {
  /** 基本信息（Tab1 两段 Descriptions）。 */
  basicInformation?: LiquidityPoolBasicInfo;
}

/** 流动性池详情 - transactions 子表列表项。rowKey: transactionId。 */
export interface TransactionRecordItem {
  /** DataTable 契约 id（= String(transactionId)）。 */
  id: string;
  transactionId?: number;
  tokenName?: string;
  from?: string;
  to?: string;
  /** 交易类型：1/2/3。type===3 时显示 N/A 占位，行操作显示 N/A。 */
  transactionType?: 1 | 2 | 3;
  transactionAmount?: string;
  symbol?: string;
  serviceFee?: string;
  fxrate?: string;
  transactionTime?: number;
  transactionHash?: string;
  /** 状态：30 处理中 / 35 成功 / 40 失败 / 50 失败。 */
  status?: 30 | 35 | 40 | 50;
}

/** 流动性池 transactions 列表请求筛选字段。 */
export interface LiquidityPoolTxListFilters {
  liquidityPoolId?: number;
  walletAddress?: string;
  /** 交易类型：1/2/3。 */
  transactionType?: string;
  transactionHash?: string;
  /** 状态：30/35/40。 */
  status?: string;
  /** RangePicker 透传 key: transactionTimeStart-transactionTimeEnd。 */
  transactionTimeStart?: number;
  transactionTimeEnd?: number;
}

/** 流动性池 transactions 列表响应。 */
export interface LiquidityPoolTxListResponse {
  page?: ResultPageInfo;
  rows: TransactionRecordItem[];
}

/** 流动性池详情 - authorization 子表列表项。rowKey: recordId。 */
export interface AuthorizationRecordItem {
  /** DataTable 契约 id（= String(recordId)）。 */
  id: string;
  recordId?: number;
  /** 操作类型：0/1。 */
  operationType?: 0 | 1;
  /** 变更类型。 */
  changeType?: number;
  tokenName?: string;
  authorizedAmount?: string;
  currencySymbol?: string;
  operationTime?: number;
  transactionTime?: number;
  transactionHash?: string;
  /** 状态：30/35/40/50。 */
  status?: 30 | 35 | 40 | 50;
}

/** 流动性池 authorization 列表请求筛选字段。 */
export interface LiquidityPoolAuthListFilters {
  liquidityPoolId?: number;
  /** 操作类型：0/1。 */
  operationType?: string;
  /** RangePicker 透传 key: operationTimeStart-operationTimeEnd。 */
  operationTimeStart?: number;
  operationTimeEnd?: number;
  transactionHash?: string;
  /** RangePicker 透传 key: transactionTimeStart-transactionTimeEnd。 */
  transactionTimeStart?: number;
  transactionTimeEnd?: number;
  /** 状态：30/35/40/50。 */
  status?: string;
}

/** 流动性池 authorization 列表响应。 */
export interface LiquidityPoolAuthListResponse {
  page?: ResultPageInfo;
  rows: AuthorizationRecordItem[];
}

/** 流动性池详情 - operationRecords 子表列表项。rowKey: recordId。 */
export interface OperationRecordItem {
  /** DataTable 契约 id（= String(recordId)）。 */
  id: string;
  recordId?: number;
  /** 操作类型：1/2。 */
  operationType?: 1 | 2;
  createdBy?: string;
  createdOn?: number;
  transactionTime?: number;
  transactionHash?: string;
  /** 状态（走 common_task_status_${status} / approval_task_status_color_${status}）。 */
  status?: number;
  /** 审批 ID（行「查看」跳 /approval-manage/view 用）。 */
  taskId?: number;
  /** 业务编码（行「查看」跳 /approval-manage/view 用）。 */
  businessCode?: string;
}

/** 流动性池 operationRecords 列表请求筛选字段。 */
export interface LiquidityPoolOpRecordListFilters {
  liquidityPoolId?: number;
  /** 操作类型：1/2。 */
  operationType?: string;
}

/** 流动性池 operationRecords 列表响应。 */
export interface LiquidityPoolOpRecordListResponse {
  page?: ResultPageInfo;
  rows: OperationRecordItem[];
}

/** 流动性池新增/编辑表单值（react-hook-form）。 */
export interface LiquidityPoolEditForm {
  /** Token ID（新增态 Select onChange 设 symbol/decimalPrecision/blockName；编辑态 disabled）。 */
  tokenId?: number;
  /** 钱包地址（isHexPrefixed 校验 + 生成钱包 Modal 回填）。 */
  liquidityPoolWalletAddress?: string;
  /** 抵扣金额（InputNumber 小数位 validator 按 decimalPrecision）。 */
  deductibleAmount?: string;
  /** keystore（TextArea）。 */
  keystore?: string;
  /** keystore 密码（提交时 AES 加密；编辑态未改则原样传）。 */
  keystorePassword?: string;
  /** 阈值（InputNumber addonAfter=symbol）。 */
  threshold?: string;
  /** 邮件接收人（逗号分隔，email 批量校验不超过 20）。 */
  emailRecipients?: string;
  /** Checkbox 是否使用全员邮箱。 */
  select?: boolean;
}

/** 流动性池编辑页回填详情（details 接口返回）。 */
export interface LiquidityPoolEditDetail {
  tokenName?: string;
  liquidityPoolWalletAddress?: string;
  deductibleAmount?: string;
  keystore?: string;
  keystorePassword?: string;
  threshold?: string;
  emailRecipients?: string;
  decimalPrecision?: number;
  symbol?: string;
}

/** 流动性池 Reauthorize 请求体（reauthorizeLiquidityPoolApi）。 */
export interface LiquidityPoolReauthorizeReq {
  liquidityPoolId: number;
  deductibleAmount: string;
}

/** 流动性池 TransferOut 请求体（transferOutLiquidityPoolApi）。 */
export interface LiquidityPoolTransferOutReq {
  liquidityPoolId: number;
  amount: string;
  /** AES 加密后的 keystore 密码。 */
  keystorePassword: string;
  receiverWalletAddress: string;
}

/** 流动性池新增请求体（saveLiquidityPoolApi）。 */
export interface LiquidityPoolSaveReq {
  tokenId: number;
  liquidityPoolWalletAddress: string;
  deductibleAmount: string;
  keystore: string;
  /** AES 加密后的 keystore 密码。 */
  keystorePassword: string;
  threshold?: string;
  emailRecipients?: string;
  select: boolean;
}

/** 流动性池编辑请求体（editLiquidityPoolApi）。 */
export interface LiquidityPoolEditReq {
  liquidityPoolId: number;
  liquidityPoolWalletAddress: string;
  deductibleAmount: string;
  keystore: string;
  /** 编辑态：未改则原样传，否则 AES 加密。 */
  keystorePassword: string;
  threshold?: string;
  emailRecipients?: string;
  select: boolean;
}

/** 钱包生成请求体（getWalletKeystoreApi）。 */
export interface WalletKeystoreReq {
  /** chainType：blockName==='Aptos'?'aptos':'evm'。 */
  chainType: 'aptos' | 'evm';
  /** AES 加密后的密码。 */
  password: string;
}

/** 钱包生成响应数据。 */
export interface WalletKeystoreData {
  keystore: string;
  walletAddress: string;
}

// ═══════════════════════════════════════════════════════════════════
// 4. rd-bridge（RD-Bridge 跨链桥配置）
// ═══════════════════════════════════════════════════════════════════

/** RD-Bridge 列表项。rowKey: crossChainId。 */
export interface RdBridgeItem {
  /** DataTable 契约 id（= String(crossChainId)）。 */
  id: string;
  crossChainId?: number;
  blockchainName?: string;
  endpointId?: number;
  endpointContractAddress?: string;
  sendContractAddress?: string;
  receiveContractAddress?: string;
  createTime?: number;
  /** 状态：35 启用 / 50 禁用。 */
  status?: 35 | 50;
  /** 是否已关联代币对（Disable 时若 ===1 则弹 warning 拦截）。 */
  isTokenPaired?: number;
}

/** RD-Bridge 列表请求筛选字段。 */
export interface RdBridgeListFilters {
  /** 链 ID（blockChainId 来自 getBlockChainList 下拉）。 */
  blockchainId?: string;
  endpointId?: string;
  endpointContractAddress?: string;
  sendContractAddress?: string;
  receiveContractAddress?: string;
  /** 状态：35/50。 */
  status?: string;
  /** RangePicker 透传 key: createStartTime-createEndTime。 */
  createStartTime?: number;
  createEndTime?: number;
}

/** RD-Bridge 列表查询参数（分页用 `pageNum` 非 `page`）。 */
export interface RdBridgeListParams {
  pageNum: number;
  pageSize: number;
  filters?: RdBridgeListFilters;
  [key: string]: unknown;
}

/** RD-Bridge 列表响应。 */
export interface RdBridgeListResponse {
  page?: ResultPageInfo;
  rows: RdBridgeItem[];
}

/** RD-Bridge 详情（getCrossChainDetail 接口返回）。 */
export interface RdBridgeDetail {
  /** 链 ID（编辑态回填 Select 用；列表 RdBridgeItem 也有此字段）。 */
  blockchainId?: number;
  blockchainName?: string;
  status?: 35 | 50;
  updateTime?: number;
  updateUserName?: string;
  endpointId?: number;
  endpointContractAddress?: string;
  sendContractAddress?: string;
  receiveContractAddress?: string;
  verifierWalletAddress?: string;
  verifierMonitorValue?: string;
  submitterWalletAddress?: string;
  submitterMonitorValue?: string;
  notifyEmail?: string;
  /** 验证者钱包余额。 */
  verifierWalletAddressBalance?: string;
  /** 提交者钱包余额。 */
  submitterWalletAddressBalance?: string;
  /** gas 单位符号。 */
  gasUnit?: string;
}

/** RD-Bridge 操作记录列表项。rowKey: crossChainRecordId。 */
export interface RdBridgeRecordItem {
  /** DataTable 契约 id（= String(crossChainRecordId)）。 */
  id: string;
  crossChainRecordId?: number;
  /** 操作类型：1/2/3/4。 */
  recordType?: 1 | 2 | 3 | 4;
  createUserName?: string;
  createTime?: number;
  /** 备注。 */
  comments?: string;
  /** 状态（走 cross_chain_operation_status_${status}）。 */
  status?: number;
}

/** RD-Bridge 操作记录列表请求筛选字段。 */
export interface RdBridgeRecordListFilters {
  crossChainId?: number;
  /** 操作类型：1/2/3/4。 */
  recordType?: string;
}

/** RD-Bridge 操作记录列表响应。 */
export interface RdBridgeRecordListResponse {
  page?: ResultPageInfo;
  rows: RdBridgeRecordItem[];
}

/** RD-Bridge 操作记录 Drawer 详情（getCrossChainRecordDetail 接口返回）。 */
export interface RdBridgeRecordDetail {
  recordType?: number;
  createUserName?: string;
  createTime?: number;
  blockchainName?: string;
  endpointContractAddress?: string;
  sendContractAddress?: string;
  receiveContractAddress?: string;
  verifierWalletAddress?: string;
  verifierMonitorValue?: string;
  submitterWalletAddress?: string;
  submitterMonitorValue?: string;
  notifyEmail?: string;
  gasUnit?: string;
}

/** RD-Bridge 新增/编辑表单值（react-hook-form）。 */
export interface RdBridgeEditForm {
  /** 链 ID（新增态默认选首项设 symbol；编辑态 disabled）。 */
  blockchainId?: number;
  /** endpointId（InputNumber；编辑态 disabled）。 */
  endpointId?: number;
  /** endpoint 合约地址（maxLength=42 + isHexPrefixed 校验）。 */
  endpointContractAddress?: string;
  /** 发送合约地址（maxLength=42 + isHexPrefixed 校验）。 */
  sendContractAddress?: string;
  /** 接收合约地址（maxLength=42 + isHexPrefixed 校验）。 */
  receiveContractAddress?: string;
  /** 验证者钱包地址（maxLength=42 + isHexPrefixed 校验）。 */
  verifierWalletAddress?: string;
  /** 验证者监控值（InputNumber addonAfter=symbol）。 */
  verifierMonitorValue?: string;
  /** 提交者钱包地址（maxLength=42 + isHexPrefixed 校验）。 */
  submitterWalletAddress?: string;
  /** 提交者监控值（InputNumber addonAfter=symbol）。 */
  submitterMonitorValue?: string;
  /** 通知邮箱（逗号分隔，email 批量校验不超过 20）。 */
  notifyEmail?: string;
}

/** RD-Bridge 新增请求体（saveCrossChainApi）。 */
export interface RdBridgeSaveReq {
  blockchainId: number;
  endpointId: number;
  endpointContractAddress: string;
  sendContractAddress: string;
  receiveContractAddress: string;
  verifierWalletAddress: string;
  verifierMonitorValue?: string;
  submitterWalletAddress: string;
  submitterMonitorValue?: string;
  notifyEmail?: string;
}

/** RD-Bridge 编辑请求体（editCrossChainApi，剔除 endpointId/blockchainId）。 */
export interface RdBridgeEditReq {
  crossChainId: number;
  endpointContractAddress: string;
  sendContractAddress: string;
  receiveContractAddress: string;
  verifierWalletAddress: string;
  verifierMonitorValue?: string;
  submitterWalletAddress: string;
  submitterMonitorValue?: string;
  notifyEmail?: string;
}

/** RD-Bridge 启停请求体（updateCrossChainApi）。 */
export interface RdBridgeUpdateReq {
  crossChainId: number;
  /** 状态：35 启用 / 50 禁用。 */
  status: 35 | 50;
  remarks: string;
}

// ═══════════════════════════════════════════════════════════════════
// 5. token-pair（代币对）
// ═══════════════════════════════════════════════════════════════════

/** 代币对列表项。rowKey: tokenCrossChainId。 */
export interface TokenPairItem {
  /** DataTable 契约 id（= String(tokenCrossChainId)）。 */
  id: string;
  tokenCrossChainId?: number;
  sendTokenName?: string;
  sendBlockchainShortName?: string;
  sendTokenCurrencySymbol?: string;
  receiveTokenName?: string;
  receiveBlockchainShortName?: string;
  receiveTokenCurrencySymbol?: string;
  crossChainFee?: string;
  updateTime?: number;
  /** 状态（列表显示）：1 处理中 / 3 禁用 / 5 启用 / 10 禁用（注意与启停接口 status 50/35 不同语义）。 */
  status?: 1 | 3 | 5 | 10;
}

/** 代币对列表请求筛选字段。 */
export interface TokenPairListFilters {
  sendTokenId?: string;
  sendBlockchainId?: string;
  receiveTokenId?: string;
  receiveBlockchainId?: string;
  /** 状态：1/3/5/10。 */
  status?: string;
  /** RangePicker 透传 key: updateStartTime-updateEndTime。 */
  updateStartTime?: number;
  updateEndTime?: number;
}

/** 代币对列表查询参数（分页用 `pageNum` 非 `page`）。 */
export interface TokenPairListParams {
  pageNum: number;
  pageSize: number;
  filters?: TokenPairListFilters;
  [key: string]: unknown;
}

/** 代币对列表响应。 */
export interface TokenPairListResponse {
  page?: ResultPageInfo;
  rows: TokenPairItem[];
}

/** 代币对详情（getTokenPairDetail 接口返回）。 */
export interface TokenPairDetail {
  sendTokenName?: string;
  sendBlockchainShortName?: string;
  sendBlockchainName?: string;
  sendTokenCurrencySymbol?: string;
  sendEndpointId?: number;
  sendCrossChainAddress?: string;
  sendLiquidityPoolWalletAddress?: string;
  sendStablecoinCount?: string;
  sendApproveTokenCount?: string;
  receiveTokenName?: string;
  receiveBlockchainShortName?: string;
  receiveBlockchainName?: string;
  receiveTokenCurrencySymbol?: string;
  receiveEndpointId?: number;
  receiveCrossChainAddress?: string;
  receiveLiquidityPoolWalletAddress?: string;
  receiveStablecoinCount?: string;
  receiveApproveTokenCount?: string;
  crossChainFee?: string;
  decimalPrecision?: number;
  updateTime?: number;
  updateUser?: string;
  status?: 1 | 3 | 5 | 10;
}

/** 代币对操作记录列表项。rowKey: recordId。 */
export interface TokenPairRecordItem {
  /** DataTable 契约 id（= String(recordId)）。 */
  id: string;
  recordId?: number;
  /** 操作类型：1/2/3/4。 */
  recordType?: 1 | 2 | 3 | 4;
  createUser?: string;
  createTime?: number;
  /** 备注。 */
  remarks?: string;
  /** 状态（走 common_task_status_${status} / approval_task_status_color_${status}）。 */
  status?: number;
  /** 审批 ID。 */
  taskId?: number;
  /** 业务编码。 */
  businessCode?: string;
}

/** 代币对操作记录列表请求筛选字段。 */
export interface TokenPairRecordListFilters {
  tokenCrossChainId?: number;
  /** 操作类型：1/2/3/4。 */
  recordType?: string;
}

/** 代币对操作记录列表响应。 */
export interface TokenPairRecordListResponse {
  page?: ResultPageInfo;
  rows: TokenPairRecordItem[];
}

/** 代币对新增/编辑表单值（react-hook-form）。 */
export interface TokenPairEditForm {
  /** 发送 Token ID（Select onChange 触发 getReceiveTokenApi 联动 + 竞态保护）。 */
  sendTokenId?: string;
  sendEndpointId?: string;
  sendCrossChainAddress?: string;
  sendLiquidityPoolWalletAddress?: string;
  /** 接收 Token ID（sendToken 切换后自动填充首个）。 */
  receiveTokenId?: string;
  receiveEndpointId?: string;
  receiveCrossChainAddress?: string;
  receiveLiquidityPoolWalletAddress?: string;
  /** 跨链手续费（InputNumber 小数位 validator 按 decimalPrecision）。 */
  crossChainFee?: string;
}

/** 代币对新增请求体（saveTokenPairApi）。 */
export interface TokenPairSaveReq {
  sendTokenId: string;
  sendEndpointId: string;
  sendCrossChainAddress: string;
  sendLiquidityPoolWalletAddress: string;
  receiveTokenId: string;
  receiveEndpointId: string;
  receiveCrossChainAddress: string;
  receiveLiquidityPoolWalletAddress: string;
  crossChainFee: string;
}

/** 代币对编辑请求体（editTokenPairApi，编辑态仅 crossChainFee 可改）。 */
export interface TokenPairEditReq {
  tokenCrossChainId: number;
  crossChainFee: string;
}

/** 代币对启停请求体（crossChainTokenPairUpdateApi）。 */
export interface TokenPairUpdateReq {
  tokenCrossChainId: number;
  /** 状态：35 启用 / 50 禁用（注意与列表显示 1/3/5/10 不同语义）。 */
  status: 35 | 50;
  remarks: string;
}

// ═══════════════════════════════════════════════════════════════════
// 通用 API 响应包裹
// ═══════════════════════════════════════════════════════════════════

/** 标准 API 响应包裹（对齐 td-manage ResultInfo）。 */
export interface ApiResponse<T = unknown> {
  code: number;
  message?: string;
  data: T;
}
