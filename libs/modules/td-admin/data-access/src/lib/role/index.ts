export type {
  RoleItem,
  RoleDetail,
  MenuTreeNode,
  RoleQueryParams,
  RoleInsertReq,
  RoleUpdateReq,
  RoleStatusUpdateReq,
} from './role.model';

export type {
  ResultInfo,
} from './role.api';
export {
  getRoleList,
  getRole,
  getAllMenus,
  saveRole,
  updateRole,
  updateRoleStatus,
  deleteRole,
} from './role.api';

export {
  roleKeys,
} from './+queries/role.keys';
export {
  useRoleListQuery,
  useRoleDetailQuery,
  useMenuTreeQuery,
} from './+queries/role.queries';
export {
  useSaveRoleMutation,
  useUpdateRoleMutation,
  useUpdateRoleStatusMutation,
  useDeleteRoleMutation,
} from './+queries/role.mutations';
