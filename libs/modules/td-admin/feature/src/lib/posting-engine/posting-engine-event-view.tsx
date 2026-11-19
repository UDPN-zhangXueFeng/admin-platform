'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, CopyableEllipsisText, DataTable, DetailField, DetailGrid, DetailSection, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import { usePostingEventDetailQuery, type PostingEvent } from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import { PostingEngineHistory } from './posting-engine-history';
import { PostingStatusBadge } from './posting-status-badge';
import { PostingEventFields } from './posting-information';
import { formatPostingDate } from './posting-engine-dates';
import {
  DEFAULT_AMOUNT_EXPRESSION, EMPTY_DISPLAY, POSTING_ENGINE_PATH, parsePostingId, getSourceEventTypeMessageKey,
  directionLabel, formatAccountLabel, mappingMethodMessageKey, resolveTokenTypeMessageKey, toMillis,
} from './posting-engine.constants';

const BASIC_TAB = 'basic-information';
const HISTORY_TAB = 'version-history';

export function PostingEngineEventView({ postingEventIdRaw, initialTab }: {
  postingEventIdRaw?: string | null;
  initialTab?: string | null;
}) {
  const t = useTranslations('modules.posting-engine');
  const router = useRouter();
  const id = parsePostingId(postingEventIdRaw);
  const activeTab = initialTab === HISTORY_TAB ? HISTORY_TAB : BASIC_TAB;
  const { data: event, isLoading, isError } = usePostingEventDetailQuery(id);

  return (
    <div className="space-y-4">
      <PageHeader backLabel={t('action.back')} onBack={() => router.back()} title={t('detail.eventTitle')} />
      {!id ? <Card className="p-6">{t('detail.invalidId')}</Card> : (
        <Tabs value={activeTab} onValueChange={(tab) => router.replace(`${POSTING_ENGINE_PATH}/view?id=${id}&tab=${tab}`, { scroll: false })}>
          <TabsList>
            <TabsTrigger value={BASIC_TAB}>{t('detail.basicInformation')}</TabsTrigger>
            <TabsTrigger value={HISTORY_TAB}>{t('detail.versionHistory')}</TabsTrigger>
          </TabsList>
          <TabsContent value={BASIC_TAB}>
            {event ? (
              <EventBasicInformation event={event} />
            ) : (
              <DetailSection
                title={t('detail.basicInformation')}
                loading={isLoading}
                skeleton="fields"
              >
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
              </DetailSection>
            )}
          </TabsContent>
          <TabsContent value={HISTORY_TAB}>
            <PostingEngineHistory key={id} postingEventId={id} tokenType={event?.tokenType} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EventBasicInformation({ event }: { event: PostingEvent }) {
  const t = useTranslations('modules.posting-engine');
  const source = event.sourceEventType || event.eventType;
  const sourceKey = getSourceEventTypeMessageKey(source, event.tokenType);
  const tokenTypeKey = resolveTokenTypeMessageKey(event.tokenType);
  const copy = (value?: string) => <CopyableEllipsisText value={value} copyLabel={t('copy')} showCopyIcon />;
  const fields = (event.normalizedTargetFields ?? [])
    .map(({ targetField, sourceField }) => targetField || sourceField)
    .filter((value): value is string => Boolean(value));

  const mappings = (event.mappings ?? []).slice().sort((a, b) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.direction ?? 0) - (b.direction ?? 0)
  );

  interface EntryTemplateRow {
    id: string;
    drCr: string;
    account: string;
    method: string;
    value: string;
  }

  const entryRows: EntryTemplateRow[] = mappings.map((mapping, index) => {
    const methodKey = mappingMethodMessageKey(mapping.mappingMethod);
    return {
      id: String(index),
      drCr: directionLabel(mapping.direction) || EMPTY_DISPLAY,
      account:
        formatAccountLabel(mapping.accountCode, mapping.accountName) ||
        EMPTY_DISPLAY,
      method: methodKey ? t(methodKey) : EMPTY_DISPLAY,
      value: mapping.amountExpression || DEFAULT_AMOUNT_EXPRESSION,
    };
  });

  const entryColumns: ColumnDef<EntryTemplateRow>[] = [
    { accessorKey: 'drCr', header: t('edit.drCr') },
    { accessorKey: 'account', header: t('edit.account') },
    { accessorKey: 'method', header: t('edit.method') },
    { accessorKey: 'value', header: t('edit.value') },
  ];

  return (
    <div className="space-y-4">
      <DetailSection title={t('detail.basicInformation')}>
        <DetailGrid>
          <DetailField
            label={t('detail.eventCode')}
            value={
              <CopyableEllipsisText
                value={event.eventCode}
                copyLabel={t('copy')}
                maxWidth={480}
              />
            }
          />
          <DetailField
            label={t('field.status')}
            value={
              <PostingStatusBadge
                status={event.status}
                statusName={event.statusName}
              />
            }
          />
          <DetailField
            label={t('detail.sourceEventType')}
            value={
              event.eventTypeName ||
              (sourceKey ? t(sourceKey) : source ?? EMPTY_DISPLAY)
            }
          />
          <DetailField
            label={t('field.bookName')}
            value={event.bookName || event.financialBookName}
          />
          <DetailField
            label={t('field.bookNo')}
            value={
              <CopyableEllipsisText
                value={event.bookNo || event.bookId}
                copyLabel={t('copy')}
                maxWidth={320}
              />
            }
          />
          <DetailField
            label={t('field.currency')}
            value={event.currencyCode || event.accountCurrency}
          />
          <DetailField
            label={t('detail.reserveAsset')}
            value={event.reserveAssetName}
          />
          <DetailField
            label={t('field.tokenType')}
            value={tokenTypeKey ? t(tokenTypeKey) : event.tokenType}
          />
          <DetailField
            label={t('detail.creator')}
            value={event.createdBy}
            muted
          />
          <DetailField
            label={t('versionHistory.createdOn')}
            value={formatAdminTimestamp(toMillis(event.createTime))}
            muted
          />
        </DetailGrid>
      </DetailSection>
      <PostingEventFields title={t('detail.transactionEventFields')} fields={fields} emptyMessage={t('empty')} />
      <DetailSection title={t('detail.entryTemplate')}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-muted-foreground">
                {t('detail.versionId')}
              </span>
              {copy(event.versionId)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {t('detail.effectiveDate')}
              </span>
              <span className="font-medium tabular-nums">
                {formatPostingDate(event.effectiveDate)}
              </span>
            </div>
          </div>
          <DataTable
            columns={entryColumns}
            data={entryRows}
            emptyMessage={t('empty')}
          />
        </div>
      </DetailSection>
    </div>
  );
}
