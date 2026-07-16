'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  usePostingBookDetailQuery,
  usePostingEventListQuery,
  type PostingEvent,
} from '@myorg/modules/posting-engine/data-access';
import { PostingStatusBadge } from '@myorg/modules/posting-engine/ui';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  directionLabel,
  formatAccountLabel,
  getSourceEventTypeMessageKey,
  resolveTokenTypeMessageKey,
  splitEntryDirection,
  toMillis,
} from '@myorg/modules/posting-engine/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const BASIC_TAB = 'basic-information';
const MATRIX_TAB = 'posting-engine-matrix';

/** 将 query 值解析为正整数，非法返回 `undefined`。 */
function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 时间戳格式化（秒/毫秒自适应），无值返回占位。 */
function formatTs(ts?: number): string {
  const ms = toMillis(ts);
  return ms ? formatDate(ms, DATETIME_FMT) : EMPTY_DISPLAY;
}

/** 解析事件的借贷方向展示行（entryDirection 优先，否则从 mappings 重建）。 */
function resolveEntryLines(event: PostingEvent): string[] {
  const direct = splitEntryDirection(event.entryDirection);
  if (direct.length) return direct;
  return (event.mappings ?? [])
    .slice()
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        (a.direction ?? 0) - (b.direction ?? 0)
    )
    .map((m) =>
      `${directionLabel(m.direction)} ${formatAccountLabel(
        m.accountCode,
        m.accountName
      )}`.trim()
    )
    .filter(Boolean);
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

/**
 * 账本详情（迁移自 detail.tsx）。
 *
 * 两 tab：Basic Information（账本元信息键值表）+ Posting Engine Matrix
 * （按账本的事件列表，行操作 Edit / View）。
 */
export function PostingEngineBookDetail({
  financeBookIdRaw,
  initialTab,
}: {
  financeBookIdRaw?: string | null;
  initialTab?: string | null;
}) {
  const t = useTranslations('modules.posting-engine');
  const router = useRouter();
  const financeBookId = parseId(financeBookIdRaw);

  const { data: book, isLoading } = usePostingBookDetailQuery(financeBookId);

  const [matrixPage, setMatrixPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const eventList = usePostingEventListQuery(
    {
      pageNum: matrixPage.pageNum,
      pageSize: matrixPage.pageSize,
      financeBookId,
    },
    Boolean(financeBookId)
  );
  const events = eventList.data?.rows ?? [];
  const eventsTotal = eventList.data?.page?.total ?? 0;

  const activeTab = initialTab === MATRIX_TAB ? MATRIX_TAB : BASIC_TAB;

  const basicRows = React.useMemo<KvRow[]>(() => {
    if (!book) return [];
    const tokenTypeKey = resolveTokenTypeMessageKey(book.tokenType);
    return [
      {
        key: 'bookName',
        label: t('field.bookName'),
        value: book.bookName || EMPTY_DISPLAY,
      },
      {
        key: 'status',
        label: t('field.status'),
        value: <PostingStatusBadge status={book.status} />,
      },
      {
        key: 'bookNo',
        label: t('field.bookNo'),
        value: (
          <CopyableEllipsisText value={book.bookNo} copyLabel={t('copy')} />
        ),
      },
      {
        key: 'reserveAsset',
        label: t('detail.reserveAsset'),
        value: book.reserveAssetName || EMPTY_DISPLAY,
      },
      {
        key: 'currency',
        label: t('field.currency'),
        value: book.currencyCode || EMPTY_DISPLAY,
      },
      {
        key: 'tokenType',
        label: t('field.tokenType'),
        value: tokenTypeKey ? t(tokenTypeKey) : EMPTY_DISPLAY,
      },
      {
        key: 'tokenCount',
        label: t('field.tokenCount'),
        value: book.tokens?.length ?? EMPTY_DISPLAY,
      },
      {
        key: 'totalEvents',
        label: t('field.totalEvents'),
        value: book.totalEvents ?? EMPTY_DISPLAY,
      },
      {
        key: 'configured',
        label: t('field.configured'),
        value: book.configured ?? EMPTY_DISPLAY,
      },
      {
        key: 'lastRuleUpdate',
        label: t('field.lastRuleUpdate'),
        value: book.lastRuleUpdate || EMPTY_DISPLAY,
      },
      {
        key: 'creator',
        label: t('detail.creator'),
        value: book.createdBy || EMPTY_DISPLAY,
      },
      {
        key: 'createTime',
        label: t('detail.createTime'),
        value: formatTs(book.createTime),
      },
    ];
  }, [book, t]);

  const matrixColumns = React.useMemo<ColumnDef<PostingEvent>[]>(
    () => [
      {
        id: 'sourceEventType',
        header: t('detail.sourceEventType'),
        cell: ({ row }) => {
          const key = getSourceEventTypeMessageKey(row.original.eventType);
          return (
            <span>
              {key ? t(key) : row.original.eventCode || EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        accessorKey: 'eventCode',
        header: t('detail.eventCode'),
        cell: ({ row }) => (
          <span>{row.original.eventCode || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'versionId',
        header: t('detail.versionId'),
        cell: ({ row }) => (
          <span>{row.original.versionId || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'entryDirection',
        header: t('detail.entryDirection'),
        cell: ({ row }) => {
          const lines = resolveEntryLines(row.original);
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
        header: t('detail.effectiveDate'),
        cell: ({ row }) => <span>{formatTs(row.original.effectiveDate)}</span>,
      },
      {
        id: 'updateTime',
        header: t('detail.updateTime'),
        cell: ({ row }) => <span>{formatTs(row.original.updateTime)}</span>,
      },
      {
        id: 'status',
        header: t('field.status'),
        cell: ({ row }) => <PostingStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => (
          <div className="flex gap-3">
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/posting-engine/edit?id=${row.original.postingEventId ?? ''}`
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
                  `/posting-engine/view?id=${row.original.postingEventId ?? ''}`
                )
              }
            >
              {t('action.view')}
            </Button>
          </div>
        ),
      },
    ],
    [t, router]
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
      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value={BASIC_TAB}>
            {t('detail.basicInformation')}
          </TabsTrigger>
          <TabsTrigger value={MATRIX_TAB}>
            {t('detail.postingEngineMatrix')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={BASIC_TAB}>
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
                        <td className="break-all border px-4 py-3">{row.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value={MATRIX_TAB}>
          <section className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('detail.postingEngineMatrix')}
            </div>
            <div className="p-4">
              <DataTable
                columns={matrixColumns}
                data={events}
                isLoading={eventList.isLoading || eventList.isFetching}
                emptyMessage={t('empty')}
                pagination={{
                  page: matrixPage.pageNum,
                  pageSize: matrixPage.pageSize,
                  total: eventsTotal,
                  onPageChange: (page) =>
                    setMatrixPage((prev) => ({ ...prev, pageNum: page })),
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
    </div>
  );
}
