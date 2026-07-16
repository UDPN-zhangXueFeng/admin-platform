'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { useNormalizationDetailQuery } from '@myorg/modules/transaction-event-configuration/data-access';
import { TxEventBasicInfoTab } from './tx-event-basic-info-tab';
import { TxEventHistoricalRecordsTab } from './tx-event-historical-records-tab';

const BASIC_TAB = 'basic-information';
const HISTORY_TAB = 'historical-records';

/** 将 query 值解析为正整数，非法返回 `undefined`。 */
function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
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
  const { data: detail, isLoading } =
    useNormalizationDetailQuery(normalizationEventId);

  if (!normalizationEventId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          {t('action.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            onBack={() => router.back()}
          />
        </TabsContent>
        <TabsContent value={HISTORY_TAB}>
          <TxEventHistoricalRecordsTab
            normalizationEventId={normalizationEventId}
            eventType={detail?.eventType}
            bookId={bookId}
            active={activeTab === HISTORY_TAB}
            onBack={() => router.back()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
