// blockchain data-access barrel.

// ── model ──
export type {
  ResultPageInfo,
  DeploymentRecordItem,
  DeploymentDetail,
  DeploymentContractRow,
  DeploymentListFilters,
  DeploymentListParams,
  DeploymentListResponse,
  NodeItem,
  NodeDetail,
  NodeParamsDetailField,
  NodeEditFormValues,
  NodeSaveReqVO,
  NodeEditReqVO,
  NodeListFilters,
  NodeListParams,
  NodeListResponse,
  NodeUpdateStateReqVO,
  NodeParamsSearchReqVO,
  NodeParamsSearchResponse,
  SmartContractItem,
  SmartContractListFilters,
  SmartContractListParams,
  SmartContractListResponse,
  BlockchainOption,
  NodeLocationOption,
  StablecoinOption,
  TokenTypeOption,
  DownloadParams,
} from './lib/blockchain.model';

// ── api（15 endpoint）──
export {
  getDeploymentList,
  getDeploymentDetail,
  getNodeList,
  getNodeDetail,
  getSmartContractList,
  saveNode,
  editNode,
  updateNodeState,
  getNodeParamsDetail,
  downloadSmartContract,
  getBlockchainList,
  getNodeLocationList,
  getStablecoinSearches,
  getTokenTypeList,
} from './lib/blockchain.api';

// ── queries ──
export { blockchainKeys } from './lib/+queries/blockchain.keys';
export {
  useDeploymentListQuery,
  useDeploymentDetailQuery,
  useNodeListQuery,
  useNodeDetailQuery,
  useSmartContractListQuery,
  useGetNodeParamsDetailQuery,
  useBlockchainListQuery,
  useNodeLocationListQuery,
  useStablecoinSearchesQuery,
  useTokenTypeListQuery,
  // mutations（同时从 queries.ts 导出，维持单文件导入便利）
  useSaveNodeMutation,
  useEditNodeMutation,
  useUpdateNodeStateMutation,
  useDownloadSmartContractMutation,
} from './lib/+queries/blockchain.queries';

// ── mutations（独立入口，显式拆分）──
export {
  useSaveNodeMutation as useSaveNodeMutationFromMutations,
  useEditNodeMutation as useEditNodeMutationFromMutations,
  useUpdateNodeStateMutation as useUpdateNodeStateMutationFromMutations,
  useDownloadSmartContractMutation as useDownloadSmartContractMutationFromMutations,
} from './lib/+queries/blockchain.mutations';
