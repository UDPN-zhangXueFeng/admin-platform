'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import {
  type TokenReconSummaryRespVo,
  type TxReconDetailRespVo,
  useTokenListQuery,
  useTxInvestigationListQuery,
} from '@myorg/modules/reconciliation/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FIELD_VALUE,
  formatTimestamp,
  getTokenTypeKey,
  getTxTypeKey,
} from '@myorg/modules/reconciliation/util';
import {
  ReconciliationSection,
  StatusBadge,
} from '@myorg/modules/reconciliation/ui';

// ── List tab filter form ──────────────────────────────────────────────────────

interface TokenListFormValues {
  tokenName: string;
  tokenType: string;
  financeBookName: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RealTimeListPage() {
  const t = useTranslations('modules.reconciliation');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  const canView =
    authPermissions.size === 0 ||
    authPermissions.has('reconciliation:view');

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState<'list' | 'investigation'>('list');

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [listPage, setListPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [investPage, setInvestPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ── List tab filter form ───────────────────────────────────────────────────
  const {
    register: regToken,
    handleSubmit: handleTokenSubmit,
    watch: watchToken,
    setValue: setTokenValue,
  } = useForm<TokenListFormValues>({
    defaultValues: { tokenName: '', tokenType: 'all', financeBookName: '' },
  });

  const [tokenFilterValues, setTokenFilterValues] = React.useState<TokenListFormValues>({
    tokenName: '',
    tokenType: '',
    financeBookName: '',
  });

  const onTokenFilterSubmit = React.useCallback(
    (data: TokenListFormValues) => {
      setTokenFilterValues(data);
      setListPage((prev) => ({ ...prev, pageNum: 1 }));
    },
    [],
  );

  // ── Investigation tab filter form ──────────────────────────────────────────
  interface InvestFormValues {
    keyword: string;
    txType: string;
  }

  const {
    register: regInvest,
    handleSubmit: handleInvestSubmit,
    watch: watchInvest,
    setValue: setInvestValue,
  } = useForm<InvestFormValues>({
    defaultValues: { keyword: '', txType: 'all' },
  });

  const [investFilterValues, setInvestFilterValues] = React.useState<InvestFormValues>({
    keyword: '',
    txType: 'all',
  });

  const onInvestFilterSubmit = React.useCallback(
    (data: InvestFormValues) => {
      setInvestFilterValues(data);
      setInvestPage((prev) => ({ ...prev, pageNum: 1 }));
    },
    [],
  );

  // ── Queries ────────────────────────────────────────────────────────────────
  const listResult = useTokenListQuery({
    pageNum: listPage.pageNum,
    pageSize: listPage.pageSize,
    filters: {
      tokenName: tokenFilterValues.tokenName || undefined,
      tokenType:
        tokenFilterValues.tokenType &&
        tokenFilterValues.tokenType !== 'all'
          ? Number(tokenFilterValues.tokenType)
          : undefined,
      financeBookName: tokenFilterValues.financeBookName || undefined,
    },
  });

  const investResult = useTxInvestigationListQuery({
    pageNum: investPage.pageNum,
    pageSize: investPage.pageSize,
    filters: {
      keyword: investFilterValues.keyword || undefined,
      txType:
        investFilterValues.txType &&
        investFilterValues.txType !== 'all'
          ? Number(investFilterValues.txType)
          : undefined,
    },
  });

  // ── List tab columns (TokenReconSummaryRespVo) ──────────────────────────────
  const tokenColumns = React.useMemo<ColumnDef<TokenReconSummaryRespVo>[]>(
    () => [
      {
        accessorKey: 'tokenName',
        header: t('reconciliation_0052'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('reconciliation_0053'),
        cell: ({ row }) => {
          const key = getTokenTypeKey(row.original.tokenType);
          return key ? (
            <span>{t(key as never)}</span>
          ) : (
            <span>{EMPTY_FIELD_VALUE}</span>
          );
        },
      },
      {
        accessorKey: 'financeBookName',
        header: t('reconciliation_0077'),
        cell: ({ row }) => (
          <span>{row.original.financeBookName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('PUB_Blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'lastReconciliationTime',
        header: t('reconciliation_0076'),
        cell: ({ row }) => (
          <span>{formatTimestamp(row.original.lastReconciliationTime)}</span>
        ),
      },
      {
        accessorKey: 'matchedCount',
        header: t('reconciliation_0073'),
        cell: ({ row }) => (
          <span className="font-semibold text-[#52c41a]">
            {row.original.matchedCount != null
              ? row.original.matchedCount
              : EMPTY_FIELD_VALUE}
          </span>
        ),
      },
      {
        accessorKey: 'unmatchedCount',
        header: t('reconciliation_0074'),
        cell: ({ row }) => (
          <span className="font-semibold text-[#f5222d]">
            {row.original.unmatchedCount != null
              ? row.original.unmatchedCount
              : EMPTY_FIELD_VALUE}
          </span>
        ),
      },
      {
        accessorKey: 'actionedCount',
        header: t('reconciliation_0075'),
        cell: ({ row }) => (
          <span className="font-semibold text-[#1677ff]">
            {row.original.actionedCount != null
              ? row.original.actionedCount
              : EMPTY_FIELD_VALUE}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('common_detail'),
        cell: ({ row }) =>
          canView ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/reconciliation/real-time/view?id=${row.original.id}`,
                )
              }
            >
              {t('PUB_Detail')}
            </Button>
          ) : (
            <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>
          ),
      },
    ],
    [t, canView, router],
  );

  // ── Investigation tab columns (TxReconDetailRespVo, pre-filtered status=3) ─
  const investColumns = React.useMemo<ColumnDef<TxReconDetailRespVo>[]>(
    () => [
      {
        accessorKey: 'lastReconciliationTime',
        header: t('reconciliation_0076'),
        cell: ({ row }) => (
          <span>{formatTimestamp(row.original.lastReconciliationTime)}</span>
        ),
      },
      {
        accessorKey: 'reconciliationNo',
        header: t('reconciliation_0133'),
        cell: ({ row }) => (
          <span>
            {row.original.reconciliationNo || EMPTY_FIELD_VALUE}
          </span>
        ),
      },
      {
        accessorKey: 'txType',
        header: t('reconciliation_0055'),
        cell: ({ row }) => {
          const key = getTxTypeKey(row.original.txType);
          return key ? (
            <span>{t(key as never)}</span>
          ) : (
            <span>{EMPTY_FIELD_VALUE}</span>
          );
        },
      },
      {
        accessorKey: 'txHash',
        header: t('reconciliation_0015'),
        cell: ({ row }) => (
          <span>{row.original.txHash || row.original.tranId || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'reconciliationStatus',
        header: t('reconciliation_0136'),
        cell: ({ row }) => {
          const status = row.original.reconciliationStatus;
          const key = status != null ? getTxTypeKey(status) : undefined;
          return status != null ? (
            <StatusBadge tone={String(status)}>
              {key ? t(key as never) : EMPTY_FIELD_VALUE}
            </StatusBadge>
          ) : (
            <span>{EMPTY_FIELD_VALUE}</span>
          );
        },
      },
      {
        id: 'actions',
        header: t('common_detail'),
        cell: ({ row }) =>
          canView ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/reconciliation/real-time/view?id=${row.original.id}`,
                )
              }
            >
              {t('PUB_Detail')}
            </Button>
          ) : (
            <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>
          ),
      },
    ],
    [t, canView, router],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'list' | 'investigation')}
      >
        <TabsList>
          <TabsTrigger value="list">{t('reconciliation_0143')}</TabsTrigger>
          <TabsTrigger value="investigation">
            {t('reconciliation_0144')}
          </TabsTrigger>
        </TabsList>

        {/* ── Token Summary Tab ──────────────────────────────────────────────── */}
        <TabsContent value="list">
          <ReconciliationSection title={t('reconciliation_0072')}>
            {/* Filter form */}
            <form
              onSubmit={handleTokenSubmit(onTokenFilterSubmit)}
              className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="list-tokenName">
                  {t('reconciliation_0052')}
                </Label>
                <Input
                  id="list-tokenName"
                  placeholder={t('reconciliation_0052')}
                  {...regToken('tokenName')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="list-tokenType">
                  {t('reconciliation_0053')}
                </Label>
                <Select
                  value={watchToken('tokenType') ?? 'all'}
                  onValueChange={(v) => setTokenValue('tokenType', v)}
                >
                  <SelectTrigger id="list-tokenType">
                    <SelectValue placeholder={t('common_all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('common_all')}
                    </SelectItem>
                    <SelectItem value="1">
                      {t('token_type_1' as never)}
                    </SelectItem>
                    <SelectItem value="5">
                      {t('token_type_5' as never)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="list-financeBookName">
                  {t('reconciliation_0047')}
                </Label>
                <Input
                  id="list-financeBookName"
                  placeholder={t('reconciliation_0047')}
                  {...regToken('financeBookName')}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit">
                  {t('common_query')}
                </Button>
              </div>
            </form>

            {/* Table */}
            <DataTable
              columns={tokenColumns}
              data={listResult.data?.rows ?? []}
              pagination={{
                page: listPage.pageNum,
                pageSize: listPage.pageSize,
                total: listResult.data?.page?.total ?? 0,
                onPageChange: (page) =>
                  setListPage((prev) => ({ ...prev, pageNum: page })),
              }}
            />
          </ReconciliationSection>
        </TabsContent>

        {/* ── Investigation Tab ──────────────────────────────────────────────── */}
        <TabsContent value="investigation">
          <ReconciliationSection title={t('reconciliation_0144')}>
            {/* Filter form */}
            <form
              onSubmit={handleInvestSubmit(onInvestFilterSubmit)}
              className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="invest-keyword">
                  {t('reconciliation_0138')}
                </Label>
                <Input
                  id="invest-keyword"
                  placeholder={t('reconciliation_0138')}
                  {...regInvest('keyword')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invest-txType">
                  {t('reconciliation_0055')}
                </Label>
                <Select
                  value={watchInvest('txType') ?? 'all'}
                  onValueChange={(v) => setInvestValue('txType', v)}
                >
                  <SelectTrigger id="invest-txType">
                    <SelectValue placeholder={t('common_all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('common_all')}
                    </SelectItem>
                    <SelectItem value="5">
                      {t('tx_type_5' as never)}
                    </SelectItem>
                    <SelectItem value="10">
                      {t('tx_type_10' as never)}
                    </SelectItem>
                    <SelectItem value="15">
                      {t('tx_type_15' as never)}
                    </SelectItem>
                    <SelectItem value="20">
                      {t('tx_type_20' as never)}
                    </SelectItem>
                    <SelectItem value="25">
                      {t('tx_type_25' as never)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit">
                  {t('common_query')}
                </Button>
              </div>
            </form>

            <DataTable
              columns={investColumns}
              data={investResult.data?.rows ?? []}
              pagination={{
                page: investPage.pageNum,
                pageSize: investPage.pageSize,
                total: investResult.data?.page?.total ?? 0,
                onPageChange: (page) =>
                  setInvestPage((prev) => ({ ...prev, pageNum: page })),
              }}
            />
          </ReconciliationSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
