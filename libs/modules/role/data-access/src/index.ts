export type {
  RoleItem,
  RoleDetail,
  MenuTreeNode,
  RoleQueryParams,
  RoleInsertReq,
  RoleUpdateReq,
  RoleStatusUpdateReq,
} from './lib/role.model';

export type { ResultInfo } from './lib/role.api';
export {
  getRoleList,
  getRole,
  getAllMenus,
  saveRole,
  updateRole,
  updateRoleStatus,
  deleteRole,
} from './lib/role.api';

export { roleKeys } from './lib/+queries/role.keys';
export {
  useRoleListQuery,
  useRoleDetailQuery,
  useMenuTreeQuery,
} from './lib/+queries/role.queries';
export {
  useSaveRoleMutation,
  useUpdateRoleMutation,
  useUpdateRoleStatusMutation,
  useDeleteRoleMutation,
} from './lib/+queries/role.mutations';
