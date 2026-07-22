'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import {
  CopyableEllipsisText,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useUserAccrualQuery,
  useUserDistributeQuery,
  useUserOpRecordQuery,
  useUserTxQuery,
  useUserWalletDetailQuery,
  type AccrualRecord,
  type DistributeRecord,
  type UserOpRecord,
  type UserTx,
  type UserWalletDetail,
} from '@myorg/modules/wallet/data-access';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  custodyModelMessageKey,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  formatLimit,
  kycMessageKey,
  resolveWalletViewTabKey,
  toMillis,
  USER_WALLET_VIEW_TAB,
} from '@myorg/modules/wallet/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FMT = 'YYYY-MM-DD';

function formatTs(ts?: number | string | null, fmt = DATETIME_FMT): string {
  const ms = toMillis(typeof ts === 'string' ? Number(ts) : ts);
  return ms ? formatDate(ms, fmt) : EMPTY_DISPLAY;
}

/** 限额展示：附 symbol（迁移自源 view basicInfoItems.formatLimit）。 */
function formatLimitWithSymbol(
  value: number | string | undefined,
  symbol?: string
): string {
  if (value === undefined || value === null) return EMPTY_DISPLAY;
  const base = formatLimit(Number(value));
  if (!base) return EMPTY_DISPLAY;
  return symbol ? `${base} ${symbol}` : base;
}

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

interface TxPage {
  pageNum: number;
  pageSize: number;
}

/**
 * UserWalletDetailViewContent — 用户钱包详情 view 变体（5 条件 tab）。
 *
 * 迁移自 td-manage `src/pages/wallet/user-wallet/view.tsx`（867 行）。
 * tab：basic(kv) + transactions + operations 必显；accrual(tokenType=5) +
 * distribute(tokenType=20) 条件显。tab key 由 `resolveWalletViewTabKey` 解析
 * query `tab` 别名（1..5 / 命名别名）。仅 detail 加载后才渲染条件 tab（tokenType
 * 已知）。详情未加载时不崩。
 *
 * 由 UserWalletDetailPage 在 slug[1]=`view` 时渲染。
 */
export function UserWalletDetailViewContent({ walletId }: { walletId: number }) {
  const t = useTranslations('modules.wallet');
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const resolvedTab = resolveWalletViewTabKey(tabParam);

  const { data: detail, isLoading } = useUserWalletDetailQuery(walletId);

  const [txPage, setTxPage] = React.useState<TxPage>({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const txList = useUserTxQuery(walletId, txPage);

  const [opPage, setOpPage] = React.useState<TxPage>({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const opRecordList = useUserOpRecordQuery(walletId, opPage);

  const [accrualPage, setAccrualPage] = React.useState<TxPage>({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const accrualList = useUserAccrualQuery(walletId, accrualPage);

  const [distributePage, setDistributePage] = React.useState<TxPage>({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const distributeList = useUserDistributeQuery(walletId, distributePage);

  const showAccrual = detail?.tokenType === 5;
  const showDistribute = detail?.tokenType === 20;

  const basicRows = React.useMemo<KvRow[]>(() => {
    if (!detail) return [];
    const custodyKey = custodyModelMessageKey(detail.custodyModel);
    const kycKey = kycMessageKey(detail.kycRequired);
    const tokenTypeKey = detail.tokenType
      ? `tokenType.${Number(detail.tokenType)}`
      : undefined;
    return [
      {
        key: 'walletAddress',
        label: t('userWallet.field.walletAddress'),
        value: (
          <CopyableEllipsisText
            value={detail.walletAddress ?? ''}
            copyLabel={t('userWallet.copy')}
          />
        ),
      },
      {
        key: 'spName',
        label: t('userWallet.field.sp'),
        value: detail.spName || EMPTY_DISPLAY,
      },
      {
        key: 'tokenType',
        label: t('userWallet.field.tokenType'),
        value: tokenTypeKey ? t(tokenTypeKey as never) : EMPTY_DISPLAY,
      },
      {
        key: 'tdName',
        label: t('userWallet.field.tdName'),
        value: detail.tdName || EMPTY_DISPLAY,
      },
      {
        key: 'blockchainName',
        label: t('userWallet.field.blockchain'),
        value: detail.blockchainName || EMPTY_DISPLAY,
      },
      {
        key: 'walletType',
        label: t('userWallet.field.walletType'),
        value: detail.walletType || EMPTY_DISPLAY,
      },
      {
        key: 'custodyModel',
        label: t('userWallet.field.custodyModel'),
        value: custodyKey ? t(custodyKey as never) : EMPTY_DISPLAY,
      },
      {
        key: 'kycStatus',
        label: t('userWallet.field.kycStatus'),
        value: kycKey ? t(kycKey as never) : EMPTY_DISPLAY,
      },
      {
        key: 'maxTxCountDaily',
        label: t('userWallet.field.maxTxCountDaily'),
        value: formatLimitWithSymbol(detail.maxTxCountDaily, detail.symbol),
      },
      {
        key: 'maxTxCountPer',
        label: t('userWallet.field.maxTxCountPer'),
        value: formatLimitWithSymbol(detail.maxTxCountPer, detail.symbol),
      },
      {
        key: 'stablecoinLimitCount',
        label: t('userWallet.field.stablecoinLimitCount'),
        value: formatLimitWithSymbol(
          detail.stablecoinLimitCount,
          detail.symbol
        ),
      },
      {
        key: 'createTime',
        label: t('userWallet.field.createTime'),
        value: formatTs(detail.createTime),
      },
      {
        key: 'withDrawTime',
        label: t('userWallet.field.withdrawTime'),
        value: formatTs(detail.withDrawTime),
      },
      {
        key: 'state',
        label: t('userWallet.field.state'),
        value: <WalletStatusBadge family="user-wallet" status={detail.state} />,
      },
    ];
  }, [detail, t]);

  const txColumns = React.useMemo<ColumnDef<UserTx>[]>(
    () => [
      {
        accessorKey: 'txFrom',
        header: t('userWallet.column.txFrom'),
        cell: ({ row }) => (
          <span className="break-all">{row.original.txFrom || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'submissionPolicy',
        header: t('userWallet.column.submissionPolicy'),
        // 源 view customTable0 该列写死 t('End User') —— 等价 submissionPolicy.direct。
        cell: () => <span>{t('userWallet.submissionPolicy.direct')}</span>,
      },
      {
        accessorKey: 'txTo',
        header: t('userWallet.column.txTo'),
        cell: ({ row }) => (
          <span className="break-all">{row.original.txTo || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('userWallet.column.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'txType',
        header: t('userWallet.column.txType'),
        cell: ({ row }) => {
          const raw = row.original.txType;
          const n = typeof raw === 'string' ? Number(raw) : raw;
          const key = n ? `tdTransactionType.${n}` : undefined;
          return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        id: 'txAmount',
        header: t('userWallet.column.txAmount'),
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
        header: t('userWallet.column.txTime'),
        cell: ({ row }) => <span>{formatTs(row.original.txTime)}</span>,
      },
      {
        accessorKey: 'txHash',
        header: t('userWallet.column.txHash'),
        cell: ({ row }) => (
          <span className="break-all">{row.original.txHash || EMPTY_DISPLAY}</span>
        ),
      },
    ],
    [t]
  );

  const opColumns = React.useMemo<ColumnDef<UserOpRecord>[]>(
    () => [
      {
        accessorKey: 'txHash',
        header: t('userWallet.column.txHash'),
        cell: ({ row }) => (
          <span className="break-all">{row.original.txHash || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'operateType',
        header: t('userWallet.column.operateType'),
        cell: ({ row }) => {
          const key = row.original.operateType
            ? `operateType.${row.original.operateType}`
            : undefined;
          return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        id: 'content',
        header: t('userWallet.column.content'),
        cell: ({ row }) => (
          <OpRecordContent
            operateType={row.original.operateType}
            operateNum={row.original.operateNum}
            newStatus={row.original.newStatus}
            oldStatus={row.original.oldStatus}
          />
        ),
      },
      {
        accessorKey: 'createUser',
        header: t('userWallet.column.creator'),
        cell: ({ row }) => (
          <span>{row.original.createUser || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'createTime',
        header: t('userWallet.column.createTime'),
        cell: ({ row }) => <span>{formatTs(row.original.createTime)}</span>,
      },
      {
        id: 'operationStatus',
        header: t('userWallet.column.operationStatus'),
        cell: ({ row }) => (
          <WalletStatusBadge
            family="user-wallet"
            status={row.original.operationStatus}
          />
        ),
      },
    ],
    [t]
  );

  const accrualColumns = React.useMemo<ColumnDef<AccrualRecord>[]>(
    () => [
      {
        id: 'accrualTimeIndex',
        header: t('userWallet.column.index'),
        cell: ({ row }) => (
          <span>{formatTs(row.original.accrualTime)}</span>
        ),
      },
      {
        id: 'accrualTime',
        header: t('userWallet.column.accrualTime'),
        cell: ({ row }) => <span>{formatTs(row.original.accrualTime)}</span>,
      },
      {
        id: 'feeType',
        header: t('userWallet.column.feeType'),
        cell: ({ row }) => {
          const key = row.original.feeType
            ? `userFeeType.${row.original.feeType}`
            : undefined;
          return <span>{key ? t(key as never) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        id: 'feePeriod',
        header: t('userWallet.column.feePeriod'),
        cell: ({ row }) => (
          <span>{formatTs(row.original.feePeriod, DATE_FMT)}</span>
        ),
      },
      {
        id: 'accrualAmount',
        header: t('userWallet.column.accrualAmount'),
        cell: ({ row }) => (
          <span>
            {row.original.accrualAmount != null
              ? `${row.original.accrualAmount} ${row.original.tokenCurrencySymbol ?? ''}`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('userWallet.column.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
    ],
    [t]
  );

  const distributeColumns = React.useMemo<ColumnDef<DistributeRecord>[]>(
    () => [
      {
        id: 'payableOnIndex',
        header: t('userWallet.column.index'),
        cell: ({ row }) => <span>{formatTs(row.original.payableOn)}</span>,
      },
      {
        id: 'payableOn',
        header: t('userWallet.column.payableOn'),
        cell: ({ row }) => <span>{formatTs(row.original.payableOn)}</span>,
      },
      {
        id: 'earningsDate',
        header: t('userWallet.column.earningsDate'),
        cell: ({ row }) => (
          <span>{formatTs(row.original.earningsDate, DATE_FMT)}</span>
        ),
      },
      {
        id: 'dividendAmount',
        header: t('userWallet.column.dividendAmount'),
        cell: ({ row }) => (
          <span>
            {row.original.dividendAmount != null
              ? `${row.original.dividendAmount} ${row.original.dividendAmountCurrency ?? ''}`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'dividendUnits',
        header: t('userWallet.column.dividendUnits'),
        cell: ({ row }) => (
          <span>
            {row.original.dividendUnits != null
              ? `${row.original.dividendUnits} ${row.original.dividendUnitsSymbol ?? ''}`.trim()
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'txTime',
        header: t('userWallet.column.txTime'),
        cell: ({ row }) => <span>{formatTs(row.original.txTime)}</span>,
      },
      {
        accessorKey: 'txHash',
        header: t('userWallet.column.txHash'),
        cell: ({ row }) => (
          <span className="break-all">{row.original.txHash || EMPTY_DISPLAY}</span>
        ),
      },
      {
        id: 'status',
        header: t('userWallet.column.status'),
        // 源 distributeRecords status 列写死 success tag（common_task_status_35=success）。
        // 35 属任务状态码域（30/35/40），复用 mmf-daily 族（码匹配：35→success 绿）。
        cell: () => (
          <WalletStatusBadge family="mmf-daily" status={35} />
        ),
      },
    ],
    [t]
  );

  // resolvedTab 指向条件 tab 但该 tab 未启用时，回退到 basic，避免空 tab 激活。
  const effectiveTab =
    (resolvedTab === USER_WALLET_VIEW_TAB.Accrual && !showAccrual) ||
    (resolvedTab === USER_WALLET_VIEW_TAB.Distribution && !showDistribute)
      ? USER_WALLET_VIEW_TAB.Basic
      : resolvedTab;

  return (
    <div className="space-y-4">
      <Tabs value={effectiveTab}>
        <TabsList>
          <TabsTrigger value={USER_WALLET_VIEW_TAB.Basic}>
            {t('userWallet.tab.basic')}
          </TabsTrigger>
          <TabsTrigger value={USER_WALLET_VIEW_TAB.Transactions}>
            {t('userWallet.tab.transactions')}
          </TabsTrigger>
          <TabsTrigger value={USER_WALLET_VIEW_TAB.Operations}>
            {t('userWallet.tab.operations')}
          </TabsTrigger>
          {showAccrual ? (
            <TabsTrigger value={USER_WALLET_VIEW_TAB.Accrual}>
              {t('userWallet.tab.accrual')}
            </TabsTrigger>
          ) : null}
          {showDistribute ? (
            <TabsTrigger value={USER_WALLET_VIEW_TAB.Distribution}>
              {t('userWallet.tab.distribution')}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value={USER_WALLET_VIEW_TAB.Basic}>
          <section className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('userWallet.section.basicDetails')}
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
                        <td className="break-all border px-4 py-3">{row.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t px-6 py-3 text-sm font-semibold">
              {t('userWallet.section.kycDetails')}
            </div>
            <div className="grid grid-cols-1 gap-px bg-border">
              <KycSimpleRow
                label={t('userWallet.section.lastVerified')}
                value={EMPTY_DISPLAY}
              />
              <KycSimpleRow
                label={t('userWallet.section.verifiableCredential')}
                value={EMPTY_DISPLAY}
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value={USER_WALLET_VIEW_TAB.Transactions}>
          <DetailTableSection
            title={t('userWallet.tab.transactions')}
            columns={txColumns}
            data={txList.data?.rows ?? []}
            isLoading={txList.isLoading || txList.isFetching}
            emptyMessage={t('common.noData')}
            page={txPage}
            total={txList.data?.page?.total ?? 0}
            onPageChange={(p) => setTxPage((prev) => ({ ...prev, pageNum: p }))}
          />
        </TabsContent>

        <TabsContent value={USER_WALLET_VIEW_TAB.Operations}>
          <DetailTableSection
            title={t('userWallet.tab.operations')}
            columns={opColumns}
            data={opRecordList.data?.rows ?? []}
            isLoading={opRecordList.isLoading || opRecordList.isFetching}
            emptyMessage={t('common.noData')}
            page={opPage}
            total={opRecordList.data?.page?.total ?? 0}
            onPageChange={(p) => setOpPage((prev) => ({ ...prev, pageNum: p }))}
          />
        </TabsContent>

        {showAccrual ? (
          <TabsContent value={USER_WALLET_VIEW_TAB.Accrual}>
            <DetailTableSection
              title={t('userWallet.tab.accrual')}
              columns={accrualColumns}
              data={accrualList.data?.rows ?? []}
              isLoading={accrualList.isLoading || accrualList.isFetching}
              emptyMessage={t('common.noData')}
              page={accrualPage}
              total={accrualList.data?.page?.total ?? 0}
              onPageChange={(p) =>
                setAccrualPage((prev) => ({ ...prev, pageNum: p }))
              }
            />
          </TabsContent>
        ) : null}

        {showDistribute ? (
          <TabsContent value={USER_WALLET_VIEW_TAB.Distribution}>
            <section className="space-y-4">
              <DistributeSummary detail={detail} />
              <DetailTableSection
                title={t('userWallet.tab.distribution')}
                columns={distributeColumns}
                data={distributeList.data?.rows ?? []}
                isLoading={
                  distributeList.isLoading || distributeList.isFetching
                }
                emptyMessage={t('common.noData')}
                page={distributePage}
                total={distributeList.data?.page?.total ?? 0}
                onPageChange={(p) =>
                  setDistributePage((prev) => ({ ...prev, pageNum: p }))
                }
              />
            </section>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

// ── 局部子组件（仅本文件内部使用） ─────────────────────────────────────────────

/** 操作记录 Content 列：按 operateType 渲染不同文案（迁移自源 view Content render）。 */
function OpRecordContent({
  operateType,
  operateNum,
  newStatus,
  oldStatus,
}: {
  operateType?: number;
  operateNum?: string | number;
  newStatus?: number;
  oldStatus?: number;
}) {
  const t = useTranslations('modules.wallet');
  switch (operateType) {
    case 1:
      return <div>{t('operateContent.created')}</div>;
    case 2:
      return (
        <div className="space-y-1">
          <div>{t('operateContent.frozen')}</div>
          <div>
            {t('operateContent.frozenNewStatus')}: {newStatus ?? EMPTY_DISPLAY}
          </div>
          <div>
            {t('operateContent.frozenOldStatus')}: {oldStatus ?? EMPTY_DISPLAY}
          </div>
        </div>
      );
    case 3:
      return (
        <div className="space-y-1">
          <div>{t('operateContent.unfrozen')}</div>
          <div>
            {t('operateContent.unfrozenNewStatus')}: {newStatus ?? EMPTY_DISPLAY}
          </div>
          <div>
            {t('operateContent.unfrozenOldStatus')}: {oldStatus ?? EMPTY_DISPLAY}
          </div>
        </div>
      );
    case 5:
      return (
        <div className="space-y-1">
          <div>{t('operateContent.changeType')}</div>
          <div>
            {t('operateContent.changeNewStatus')}: {newStatus ?? EMPTY_DISPLAY}
          </div>
          <div>
            {t('operateContent.changeOldStatus')}: {oldStatus ?? EMPTY_DISPLAY}
          </div>
        </div>
      );
    case 6:
      return (
        <div>
          {t('operateContent.freezeFunds')}: {operateNum ?? EMPTY_DISPLAY}
        </div>
      );
    case 7:
      return (
        <div>
          {t('operateContent.unfreezeFunds')}: {operateNum ?? EMPTY_DISPLAY}
        </div>
      );
    default:
      return <span>{EMPTY_DISPLAY}</span>;
  }
}

/** KYC 简单 label/value 行（源 kycInfoItems 多为 N/A 占位）。 */
function KycSimpleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[34%_1fr] bg-card">
      <div className="bg-muted/30 px-4 py-3 text-sm font-medium">{label}</div>
      <div className="break-all px-4 py-3 text-sm">{value}</div>
    </div>
  );
}

/** distribute tab 顶部的 3 项 kv（迁移自源 view items）。 */
function DistributeSummary({ detail }: { detail?: UserWalletDetail }) {
  const t = useTranslations('modules.wallet');
  const rows: KvRow[] = [
    {
      key: 'fundName',
      label: t('userWallet.section.fundName'),
      value: detail?.fundName || EMPTY_DISPLAY,
    },
    {
      key: 'fundAssetValue',
      label: t('userWallet.section.fundAssetValue'),
      value:
        detail?.fundAssetValue != null
          ? `${detail.fundAssetValue} ${detail.fundAssetCurrency ?? ''}`.trim()
          : EMPTY_DISPLAY,
    },
    {
      key: 'dividendMethod',
      label: t('userWallet.section.dividendMethod'),
      value: detail?.dividendMethod || EMPTY_DISPLAY,
    },
  ];
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-3 text-sm font-semibold">
        {t('userWallet.section.distributionDetails')}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                  {row.label}
                </td>
                <td className="break-all border px-4 py-3">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 详情页表格区段（标题 + DataTable 服务端分页）。 */
function DetailTableSection<T extends { id: string }>({
  title,
  columns,
  data,
  isLoading,
  emptyMessage,
  page,
  total,
  onPageChange,
}: {
  title: string;
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  emptyMessage: string;
  page: TxPage;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
      <div className="p-4">
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          pagination={{
            page: page.pageNum,
            pageSize: page.pageSize,
            total,
            onPageChange,
          }}
        />
      </div>
    </section>
  );
}
