/**
 * 认证与菜单模型（源 `src/types/auth.ts` 的 1:1 移植）。
 * 供 apps/kissen-admin 登录/会话守卫使用，data-access 不在此消费，但放于此域内
 * 避免散落。
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
  loginName: string;
  userName: string;
  userType: number;
  /** 0=首次登录需改密 */
  firstLogin: number;
  menuKeys: string[];
  menuTree: MenuTreeRespVO[];
}

export interface ChangePwdReq {
  oldPassword: string;
  newPassword: string;
}
