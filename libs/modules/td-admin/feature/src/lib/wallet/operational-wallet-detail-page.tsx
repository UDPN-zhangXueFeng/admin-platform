'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import {
  Card,
  CopyableEllipsisText,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import {
  useOperationalOpRecordQuery,
  useOperationalTxQuery,
  useOperationalWalletDetailQuery,
  type OperationalOpRecord,
  type OperationalTx,
} from '@myorg/modules/td-admin/data-access';
import { formatOperationalWalletTime } from './wallet.helpers';
import { WalletStatusBadge } from './wallet-status-badge';
import { EMPTY_DISPLAY, OPERATIONAL_WALLET_RECORD_TONES, walletStatusToneClass } from './wallet.constants';
import { OperationalWalletLoadError, OperationalWalletTable, useOperationalWalletPage } from './operational-wallet-table';

const BASIC_TAB = 'basic-information';
const TX_TAB = 'transactions';
const OP_RECORD_TAB = 'operation-records';

/** 将 query 值解析为正整数，非法返回 `undefined`。 */
function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

/** Accept legacy id links as well as previously issued admin ruleWalletId links. */
export function OperationalWalletDetailPage() {
  const searchParams = useSearchParams();
  const idParam = parseId(searchParams.get('id'));
  const legacyParam = parseId(searchParams.get('ruleWalletId'));
  const ruleWalletId = idParam ?? legacyParam;
  const walletAddress = searchParams.get('walletAddress') ?? undefined;
  return <OperationalWalletDetail key={JSON.stringify([ruleWalletId, walletAddress])} ruleWalletId={ruleWalletId} walletAddress={walletAddress} />;
}

function OperationalWalletDetail({ ruleWalletId, walletAddress }: { ruleWalletId?: number; walletAddress?: string }) {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const detailQuery = useOperationalWalletDetailQuery(ruleWalletId);
  const { data: detail } = detailQuery;
  const txPaging = useOperationalWalletPage();
  const opPaging = useOperationalWalletPage();
  const txList = useOperationalTxQuery(ruleWalletId, txPaging.page);
  const opRecordList = useOperationalOpRecordQuery({ ruleWalletId, walletAddress }, opPaging.page);

  const basicRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    const feeTypeKey = `operationalWallet.feeType.${detail.feeType}`;
    const accountTypeKey = `operationalWallet.accountType.${detail.accountType}`;
    return [
      {
        key: 'walletAddress',
        label: t('operationalWallet.field.walletAddress'),
        value: (
          <CopyableEllipsisText
            value={detail.walletAddress ?? ''}
            copyLabel={t('operationalWallet.copy')}
            copySuccessMessage={t('operationalWallet.copySuccess')}
            copyErrorMessage={t('operationalWallet.copyFailed')}
            showCopyIcon
            maxWidth={640}
          />
        ),
      },
      {
        key: 'feeType',
        label: t('operationalWallet.column.feeType'),
        value: t.has(feeTypeKey) ? t(feeTypeKey) : EMPTY_DISPLAY,
      },
      {
        key: 'accountType',
        label: t('operationalWallet.column.accountType'),
        value: t.has(accountTypeKey) ? t(accountTypeKey) : EMPTY_DISPLAY,
      },
      {
        key: 'blockchainName',
        label: t('operationalWallet.column.blockchain'),
        value: detail.blockchainName || EMPTY_DISPLAY,
      },
      {
        key: 'createUserName',
        label: t('operationalWallet.field.creator'),
        value: detail.createUserName || EMPTY_DISPLAY,
      },
      {
        key: 'createTime',
        label: t('operationalWallet.column.createTime'),
        value: formatOperationalWalletTime(detail.createTime),
      },
      {
        key: 'state',
        label: t('common.status'),
        value: <WalletStatusBadge family="operational-wallet" status={detail.state} />,
      },
    ];
  }, [detail, t]);

  const common = useTranslations('common');
  const txColumns = React.useMemo<ColumnDef<OperationalTx>[]>(() => [
    { accessorKey: 'txFrom', header: t('operationalWallet.column.txFrom') },
    { accessorKey: 'txTo', header: t('operationalWallet.column.txTo') },
    { accessorKey: 'blockchainName', header: t('operationalWallet.column.blockchain') },
    { accessorKey: 'txType', header: t('operationalWallet.column.txType'), cell: ({ row }) => {
      const key = `operationalWallet.feeType.${row.original.txType}`;
      return t.has(key) ? t(key) : EMPTY_DISPLAY;
    } },
    { accessorKey: 'txAmount', header: t('operationalWallet.column.txAmount'), cell: ({ row }) => {
      const { txAmount, symbol } = row.original;
      return txAmount == null || txAmount === '' ? EMPTY_DISPLAY : `${txAmount} ${symbol ?? ''}`.trimEnd();
    } },
    { accessorKey: 'txTime', header: t('operationalWallet.column.txTime'), cell: ({ row }) => formatOperationalWalletTime(row.original.txTime) },
    { accessorKey: 'txHash', header: t('operationalWallet.column.txHash') },
  ], [t]);

  const opColumns = React.useMemo<ColumnDef<OperationalOpRecord>[]>(() => [
    { accessorKey: 'operateType', header: t('operationalWallet.column.operateType'), cell: ({ row }) => {
      const key = `operationalWallet.operationType.${row.original.operateType}`;
      return t.has(key) ? t(key) : EMPTY_DISPLAY;
    } },
    { accessorKey: 'oldWalletAddress', header: t('operationalWallet.column.oldWalletAddress'), cell: ({ row }) =>
      row.original.oldWalletAddress || EMPTY_DISPLAY },
    { accessorKey: 'walletAddress', header: t('operationalWallet.column.newWalletAddress') },
    { accessorKey: 'blockchainName', header: t('operationalWallet.column.blockchain') },
    { accessorKey: 'createUser', header: t('operationalWallet.field.creator') },
    { accessorKey: 'createTime', header: t('operationalWallet.column.createTime'), cell: ({ row }) => formatOperationalWalletTime(row.original.createTime) },
    { accessorKey: 'txHash', header: t('operationalWallet.column.txHash') },
    { accessorKey: 'txTime', header: t('operationalWallet.column.txTime'), cell: ({ row }) => formatOperationalWalletTime(row.original.txTime) },
    { accessorKey: 'operationStatus', header: t('common.status'), cell: ({ row }) => {
      const status = OPERATIONAL_WALLET_RECORD_TONES[Number(row.original.operationStatus)];
      if (!status) return EMPTY_DISPLAY;
      return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${walletStatusToneClass(status.tone)}`}>
        {common(status.labelKey)}
      </span>;
    } },
  ], [t, common]);

  const header = (
    <PageHeader
      backLabel={t('common.back')}
      onBack={() => router.back()}
      title={t('operationalWallet.detailTitle')}
    />
  );

  if (!ruleWalletId) {
    return (
      <div className="space-y-4">
        {header}
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            {t('operationalWallet.invalidId')}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <Tabs defaultValue={BASIC_TAB}>
        <TabsList>
          <TabsTrigger value={BASIC_TAB}>
            {t('operationalWallet.tab.basicInformation')}
          </TabsTrigger>
          <TabsTrigger value={TX_TAB}>
            {t('operationalWallet.tab.transactions')}
          </TabsTrigger>
          <TabsTrigger value={OP_RECORD_TAB}>
            {t('operationalWallet.tab.operationRecords')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={BASIC_TAB}>
          <Card>
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('operationalWallet.tab.basicInformation')}
            </div>
            {detailQuery.isError && !detailQuery.isFetching ? <OperationalWalletLoadError retry={detailQuery.refetch} /> : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <tbody>
                  {detailQuery.isPending || !basicRows.length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground">
                        {detailQuery.isPending ? t('loading') : t('common.noData')}
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
            )}
          </Card>
        </TabsContent>

        <TabsContent value={TX_TAB}>
          <OperationalWalletTable title={t('operationalWallet.tab.transactions')} columns={txColumns} query={txList} paging={txPaging} />
        </TabsContent>

        <TabsContent value={OP_RECORD_TAB}>
          <OperationalWalletTable title={t('operationalWallet.tab.operationRecords')} columns={opColumns} query={opRecordList} paging={opPaging} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
