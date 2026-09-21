/**
 * auth 域 raw API 层（源 `src/api/auth.ts` 1:1）。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type { ChangePwdReq, LoginReq, LoginRespVO } from './auth.model';

/** 登录（源 auth.login：POST /lp/login）。 */
export function authLogin(
  req: LoginReq,
  config?: AxiosRequestConfig,
): Promise<LoginRespVO> {
  return lpRequest.post<LoginRespVO>('/login', req, config);
}

/** 登出（源 auth.logout：POST /lp/logout）。 */
export function authLogout(config?: AxiosRequestConfig): Promise<void> {
  return lpRequest.post('/logout', undefined, config);
}

/** 修改密码（源 auth.changePwd：POST /lp/change-pwd）。 */
export function authChangePwd(
  req: ChangePwdReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return lpRequest.post('/change-pwd', req, config);
}
