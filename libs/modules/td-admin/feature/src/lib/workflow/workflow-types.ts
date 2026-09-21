/**
 * Workflow 模块 UI 层所需的结构类型（避免 ui → data-access 的逆向依赖）。
 *
 * `CandidateUser` 与 data-access 的同名接口结构等价（structural typing），
 * feature 层传入的实际是 data-access 类型实例，TS 结构兼容无需显式转换。
 */
export interface CandidateUser {
  userId: number;
  userName: string;
  roles: string[];
}
