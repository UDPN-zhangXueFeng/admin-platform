'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import {
  Card,
  CopyableEllipsisText,
  DataTable,
  DetailField,
  DetailGrid,
  DetailSection,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { formatAdminTimestamp } from '../format-admin-time';
import { formatPostingDate } from './posting-engine-dates';
import {
  usePostingBookDetailQuery,
  usePostingEventListQuery,
  type PostingEvent,
} from '@myorg/modules/td-admin/data-access';
import { PostingStatusBadge } from '.';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  POSTING_ENGINE_PATH,
  paginationRange,
  parsePostingId,
  directionLabel,
  formatAccountLabel,
  getSourceEventTypeMessageKey,
  resolveTokenTypeMessageKey,
  splitEntryDirection,
  toMillis,
} from '.';
import { createRowActionsColumn } from '../row-actions';

const BASIC_TAB = 'basic-information';
const MATRIX_TAB = 'posting-engine-matrix';


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
  const financeBookId = parsePostingId(financeBookIdRaw);
  const activeTab = initialTab === MATRIX_TAB ? MATRIX_TAB : BASIC_TAB;
  const { data: book, isLoading, isError } = usePostingBookDetailQuery(financeBookId);

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
    Boolean(book) && activeTab === MATRIX_TAB
  );
  const events = eventList.isError ? [] : eventList.data?.rows ?? [];
  const eventsTotal = eventList.isError ? 0 : eventList.data?.page?.total ?? 0;
  const tokenTypeKey = resolveTokenTypeMessageKey(book?.tokenType);
  const tokenNames = book?.tokens
    ?.map((token) => token.tokenName?.trim())
    .filter(Boolean)
    .join(', ');

  const matrixColumns = React.useMemo<ColumnDef<PostingEvent>[]>(
    () => [
      {
        id: 'sourceEventType',
        header: t('detail.sourceEventType'),
        cell: ({ row }) => {
          const event = row.original;
          const source = event.sourceEventType || event.eventType;
          const key = getSourceEventTypeMessageKey(source, event.tokenType ?? book?.tokenType);
          return event.eventTypeName || (key ? t(key) : source ?? EMPTY_DISPLAY);
        },
      },
      {
        accessorKey: 'eventCode',
        header: t('detail.eventCode'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.eventCode} copyLabel={t('copy')} showCopyIcon />
        ),
      },
      {
        accessorKey: 'versionId',
        header: t('detail.versionId'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.versionId} copyLabel={t('copy')} showCopyIcon />
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
        cell: ({ row }) => formatPostingDate(row.original.effectiveDate),
      },
      {
        id: 'updateTime',
        header: t('detail.updateTime'),
        cell: ({ row }) => formatAdminTimestamp(toMillis(row.original.updateTime)),
      },
      {
        id: 'status',
        header: t('field.status'),
        cell: ({ row }) => <PostingStatusBadge status={row.original.status} scope="matrix" />,
      },
      createRowActionsColumn<PostingEvent>({
        header: t('field.actions'),
        detail: (row) => row.postingEventId ? {
          label: t('action.detail'),
          onClick: () => router.push(`${POSTING_ENGINE_PATH}/view?id=${row.postingEventId}`),
        } : undefined,
        menu: (row) => row.postingEventId ? [{
          label: t('action.edit'),
          onClick: () => router.push(`${POSTING_ENGINE_PATH}/edit?id=${row.postingEventId}`),
        }] : [],
      }),
    ],
    [t, router, book?.tokenType]
  );

  if (!financeBookId) {
    return (
      <div className="space-y-4">
        <PageHeader
          backLabel={t('action.back')}
          onBack={() => router.back()}
          title={t('detail.bookTitle')}
        />
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            {t('detail.invalidId')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backLabel={t('action.back')}
        onBack={() => router.back()}
        title={t('detail.bookTitle')}
      />
      <Tabs value={activeTab} onValueChange={(tab) => {
        setMatrixPage({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
        router.replace(`${POSTING_ENGINE_PATH}/book?id=${financeBookId}&tab=${tab}`, { scroll: false });
      }}>
        <TabsList>
          <TabsTrigger value={BASIC_TAB}>
            {t('detail.basicInformation')}
          </TabsTrigger>
          <TabsTrigger value={MATRIX_TAB}>
            {t('detail.postingEngineMatrix')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={BASIC_TAB}>
          <DetailSection
            title={t('detail.basicInformation')}
            loading={isLoading}
            skeleton="fields"
          >
            {book ? (
              <DetailGrid>
                <DetailField
                  label={t('field.bookName')}
                  value={book.bookName}
                />
                <DetailField
                  label={t('field.status')}
                  value={
                    <PostingStatusBadge
                      status={book.status}
                      statusName={book.statusName}
                      scope="book"
                    />
                  }
                />
                <DetailField
                  label={t('field.bookNo')}
                  value={
                    <CopyableEllipsisText
                      value={book.bookNo}
                      copyLabel={t('copy')}
                      maxWidth={320}
                    />
                  }
                />
                <DetailField
                  label={t('detail.reserveAsset')}
                  value={book.reserveAssetName}
                />
                <DetailField
                  label={t('field.currency')}
                  value={book.currencyCode}
                />
                <DetailField
                  label={t('field.tokenType')}
                  value={tokenTypeKey ? t(tokenTypeKey) : undefined}
                />
                <DetailField
                  label={t('detail.tokenNames')}
                  value={
                    <CopyableEllipsisText
                      value={tokenNames}
                      maxWidth={320}
                    />
                  }
                />
                <DetailField
                  label={t('field.totalEvents')}
                  value={book.totalEvents}
                />
                <DetailField
                  label={t('field.configured')}
                  value={book.configured}
                />
                <DetailField
                  label={t('field.lastRuleUpdate')}
                  value={book.lastRuleUpdate}
                />
                <DetailField
                  label={t('detail.creator')}
                  value={book.createdBy}
                  muted
                />
                <DetailField
                  label={t('detail.createTime')}
                  value={formatAdminTimestamp(toMillis(book.createTime))}
                  muted
                />
              </DetailGrid>
            ) : (
              <p
                role={isError ? 'alert' : undefined}
                className={
                  isError
                    ? 'text-sm text-destructive'
                    : 'text-sm text-muted-foreground'
                }
              >
                {t(isError ? 'loadError' : 'empty')}
              </p>
            )}
          </DetailSection>
        </TabsContent>

        <TabsContent value={MATRIX_TAB}>
          <Card>
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('detail.postingEngineMatrix')}
            </div>
            <p className="px-6 pt-3 text-sm text-muted-foreground">{t('detail.matrixDescription')}</p>
            <div className="p-4">
              <DataTable
                columns={matrixColumns}
                data={events}
                isLoading={eventList.isLoading || eventList.isFetching}
                emptyMessage={t(isError || eventList.isError ? 'loadError' : 'empty')}
                pagination={{
                  page: matrixPage.pageNum,
                  pageSize: matrixPage.pageSize,
                  total: eventsTotal,
                  onPageChange: (page) =>
                    setMatrixPage((prev) => ({ ...prev, pageNum: page })),
                  summary: t('pagination.range', paginationRange(matrixPage.pageNum, eventsTotal)),
                }}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
