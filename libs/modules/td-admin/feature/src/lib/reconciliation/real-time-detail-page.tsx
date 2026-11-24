'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import { type TxReconDetailRespVo, useTokenBasicDetailQuery, useTxInvestigationListQuery } from '@myorg/modules/td-admin/data-access';
import { resolveDetailTab } from './reconciliation.helpers';
import { RealTimeAccess } from './real-time/access';
import { RealTimeBasicInfo } from './real-time/basic-info';
import { TransactionTab } from './real-time/transaction-tab';
import { PostToSuspenseModal } from './real-time/post-to-suspense-modal';
import { RealTimeReconLogModal } from './real-time/recon-log-modal';
import { subtractAmounts } from './real-time/format';
import { chainCount, financeCount } from './real-time/transaction-columns';

export function RealTimeDetailPage() {
  const search = useSearchParams();
  const tokenId = Number(search.get('tokenId') ?? search.get('id'));
  const tab = resolveDetailTab(search.get('tab'));
  return (
    <RealTimeAccess>
      <TokenDetail key={`${tokenId}-${tab}`} tokenId={tokenId} initialTab={tab} />
    </RealTimeAccess>
  );
}

function TokenDetail({ tokenId, initialTab }: { tokenId: number; initialTab: 'list' | 'investigation' }) {
  const t = useTranslations('modules.reconciliation');
  const router = useRouter();
  const hasToken = Number.isSafeInteger(tokenId) && tokenId > 0;
  const basic = useTokenBasicDetailQuery(tokenId, hasToken);
  const info = basic.data;
  const badge = useTxInvestigationListQuery({ pageNum: 1, pageSize: 1, filters: { tokenId } },
    hasToken && !basic.isLoading && info?.unmatchedCount == null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [modal, setModal] = useState<{ row: TxReconDetailRespVo; kind: 'post' | 'log' }>();
  const currency = modal?.row.currencyCode ?? info?.currencySymbol;
  const posted = modal?.kind === 'post' ? modal.row : undefined;
  const postedCount = posted ? chainCount(posted) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title={t('reconciliation_0072')} backLabel={t('PUB_GoBack')} onBack={() => router.back()} />
      {!hasToken ? <p role="alert" className="text-destructive">{t('realTimeLoadError')}</p> : (
        <>
          <RealTimeBasicInfo info={info} loading={basic.isLoading} error={basic.isError} />
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(resolveDetailTab(value))}>
            <TabsList>
              <TabsTrigger value="list">{t('reconciliation_0143')}</TabsTrigger>
              <TabsTrigger value="investigation">
                {t('reconciliation_0144')} ({info?.unmatchedCount ?? badge.data?.page?.total ?? 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent forceMount value="list" className="data-[state=inactive]:hidden">
              <TransactionTab tab="list" active={activeTab === 'list'} tokenId={tokenId} info={info} onOpen={setModal} />
            </TabsContent>
            <TabsContent forceMount value="investigation" className="data-[state=inactive]:hidden">
              <TransactionTab tab="investigation" active={activeTab === 'investigation'} tokenId={tokenId} info={info} onOpen={setModal} />
            </TabsContent>
          </Tabs>
          <PostToSuspenseModal open={modal?.kind === 'post'} reconciliationTxId={posted?.reconciliationTxId}
            unmatchedType={posted?.unmatchedType}
            postedAmount={posted && { amount: posted.chainAmount, count: postedCount, currency, tokenSymbol: posted.tokenSymbol }}
            mismatchedAmount={posted && {
              amount: subtractAmounts(posted.chainAmount, posted.financeAmount),
              count: subtractAmounts(postedCount, financeCount(posted)), currency, tokenSymbol: posted.tokenSymbol,
            }}
            onOpenChange={(open) => { if (!open) setModal(undefined); }} />
          <RealTimeReconLogModal open={modal?.kind === 'log'} reconciliationTxId={modal?.row.reconciliationTxId}
            onOpenChange={(open) => { if (!open) setModal(undefined); }} />
        </>
      )}
    </div>
  );
}
