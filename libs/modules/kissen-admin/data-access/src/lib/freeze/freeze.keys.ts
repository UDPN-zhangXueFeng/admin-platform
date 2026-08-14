import type {
  FreezeBankFilter,
  FreezeLpFilter,
  FreezePairFilter,
} from './freeze.model';

interface FreezeListParams<F> {
  pageNum: number;
  pageSize: number;
  filter: F;
}

/** 冻结域 query key factory（携带 projectId 隔离缓存；三类目标列表各自独立）。 */
export const freezeKeys = {
  all: (projectId: string) => ['project', projectId, 'freeze'] as const,
  bankList: (projectId: string, params: FreezeListParams<FreezeBankFilter>) =>
    [...freezeKeys.all(projectId), 'bank-list', params] as const,
  lpList: (projectId: string, params: FreezeListParams<FreezeLpFilter>) =>
    [...freezeKeys.all(projectId), 'lp-list', params] as const,
  pairList: (projectId: string, params: FreezeListParams<FreezePairFilter>) =>
    [...freezeKeys.all(projectId), 'pair-list', params] as const,
} as const;
