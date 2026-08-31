import type {
  FreezeBankFilter,
  FreezeLpFilter,
} from './freeze.model';

interface FreezeListParams<F> {
  pageNum: number;
  pageSize: number;
  filter: F;
}

/** 冻结域 query key factory（携带 projectId 隔离缓存；银行/LP 两类目标列表各自独立）。 */
export const freezeKeys = {
  all: (projectId: string) => ['project', projectId, 'freeze'] as const,
  bankList: (projectId: string, params: FreezeListParams<FreezeBankFilter>) =>
    [...freezeKeys.all(projectId), 'bank-list', params] as const,
  lpList: (projectId: string, params: FreezeListParams<FreezeLpFilter>) =>
    [...freezeKeys.all(projectId), 'lp-list', params] as const,
} as const;
