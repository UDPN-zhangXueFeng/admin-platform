/**
 * 邀请域模型（源 `src/api/invite.ts` 1:1，v2.1 a522963）。
 *
 * 邀请落地页（/invite/accept）免登录：鉴权靠邮件链接携带的一次性
 * invite token；accept 成功后 token 即被后端消费（原链接再用报 MSG_23_0031）。
 */

/** verify 请求体（token 来自 URL ?token=）。 */
export interface InviteVerifyReq {
  token: string;
}

/** accept 请求体：设置密码并消费邀请 token。 */
export interface InviteAcceptReq {
  token: string;
  password: string;
}

/** 邀请链接信息（verify 回显）。 */
export interface InviteInfo {
  lpCode: string;
  lpName: string;
  loginName: string;
  /** 过期时间（毫秒时间戳） */
  expireTime: number;
}

/** accept 成功回执（用于成功态文案）。 */
export interface InviteAcceptResult {
  loginName: string;
  lpName: string;
}
