import type { BizRecordListReq } from './biz-record.model';

export const bizRecordKeys = {
  all: (projectId: string) => ['project', projectId, 'biz-record'] as const,
  lists: (projectId: string) =>
    [...bizRecordKeys.all(projectId), 'list'] as const,
  list: (
    projectId: string,
    params: { pageNum: number; pageSize: number; filter: BizRecordListReq },
  ) => [...bizRecordKeys.lists(projectId), params] as const,
};
