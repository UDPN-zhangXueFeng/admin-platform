'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { useSpAccessOperationRecordsQuery } from '@myorg/modules/td-admin/data-access';
import type { SpAccessOperationRecord } from '@myorg/modules/td-admin/data-access';
import { EMPTY_FIELD_VALUE, formatTimestamp } from './formatters';
import { SpAccessStatusBadge } from './sp-access-status-badge';

/**
 * 详情页「操作记录」Tab（上游 OperationRecordsSection）：
 * 操作类型筛选 + 记录列表；Details 跳审批详情（task 存在才可点）。
 */

const ALL_VALUE = '';
const PAGE_SIZE = 10;
const OPERATION_TYPE_OPTIONS = ['1', '2'] as const;

export function SpAccessOperationRecordsSection({ spCode }: { spCode: string }) {
  const t = useTranslations('modules.sp-access');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);
  const [draftType, setDraftType] = React.useState(ALL_VALUE);
  const [appliedType, setAppliedType] = React.useState(ALL_VALUE);

  const { data, isLoading, error } = useSpAccessOperationRecordsQuery({
    spCode,
    pageNum: page,
    pageSize,
    operationType: appliedType === ALL_VALUE ? '' : appliedType,
  });

  React.useEffect(() => {
    if (error) toast.error(error instanceof Error ? error.message : t('sp_access_0125'));
  }, [error, t]);

  const rows = data?.rows ?? [];

  const columns = React.useMemo<ColumnDef<SpAccessOperationRecord & { id: string }>[]>(
    () => [
      {
        accessorKey: 'type',
        header: t('sp_access_0013'),
        cell: ({ getValue }) => {
          const raw = getValue();
          return raw !== null && raw !== undefined && raw !== ''
            ? t(`operation_type_${raw}`)
            : EMPTY_FIELD_VALUE;
        },
      },
      {
        accessorKey: 'createUserName',
        header: t('PUB_Creater'),
        cell: ({ getValue }) => (getValue() as string) || EMPTY_FIELD_VALUE,
      },
      {
        accessorKey: 'createTime',
        header: t('PUB_CreateTime'),
        cell: ({ getValue }) =>
          formatTimestamp(getValue() as number | undefined),
      },
      {
        accessorKey: 'state',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <SpAccessStatusBadge kind="taskStatus" status={Number(getValue())} />
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        enableSorting: false,
        cell: ({ row }) => {
          const record = row.original;
          const disabled = !record.taskId || !record.businessCode;
          return (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={disabled}
              onClick={() =>
                router.push(
                  `/approval-manage/view?id=${record.taskId}&busCode=${record.businessCode}`,
                )
              }
            >
              {t('Router_062')}
            </Button>
          );
        },
      },
    ],
    [t, router],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 text-base font-semibold">{t('sp_access_0012')}</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('sp_access_0013')}</span>
            <Select
              value={draftType}
              onValueChange={(value) => setDraftType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {OPERATION_TYPE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`operation_type_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraftType(ALL_VALUE);
              setAppliedType(ALL_VALUE);
              setPage(1);
              setPageSize(PAGE_SIZE);
            }}
          >
            {t('PUB_Reset')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setAppliedType(draftType);
              setPage(1);
            }}
          >
            {t('PUB_Query')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows.map((row, index) => ({ ...row, id: String(row.spRecordId ?? row.taskId ?? index) }))}
        isLoading={isLoading}
        emptyMessage={tCommon('noData')}
        pagination={{
          page,
          pageSize: data?.pageSize ?? pageSize,
          total: data?.total ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          },
        }}
      />
    </div>
  );
}
