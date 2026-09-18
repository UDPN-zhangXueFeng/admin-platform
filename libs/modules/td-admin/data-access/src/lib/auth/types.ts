/**
 * Auth module type definitions.
 *
 * Aligned with the RBAC backend API contract used across projects.
 */

/** Menu item returned within LoginRespVo.menuKeyList */
export interface MenuInfoRespVo {
  menuKey: string;
  menuName: string;
  menuType: number;
  menuUrl: string;
  orderNum: number;
  orgType: number;
  urlType: number;
}

/** Login response — returned on successful password / 2FA / MetaMask login */
export interface LoginRespVo {
  token: string;
  userId: number;
  userName: string;
  email: string;
  orgName: string;
  /** 1=operate, 5=central, 10=commercial, 15=third party */
  orgType: number;
  expire: number;
  phoneNumber: string;
  menuKeyList: MenuInfoRespVo[];
  /** Present during password login — indicates whether 2FA is enabled */
  twoFactorAuth?: boolean;
  /** Present when twoFactorAuth=true — token for the subsequent 2FA verification */
  twoFactorToken?: string;
}

/** Encrypted login request body */
export interface LoginReqVo {
  code: string;
  loginName: string;
  password: string;
}

/** Two-factor authentication request */
export interface TwoFactorReq {
  code: string;
  twoFactorToken: string;
}

/** MetaMask wallet login request */
export interface MetaMaskLoginReq {
  loginName: string;
  signR: string;
  signS: string;
  signV: string;
}

/** API response envelope for login endpoints */
export interface AuthApiResponse<T> {
  code: number;
  data: T;
  message: string;
}
