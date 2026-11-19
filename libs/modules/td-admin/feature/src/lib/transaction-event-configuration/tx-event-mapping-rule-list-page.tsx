'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  Card,
  CopyableEllipsisText,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageHeader,
} from '@myorg/shared/ui';
import { toast } from 'sonner';
import {
  useNormalizationMappingRulesQuery,
  usePreviewNormalizationMutation,
  type NormalizationEvent,
} from '@myorg/modules/td-admin/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  formatDate,
  formatDateTime,
  getSourceEventTypeByEventType,
  getSourceEventTypeMessageKey,
  resolveMappingRuleStatusMeta,
  statusToneClass,
} from '.';
import { createRowActionsColumn } from '../row-actions';

/** 列表 / Preview 共用的 Mapping Rule ID 派生（源项目 mapMappingRuleRow 同逻辑）。 */
function resolveMappingRuleId(record: NormalizationEvent): string {
  return (
    record.eventCode ||
    record.versionId ||
    (record.normalizationEventId ? String(record.normalizationEventId) : '')
  );
}

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
  const rawBookId = searchParams.get('id') ?? '';
  const financeBookId = /^[1-9]\d*$/.test(rawBookId) ? rawBookId : '';
  const goBack = () => router.push('/accounting/transaction-event-configuration');

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [previewRecord, setPreviewRecord] =
    React.useState<NormalizationEvent | null>(null);

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
    (record: NormalizationEvent) => {
      if (!record.normalizationEventId) return;
      setPreviewRecord(record);
      void previewMutation.mutate({
        normalizationEventId: record.normalizationEventId,
      });
    },
    [previewMutation]
  );

  const closePreview = React.useCallback(() => {
    setPreviewRecord(null);
    previewMutation.reset();
  }, [previewMutation]);

  const previewJson = React.useMemo(() => {
    const data = previewMutation.data;
    if (!data || !previewRecord) return '';
    const sourceEventType =
      getSourceEventTypeByEventType(data.eventType) ??
      getSourceEventTypeByEventType(previewRecord.eventType) ??
      EMPTY_DISPLAY;
    return JSON.stringify(
      {
        mappingRuleId: resolveMappingRuleId(previewRecord) || EMPTY_DISPLAY,
        normalizationEventId:
          data.normalizationEventId ?? previewRecord.normalizationEventId,
        eventCode: data.eventCode || '--',
        eventType: data.eventType,
        sourceEventType,
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
  }, [previewMutation.data, previewRecord]);

  const handleCopyPreviewJson = React.useCallback(async () => {
    if (!previewJson || previewMutation.isPending) return;
    try {
      await navigator.clipboard.writeText(previewJson);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  }, [previewJson, previewMutation.isPending, t]);

  const columns = React.useMemo<ColumnDef<NormalizationEvent>[]>(
    () => [
      {
        id: 'mappingRuleId',
        header: t('field.mappingRuleId'),
        cell: ({ row }) => {
          const id = resolveMappingRuleId(row.original);
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
      // Actions：统一行操作列。Detail 内联；Preview/Edit 收进 ⋮（顺序对齐源单元格）。
      createRowActionsColumn<NormalizationEvent>({
        detail: {
          label: t('action.detail'),
          onClick: (row) =>
            router.push(
              `/accounting/transaction-event-configuration/mapping-rule/view?id=${row.normalizationEventId ?? ''}&bookId=${financeBookId}`
            ),
        },
        menu: (row) => [
          {
            label: t('action.preview'),
            onClick: () => handlePreview(row),
          },
          {
            label: t('action.edit'),
            onClick: () =>
              router.push(
                `/accounting/transaction-event-configuration/mapping-rule/edit?id=${row.normalizationEventId ?? ''}&bookId=${financeBookId}`
              ),
          },
        ],
      }),
    ],
    [t, financeBookId, router, handlePreview]
  );

  if (!financeBookId) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('mappingRuleList')}
          backLabel={t('action.back')}
          onBack={goBack}
        />
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('mappingRuleList')}
        backLabel={t('action.back')}
        onBack={goBack}
      />
      {listResult.error && <p role="alert" className="text-sm text-destructive">{listResult.error.message}</p>}
      <Card>
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
              summary: t('resultRange', { start: rows.length ? (pagination.pageNum - 1) * pagination.pageSize + 1 : 0, end: (pagination.pageNum - 1) * pagination.pageSize + rows.length, total }),
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
            }}
          />
        </div>
      </Card>

      <Dialog
        open={previewRecord !== null}
        onOpenChange={(open) => !open && closePreview()}
      >
        <DialogContent className="max-w-[560px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('action.preview')}</DialogTitle>
            <DialogDescription className="sr-only">{t('previewDescription')}</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded border">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2">
              <span className="text-sm">Json</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleCopyPreviewJson}
                disabled={!previewJson || previewMutation.isPending}
              >
                {t('copy')}
              </Button>
            </div>
            {previewMutation.error && <p role="alert" className="px-4 py-2 text-sm text-destructive">{previewMutation.error.message}</p>}
            <pre className="m-0 max-h-[60vh] overflow-auto whitespace-pre-wrap break-all p-4 text-xs leading-5">
              {previewMutation.isPending
                ? t('loading')
                : previewJson || EMPTY_DISPLAY}
            </pre>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePreview}>{t('action.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
