/** bank 域 query key factory（维度：detail / onboardStatus / queryList=分页+筛选 / queryDetail / bankInfo）。 */
import type { BankQueryPageReq } from './bank.model';

export const bankKeys = {
  all: ['kissen-gateway', 'bank'] as const,
  detail: () => [...bankKeys.all, 'detail'] as const,
  onboardStatus: () => [...bankKeys.all, 'onboardStatus'] as const,
  queryList: (req: BankQueryPageReq) => [...bankKeys.all, 'queryList', req] as const,
  queryDetail: (bankId: number) => [...bankKeys.all, 'queryDetail', bankId] as const,
  bankInfo: () => [...bankKeys.all, 'bankInfo'] as const,
} as const;
