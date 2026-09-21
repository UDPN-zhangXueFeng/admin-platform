import type {
  AdminWalletListParams,
  ContractDetailListParams,
  ContractPackageListParams,
  DeployStepDetailParams,
  FinanceBookByReserveParams,
  FinanceTemplateListParams,
  KeyServiceListParams,
  MMFSummaryListParams,
  OperationRecordListParams,
  ReserveBalanceParams,
  ReserveListParams,
  RoleWalletListParams,
  SPRecordListParams,
  StablecoinRecordListParams,
  TDRecordListParams,
  WalletDetailParams,
  WalletListParams,
} from '../tokenized-deposit.model';

/**
 * Tokenized-Deposit TanStack Query key 工厂（按 6 分组分 key）。
 *
 * 对齐 cross-chain / blockchain 模式：{@code as const} 元组，函数形式返回。
 *
 * 分组：
 * - overview（index 概览页：TD 记录 / 合约包 / 合约明细 / 部署历史 / 部署步骤 / apply 标题 / reserve 余额 / pending melt）
 * - view（详情页：SP 记录 / 稳定币记录 / 稳定币列表 / 稳定币信息）
 * - edit（编辑页：编辑详情回填 / 密钥服务 / 管理员钱包 / 科目模板 / Financial Book / 储备账户）
 * - summary（MMF 基金汇总）
 * - roleWallet（角色钱包 mock：列表 + 详情）
 * - common（公共下拉：区块链 / 币种 / tokenType / 时区 / 智能合约）
 *
 * ## customTable2 双 URL（钱包表）
 *
 * 钱包列表有 2 个 endpoint（listPage / balance），请求体相同但 URL 不同。
 * 分别建 key（walletList / walletBalance）避免缓存污染，调用方按 isOnclick 切换。
 * 同理 walletDetail / walletHistory（管理钱包 Modal Details/History 态）。
 *
 * 注意：列表 key 含完整 params（含 pageNum/pageSize/filters），保证筛选条件变化重新查询。
 */
export const tdKeys = {
  all: ['tokenized-deposit'] as const,

  // ── 1. overview（index 概览页）──
  overview: () => [...tdKeys.all, 'overview'] as const,
  /** TD 铸销记录列表（index Tab5 质押铸造分支）。 */
  overviewTDRecordList: (params: TDRecordListParams) =>
    [...tdKeys.overview(), 'td-record-list', params] as const,
  /** 合约包列表（index Tab2 上表，已部署合约概览）。 */
  overviewContractPackageList: (params: ContractPackageListParams) =>
    [...tdKeys.overview(), 'contract-package-list', params] as const,
  /** 合约明细列表（index Tab2 下表）。 */
  overviewContractDetailList: (params: ContractDetailListParams) =>
    [...tdKeys.overview(), 'contract-detail-list', params] as const,
  /** 部署历史（index 部署历史 Modal，取 data[0]）。 */
  overviewContractDeployHistory: (stablecoinCode: string) =>
    [...tdKeys.overview(), 'contract-deploy-history', stablecoinCode] as const,
  /** 部署步骤详情（index 部署 Modal，body taskCode）。 */
  overviewDeployStepDetail: (params: DeployStepDetailParams) =>
    [...tdKeys.overview(), 'deploy-step-detail', params] as const,
  /** TD 标题列表（index 顶部 TD 切换 + 概览数据源，data 直接为数组）。 */
  overviewApplyList: () => [...tdKeys.overview(), 'apply-list'] as const,
  /** 储备 / 可销毁余额（Mint/Melt 前拉）。 */
  overviewReserveBalance: (params: ReserveBalanceParams) =>
    [...tdKeys.overview(), 'reserve-balance', params] as const,
  /** 是否有待处理销毁（控制 Melt 按钮禁用）。 */
  overviewPendingMelt: (stablecoinCode: string) =>
    [...tdKeys.overview(), 'pending-melt', stablecoinCode] as const,

  // ── 2. view（详情页）──
  view: () => [...tdKeys.all, 'view'] as const,
  /** SP 直铸记录列表（index Tab5 SP 分支，初始 stablecoinId）。 */
  viewSPRecordList: (params: SPRecordListParams) =>
    [...tdKeys.view(), 'sp-record-list', params] as const,
  /** 稳定币铸销记录列表（view 页 Tab1，初始 txHash）。 */
  viewStablecoinRecordList: (params: StablecoinRecordListParams) =>
    [...tdKeys.view(), 'stablecoin-record-list', params] as const,
  /** 稳定币列表（view 页 mount 拉，取 [0]）。 */
  viewStablecoinList: () => [...tdKeys.view(), 'stablecoin-list'] as const,
  /** 稳定币信息（view 页，surplusCount 可销毁余额）。 */
  viewStablecoinInfo: (stablecoinId: number | string | undefined) =>
    [...tdKeys.view(), 'stablecoin-info', stablecoinId ?? ''] as const,

  // ── 3. edit（编辑页）──
  edit: () => [...tdKeys.all, 'edit'] as const,
  /** 编辑详情回填（动态 URL GET，body code）。 */
  editOperationDetail: (code: number | string | undefined) =>
    [...tdKeys.edit(), 'operation-detail', code ?? ''] as const,
  /** 密钥服务下拉（body blockchainId）。 */
  editKeyServiceList: (params: KeyServiceListParams) =>
    [...tdKeys.edit(), 'key-service-list', params] as const,
  /** 管理员钱包列表（edit 页自动拉取，body blockchainId）。 */
  editAdminWalletList: (params: AdminWalletListParams) =>
    [...tdKeys.edit(), 'admin-wallet-list', params] as const,
  /** 科目模板下拉（COA 设置用，GET query tokenType）。 */
  editFinanceTemplateList: (params: FinanceTemplateListParams) =>
    [...tdKeys.edit(), 'finance-template-list', params] as const,
  /** Financial Book（按 reserveAccountId 动态 URL GET）。 */
  editFinanceBookByReserve: (params: FinanceBookByReserveParams) =>
    [...tdKeys.edit(), 'finance-book-by-reserve', params] as const,
  /** 储备账户下拉（body currencySymbol）。 */
  editReserveList: (params: ReserveListParams) =>
    [...tdKeys.edit(), 'reserve-list', params] as const,

  // ── 4. summary（MMF 基金汇总，index Tab1 MMF 分支）──
  summary: () => [...tdKeys.all, 'summary'] as const,
  summaryMMFSummaryList: (params: MMFSummaryListParams) =>
    [...tdKeys.summary(), 'mmf-summary-list', params] as const,

  // ── 5. roleWallet（角色钱包 mock）──
  roleWallet: () => [...tdKeys.all, 'role-wallet'] as const,
  /** 角色钱包列表（mock，body pageNum/pageSize/tokenId/roleName/walletAddress）。 */
  roleWalletList: (params: RoleWalletListParams) =>
    [...tdKeys.roleWallet(), 'list', params] as const,
  /** 角色钱包详情（mock，含 operations 操作历史）。 */
  roleWalletDetail: (roleWalletId: number | string | undefined) =>
    [...tdKeys.roleWallet(), 'detail', roleWalletId ?? ''] as const,

  // ── 6. common（公共下拉，多页面共用）──
  common: () => [...tdKeys.all, 'common'] as const,
  /** 区块链下拉（GET，{ key, value, status }）。 */
  commonBlockchainDropdown: () =>
    [...tdKeys.common(), 'blockchain-dropdown'] as const,
  /** 币种下拉（GET，{ key, value }）。 */
  commonCurrencyDropdown: () => [...tdKeys.common(), 'currency-dropdown'] as const,
  /** Token 类型下拉（GET，status===0 时 disabled）。 */
  commonTokenTypeDropdown: () => [...tdKeys.common(), 'token-type-dropdown'] as const,
  /** 时区下拉（COA 设置用，GET）。 */
  commonTimezoneDropdown: () => [...tdKeys.common(), 'timezone-dropdown'] as const,
  /** 智能合约包下拉（POST，body contractLanguage/tokenType）。 */
  commonSmartContractDropdown: (params: {
    contractLanguage?: string;
    tokenType?: number;
    [key: string]: unknown;
  }) => [...tdKeys.common(), 'smart-contract-dropdown', params] as const,

  // ── 7. 钱包表（customTable2 双 URL，跨 overview/view）──
  // 钱包列表与余额列表 endpoint 不同，分别建 key 避免 isOnclick 切换时缓存污染
  wallet: () => [...tdKeys.all, 'wallet'] as const,
  /** 钱包列表（listPage，默认场景）。 */
  walletList: (params: WalletListParams) =>
    [...tdKeys.wallet(), 'list', params] as const,
  /** 钱包余额列表（balance，刷新按钮 isOnclick=true 场景）。 */
  walletBalanceList: (params: WalletListParams) =>
    [...tdKeys.wallet(), 'balance-list', params] as const,
  /** 钱包详情列表（管理钱包 Modal - Details 态）。 */
  walletDetailList: (params: WalletDetailParams) =>
    [...tdKeys.wallet(), 'detail-list', params] as const,
  /** 钱包历史列表（管理钱包 Modal - History 态）。 */
  walletHistoryList: (params: WalletDetailParams) =>
    [...tdKeys.wallet(), 'history-list', params] as const,
  /** 操作记录列表（index Tab4）。 */
  operationRecordList: (params: OperationRecordListParams) =>
    [...tdKeys.wallet(), 'operation-record-list', params] as const,
} as const;
