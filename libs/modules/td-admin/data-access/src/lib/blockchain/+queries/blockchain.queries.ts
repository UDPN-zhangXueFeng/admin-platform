'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getBlockchainList,
  getDeploymentDetail,
  getDeploymentList,
  getNodeDetail,
  getNodeList,
  getNodeLocationList,
  getNodeParamsDetail,
  getSmartContractList,
  getStablecoinSearches,
  getTokenTypeList,
} from '../blockchain.api';
import type {
  BlockchainOption,
  DeploymentDetail,
  DeploymentListParams,
  DeploymentListResponse,
  NodeDetail,
  NodeListParams,
  NodeListResponse,
  NodeLocationOption,
  NodeParamsSearchReqVO,
  NodeParamsSearchResponse,
  SmartContractListParams,
  SmartContractListResponse,
  StablecoinOption,
  TokenTypeOption,
} from '../blockchain.model';
import { blockchainKeys } from './blockchain.keys';

// ======================================================================
// 列表查询（3 个）
// ======================================================================

/** 合约部署记录列表查询。 */
export function useDeploymentListQuery(params: DeploymentListParams) {
  return useQuery<DeploymentListResponse>({
    queryKey: blockchainKeys.deploymentList(params),
    queryFn: ({ signal }) => getDeploymentList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 节点管理列表查询。 */
export function useNodeListQuery(params: NodeListParams) {
  return useQuery<NodeListResponse>({
    queryKey: blockchainKeys.nodeList(params),
    queryFn: ({ signal }) => getNodeList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 智能合约包列表查询。 */
export function useSmartContractListQuery(params: SmartContractListParams) {
  return useQuery<SmartContractListResponse>({
    queryKey: blockchainKeys.smartContractList(params),
    queryFn: ({ signal }) => getSmartContractList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 详情查询（2 个）
// ======================================================================

/** 合约部署详情查询。recordId 缺失时不发起。 */
export function useDeploymentDetailQuery(
  recordId: number | string | undefined,
  enabled = true,
) {
  return useQuery<DeploymentDetail | undefined>({
    queryKey: blockchainKeys.deploymentDetail(recordId ?? ''),
    queryFn: ({ signal }) =>
      getDeploymentDetail(recordId as number | string, { signal }),
    enabled: recordId != null && recordId !== '' && enabled,
  });
}

/** 节点详情查询（编辑页回填用）。任一参数缺失时不发起。 */
export function useNodeDetailQuery(
  blockchainId: string | undefined,
  nodeLocationId: string | undefined,
  enabled = true,
) {
  return useQuery<NodeDetail | undefined>({
    queryKey: blockchainKeys.nodeDetail(blockchainId ?? '', nodeLocationId ?? ''),
    queryFn: ({ signal }) =>
      getNodeDetail(blockchainId as string, nodeLocationId as string, { signal }),
    enabled:
      blockchainId != null &&
      blockchainId !== '' &&
      nodeLocationId != null &&
      nodeLocationId !== '' &&
      enabled,
  });
}

// ======================================================================
// 节点参数明细查询（1 个：params/search，动态表单字段用）
// ======================================================================

/**
 * 节点参数明细查询（params/search）。
 * 用于 node/edit 页：blockchainId + nodeLocationId 确定后拉取动态字段集合。
 * enabled=false 默认不发起，由 Select onChange 手动触发 refetch()。
 */
export function useGetNodeParamsDetailQuery(
  params: NodeParamsSearchReqVO | undefined,
  enabled = false,
) {
  return useQuery<NodeParamsSearchResponse>({
    queryKey: blockchainKeys.nodeParamsDetail(
      params?.blockchainId ?? '',
      params?.nodeLocationId ?? '',
    ),
    queryFn: ({ signal }) =>
      getNodeParamsDetail(params as NodeParamsSearchReqVO, { signal }),
    enabled: enabled && params != null,
  });
}

// ======================================================================
// 公共下拉查询（4 个）
// ======================================================================

/**
 * 过滤下拉数据：后端下拉接口可能返回非数组（{rows}）或含 null 项，导致消费端
 * `.map` 报 `Cannot read properties of null (reading 'value')`。统一在 query 层过滤，
 * 所有页面（node-list/deployment-list/smart-contract-list）受益。
 */
function filterDropdown<T>(data: unknown): T[] {
  return Array.isArray(data) ? data.filter((o): o is T => o != null) : [];
}

/** 区块链下拉查询。staleTime 5 分钟减少重复请求。 */
export function useBlockchainListQuery() {
  return useQuery<BlockchainOption[]>({
    queryKey: blockchainKeys.blockchainDropdown(),
    queryFn: ({ signal }) => getBlockchainList({ signal }),
    select: filterDropdown<BlockchainOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/** 节点位置下拉查询。staleTime 5 分钟。 */
export function useNodeLocationListQuery() {
  return useQuery<NodeLocationOption[]>({
    queryKey: blockchainKeys.nodeLocationDropdown(),
    queryFn: ({ signal }) => getNodeLocationList({ signal }),
    select: filterDropdown<NodeLocationOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/** 稳定币下拉查询。staleTime 5 分钟。 */
export function useStablecoinSearchesQuery() {
  return useQuery<StablecoinOption[]>({
    queryKey: blockchainKeys.stablecoinDropdown(),
    queryFn: ({ signal }) => getStablecoinSearches({ signal }),
    select: filterDropdown<StablecoinOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/** TokenType 下拉查询。staleTime 5 分钟。 */
export function useTokenTypeListQuery() {
  return useQuery<TokenTypeOption[]>({
    queryKey: blockchainKeys.tokenTypeDropdown(),
    queryFn: ({ signal }) => getTokenTypeList({ signal }),
    select: filterDropdown<TokenTypeOption>,
    staleTime: 5 * 60 * 1000,
  });
}

// ======================================================================
// Mutations（4 个：save/edit/updateState/download）
//
// 实现文件：./blockchain.mutations.ts
// 此处 re-export 维持单文件导入便利，不破坏已有调用方。
// ======================================================================

export {
  useSaveNodeMutation,
  useEditNodeMutation,
  useUpdateNodeStateMutation,
  useDownloadSmartContractMutation,
} from './blockchain.mutations';
