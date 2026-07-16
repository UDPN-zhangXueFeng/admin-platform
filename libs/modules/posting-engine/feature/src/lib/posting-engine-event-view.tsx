'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  usePostingEventDetailQuery,
  usePostingHistoryListQuery,
  type PostingHistoryItem,
} from '@myorg/modules/posting-engine/data-access';
import { PostingStatusBadge } from '@myorg/modules/posting-engine/ui';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  directionLabel,
  formatAccountLabel,
  getSourceEventTypeMessageKey,
  mappingMethodMessageKey,
  resolveTokenTypeMessageKey,
  splitEntryDirection,
  toMillis,
} from '@myorg/modules/posting-engine/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const BASIC_TAB = 'basic-information';
const HISTORY_TAB = 'version-history';

function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function formatTs(ts?: number): string {
  const ms = toMillis(ts);
  return ms ? formatDate(ms, DATETIME_FMT) : EMPTY_DISPLAY;
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

interface EntryTemplateRow {
  id: string;
  drCr: string;
  account: string;
  method: string;
  value: string;
}

/**
 * 事件详情（迁移自 view.tsx）。
 *
 * 两 tab：Basic Information（事件元信息 + 事务事件字段 chips + 分录模板表）+
 * Version History（版本列表 + 行查看 Drawer + 审批跳转）。
 */
export function PostingEngineEventView({
  postingEventIdRaw,
}: {
  postingEventIdRaw?: string | null;
}) {
  const t = useTranslations('modules.posting-engine');
  const router = useRouter();
  const postingEventId = parseId(postingEventIdRaw);

  const { data: event, isLoading } =
    usePostingEventDetailQuery(postingEventId);

  const [historyPage, setHistoryPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const historyList = usePostingHistoryListQuery(
    {
      pageNum: historyPage.pageNum,
      pageSize: historyPage.pageSize,
      filters: { postingEventId: postingEventId ?? 0 },
    },
    Boolean(postingEventId)
  );
  const history = historyList.data?.rows ?? [];
  const historyTotal = historyList.data?.page?.total ?? 0;

  const [selected, setSelected] = React.useState<PostingHistoryItem | null>(
    null
  );

  const basicRows = React.useMemo<KvRow[]>(() => {
    if (!event) return [];
    const sourceKey = getSourceEventTypeMessageKey(event.eventType);
    const tokenTypeKey = resolveTokenTypeMessageKey(event.tokenType);
    return [
      {
        key: 'sourceEventType',
        label: t('detail.sourceEventType'),
        value: sourceKey ? t(sourceKey) : EMPTY_DISPLAY,
      },
      {
        key: 'eventCode',
        label: t('detail.eventCode'),
        value: event.eventCode || EMPTY_DISPLAY,
      },
      {
        key: 'versionId',
        label: t('detail.versionId'),
        value: event.versionId || EMPTY_DISPLAY,
      },
      {
        key: 'status',
        label: t('field.status'),
        value: <PostingStatusBadge status={event.status} />,
      },
      {
        key: 'effectiveDate',
        label: t('detail.effectiveDate'),
        value: formatTs(event.effectiveDate),
      },
      {
        key: 'currency',
        label: t('field.currency'),
        value: event.currencyCode || EMPTY_DISPLAY,
      },
      {
        key: 'tokenType',
        label: t('field.tokenType'),
        value: tokenTypeKey ? t(tokenTypeKey) : EMPTY_DISPLAY,
      },
      {
        key: 'bookName',
        label: t('field.bookName'),
        value: event.bookName || EMPTY_DISPLAY,
      },
      {
        key: 'reserveAsset',
        label: t('detail.reserveAsset'),
        value: event.reserveAssetName || EMPTY_DISPLAY,
      },
      {
        key: 'lastRuleUpdate',
        label: t('field.lastRuleUpdate'),
        value: event.lastRuleUpdate || EMPTY_DISPLAY,
      },
      {
        key: 'creator',
        label: t('detail.creator'),
        value: event.createdBy || EMPTY_DISPLAY,
      },
      {
        key: 'createdOn',
        label: t('detail.updateTime'),
        value: formatTs(event.createdOn),
      },
    ];
  }, [event, t]);

  const eventFields = event?.normalizedTargetFields ?? [];

  const entryRows = React.useMemo<EntryTemplateRow[]>(() => {
    return (event?.mappings ?? [])
      .slice()
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          (a.direction ?? 0) - (b.direction ?? 0)
      )
      .map((m, index) => {
        const methodKey = mappingMethodMessageKey(m.mappingMethod);
        return {
          id: String(index),
          drCr: directionLabel(m.direction) || EMPTY_DISPLAY,
          account: formatAccountLabel(m.accountCode, m.accountName) || EMPTY_DISPLAY,
          method: methodKey ? t(methodKey) : EMPTY_DISPLAY,
          value: m.amountExpression || EMPTY_DISPLAY,
        };
      });
  }, [event?.mappings, t]);

  const historyColumns = React.useMemo<ColumnDef<PostingHistoryItem>[]>(
    () => [
      {
        id: 'sourceEventType',
        header: t('versionHistory.sourceEventType'),
        cell: ({ row }) => (
          <span>{row.original.sourceEventType || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'versionId',
        header: t('versionHistory.versionId'),
        cell: ({ row }) => (
          <span>{row.original.versionId || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'entryDirection',
        header: t('versionHistory.entryDirection'),
        cell: ({ row }) => {
          const lines = splitEntryDirection(row.original.entryDirection);
          if (!lines.length)
            return <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>;
          return (
            <div className="space-y-0.5">
              {lines.map((line, index) => (
                <div key={index} className="text-xs">
                  {line}
                </div>
              ))}
            </div>
          );
        },
      },
      {
        id: 'effectiveDate',
        header: t('versionHistory.effectiveDate'),
        cell: ({ row }) => <span>{formatTs(row.original.effectiveDate)}</span>,
      },
      {
        id: 'createdBy',
        header: t('versionHistory.createdBy'),
        cell: ({ row }) => (
          <span>{row.original.createdBy || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'createdOn',
        header: t('versionHistory.createdOn'),
        cell: ({ row }) => <span>{formatTs(row.original.createdOn)}</span>,
      },
      {
        id: 'status',
        header: t('versionHistory.status'),
        cell: ({ row }) => <PostingStatusBadge status={row.original.status} />,
      },
      {
        id: 'action',
        header: t('versionHistory.action'),
        cell: ({ row }) => (
          <div className="flex gap-3">
            {row.original.taskId && row.original.busCode ? (
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/approval-manage/view?id=${row.original.taskId}&busCode=${row.original.busCode}`
                  )
                }
              >
                {t('action.approval')}
              </Button>
            ) : null}
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => setSelected(row.original)}
            >
              {t('action.view')}
            </Button>
          </div>
        ),
      },
    ],
    [t, router]
  );

  if (!postingEventId) {
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
      <Tabs defaultValue={BASIC_TAB}>
        <TabsList>
          <TabsTrigger value={BASIC_TAB}>
            {t('detail.basicInformation')}
          </TabsTrigger>
          <TabsTrigger value={HISTORY_TAB}>
            {t('detail.versionHistory')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={BASIC_TAB}>
          <div className="space-y-4">
            <section className="rounded-lg border bg-card shadow-sm">
              <div className="border-b px-6 py-3 text-sm font-semibold">
                {t('detail.basicInformation')}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-sm">
                  <tbody>
                    {isLoading || !basicRows.length ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground">
                          {isLoading ? '' : t('empty')}
                        </td>
                      </tr>
                    ) : (
                      basicRows.map((row) => (
                        <tr key={row.key}>
                          <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                            {row.label}
                          </td>
                          <td className="break-all border px-4 py-3">
                            {row.value}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border bg-card shadow-sm">
              <div className="border-b px-6 py-3 text-sm font-semibold">
                {t('detail.transactionEventFields')}
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {eventFields.length ? (
                  eventFields.map((field, index) => {
                    const fieldLabel = field.targetField || field.sourceField;
                    return (
                      <span
                        key={`${fieldLabel ?? ''}-${index}`}
                        className="inline-flex items-center rounded-md border bg-muted/40 px-2 py-1 text-xs"
                      >
                        <span className="font-medium">
                          {fieldLabel || EMPTY_DISPLAY}
                        </span>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t('empty')}
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-card shadow-sm">
              <div className="border-b px-6 py-3 text-sm font-semibold">
                {t('detail.entryTemplate')}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="border px-4 py-2 font-medium">
                        {t('edit.drCr')}
                      </th>
                      <th className="border px-4 py-2 font-medium">
                        {t('edit.account')}
                      </th>
                      <th className="border px-4 py-2 font-medium">
                        {t('edit.method')}
                      </th>
                      <th className="border px-4 py-2 font-medium">
                        {t('edit.value')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryRows.length ? (
                      entryRows.map((row) => (
                        <tr key={row.id}>
                          <td className="border px-4 py-2">{row.drCr}</td>
                          <td className="border px-4 py-2">{row.account}</td>
                          <td className="border px-4 py-2">{row.method}</td>
                          <td className="border px-4 py-2">{row.value}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="border px-4 py-8 text-center text-muted-foreground"
                        >
                          {t('empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value={HISTORY_TAB}>
          <section className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('detail.versionHistory')}
            </div>
            <div className="p-4">
              <DataTable
                columns={historyColumns}
                data={history}
                isLoading={historyList.isLoading || historyList.isFetching}
                emptyMessage={t('detail.noVersion')}
                pagination={{
                  page: historyPage.pageNum,
                  pageSize: historyPage.pageSize,
                  total: historyTotal,
                  onPageChange: (page) =>
                    setHistoryPage((prev) => ({ ...prev, pageNum: page })),
                }}
              />
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>

      <Drawer
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('detail.versionHistory')}</DrawerTitle>
            <DrawerDescription>
              {selected?.versionId || EMPTY_DISPLAY}
            </DrawerDescription>
          </DrawerHeader>
          {selected ? (
            <div className="overflow-x-auto px-6 pb-8">
              <table className="w-full table-fixed border-collapse text-sm">
                <tbody>
                  {[
                    {
                      label: t('versionHistory.sourceEventType'),
                      value: selected.sourceEventType || EMPTY_DISPLAY,
                    },
                    {
                      label: t('versionHistory.versionId'),
                      value: selected.versionId || EMPTY_DISPLAY,
                    },
                    {
                      label: t('versionHistory.effectiveDate'),
                      value: formatTs(selected.effectiveDate),
                    },
                    {
                      label: t('versionHistory.createdBy'),
                      value: selected.createdBy || EMPTY_DISPLAY,
                    },
                    {
                      label: t('versionHistory.createdOn'),
                      value: formatTs(selected.createdOn),
                    },
                    {
                      label: t('versionHistory.status'),
                      value: <PostingStatusBadge status={selected.status} />,
                    },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                        {row.label}
                      </td>
                      <td className="break-all border px-4 py-3">{row.value}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border bg-muted/30 px-4 py-3 align-top font-medium">
                      {t('versionHistory.entryDirection')}
                    </td>
                    <td className="border px-4 py-3">
                      {splitEntryDirection(selected.entryDirection).length ? (
                        <div className="space-y-0.5">
                          {splitEntryDirection(selected.entryDirection).map(
                            (line, index) => (
                              <div key={index} className="text-xs">
                                {line}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {EMPTY_DISPLAY}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
