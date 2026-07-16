import type {
  DeploymentListParams,
  NodeListParams,
  SmartContractListParams,
} from '../blockchain.model';

/**
 * Blockchain TanStack Query key 工厂。
 *
 * 对齐 mmf/statements 模式：{@code as const} 元组，函数形式返回。
 */
export const blockchainKeys = {
  all: ['blockchain'] as const,

  // ── 合约部署记录（deployment）──
  deployment: () => [...blockchainKeys.all, 'deployment'] as const,
  deploymentList: (params: DeploymentListParams) =>
    [...blockchainKeys.deployment(), 'list', params] as const,
  deploymentDetail: (recordId: number | string) =>
    [...blockchainKeys.deployment(), 'detail', recordId] as const,

  // ── 节点管理（node）──
  node: () => [...blockchainKeys.all, 'node'] as const,
  nodeList: (params: NodeListParams) =>
    [...blockchainKeys.node(), 'list', params] as const,
  nodeDetail: (blockchainId: string, nodeLocationId: string) =>
    [...blockchainKeys.node(), 'detail', blockchainId, nodeLocationId] as const,
  nodeParamsDetail: (blockchainId: string, nodeLocationId: string) =>
    [...blockchainKeys.node(), 'params-detail', blockchainId, nodeLocationId] as const,

  // ── 智能合约包（smart-contract）──
  smartContract: () => [...blockchainKeys.all, 'smart-contract'] as const,
  smartContractList: (params: SmartContractListParams) =>
    [...blockchainKeys.smartContract(), 'list', params] as const,

  // ── 公共下拉 ──
  blockchainDropdown: () => [...blockchainKeys.all, 'blockchain-dropdown'] as const,
  nodeLocationDropdown: () => [...blockchainKeys.all, 'node-location-dropdown'] as const,
  stablecoinDropdown: () => [...blockchainKeys.all, 'stablecoin-dropdown'] as const,
  tokenTypeDropdown: () => [...blockchainKeys.all, 'token-type-dropdown'] as const,
} as const;
