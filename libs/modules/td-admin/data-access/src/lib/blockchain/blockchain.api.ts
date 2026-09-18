import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  BlockchainOption,
  DeploymentDetail,
  DeploymentListParams,
  DeploymentListResponse,
  DeploymentRecordItem,
  DownloadParams,
  NodeDetail,
  NodeEditReqVO,
  NodeListParams,
  NodeListResponse,
  NodeLocationOption,
  NodeParamsSearchReqVO,
  NodeParamsSearchResponse,
  NodeSaveReqVO,
  NodeUpdateStateReqVO,
  SmartContractItem,
  SmartContractListParams,
  SmartContractListResponse,
  StablecoinOption,
  TokenTypeOption,
  NodeItem,
  ResultPageInfo,
} from './blockchain.model';

/**
 * Blockchain 模块 API（15 个 endpoint）。
 *
 * endpoint base `/api/manage/v1/`（源自 td-manage blockchain）。
 * `apiClient` 自动解包 `{ code, message, data }` 信封。
 * 列表 API 注入 `id = String(主键)` 满足 DataTable 契约。
 *
 * 硬约束：
 * - 三个列表接口请求体使用 pageNum/pageSize（非 page），RBAC/sys 域后端约定。
 * - detail API endpoint 拼写保持 `detial`（非 detail），确保后端匹配。
 * - 下载函数使用 responseType: 'blob'，URL 拼接文件服务域名。
 * - getNodeParamsDetail 返回 nodeParamsDetail 数组。
 */

// ── 常量：endpoint URL ──
const DEPLOYMENT_LIST_URL = '/api/manage/v1/contract/deployment/listPage';
const DEPLOYMENT_DETAILS_URL = '/api/manage/v1/contract/deployment/details';
const NODE_LIST_URL = '/api/manage/v1/node/manage/list';
const NODE_DETAIL_URL = '/api/manage/v1/node/manage/detial'; // 注意：拼写保持 detial
const NODE_ADD_URL = '/api/manage/v1/node/manage/add';
const NODE_EDIT_URL = '/api/manage/v1/node/manage/edit';
const NODE_UPDATE_STATE_URL = '/api/manage/v1/node/manage/updateState';
const NODE_PARAMS_SEARCH_URL = '/api/manage/v1/node/manage/add/params/search';
const SMART_CONTRACT_LIST_URL = '/api/manage/v1/contract/manage/list';
const BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';
const NODE_LOCATION_LIST_URL = '/api/manage/v1/common/nodeLocation/list';
const STABLECOIN_SEARCHES_URL = '/api/manage/v1/common/stablecoin/enabled/searches';
const TOKEN_TYPE_LIST_URL = '/api/manage/v1/common/tokenType/list';

// ── 中间类型：后端列表行（无 id）──
type DeploymentRecordItemApi = Omit<DeploymentRecordItem, 'id'>;
type NodeItemApi = Omit<NodeItem, 'id'>;
type SmartContractItemApi = Omit<SmartContractItem, 'id'>;
interface ListResponseApi<TRow> {
  page?: ResultPageInfo;
  rows?: TRow[];
}

// ======================================================================
// 列表 API（3 个）
// ======================================================================

/**
 * 合约部署记录分页列表查询。
 * 请求体使用 pageNum/pageSize（非 page），对齐 RBAC/sys 域后端约定。
 */
export async function getDeploymentList(
  params: DeploymentListParams,
  config?: ApiRequestConfig,
): Promise<DeploymentListResponse> {
  const res = await apiClient.post<ListResponseApi<DeploymentRecordItemApi>>(
    DEPLOYMENT_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): DeploymentRecordItem => ({
        ...r,
        id: String(r.recordId ?? ''),
      }),
    ),
  };
}

/**
 * 节点管理分页列表查询。
 * 请求体使用 pageNum/pageSize（非 page）。
 */
export async function getNodeList(
  params: NodeListParams,
  config?: ApiRequestConfig,
): Promise<NodeListResponse> {
  const res = await apiClient.post<ListResponseApi<NodeItemApi>>(
    NODE_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): NodeItem => ({
        ...r,
        id: String(r.blockchainAccessId ?? ''),
      }),
    ),
  };
}

/**
 * 智能合约包分页列表查询。
 * 请求体使用 pageNum/pageSize（非 page）。
 */
export async function getSmartContractList(
  params: SmartContractListParams,
  config?: ApiRequestConfig,
): Promise<SmartContractListResponse> {
  const res = await apiClient.post<ListResponseApi<SmartContractItemApi>>(
    SMART_CONTRACT_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): SmartContractItem => ({
        ...r,
        id: String(r.packageId ?? ''),
      }),
    ),
  };
}

// ======================================================================
// 详情 API（2 个）
// ======================================================================

/**
 * 合约部署详情查询（含 detailList 合约清单）。
 */
export async function getDeploymentDetail(
  recordId: number | string,
  config?: ApiRequestConfig,
): Promise<DeploymentDetail | undefined> {
  const data = await apiClient.post<DeploymentDetail | null>(
    DEPLOYMENT_DETAILS_URL,
    { recordId },
    config,
  );
  return data ?? undefined;
}

/**
 * 节点详情查询（编辑页回填用，含 nodeParamsDetail 动态字段 + browserUrl）。
 * endpoint 拼写保持 `detial`（非 detail），确保后端匹配。
 */
export async function getNodeDetail(
  blockchainId: string,
  nodeLocationId: string,
  config?: ApiRequestConfig,
): Promise<NodeDetail | undefined> {
  const data = await apiClient.post<NodeDetail | null>(
    NODE_DETAIL_URL,
    { blockchainId, nodeLocationId },
    config,
  );
  return data ?? undefined;
}

// ======================================================================
// 节点写操作 API（4 个：add/edit/updateState/paramsSearch）
// ======================================================================

/**
 * 新增节点。
 */
export function saveNode(
  dto: NodeSaveReqVO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(NODE_ADD_URL, dto, config);
}

/**
 * 编辑节点。
 */
export function editNode(
  dto: NodeEditReqVO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(NODE_EDIT_URL, dto, config);
}

/**
 * 更新节点状态（启用 state:1 / 禁用 state:2 / 删除 state:3）。
 * 启停直接调；删除在 Modal 内 onFinish 调。
 */
export function updateNodeState(
  dto: NodeUpdateStateReqVO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(NODE_UPDATE_STATE_URL, dto, config);
}

/**
 * 按 blockchainId + nodeLocationId 拉节点参数明细（nodeParamsDetail 数组）。
 * 用于 node/edit 页动态渲染表单字段。
 *
 * 返回 NodeParamsSearchResponse，调用方取 .nodeParamsDetail 数组。
 */
export async function getNodeParamsDetail(
  dto: NodeParamsSearchReqVO,
  config?: ApiRequestConfig,
): Promise<NodeParamsSearchResponse> {
  const data = await apiClient.post<NodeParamsSearchResponse>(
    NODE_PARAMS_SEARCH_URL,
    dto,
    config,
  );
  return data;
}

// ======================================================================
// 智能合约包下载（1 个，blob + fetch + <a> 触发）
// ======================================================================

/**
 * 下载智能合约包（.xlsx blob 文件下载）。
 *
 * 绕过 apiClient 信封解包（blob 不走 {code,data}），用 fetch 取原始响应。
 * 文件名从 Content-Disposition `utf-8''fileName` 解析（源 downloadApi 行为）。
 * auth token 从 localStorage 读取（与 axios 拦截器一致，用 `token` header）。
 *
 * URL 拼接：NEXT_PUBLIC_FILE_ID + v1/sftp/download?busId=&busType=
 * 脚本静态扫描漏抓此 URL，手动实现。
 */
export async function downloadSmartContract(
  params: DownloadParams,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_FILE_ID ?? '';
  const url = `${base}/v1/sftp/download?busId=${encodeURIComponent(
    String(params.busId),
  )}&busType=${encodeURIComponent(String(params.busType))}`;
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('admin_platform_access_token') ?? ''
      : '';
  const res = await fetch(url, { headers: token ? { token } : {} });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const fileNamePart = disposition.split("utf-8''")[1];
  const fileName = fileNamePart
    ? decodeURIComponent(fileNamePart)
    : 'smart-contract.xlsx';
  const elink = document.createElement('a');
  elink.download = fileName;
  elink.style.display = 'none';
  elink.href = URL.createObjectURL(blob);
  document.body.appendChild(elink);
  elink.click();
  URL.revokeObjectURL(elink.href);
  document.body.removeChild(elink);
}

// ======================================================================
// 公共下拉数据源（4 个）
// ======================================================================

/**
 * 区块链下拉（「链」选择器）。
 * status===1 可选，否则 disabled。node/edit 页还取 browserUrl 预填。
 */
export function getBlockchainList(
  config?: ApiRequestConfig,
): Promise<BlockchainOption[]> {
  return apiClient.get<BlockchainOption[]>(BLOCKCHAIN_LIST_URL, config);
}

/**
 * 节点位置下拉（「节点位置」选择器）。
 */
export function getNodeLocationList(
  config?: ApiRequestConfig,
): Promise<NodeLocationOption[]> {
  return apiClient.get<NodeLocationOption[]>(NODE_LOCATION_LIST_URL, config);
}

/**
 * 稳定币下拉（「稳定币/Token」选择器）。
 * 返回 stablecoinId + name。
 */
export function getStablecoinSearches(
  config?: ApiRequestConfig,
): Promise<StablecoinOption[]> {
  return apiClient.get<StablecoinOption[]>(STABLECOIN_SEARCHES_URL, config);
}

/**
 * TokenType 下拉。
 * 返回 tokenTypeId + tokenTypeName + status，status===0 时 disabled。
 */
export function getTokenTypeList(
  config?: ApiRequestConfig,
): Promise<TokenTypeOption[]> {
  return apiClient.get<TokenTypeOption[]>(TOKEN_TYPE_LIST_URL, config);
}
