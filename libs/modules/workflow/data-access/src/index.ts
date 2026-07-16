export type {
  WorkflowStatus,
  WorkflowStepType,
  WorkflowSwitch,
  BusinessItem,
  WorkflowItem,
  CandidateUser,
  WorkflowDetailNode,
  WorkflowDetail,
  WorkflowListParams,
  WorkflowListPage,
  WorkflowListResult,
  CandidateUserListParams,
  CandidateUserListPage,
  CandidateUserListResult,
  WorkflowSaveNode,
  WorkflowCreateReq,
  WorkflowUpdateReq,
  WorkflowModifyStatusReq,
} from './lib/workflow.model';

export type { WorkflowResultInfo } from './lib/workflow.api';
export {
  getWorkflowList,
  getBusinessList,
  getWorkflowDetail,
  createWorkflow,
  updateWorkflow,
  modifyWorkflowStatus,
  getCandidateUsers,
} from './lib/workflow.api';

export { workflowKeys } from './lib/+queries/workflow.keys';
export {
  useWorkflowListQuery,
  useWorkflowDetailQuery,
  useBusinessListQuery,
  useCandidateUsersQuery,
} from './lib/+queries/workflow.queries';
export {
  useCreateWorkflowMutation,
  useUpdateWorkflowMutation,
  useModifyWorkflowStatusMutation,
} from './lib/+queries/workflow.mutations';
