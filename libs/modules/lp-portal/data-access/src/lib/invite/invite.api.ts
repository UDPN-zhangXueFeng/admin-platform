/**
 * 邀请域 raw API 层（源 `src/api/invite.ts` 1:1，v2.1 a522963）。
 *
 * 免登录端点：请求拦截器无 token 亦放行（上游同构——邀请页在登录前调用）。
 * 错误呈现双通道：拦截器已 toast，页面仍按 code 映射内联 error alert
 * （MSG_23_0029 无效 / 0030 已过期 / 0031 已使用，见 pitfalls §E38）。
 */
import type { AxiosRequestConfig } from 'axios';

import { lpRequest } from '../lp-client';
import type {
  InviteAcceptReq,
  InviteAcceptResult,
  InviteInfo,
  InviteVerifyReq,
} from './invite.model';

/** 验证邀请链接（POST /lp/auth/invite/verify）。 */
export function inviteVerify(
  req: InviteVerifyReq,
  config?: AxiosRequestConfig,
): Promise<InviteInfo> {
  return lpRequest.post<InviteInfo>('/auth/invite/verify', req, config);
}

/** 设置密码（POST /lp/auth/invite/accept）：成功后 token 一次性消费。 */
export function inviteAccept(
  req: InviteAcceptReq,
  config?: AxiosRequestConfig,
): Promise<InviteAcceptResult> {
  return lpRequest.post<InviteAcceptResult>('/auth/invite/accept', req, config);
}
