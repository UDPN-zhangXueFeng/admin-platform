'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CopyableEllipsisText, Tabs, TabsContent, TabsList, TabsTrigger } from '@myorg/shared/ui';
import { useUserWalletDetailQuery, type UserWalletDetail } from '@myorg/modules/td-admin/data-access';
import { UserWalletAccrual, UserWalletDistribution, UserWalletOperations, UserWalletTransactions } from './user-wallet-detail-records';
import { amountWithSymbol, walletLimit, walletTime } from './user-wallet-rules';
import { WalletLoadError } from './user-wallet-table';
import { WalletStatusBadge } from './wallet-status-badge';
import { custodyModelMessageKey, EMPTY_DISPLAY } from './wallet.constants';
import { resolveWalletViewTabKey } from './wallet.helpers';

export function UserWalletDetailViewContent({ walletId }: { walletId: number }) {
  const query = useUserWalletDetailQuery(walletId);
  const tab = resolveWalletViewTabKey(useSearchParams().get('tab'));
  const t = useTranslations('modules.wallet');
  if (query.isError) return <Card><WalletLoadError retry={query.refetch} /></Card>;
  if (query.isPending) return <Card className="p-4"><p role="status">{t('loading')}</p></Card>;
  if (!query.data) return <Card className="p-4">{t('common.noData')}</Card>;
  return <WalletView key={tab} detail={query.data} walletId={walletId} initialTab={tab} />;
}

function WalletView({ walletId, detail, initialTab }: {
  walletId: number;
  detail: UserWalletDetail;
  initialTab: string;
}) {
  const t = useTranslations('modules.wallet');
  const [tab, setTab] = useState(initialTab);
  const showAccrual = detail.tokenType === 5;
  const showDistribution = detail.tokenType === 20;
  const active = (tab === 'accrual' && !showAccrual) || (tab === 'distribution' && !showDistribution) ? 'basic' : tab;
  return (
    <Tabs value={active} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="basic">{t('userWallet.tab.basic')}</TabsTrigger>
        <TabsTrigger value="transactions">{t('userWallet.tab.transactions')}</TabsTrigger>
        <TabsTrigger value="operations">{t('userWallet.tab.operations')}</TabsTrigger>
        {showAccrual && <TabsTrigger value="accrual">{t('userWallet.tab.accrual')}</TabsTrigger>}
        {showDistribution && <TabsTrigger value="distribution">{t('userWallet.tab.distribution')}</TabsTrigger>}
      </TabsList>
      <TabsContent value="basic"><WalletBasic detail={detail} /></TabsContent>
      <TabsContent value="transactions"><UserWalletTransactions walletId={walletId} /></TabsContent>
      <TabsContent value="operations"><UserWalletOperations walletId={walletId} /></TabsContent>
      {showAccrual && <TabsContent value="accrual"><UserWalletAccrual walletId={walletId} /></TabsContent>}
      {showDistribution && <TabsContent value="distribution" className="space-y-4">
        <WalletFields title={t('userWallet.section.distributionDetails')} rows={[
          [t('userWallet.section.fundName'), detail.fundName],
          [t('userWallet.section.fundAssetValue'), amountWithSymbol(detail.fundAssetValue, detail.fundAssetCurrency, false)],
          [t('userWallet.section.dividendMethod'), detail.dividendMethod],
        ]} />
        <UserWalletDistribution walletId={walletId} />
      </TabsContent>}
    </Tabs>
  );
}

function WalletBasic({ detail }: { detail: UserWalletDetail }) {
  const t = useTranslations('modules.wallet');
  const custody = custodyModelMessageKey(detail.custodyModel);
  const kyc = detail.kycRequired === 1 ? 'kyc.yes' : detail.kycRequired === 0 ? 'kyc.no' : undefined;
  const token = `tokenType.${detail.tokenType}`;
  return (
    <div className="space-y-4">
      <WalletFields title={t('userWallet.section.basicDetails')} multiColumn rows={[
        [t('userWallet.column.walletAddress'), <CopyableEllipsisText value={detail.walletAddress} copyLabel={t('userWallet.copy')} />],
        [t('userWallet.column.sp'), detail.spName],
        [t('userWallet.column.tokenType'), t.has(token) ? t(token) : detail.tokenType],
        [t('userWallet.column.tokenName'), detail.tdName],
        [t('userWallet.column.blockchain'), detail.blockchainName],
        [t('userWallet.column.walletType'), detail.walletType],
        [t('userWallet.column.custodyModel'), custody && t(custody)],
        [t('userWallet.field.kycStatus'), kyc && <span className={detail.kycRequired === 1 ? 'rounded bg-destructive/10 px-2 py-1 text-destructive' : 'rounded bg-muted px-2 py-1'}>{t(kyc)}</span>],
        [t('userWallet.field.maxTxCountDaily'), walletLimit(detail.maxTxCountDaily, detail.symbol)],
        [t('userWallet.field.maxTxCountPer'), walletLimit(detail.maxTxCountPer, detail.symbol)],
        [t('userWallet.field.stablecoinLimitCount'), walletLimit(detail.stablecoinLimitCount, detail.symbol)],
        [t('common.createTime'), walletTime(detail.createTime)],
        [t('userWallet.field.withdrawTime'), walletTime(detail.withDrawTime)],
        [t('userWallet.field.walletStatus'), <WalletStatusBadge family="user-wallet" status={detail.state} />],
      ]} />
      <WalletFields title={t('userWallet.section.kycDetails')} rows={[
        [t('userWallet.section.lastVerified'), t('userWallet.notAvailable')],
        [t('userWallet.section.verifiableCredential'), t('userWallet.notAvailable')],
      ]} />
    </div>
  );
}

function WalletFields({ title, rows, multiColumn }: {
  title: string;
  rows: [string, ReactNode][];
  multiColumn?: boolean;
}) {
  return (
    <Card>
      <h2 className="border-b px-6 py-3 text-sm font-semibold">{title}</h2>
      <dl className={multiColumn ? 'grid md:grid-cols-2 xl:grid-cols-3' : undefined}>
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(8rem,38%)_minmax(0,1fr)] border-b text-sm">
            <dt className="bg-muted/30 px-4 py-3 font-medium">{label}</dt>
            <dd className="break-words px-4 py-3">{value ?? EMPTY_DISPLAY}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
