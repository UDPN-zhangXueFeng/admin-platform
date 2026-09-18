import { apiClient, axiosClient } from '@myorg/shared/data-access-api';import type { ExportListResponse } from './data-export.model';
export const fetchExportTaskList = (p: { pageNum: number; pageSize: number }) => apiClient.post<ExportListResponse>('/api/manage/v1/export/task/list/my', { page: { pageNum: p.pageNum, pageSize: p.pageSize } });
// 下载端点返回二进制 blob，不走 {code,data} 信封，故绕过 apiClient 直接使用 axiosClient（与 auth.getCaptcha 一致）。
export const downloadExportFile = (busId: string, busType: string) =>
  axiosClient
    .post<Blob>('/api/manage/v1/export/task/download', { busId, busType }, { responseType: 'blob' })
    .then((response) => response.data);
