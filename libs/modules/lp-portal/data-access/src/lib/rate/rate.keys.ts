/**
 * rate 域 query key 工厂（携带 projectId 维度隔离缓存）。
 *
 * 汇率页固定全量拉取（唯一入参 pairId 从不传，无筛选参数维度），
 * 单 list key 即可；刷新/窗口聚焦重取复用同 key。
 */
export const lpRateKeys = {
  all: (projectId: string) => ['project', projectId, 'rate'] as const,
  list: (projectId: string) => [...lpRateKeys.all(projectId), 'list'] as const,
} as const;
