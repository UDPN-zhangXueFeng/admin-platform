/**
 * 认证与菜单模型（源 `src/types/auth.ts` 的 1:1 移植）。
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
}

export interface ChangePwdReq {
  oldPassword: string;
  newPassword: string;
}

/** 品牌信息（源 `src/types/brand.ts`）。 */
export interface Brand {
  name: string;
  subtitle: string;
  logo: string;
  primaryColor: string;
  /** Gateway header name returned by the public brand endpoint. */
  headerName: string;
}

/** 品牌回退默认值（源 store/brand.ts DEFAULT）。 */
export const DEFAULT_BRAND: Brand = {
  name: 'Kissen Bank Portal',
  subtitle: 'Bank Portal Management Console',
  logo: '🏦',
  primaryColor: '#0B6B53',
  headerName: 'UDPN Kissen Gateway Portal',
};
