/**
 * Blockchain 模块类型定义。
 *
 * 类型来源：td-manage blockchain（deployment / node / smart-contract）。
 * 列表行注入字符串 `id`（= String(主键)）满足 DataTable `{ id: string }` 契约。
 *
 * 注意：
 * - 分页请求体统一使用 pageNum/pageSize（非 page），见第 3.1 节。
 * - detail API endpoint 拼写保持 'detial'（typo），类型命名不继承该拼写。
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

/** 区块链选项（下拉）。status===1 可选，否则 disabled。 */
export interface BlockchainOption {
  key: string;
  value: string;
  status: number;
  /** 节点编辑页用于预填 browserUrl 输入框。 */
  browserUrl?: string;
}

/** 节点位置选项（下拉）。 */
export interface NodeLocationOption {
  key: string;
  value: string;
}

/** 稳定币选项（下拉）。 */
export interface StablecoinOption {
  stablecoinId: string;
  name: string;
}

/** TokenType 选项（下拉）。status===0 时 disabled。 */
export interface TokenTypeOption {
  tokenTypeId: number;
  tokenTypeName: string;
  status: number;
}

// ── 合约部署记录（deployment）──

/** 合约部署记录列表项。rowKey: recordId。 */
export interface DeploymentRecordItem {
  /** DataTable 契约 id（= String(recordId)）。 */
  id: string;
  recordId?: number | string;
  tdName?: string;
  /** tokenType，文案走 i18n `token_type_${n}` 拼接。 */
  tokenType?: number;
  packageName?: string;
  packageVersion?: string;
  /** 类型（1/5），文案走 i18n `type_${n}` 拼接。 */
  type?: number;
  blockchainName?: string;
  /** 部署时间（时间戳）。 */
  deployTime?: number;
  /** 状态——源码写死 success display，实际数据可能包含该字段。 */
  state?: number | string;
}

/** 部署列表请求参数。筛选字段按源码 `form.items` 定义。 */
export interface DeploymentListFilters {
  /** 稳定币 ID。 */
  tdId?: string;
  tokenType?: number | string;
  blockchainId?: number | string;
  packageName?: string;
  type?: number | string;
  /** RangePicker 的起止时间通过自定义 key 透传（如 startDeploymentTime-endDeploymentTime），此处预留时间戳字段。 */
  startDeploymentTime?: number;
  endDeploymentTime?: number;
}

/** 部署列表查询参数（分页用 `pageNum` 非 `page`）。 */
export interface DeploymentListParams {
  pageNum: number;
  pageSize: number;
  filters?: DeploymentListFilters;
  [key: string]: unknown;
}

/** 部署列表响应。 */
export interface DeploymentListResponse {
  page?: ResultPageInfo;
  rows: DeploymentRecordItem[];
}

/** 合约部署详情（含合约清单 detailList）。 */
export interface DeploymentDetail {
  tdName?: string;
  packageVersion?: string;
  /** 部署时间（时间戳）。 */
  deployTime?: number;
  recordId?: number | string;
  /** 内嵌合约清单（静态表格，无分页）。 */
  detailList: DeploymentContractRow[];
}

/** 部署详情中的合约行（静态子表格）。 */
export interface DeploymentContractRow {
  /** 合约名 int 枚举，文案走 i18n `contractName_${n}` 拼接。 */
  contractName?: number;
  contractVersion?: string;
  contractAddress?: string;
  contractHash?: string;
  blockchainName?: string;
  ownerAddress?: string;
  txHash?: string;
  /** 状态——源码写死 success display。 */
  status?: number | string;
}

// ── 节点管理（node）──

/** 节点列表项。rowKey: blockchainAccessId。 */
export interface NodeItem {
  /** DataTable 契约 id（= String(blockchainAccessId)）。 */
  id: string;
  blockchainAccessId?: number;
  blockchainId?: string;
  blockchainName?: string;
  nodeLocationId?: string;
  nodeLocationName?: string;
  /** 节点 URL（数组，列表用 CustomCopy 渲染）。 */
  url?: string[];
  /** 区块链浏览器 URL（外链）。 */
  browserUrl?: string;
  /** 创建时间（时间戳）。 */
  createTime?: number;
  /**
   * 状态：1 启用 / 2 禁用。
   * Tag 色走 i18n `common_task_status_color_${status}`，文案走 `node_status_${status}`。
   */
  status?: number;
}

/** 节点列表请求筛选字段。 */
export interface NodeListFilters {
  /** 链 ID（下拉字段名 chainId）。 */
  chainId?: string;
  nodeLocationId?: string;
  /** 创建时间范围（RangePicker 透传 key: startCreateTime-endCreateTime）。 */
  startCreateTime?: number;
  endCreateTime?: number;
  /** 状态筛选：'1' 启用 / '2' 禁用。 */
  state?: string;
}

/** 节点列表查询参数（分页用 `pageNum` 非 `page`）。 */
export interface NodeListParams {
  pageNum: number;
  pageSize: number;
  filters?: NodeListFilters;
  [key: string]: unknown;
}

/** 节点列表响应。 */
export interface NodeListResponse {
  page?: ResultPageInfo;
  rows: NodeItem[];
}

/** 节点参数明细字段（动态表单字段，由 params/search 接口返回）。 */
export interface NodeParamsDetailField {
  paramKey: string;
  paramName: string;
  paramValue: string;
}

/** 节点新增/编辑表单值（react-hook-form）。 */
export interface NodeEditFormValues {
  chainName?: string;
  nodeLocation?: string;
  browserUrl?: string;
  /** 动态字段在运行时按 paramKey 注册，此处仅记录已序列化的参数明细。 */
  nodeParamsDetail?: NodeParamsDetailField[];
  [key: string]: unknown;
}

/** 节点新增请求 VO。 */
export interface NodeSaveReqVO {
  blockchainId: string;
  nodeLocationId: string;
  nodeParamsDetail: NodeParamsDetailField[];
  browserUrl: string;
}

/** 节点编辑请求 VO。 */
export interface NodeEditReqVO {
  blockchainId: string;
  nodeLocationId: string;
  nodeParamsDetail: NodeParamsDetailField[];
  browserUrl: string;
}

/** 节点状态更新请求 VO（启停删共用，state 区分）。 */
export interface NodeUpdateStateReqVO {
  blockchainId: string;
  nodeLocationId: string;
  /** 1 启用 / 2 禁用 / 3 删除。 */
  state: number;
}

/** 节点详情（detailApi 返回，用于编辑页回填）。 */
export interface NodeDetail {
  blockchainId?: string;
  nodeLocationId?: string;
  browserUrl?: string;
  nodeParamsDetail: NodeParamsDetailField[];
}

/** 节点参数查询请求（params/search）。 */
export interface NodeParamsSearchReqVO {
  blockchainId: string;
  nodeLocationId: string;
}

/** 节点参数查询响应。 */
export interface NodeParamsSearchResponse {
  nodeParamsDetail: NodeParamsDetailField[];
}

// ── 智能合约包（smart-contract）──

/** 智能合约列表项。rowKey: packageId。 */
export interface SmartContractItem {
  /** DataTable 契约 id（= String(packageId)）。 */
  id: string;
  packageId?: number | string;
  /** 报名含后缀（列展示用原始值）。 */
  packageNameWithSuffix?: string;
  packageVersion?: string;
  /** 类型（1/5），文案走 i18n `type_1` / `type_5`。 */
  type?: number;
  contractLanguage?: string;
  /** 创建时间（时间戳）。 */
  createTime?: number;
  busType?: string;
}

/** 智能合约列表请求筛选字段。 */
export interface SmartContractListFilters {
  smartPackageName?: string;
  /** 创建时间范围（RangePicker 透传 key: startCreateTime-endCreateTime）。 */
  startCreateTime?: number;
  endCreateTime?: number;
}

/** 智能合约列表查询参数（分页用 `pageNum` 非 `page`）。 */
export interface SmartContractListParams {
  pageNum: number;
  pageSize: number;
  filters?: SmartContractListFilters;
  [key: string]: unknown;
}

/** 智能合约列表响应。 */
export interface SmartContractListResponse {
  page?: ResultPageInfo;
  rows: SmartContractItem[];
}

// ── 下载 ──

/** 智能合约包下载参数。 */
export interface DownloadParams {
  busId: string;
  busType: string;
}
