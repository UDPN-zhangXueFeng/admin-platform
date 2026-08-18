/**
 * User 域模型（源 `types/system.ts` User 部分 + `views/system/user.vue` 展示映射）。
 */

/** Badge variant 约定（kissen 家族语义分层，Element tag type 映射见各映射表注释）。 */
export type UserVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 用户列表筛选条件（POST /user/page，全部可选，登录名/姓名模糊匹配）。 */
export interface UserListReq {
  loginName?: string;
  userName?: string;
  status?: number;
}

/** 列表查询请求（喂 kissenPage）。 */
export interface UserPageReq {
  pageNum: number;
  pageSize: number;
  filter: UserListReq;
}

/** 用户行（gw_user；roleIds 为已关联角色 id，供表单/分配角色回显）。 */
export interface UserRow {
  userId: number;
  loginName: string;
  userName: string;
  userType: number;
  email?: string;
  phone?: string;
  status: number;
  firstLogin: number;
  createTime: number;
  roleIds?: number[];
}

/** 新建用户请求（POST /user/save；roleIds 内嵌于保存，源表单多选）。 */
export interface UserCreateReq {
  loginName: string;
  userName: string;
  userType?: number;
  email?: string;
  phone?: string;
  roleIds?: number[];
}

/** 更新用户请求（POST /user/update；不含 loginName/userType，编辑态两者禁用）。 */
export interface UserUpdateReq {
  userId: number;
  userName?: string;
  email?: string;
  phone?: string;
  /** null=不改角色;空数组=清空 */
  roleIds?: number[] | null;
}

/** 启停用户请求（POST /user/status）。 */
export interface UserToggleReq {
  userId: number;
  /** 0 正常 / 1 停用 */
  status: number;
}

/** 分配角色请求（POST /user/assign-role）。 */
export interface UserAssignRoleReq {
  userId: number;
  roleIds: number[];
}

/** 一次性密码（/user/save、/user/reset-pwd 返回；首登强制改密）。 */
export interface OneTimePassword {
  userId: number;
  oneTimePassword: string;
}

/**
 * 角色选项（源 user.vue loadRoles 直接调 roleApi.page 取前 200 条，
 * 仅消费 roleId/roleName；完整 RoleRow 归 role 域）。
 */
export interface UserRoleOption {
  roleId: number;
  roleName: string;
}

/** 用户类型：0 超管 / 1 运营（源 user.vue 类型列 tag：danger→destructive、primary→secondary）。 */
export const USER_TYPE_LABEL: Record<number, string> = {
  0: '超管',
  1: '运营',
};

/** 用户类型 Badge variant（源 tag type 映射）。 */
export const USER_TYPE_VARIANT: Record<number, UserVariant> = {
  0: 'destructive',
  1: 'secondary',
};

/** 表单类型单选项（源弹窗 radio 文案「超级管理员/运营用户」，与列表 tag 文案并存）。 */
export const USER_TYPE_RADIO_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: '0', label: '超级管理员' },
  { value: '1', label: '运营用户' },
];

/** 用户状态：0 正常 / 1 停用（源 tag：success→default、info→outline）。 */
export const USER_STATUS_LABEL: Record<number, string> = {
  0: '正常',
  1: '停用',
};

/** 用户状态 Badge variant（源 tag type 映射）。 */
export const USER_STATUS_VARIANT: Record<number, UserVariant> = {
  0: 'default',
  1: 'outline',
};

/** 状态筛选下拉选项（value 为字符串供 Select 使用）。 */
export const USER_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  [
    { value: '0', label: USER_STATUS_LABEL[0] ?? '' },
    { value: '1', label: USER_STATUS_LABEL[1] ?? '' },
  ];

/**
 * 首登标记文案（auth 域语义：firstLogin===0 首登需改密，改密后置 1；
 * 源 user.vue 列表未展示，detail 页扩展展示用）。
 */
export const USER_FIRST_LOGIN_LABEL: Record<number, string> = {
  0: '首登待改密',
  1: '已就绪',
};
