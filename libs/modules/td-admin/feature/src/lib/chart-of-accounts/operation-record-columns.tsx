'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@myorg/shared/ui';
import type {
  OperationRecordRow,
  OperationType,
} from '@myorg/modules/td-admin/data-access';

import { OperationStatusBadge } from './operation-status-badge';

export interface OperationRecordColumnsOptions {
  t: (key: string) => string;
  /** `common` 命名空间翻译（`common_task_status_${status}`）。 */
  tCommon: (key: string) => string;
  /** 审批任务详情跳转（非 Create 且存在 taskId + busCode 时）。 */
  onOpenDetails: (record: OperationRecordRow) => void;
}

function operationTypeLabel(
  operationType: OperationType | undefined,
  t: (key: string) => string
): string {
  switch (operationType) {
    case 'create':
      return t('operationRecords.create');
    case 'update':
      return t('operationRecords.update');
    case 'activate':
      return t('operationRecords.activate');
    case 'deactivate':
      return t('operationRecords.deactivate');
    default:
      return '--';
  }
}

export function buildOperationRecordColumns({
  t,
  tCommon,
  onOpenDetails,
}: OperationRecordColumnsOptions): ColumnDef<OperationRecordRow>[] {
  return [
    {
      id: 'operationType',
      header: t('operationRecords.operationType'),
      size: 180,
      cell: ({ row }) => operationTypeLabel(row.original.operationType, t),
    },
    {
      accessorKey: 'createdBy',
      header: t('operationRecords.createdBy'),
      size: 180,
    },
    {
      accessorKey: 'createdOn',
      header: t('operationRecords.createdOn'),
      size: 250,
    },
    {
      accessorKey: 'comments',
      header: t('operationRecords.comments'),
      size: 460,
      cell: ({ row }) => (
        <span className="block whitespace-normal break-words">
          {row.original.comments}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('operationRecords.status'),
      size: 170,
      cell: ({ row }) => (
        <OperationStatusBadge status={row.original.status} tCommon={tCommon} />
      ),
    },
    {
      id: 'actions',
      header: t('operationRecords.actions'),
      size: 110,
      cell: ({ row }) => {
        const record = row.original;
        if (record.operationType === 'create') return '--';
        return (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            disabled={!record.taskId || !record.busCode}
            onClick={() => onOpenDetails(record)}
          >
            {t('operationRecords.details')}
          </Button>
        );
      },
    },
  ];
}
