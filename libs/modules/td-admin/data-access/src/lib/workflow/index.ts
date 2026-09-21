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
} from './workflow.model';

export type {
  WorkflowResultInfo,
} from './workflow.api';
export {
  getWorkflowList,
  getBusinessList,
  getWorkflowDetail,
  createWorkflow,
  updateWorkflow,
  modifyWorkflowStatus,
  getCandidateUsers,
} from './workflow.api';

export {
  workflowKeys,
} from './+queries/workflow.keys';
export {
  useWorkflowListQuery,
  useWorkflowDetailQuery,
  useBusinessListQuery,
  useCandidateUsersQuery,
} from './+queries/workflow.queries';
export {
  useCreateWorkflowMutation,
  useUpdateWorkflowMutation,
  useModifyWorkflowStatusMutation,
} from './+queries/workflow.mutations';
