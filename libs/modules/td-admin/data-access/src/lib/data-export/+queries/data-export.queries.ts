import { useQuery } from '@tanstack/react-query';import { fetchExportTaskList } from '../data-export.api';import { dataExportKeys } from './data-export.keys';
export const useExportTaskList = (pageNum: number, pageSize = 10) => useQuery({ queryKey: dataExportKeys.list(pageNum), queryFn: () => fetchExportTaskList({ pageNum, pageSize }) });
