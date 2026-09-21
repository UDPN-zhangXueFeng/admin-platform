/**
 * 邀请域（v2.1 a522963）：免登录一次性流程，无 query 缓存与本地会话
 * 副作用——页面状态机（loading→ready|error|done）直接消费 raw api，
 * 与源 invite/accept.vue 的 onMounted 直调语义一致。
 */
export { inviteVerify, inviteAccept } from './invite.api';
export type {
  InviteVerifyReq,
  InviteAcceptReq,
  InviteInfo,
  InviteAcceptResult,
} from './invite.model';
