'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@myorg/shared/ui';
import {
  useNormalizationMappingRulesQuery,
  usePreviewNormalizationMutation,
  type NormalizationEvent,
} from '@myorg/modules/transaction-event-configuration/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  formatDate,
  formatDateTime,
  getSourceEventTypeByEventType,
  getSourceEventTypeMessageKey,
  resolveMappingRuleStatusMeta,
  statusToneClass,
} from '@myorg/modules/transaction-event-configuration/util';

/**
 * TxEventMappingRuleListPage — Mapping Rule 列表页（按 financeBookId）。
 *
 * 迁移自 td-manage `pages/financial/transaction-event-configuration/mapping-rule/index.tsx`（513 行）。
 * 保留：按账本查询、状态 tag（30/35/45）、Preview Modal（preview API）、Edit / Detail 操作。
 * 无筛选表单（源亦无），仅服务端分页。
 */
export function TxEventMappingRuleListPage() {
  const t = useTranslations('modules.transaction-event-configuration');
  const router = useRouter();
  const searchParams = useSearchParams();
  const financeBookId = searchParams.get('id') ?? '';

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [previewId, setPreviewId] = React.useState<number | null>(null);

  const listResult = useNormalizationMappingRulesQuery(
    {
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      financeBookId,
    },
    Boolean(financeBookId)
  );
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const previewMutation = usePreviewNormalizationMutation();

  const handlePreview = React.useCallback(
    (normalizationEventId?: number) => {
      if (!normalizationEventId) return;
      setPreviewId(normalizationEventId);
      void previewMutation.mutate({ normalizationEventId });
    },
    [previewMutation]
  );

  const closePreview = React.useCallback(() => {
    setPreviewId(null);
    previewMutation.reset();
  }, [previewMutation]);

  const previewJson = React.useMemo(() => {
    const data = previewMutation.data;
    if (!data) return '';
    return JSON.stringify(
      {
        normalizationEventId: data.normalizationEventId ?? previewId,
        eventCode: data.eventCode || '--',
        eventType: data.eventType,
        mappings: (data.mappings ?? []).map((m) => ({
          sourceField: m.sourceField,
          targetField: m.targetField,
          mappingType: m.mappingType,
          description: m.description,
        })),
      },
      null,
      2
    );
  }, [previewMutation.data, previewId]);

  const columns = React.useMemo<ColumnDef<NormalizationEvent>[]>(
    () => [
      {
        id: 'mappingRuleId',
        header: t('field.mappingRuleId'),
        cell: ({ row }) => {
          const id =
            row.original.eventCode ||
            row.original.versionId ||
            (row.original.normalizationEventId
              ? String(row.original.normalizationEventId)
              : '');
          return id ? (
            <CopyableEllipsisText value={id} copyLabel={t('copy')} />
          ) : (
            <span>{EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        id: 'sourceEventType',
        header: t('field.sourceEventType'),
        cell: ({ row }) => {
          const se = getSourceEventTypeByEventType(row.original.eventType);
          const key = getSourceEventTypeMessageKey(se, financeBookId);
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'createTime',
        header: t('field.createdOn'),
        cell: ({ row }) => (
          <span>{formatDateTime(row.original.createTime)}</span>
        ),
      },
      {
        accessorKey: 'effectiveDate',
        header: t('field.effectiveDate'),
        cell: ({ row }) => <span>{formatDate(row.original.effectiveDate)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const meta = resolveMappingRuleStatusMeta(row.original.status);
          if (!meta) return <span>{EMPTY_DISPLAY}</span>;
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
                meta.tone
              )}`}
            >
              {t(meta.labelKey)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => (
          <div className="flex gap-3">
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => handlePreview(row.original.normalizationEventId)}
            >
              {t('action.preview')}
            </Button>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/transaction-event-configuration/mapping-rule/edit?id=${row.original.normalizationEventId ?? ''}&bookId=${financeBookId}`
                )
              }
            >
              {t('action.edit')}
            </Button>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/transaction-event-configuration/mapping-rule/view?id=${row.original.normalizationEventId ?? ''}&bookId=${financeBookId}`
                )
              }
            >
              {t('action.detail')}
            </Button>
          </div>
        ),
      },
    ],
    [t, financeBookId, router, handlePreview]
  );

  if (!financeBookId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('mappingRuleList')}
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
            }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>

      <Dialog open={previewId !== null} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t('action.preview')}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-4 text-xs leading-5">
            {previewMutation.isPending
              ? 'Loading...'
              : previewJson || EMPTY_DISPLAY}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
