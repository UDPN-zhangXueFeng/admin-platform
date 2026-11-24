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

/**
 * 品牌保存载荷（PUT /bankgw/portal/brand）。
 *
 * logo 三态：
 * - 省略（undefined）：保留服务端当前 logo；
 * - 纯文本（≤4 字符，如 emoji/缩写）：文本 logo；
 * - `data:image/png|jpeg|gif|bmp;base64,...`：图片 logo（后端压缩为 PNG）。
 */
export interface BrandUpdatePayload {
  name: string;
  subtitle: string;
  primaryColor: string;
  /** Omit (undefined) to keep the server's current logo; send to overwrite. */
  logo?: string;
}

/** 是否为图片 logo（data URL）：仅非空且以 `data:image/` 开头的字符串。 */
export function isImageLogo(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('data:image/');
}

/** 品牌回退默认值（源 store/brand.ts DEFAULT）。 */
export const DEFAULT_BRAND: Brand = {
  // 2026-11-09 品牌定名：UDPN Kissen Bank Gateway Management（登录页 name 与侧栏 headerName 同值）
  name: 'UDPN Kissen Bank Gateway Management',
  subtitle: 'Bank Gateway Management Console',
  logo: '🏦',
  primaryColor: '#0B6B53',
  headerName: 'UDPN Kissen Bank Gateway Management',
};
