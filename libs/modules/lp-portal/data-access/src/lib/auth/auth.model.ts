/**
 * 认证与菜单模型（源 `src/types/auth.ts` 1:1 移植）。
 *
 * LoginRespVO 整体（含 menuTree）随会话持久化，驱动侧栏装配 / v-perm 按钮权限 /
 * root 落点；LP-3：全角色（含 ROLE_LP_ADMIN）走权限表装配，无 userType 旁路字段。
 */

export interface LoginReq {
  loginName: string;
  password: string;
}

export interface MenuTreeRespVO {
  menuId: number;
  menuName: string;
  menuNameEn?: string;
  menuKey: string;
  parentId: number;
  /** 0 模块 / 1 系统 / 2 一级菜单 / 3 二级菜单 / 4 按钮 */
  menuType: 0 | 1 | 2 | 3 | 4;
  orderNum: number;
  visible: 0 | 1;
  menuUrl?: string;
  icon?: string;
  children?: MenuTreeRespVO[];
}

export interface LoginRespVO {
  token: string;
  userId: number;
  /** 登录用户所属 LP 数据域 */
  lpId: number;
  loginName: string;
  userName: string;
  /** 0=首次登录需改密 */
  firstLogin: number;
  /** 后端按角色装配的可见菜单树,侧栏渲染/按钮权限/根路径落点均由它驱动(LP-3:全角色走权限表,无 userType 旁路) */
  menuTree: MenuTreeRespVO[];
}

export interface ChangePwdReq {
  oldPassword: string;
  newPassword: string;
}

/**
 * 展开菜单树全部 menuKey（含 menuType=4 按钮级、含 visible=1 隐藏节点；
 * 仅 n.menuKey 非空才收集），供 v-perm 等价按钮鉴权与 root 落点候选匹配使用。
 * 源 `src/store/user.ts` flattenKeys 1:1。
 */
export function flattenMenuKeys(nodes: MenuTreeRespVO[]): string[] {
  const keys: string[] = [];
  const walk = (list: MenuTreeRespVO[]) => {
    for (const n of list) {
      if (n.menuKey) keys.push(n.menuKey);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return keys;
}
