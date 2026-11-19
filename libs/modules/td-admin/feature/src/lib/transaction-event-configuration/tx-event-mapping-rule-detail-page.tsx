'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  Card,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { useNormalizationDetailQuery } from '@myorg/modules/td-admin/data-access';
import { TxEventBasicInfoTab } from './tx-event-basic-info-tab';
import { TxEventHistoricalRecordsTab } from './tx-event-historical-records-tab';

const BASIC_TAB = 'basic-information';
const HISTORY_TAB = 'historical-records';

/** 将 query 值解析为正整数，非法返回 `undefined`。 */
function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

/**
 * TxEventMappingRuleDetailPage — Mapping Rule 详情页（2 tab 容器）。
 *
 * 迁移自 td-manage `mapping-rule/detail.tsx`（133 行）。
 * Basic Information（规则元信息 + 字段映射明细）+ Historical Records（历史记录 + 审批跳转）。
 */
export function TxEventMappingRuleDetailPage() {
  const t = useTranslations('modules.transaction-event-configuration');
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizationEventId = parseId(searchParams.get('id'));
  const bookId = searchParams.get('bookId') ?? '';

  const [activeTab, setActiveTab] = React.useState(BASIC_TAB);
  const { data: detail, isLoading, error } =
    useNormalizationDetailQuery(normalizationEventId);

  if (!normalizationEventId) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('mappingRuleDetail')} backLabel={t('action.back')} onBack={() => router.back()} />
        <Card className="p-6"><p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('mappingRuleDetail')} backLabel={t('action.back')} onBack={() => router.back()} />
      {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value={BASIC_TAB}>
            {t('detail.basicInformation')}
          </TabsTrigger>
          <TabsTrigger value={HISTORY_TAB}>
            {t('detail.historicalRecords')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={BASIC_TAB}>
          <TxEventBasicInfoTab
            detail={detail ?? null}
            loading={isLoading}
            bookId={bookId}
          />
        </TabsContent>
        <TabsContent value={HISTORY_TAB}>
          {activeTab === HISTORY_TAB && !isLoading && (
            <TxEventHistoricalRecordsTab
              normalizationEventId={normalizationEventId}
              eventType={detail?.eventType}
              bookId={bookId}
              active
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
