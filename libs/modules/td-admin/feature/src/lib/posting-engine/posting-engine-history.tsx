'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import { FormDateRangePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { usePostingHistoryListQuery, type PostingHistoryItem } from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import { QueryForm } from '../query-form';
import { createRowActionsColumn, renderRowActions } from '../row-actions';
import {
  ALL_VALUE, DEFAULT_PAGE_SIZE, EMPTY_DISPLAY, POSTING_STATUS,
  getSourceEventTypeMessageKey, paginationRange, splitEntryDirection, toMillis,
} from './posting-engine.constants';
import { formatPostingDate } from './posting-engine-dates';
import { PostingStatusBadge } from './posting-status-badge';

const EMPTY_FILTER = {
  versionId: '', effectiveDateFrom: '', effectiveDateTo: '',
  createdOnFrom: '', createdOnTo: '', status: ALL_VALUE,
};

export function PostingEngineHistory({ postingEventId, tokenType }: {
  postingEventId: number;
  tokenType?: number;
}) {
  const t = useTranslations('modules.posting-engine');
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { control, register, handleSubmit, reset } = useForm({ defaultValues: EMPTY_FILTER });
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const result = usePostingHistoryListQuery({
    pageNum: page,
    pageSize: DEFAULT_PAGE_SIZE,
    filters: {
      postingEventId,
      versionId: filter.versionId.trim() || undefined,
      status: filter.status === ALL_VALUE ? undefined : Number(filter.status),
      effectiveDateStart: filter.effectiveDateFrom ? startOfDay(parseISO(filter.effectiveDateFrom)).getTime() : undefined,
      effectiveDateEnd: filter.effectiveDateTo ? endOfDay(parseISO(filter.effectiveDateTo)).getTime() : undefined,
      createTimeStart: filter.createdOnFrom ? startOfDay(parseISO(filter.createdOnFrom)).getTime() : undefined,
      createTimeEnd: filter.createdOnTo ? endOfDay(parseISO(filter.createdOnTo)).getTime() : undefined,
    },
  });
  const total = result.isError ? 0 : result.data?.page?.total ?? 0;
  const statusOptions = [
    { value: ALL_VALUE, label: t('filter.all') },
    { value: String(POSTING_STATUS.Pending), label: t('status.pending') },
    { value: String(POSTING_STATUS.UnderApproval), label: t('status.underApproval') },
    { value: String(POSTING_STATUS.Rejected), label: t('status.rejected') },
    { value: String(POSTING_STATUS.Scheduled), label: t('status.scheduled') },
    { value: String(POSTING_STATUS.Effective), label: t('status.active') },
    { value: String(POSTING_STATUS.Expired), label: t('status.expired') },
  ];
  const columns: ColumnDef<PostingHistoryItem>[] = [
    {
      accessorKey: 'sourceEventType', header: t('detail.sourceEventType'),
      cell: ({ row }) => {
        const source = row.original.sourceEventType;
        const key = getSourceEventTypeMessageKey(source, tokenType);
        return key ? t(key) : source || EMPTY_DISPLAY;
      },
    },
    {
      accessorKey: 'versionId', header: t('detail.versionId'),
      cell: ({ row }) => <CopyableEllipsisText value={row.original.versionId} copyLabel={t('copy')} showCopyIcon />,
    },
    {
      accessorKey: 'entryDirection', header: t('detail.entryDirection'),
      cell: ({ row }) => {
        const lines = splitEntryDirection(row.original.entryDirection);
        return lines.length ? <div className="space-y-0.5 text-xs">{lines.map((line, index) => <div key={index}>{line}</div>)}</div> : EMPTY_DISPLAY;
      },
    },
    { accessorKey: 'effectiveDate', header: t('detail.effectiveDate'), cell: ({ row }) => formatPostingDate(row.original.effectiveDate) },
    { accessorKey: 'createdBy', header: t('versionHistory.createdBy'), cell: ({ row }) => row.original.createdBy || EMPTY_DISPLAY },
    { accessorKey: 'createdOn', header: t('versionHistory.createdOn'), cell: ({ row }) => formatAdminTimestamp(toMillis(row.original.createdOn)) },
    {
      accessorKey: 'status', header: t('field.status'),
      cell: ({ row }) => <PostingStatusBadge status={row.original.status} statusName={row.original.statusName} />,
    },
    {
      ...createRowActionsColumn<PostingHistoryItem>({ header: t('field.actions') }),
      cell: ({ row }) => {
        const { taskId, busCode } = row.original;
        if (!taskId || !busCode) return EMPTY_DISPLAY;
        return renderRowActions(row.original, {
          detail: { label: t('action.detail'), onClick: () => {
            const params = new URLSearchParams({ id: String(taskId), busCode });
            router.push(`/approval-manage/view?${params}`);
          } },
        });
      },
    },
  ];

  return (
    <Card>
      <h2 className="border-b px-6 py-3 text-sm font-semibold">{t('detail.versionHistory')}</h2>
      <form className="border-b p-4" onSubmit={handleSubmit((values) => { setPage(1); setFilter(values); })}>
        <QueryForm variant="plain" queryType="submit"
          fields={[
            <FormField key="versionId" name="versionId" label={t('detail.versionId')}
              placeholder={t('versionHistory.versionIdPlaceholder')} register={register('versionId')} />,
            <FormDateRangePicker key="effectiveDate" startName="effectiveDateFrom" endName="effectiveDateTo"
              control={control} label={t('detail.effectiveDate')} />,
            <FormDateRangePicker key="createdOn" startName="createdOnFrom" endName="createdOnTo"
              control={control} label={t('versionHistory.createdOn')} />,
            <FormSelect key="status" name="status" control={control} label={t('field.status')} options={statusOptions} />,
          ]}
          onReset={() => { reset(EMPTY_FILTER); setFilter(EMPTY_FILTER); setPage(1); }}
          queryLabel={t('filter.query')}
          resetLabel={t('filter.reset')}
        />
      </form>
      <div className="p-4">
        <DataTable columns={columns} data={result.isError ? [] : result.data?.rows ?? []}
          isLoading={result.isLoading || result.isFetching}
          emptyMessage={t(result.isError ? 'loadError' : 'detail.noVersion')}
          pagination={{ page, pageSize: DEFAULT_PAGE_SIZE, total, onPageChange: setPage,
            summary: t('pagination.range', paginationRange(page, total)), }}
        />
      </div>
    </Card>
  );
}
