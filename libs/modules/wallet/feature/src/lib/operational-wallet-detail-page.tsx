'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
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
  useOperationalOpRecordQuery,
  useOperationalTxQuery,
  useOperationalWalletDetailQuery,
  type OperationalOpRecord,
  type OperationalTx,
} from '@myorg/modules/wallet/data-access';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  accountTypeMessageKey,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  feeTypeMessageKey,
  operateTypeMessageKey,
  toMillis,
} from '@myorg/modules/wallet/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const BASIC_TAB = 'basic-information';
const TX_TAB = 'transactions';
const OP_RECORD_TAB = 'operation-records';

/** 将 query 值解析为正整数，非法返回 `undefined`。 */
function parseId(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 时间戳格式化（秒/毫秒自适应），无值返回占位。 */
function formatTs(ts?: number | string | null): string {
  const ms = toMillis(typeof ts === 'string' ? Number(ts) : ts);
  return ms ? formatDate(ms, DATETIME_FMT) : EMPTY_DISPLAY;
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

/**
 * OperationalWalletDetailPage — 营运钱包详情页（3 tab）。
 *
 * 迁移自 td-manage `src/pages/wallet/operational-wallet/view.tsx`（293 行）。
 * query：`ruleWalletId`（详情/交易/操作记录三接口共用）、`walletAddress`（操作记录透传）。
 * tab：Basic Information（kv）+ Transaction Records（DataTable 分页）+
 * Operation Records（DataTable 分页，含状态列 WalletStatusBadge）。
 *
 * 路由：/wallet/operational-wallet/view?ruleWalletId=&walletAddress=
 */
export function OperationalWalletDetailPage() {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const searchParams = useSearchParams();
  const ruleWalletId = parseId(searchParams.get('ruleWalletId'));
  const walletAddress = searchParams.get('walletAddress') ?? '';

  const { data: detail, isLoading } = useOperationalWalletDetailQuery(
    ruleWalletId
  );

  const [txPage, setTxPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const txList = useOperationalTxQuery(ruleWalletId, txPage);
  const txRows = txList.data?.rows ?? [];
  const txTotal = txList.data?.page?.total ?? 0;

  const [opPage, setOpPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const opRecordList = useOperationalOpRecordQuery(
    { ruleWalletId: ruleWalletId as number, walletAddress },
    opPage
  );
  const opRows = opRecordList.data?.rows ?? [];
  const opTotal = opRecordList.data?.page?.total ?? 0;

  const basicRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    const feeTypeKey = feeTypeMessageKey(detail.feeType);
    const accountTypeKey = accountTypeMessageKey(detail.accountType);
    return [
      {
        key: 'walletAddress',
        label: t('operationalWallet.field.walletAddress'),
        value: (
          <CopyableEllipsisText
            value={detail.walletAddress ?? ''}
            copyLabel={t('operationalWallet.copy')}
          />
        ),
      },
      {
        key: 'feeType',
        label: t('operationalWallet.column.feeType'),
        value: feeTypeKey ? t(feeTypeKey as never) : EMPTY_DISPLAY,
      },
      {
        key: 'accountType',
        label: t('operationalWallet.column.accountType'),
        value: accountTypeKey ? t(accountTypeKey as never) : EMPTY_DISPLAY,
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
        value: formatTs(detail.createTime),
      },
      {
        key: 'state',
        label: t('common.status'),
        value: <WalletStatusBadge family="operational-wallet" status={detail.state} />,
      },
    ];
  }, [detail, t]);

  const txColumns = React.useMemo<ColumnDef<OperationalTx>[]>(
    () => [
      {
        accessorKey: 'txFrom',
        header: t('operationalWallet.column.txFrom'),
        cell: ({ row }) => (
          <span>{row.original.txFrom || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'txTo',
        header: t('operationalWallet.column.txTo'),
        cell: ({ row }) => <span>{row.original.txTo || EMPTY_DISPLAY}</span>,
      },
      {
        accessorKey: 'blockchainName',
        header: t('operationalWallet.column.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'txType',
        header: t('operationalWallet.column.txType'),
        cell: ({ row }) => {
          const key = feeTypeMessageKey(
            typeof row.original.txType === 'string'
              ? Number(row.original.txType)
              : row.original.txType
          );
          return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        id: 'txAmount',
        header: t('operationalWallet.column.txAmount'),
        cell: ({ row }) => (
          <span>
            {row.original.txAmount != null
              ? `${row.original.txAmount} ${row.original.symbol ?? ''}`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'txTime',
        header: t('operationalWallet.column.txTime'),
        cell: ({ row }) => <span>{formatTs(row.original.txTime)}</span>,
      },
      {
        accessorKey: 'txHash',
        header: t('operationalWallet.column.txHash'),
        cell: ({ row }) => (
          <span className="break-all">{row.original.txHash || EMPTY_DISPLAY}</span>
        ),
      },
    ],
    [t]
  );

  const opColumns = React.useMemo<ColumnDef<OperationalOpRecord>[]>(
    () => [
      {
        id: 'operateType',
        header: t('operationalWallet.column.operateType'),
        cell: ({ row }) => {
          const key = operateTypeMessageKey(row.original.operateType);
          return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'oldWalletAddress',
        header: t('operationalWallet.column.oldWalletAddress'),
        cell: ({ row }) => (
          <span>{row.original.oldWalletAddress || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'walletAddress',
        header: t('operationalWallet.column.walletAddress'),
        cell: ({ row }) => (
          <span className="break-all">
            {row.original.walletAddress || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('operationalWallet.column.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createUser',
        header: t('operationalWallet.field.creator'),
        cell: ({ row }) => (
          <span>{row.original.createUser || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'createTime',
        header: t('operationalWallet.column.createTime'),
        cell: ({ row }) => <span>{formatTs(row.original.createTime)}</span>,
      },
      {
        accessorKey: 'txHash',
        header: t('operationalWallet.column.txHash'),
        cell: ({ row }) => (
          <span className="break-all">{row.original.txHash || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'txTime',
        header: t('operationalWallet.column.txTime'),
        cell: ({ row }) => <span>{formatTs(row.original.txTime)}</span>,
      },
      {
        id: 'operationStatus',
        header: t('common.status'),
        cell: ({ row }) => (
          <WalletStatusBadge
            family="operational-wallet"
            status={row.original.operationStatus}
          />
        ),
      },
    ],
    [t]
  );

  if (!ruleWalletId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {t('operationalWallet.invalidId')}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          <section className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('operationalWallet.tab.basicInformation')}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <tbody>
                  {isLoading || !basicRows.length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground">
                        {isLoading ? '' : t('common.noData')}
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
        </TabsContent>

        <TabsContent value={TX_TAB}>
          <section className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('operationalWallet.tab.transactions')}
            </div>
            <div className="p-4">
              <DataTable
                columns={txColumns}
                data={txRows}
                isLoading={txList.isLoading || txList.isFetching}
                emptyMessage={t('common.noData')}
                pagination={{
                  page: txPage.pageNum,
                  pageSize: txPage.pageSize,
                  total: txTotal,
                  onPageChange: (page) =>
                    setTxPage((prev) => ({ ...prev, pageNum: page })),
                }}
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value={OP_RECORD_TAB}>
          <section className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('operationalWallet.tab.operationRecords')}
            </div>
            <div className="p-4">
              <DataTable
                columns={opColumns}
                data={opRows}
                isLoading={opRecordList.isLoading || opRecordList.isFetching}
                emptyMessage={t('common.noData')}
                pagination={{
                  page: opPage.pageNum,
                  pageSize: opPage.pageSize,
                  total: opTotal,
                  onPageChange: (page) =>
                    setOpPage((prev) => ({ ...prev, pageNum: page })),
                }}
              />
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  );
}
