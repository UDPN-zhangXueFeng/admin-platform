/**
 * kissen-admin data-access barrel。
 *
 * 基础设施（kissen-client/result/auth）+ 共享币种域由主 agent 维护；
 * 其余业务域子目录（rbac/bank/lp/...）由迁移组 agent 各自填充，barrel 已预声明
 * 导出，组 agent 只需覆盖对应 `lib/<domain>/index.ts`，**不要改动本文件**。
 */

/** kissen-admin 应用固定 projectId（与 user 模块用 'stablecoin' 同模式）。 */
export const KISSEN_PROJECT_ID = 'kissen-admin';

export type { KissenAdminModule } from './lib/types';

// ---- 请求基础设施（主 agent 维护）----
export {
  kissenAxios,
  kissenRequest,
  kissenPage,
  KissenApiError,
  type KissenRequest,
  type KissenResult,
  type KissenPageResult,
  type KissenPageReq,
} from './lib/kissen-client';
export type { ResultInfo, PageReq, DataTable, PageResult } from './lib/result';
export type {
  LoginReq,
  MenuTreeRespVO,
  LoginRespVO,
  ChangePwdReq,
} from './lib/auth.model';


// ---- 业务域（迁移组 agent 填充，预声明导出）----
export * from './lib/rbac';
export * from './lib/workflow';
export * from './lib/bank';
export * from './lib/bank-gateway';
export * from './lib/lp';
export * from './lib/lp-pool';
export * from './lib/lp-preauth';
export * from './lib/lp-pair';
export * from './lib/token';
export * from './lib/token-pair';
export * from './lib/gateway-instance';
export * from './lib/access-key';
export * from './lib/bank-interact';
export * from './lib/operate-log';
export * from './lib/transaction';
export * from './lib/settle-order';
export * from './lib/reconcile';
export * from './lib/risk-monitor';
export * from './lib/freeze';
export * from './lib/approval';
