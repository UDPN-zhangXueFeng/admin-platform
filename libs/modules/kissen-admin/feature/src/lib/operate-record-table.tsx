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

/**
 * 业务对象状态码 → 展示文案（2026-11-19）。
 *
 * <p>WHY：`biz_operate_record.from_status/to_status` 存的是原始码，直接渲染会出现
 * 「50 → 20」这种用户无法理解的列（实测网关实例详情页）。这里按对象类型映射成
 * 可读文案；未登记的码原样显示，避免掩盖未知状态。
 *
 * <p>注意：不同对象的同一数字含义不同（如 20 对实例是 Activated、对通用实体是 Approved），
 * 因此映射按 objectType 区分，而不是全局一张表。
 */
const STATUS_LABELS: Record<string, Record<number, string>> = {
  // BankGatewayInstance：1=Registered 10=Key pushed 20=Activated 50=Disabled
  BANK_INSTANCE: {
    1: 'Registered',
    10: 'Key pushed',
    20: 'Active',
    50: 'Disabled',
  },
  // 其余对象沿用通用状态：20=Approved(启用) 35=Completed 50=Stopped
  DEFAULT: {
    1: 'Registered',
    20: 'Approved',
    35: 'Completed',
    50: 'Disabled',
  },
};

function statusLabel(objectType: string | undefined, code: number | null | undefined): string {
  if (code == null) {
    return '—';
  }
  const table = STATUS_LABELS[objectType ?? ''] ?? STATUS_LABELS.DEFAULT;
  return table[code] ?? String(code);
}

/** Trace ID 中段省略：首 8 + 尾 5（完整值放 title，可悬停查看）。 */
function shortTrace(trace: string): string {
  return trace.length <= 16 ? trace : `${trace.slice(0, 8)}…${trace.slice(-5)}`;
}

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
      const { fromStatus, toStatus, objectType } = row.original;
      if (fromStatus == null && toStatus == null) {
        return <span className="text-muted-foreground">—</span>;
      }
      // 原始码放 title，需要时悬停可查（排查问题时仍要能对上库里的值）
      return (
        <span
          className="whitespace-nowrap"
          title={`${fromStatus ?? '-'} → ${toStatus ?? '-'}`}
        >
          {statusLabel(objectType, fromStatus)}
          <span className="mx-1 text-muted-foreground">→</span>
          {statusLabel(objectType, toStatus)}
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
    cell: ({ row }) => {
      const trace = row.original.traceId;
      if (!trace) {
        return <span className="text-muted-foreground">—</span>;
      }
      // traceId 是 32 位 hex，完整展示会把整列撑开；截断后 title 悬停可见全文
      return (
        <span className="font-mono text-[11px] text-muted-foreground" title={trace}>
          {shortTrace(trace)}
        </span>
      );
    },
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
