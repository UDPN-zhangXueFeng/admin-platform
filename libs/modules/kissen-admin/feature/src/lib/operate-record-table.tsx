/**
 * 业务操作历史通用表格（biz_operate_record）：
 * LP / 参与对 / 银行 / 网关实例 / token / token 对等详情页共用，避免各页重复列定义。
 */
'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Alert, AlertTitle, DataTable } from '@myorg/shared/ui';

import {
  useBizRecordObjectQuery,
  type BizObjectType,
  type BizRecordRow,
} from '@myorg/modules/kissen-admin/data-access';

import { formatUtc8 } from './proto-format';

export type OperateRecordRow = BizRecordRow & { id: string };

export const operateRecordColumns: ColumnDef<OperateRecordRow>[] = [
  {
    accessorKey: 'operateTime',
    header: 'Timestamp',
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {formatUtc8(row.original.operateTime)}
      </span>
    ),
  },
  {
    accessorKey: 'operatorName',
    header: 'Operator',
    cell: ({ row }) => <span>{row.original.operatorName || '—'}</span>,
  },
  {
    accessorKey: 'actionLabel',
    header: 'Action',
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <div className="font-medium">{row.original.actionLabel}</div>
        {row.original.remarks ? (
          <div className="text-[11px] leading-4 text-muted-foreground">
            {row.original.remarks}
          </div>
        ) : null}
      </div>
    ),
  },
  {
    id: 'statusChange',
    header: 'Status change',
    cell: ({ row }) => {
      const { fromStatus, toStatus } = row.original;
      if (fromStatus == null && toStatus == null) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <span className="whitespace-nowrap tabular-nums">
          {fromStatus == null ? '—' : fromStatus} → {toStatus == null ? '—' : toStatus}
        </span>
      );
    },
  },
  {
    id: 'detail',
    header: 'Detail',
    cell: ({ row }) =>
      row.original.payload ? (
        <code className="break-all text-[11px] leading-4 text-muted-foreground">
          {row.original.payload}
        </code>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: 'traceId',
    header: 'Trace ID',
    cell: ({ row }) => (
      <span className="break-all text-[11px] text-muted-foreground">
        {row.original.traceId || '—'}
      </span>
    ),
  },
];

/** 按对象查操作历史；objectId 无效时不发请求。 */
export function OperateRecordTable({
  projectId,
  objectType,
  objectId,
  emptyMessage = 'No operations recorded yet.',
  pageSize = 50,
}: {
  projectId: string;
  objectType: BizObjectType;
  objectId: number | null | undefined;
  emptyMessage?: string;
  pageSize?: number;
}) {
  const enabled = (objectId ?? 0) > 0;
  const query = useBizRecordObjectQuery(
    projectId,
    {
      pageNum: 1,
      pageSize,
      filter: { objectType, objectId: objectId ?? 0 },
    },
    enabled,
  );

  const rows = React.useMemo<OperateRecordRow[]>(
    () => (query.data?.data ?? []).map((r) => ({ ...r, id: String(r.recordId) })),
    [query.data],
  );

  if (query.isError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Failed to load operation history.</AlertTitle>
        </Alert>
      </div>
    );
  }

  return (
    <DataTable
      columns={operateRecordColumns}
      data={rows}
      isLoading={query.isLoading}
      emptyMessage={emptyMessage}
    />
  );
}
