import axios, { type AxiosRequestConfig } from 'axios';

import { kissenRequest } from '../kissen-gateway-client';
import {
  DEFAULT_BRAND,
  type Brand,
  type BrandUpdatePayload,
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
      ? (
          process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '/kissen-api/bankgw/portal'
        ).replace(/\/portal$/, '')
      : '/kissen-api/bankgw',
  timeout: 5000,
});

/**
 * 历史 headerName 集合：后端 gw_instance_config 里可能存有旧默认值，读到就归一到当前名称。
 * - 'UDPN Kissen Gateway Portal'：2026-09-04 之前的侧栏名
 * - 'UDPN Kissen Bank Portal'：2026-09-07 品牌重命名期写入的名字（2026-11-09 再次改名）
 */
const LEGACY_HEADER_NAMES = new Set([
  'UDPN Kissen Gateway Portal',
  'UDPN Kissen Bank Portal',
]);

/**
 * 品牌文案规整：后端 brand 接口的 name/subtitle/headerName 可能返回中文，
 * 而本门户约束用户可见文案零中文（document.title 与登录页品牌区均消费）。
 * 英文原样透传；空缺或含 CJK 时回退 DEFAULT_BRAND 对应默认值——后端切换
 * 为英文白标数据后自动生效。
 */
export function sanitizeBrandText(
  value: string | undefined,
  fallback: string,
): string {
  const text = value?.trim();
  if (!text) return fallback;
  return /[\u4e00-\u9fff]/.test(text) ? fallback : text;
}

/** 将服务端已保存的旧默认产品名迁移为当前门户名称。 */
function normalizeHeaderName(value: string | undefined): string {
  const headerName = sanitizeBrandText(value, DEFAULT_BRAND.headerName);
  return LEGACY_HEADER_NAMES.has(headerName) ? DEFAULT_BRAND.headerName : headerName;
}

export async function getBrand(): Promise<Brand> {
  try {
    const resp = await brandAxios.get<{ code: string; data: Partial<Brand> }>(
      '/brand',
    );
    const body = resp.data;
    if (body && body.code === '0' && body.data) {
      const data = body.data;
      return {
        name: sanitizeBrandText(data.name, DEFAULT_BRAND.name),
        subtitle: sanitizeBrandText(data.subtitle, DEFAULT_BRAND.subtitle),
        logo: sanitizeBrandText(data.logo, DEFAULT_BRAND.logo),
        primaryColor: data.primaryColor ?? DEFAULT_BRAND.primaryColor,
        headerName: normalizeHeaderName(data.headerName),
      };
    }
    return DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

/**
 * 品牌保存（源 api/brand.ts updateBrand，bcfad98）：PUT /brand → 保存后回写值。
 *
 * 与公开 GET 不同：写操作在登录后发起，走带 token 的 kissenRequest
 * （baseURL /kissen-api/bankgw/portal），而非免 token 的 brandAxios。
 *
 * logo 三态（后端契约）：字段省略 → 保留服务端当前 logo；纯文本（≤4 字符，
 * emoji/缩写）→ 文本 logo；`data:image/...` → 图片 logo。因此仅当调用方
 * 显式传入 `logo`（含空串）时才发送，`undefined` 时整字段不出现。
 * headerName 不由该接口维护，始终不发送。
 */
export function updateBrand(
  data: BrandUpdatePayload,
  config?: AxiosRequestConfig,
): Promise<Brand> {
  const { name, subtitle, primaryColor, logo } = data;
  const body: BrandUpdatePayload = { name, subtitle, primaryColor };
  if (logo !== undefined) body.logo = logo;
  return kissenRequest.put<Brand>('/brand', body, config);
}
