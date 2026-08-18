import axios, { type AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import {
  DEFAULT_BRAND,
  type Brand,
  type ChangePwdReq,
  type LoginReq,
  type LoginRespVO,
} from './auth.model';

/** 登录（源 auth.login：POST /login）。 */
export function authLogin(
  req: LoginReq,
  config?: AxiosRequestConfig,
): Promise<LoginRespVO> {
  return kissenRequest.post<LoginRespVO>('/login', req, config);
}

/** 登出（源 auth.logout：POST /logout）。 */
export function authLogout(config?: AxiosRequestConfig): Promise<void> {
  return kissenRequest.post('/logout', undefined, config);
}

/** 自助修改密码（源 auth.changePwd：POST /change-pwd）。 */
export function authChangePwd(
  req: ChangePwdReq,
  config?: AxiosRequestConfig,
): Promise<void> {
  return kissenRequest.post('/change-pwd', req, config);
}

/**
 * 品牌信息（公开端点）：GET /bankgw/brand —— 挂在 `/bankgw` 下而非 `/portal`
 * 下，且登录前即需调用。因此用裸 axios 实例（baseURL 去掉 `/portal` 段），
 * 不走 token 拦截器；任何失败回退源默认值（源 api/brand.ts getBrand 语义）。
 */
const brandAxios = axios.create({
  baseURL:
    typeof process !== 'undefined'
      ? (process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '/kissen-api/bankgw/portal')
          .replace(/\/portal$/, '')
      : '/kissen-api/bankgw',
  timeout: 5000,
});

export async function getBrand(): Promise<Brand> {
  try {
    const resp = await brandAxios.get<{ code: string; data: Partial<Brand> }>(
      '/brand',
    );
    const body = resp.data;
    if (body && body.code === '0' && body.data) {
      return { ...DEFAULT_BRAND, ...body.data };
    }
    return DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}
