'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { sysLogKeys } from './syslog.keys';
import {
  getSysLogs,
  getSysLogModules,
  getSysLogOperationTypes,
  getSysLogUsers,
} from '../syslog.api';
import type { SysLogQueryParams } from '../syslog.model';

/**
 * 日志列表查询。`keepPreviousData` 让翻页/筛选时当前结果仍可见，直到新结果返回。
 */
export function useSysLogsQuery(projectId: string, params: SysLogQueryParams) {
  return useQuery({
    queryKey: sysLogKeys.list(projectId, params),
    queryFn: ({ signal }) => getSysLogs(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 模块下拉数据（同时供列渲染做 code→name 映射）。 */
export function useSysLogModulesQuery(projectId: string) {
  return useQuery({
    queryKey: sysLogKeys.modules(projectId),
    queryFn: ({ signal }) => getSysLogModules({ signal }),
  });
}

/** 操作类型下拉数据。 */
export function useSysLogOperationTypesQuery(projectId: string) {
  return useQuery({
    queryKey: sysLogKeys.operationTypes(projectId),
    queryFn: ({ signal }) => getSysLogOperationTypes({ signal }),
  });
}

/** 用户下拉数据。 */
export function useSysLogUsersQuery(projectId: string) {
  return useQuery({
    queryKey: sysLogKeys.users(projectId),
    queryFn: ({ signal }) => getSysLogUsers({ signal }),
  });
}
