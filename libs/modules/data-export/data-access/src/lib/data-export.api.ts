import { apiClient } from '@myorg/shared/data-access-api';import type { ExportListResponse } from './data-export.model';
export const fetchExportTaskList = (p: { pageNum: number; pageSize: number }) => apiClient.post<ExportListResponse>('/api/manage/v1/export/task/list/my', { page: { pageNum: p.pageNum, pageSize: p.pageSize } });
export const downloadExportFile = (busId: string, busType: string) => apiClient.post('/api/manage/v1/export/task/download', { busId, busType }, { responseType: 'blob' });
