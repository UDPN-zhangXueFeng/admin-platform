'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  CopyableEllipsisText,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import {
  type ReconciliationListParams,
  type TxReconDetailRespVo,
  type TxReconListReqVo,
  useTokenBasicDetailQuery,
  useTxListQuery,
  useTxInvestigationListQuery,
} from '@myorg/modules/reconciliation/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FIELD_VALUE,
  formatBlockHeight,
  formatCurrencyValue,
  formatNonZeroNumber,
  formatTimestamp,
  getReconStatusKey,
  getTxTypeKey,
  RECON_STATUS_TONE,
  resolveDetailTab,
  TOKEN_TYPE,
  TX_TYPE_VALUES,
} from '@myorg/modules/reconciliation/util';
import {
  ReconciliationMetricCard,
  ReconciliationSection,
  StatusBadge,
} from '@myorg/modules/reconciliation/ui';

import { PostToSuspenseModal } from './real-time/post-to-suspense-modal';
import { RealTimeReconLogModal } from './real-time/recon-log-modal';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * 交易类型筛选下拉项（对照源 `txTypeOptions(t, tokenType)`）。
 *
 * tokenType=Stablecoin(1) → 全集 5 项(5/10/15/20/25)；TD(5)/默认 → 裁剪为 3 项
 * (5/15/25，排除 10/20，这两个类型仅 Stablecoin 存在)。
 */
function buildTxTypeOptions(
  t: ReturnType<typeof useTranslations>,
  tokenType?: number,
) {
  const allowed =
    Number(tokenType) === TOKEN_TYPE.STABLECOIN
      ? Array.from(TX_TYPE_VALUES)
      : Array.from(TX_TYPE_VALUES).filter(
          (v) => v !== 10 && v !== 20,
        );
  return allowed.map((value) => {
    const key = getTxTypeKey(value);
    return {
      value: String(value),
      label: key ? (t(key as never) ?? String(value)) : String(value),
    };
  });
}

/**
 * 对账状态筛选下拉项（对照源 `statusOptions(t)`）：全部/2/3/5/6，排除 1/4
 * （1=ReconExecuted / 4=Processing 非业务筛选态）。
 */
function buildStatusOptions(
  t: ReturnType<typeof useTranslations>,
) {
  return [2, 3, 5, 6].map((value) => {
    const key = getReconStatusKey(value);
    return {
      value: String(value),
      label: key ? (t(key as never) ?? String(value)) : String(value),
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RealTimeDetailPage() {
  const t = useTranslations('modules.reconciliation');
  const searchParams = useSearchParams();
  const tokenId = searchParams.get('id')
    ? Number(searchParams.get('id'))
    : undefined;

  // ── Basic info ────────────────────────────────────────────────────────────
  const {
    data: basicInfo,
    isLoading: basicLoading,
  } = useTokenBasicDetailQuery(tokenId, Boolean(tokenId));

  // ── Tab management ────────────────────────────────────────────────────────
  // 对照源 `resolveDetailTab(query.tab)`：`investigation` → investigation，其余 → list。
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState<'list' | 'investigation'>(
    resolveDetailTab(queryTab),
  );

  // URL ?tab 变化时同步 Tab（源 `useEffect([query.tab])`）。
  React.useEffect(() => {
    setActiveTab(resolveDetailTab(queryTab));
  }, [queryTab]);

  // Investigation Queue 总数角标（对照源 `investBadge`）。
  // 优先取 basic-detail 的 unmatchedCount（权威汇总），缺失时回退轻量角标请求
  // （pageSize=1 仅取 total，不阻塞主表）。后端全集经 query 层 `select` 二次过滤
  // status=3 后的 total 即为 investigation 计数。
  const investBadgeQuery = useTxInvestigationListQuery({
    pageNum: 1,
    pageSize: 1,
    filters: { tokenId },
  });
  const investTotal =
    basicInfo?.unmatchedCount ?? investBadgeQuery.data?.page?.total ?? 0;

  // ── Pagination per tab ────────────────────────────────────────────────────
  const [listPage, setListPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [investPage, setInvestPage] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ── Filter state per tab ──────────────────────────────────────────────────
  interface TxFilterValues {
    keyword: string;
    txType: string;
    reconciliationStatus: string;
  }

  const defaultFilters: TxFilterValues = {
    keyword: '',
    txType: 'all',
    reconciliationStatus: 'all',
  };

  const [listFilterValues, setListFilterValues] =
    React.useState<TxFilterValues>(defaultFilters);
  const [investFilterValues, setInvestFilterValues] =
    React.useState<TxFilterValues>(defaultFilters);

  // ── Queries ───────────────────────────────────────────────────────────────
  const makeTxParams = React.useCallback(
    (
      pageNum: number,
      pageSize: number,
      filters: TxFilterValues,
    ): ReconciliationListParams<TxReconListReqVo> => ({
      pageNum,
      pageSize,
      filters: {
        tokenId,
        keyword: filters.keyword || undefined,
        txType:
          filters.txType && filters.txType !== 'all'
            ? Number(filters.txType)
            : undefined,
        reconciliationStatus:
          filters.reconciliationStatus &&          filters.reconciliationStatus !== 'all'
            ? Number(filters.reconciliationStatus)
            : undefined,
      },
    }),
    [tokenId],
  );

  const listResult = useTxListQuery(
    makeTxParams(listPage.pageNum, listPage.pageSize, listFilterValues),
  );
  const investResult = useTxInvestigationListQuery(
    makeTxParams(investPage.pageNum, investPage.pageSize, investFilterValues),
  );

  // ── Filter handlers ───────────────────────────────────────────────────────
  const [listFormValues, setListFormValues] =
    React.useState<TxFilterValues>(defaultFilters);
  const [investFormValues, setInvestFormValues] =
    React.useState<TxFilterValues>(defaultFilters);

  const onListFilterSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setListFilterValues(listFormValues);
      setListPage((prev) => ({ ...prev, pageNum: 1 }));
    },
    [listFormValues],
  );

  const onInvestFilterSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setInvestFilterValues(investFormValues);
      setInvestPage((prev) => ({ ...prev, pageNum: 1 }));
    },
    [investFormValues],
  );

  // ── Modal state ──────────────────────────────────────────────────────────
  const [selectedRow, setSelectedRow] = React.useState<
    TxReconDetailRespVo | undefined
  >();
  const [modalType, setModalType] = React.useState<'post' | 'log' | null>(null);

  const openPostModal = React.useCallback((row: TxReconDetailRespVo) => {
    setSelectedRow(row);
    setModalType('post');
  }, []);

  const openLogModal = React.useCallback((row: TxReconDetailRespVo) => {
    setSelectedRow(row);
    setModalType('log');
  }, []);

  const closeModals = React.useCallback(() => {
    setModalType(null);
    setSelectedRow(undefined);
  }, []);

  // ── Table columns (shared across both tabs) ───────────────────────────────
  const buildTxColumns = React.useCallback(
    (): ColumnDef<TxReconDetailRespVo>[] => [
      {
        accessorKey: 'lastReconciliationTime',
        header: t('reconciliation_0076'),
        cell: ({ row }) => (
          <span>
            {formatTimestamp(row.original.lastReconciliationTime)}
          </span>
        ),
      },
      {
        accessorKey: 'reconciliationNo',
        header: t('reconciliation_0133'),
        cell: ({ row }) => (
          <span>{row.original.reconciliationNo || EMPTY_FIELD_VALUE}</span>
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
          <CopyableEllipsisText
            value={row.original.txHash || row.original.tranId}
            copyLabel={t('common_copy')}
            className="max-w-[180px]"
          />
        ),
      },
      {
        accessorKey: 'financeTxTime',
        header: t('reconciliation_0039'),
        cell: ({ row }) => (
          <span>{formatTimestamp(row.original.financeTxTime)}</span>
        ),
      },
      {
        id: 'financeAmount',
        header: t('reconciliation_0134'),
        cell: ({ row }) => {
          // 对照源 `renderAmountPair`：法币/Token 双行，各自非零才展示，全空 '--'。
          const fiat = formatCurrencyValue(row.original.financeAmount);
          const token = formatNonZeroNumber(row.original.financeCount);
          const currency = row.original.currencyCode || basicInfo?.currencySymbol || '';
          const hasFiat = fiat !== EMPTY_FIELD_VALUE;
          const hasToken = token !== EMPTY_FIELD_VALUE;
          if (!hasFiat && !hasToken) return <span>{EMPTY_FIELD_VALUE}</span>;
          return (
            <div className="leading-tight">
              {hasFiat ? (
                <div>
                  {fiat} {currency}
                </div>
              ) : null}
              {hasToken ? (
                <div className="text-xs text-muted-foreground">
                  {token} {row.original.tokenSymbol || ''}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: 'blockHeight',
        header: t('reconciliation_0118'),
        cell: ({ row }) => (
          <span>{formatBlockHeight(row.original.blockHeight)}</span>
        ),
      },
      {
        accessorKey: 'chainTxTime',
        header: t('reconciliation_0057'),
        cell: ({ row }) => (
          <span>{formatTimestamp(row.original.chainTxTime)}</span>
        ),
      },
      {
        accessorKey: 'chainAmount',
        header: t('reconciliation_0135'),
        cell: ({ row }) => {
          const fiat = formatCurrencyValue(row.original.chainAmount);
          const token = formatNonZeroNumber(row.original.chainCount);
          const currency = row.original.currencyCode || basicInfo?.currencySymbol || '';
          const hasFiat = fiat !== EMPTY_FIELD_VALUE;
          const hasToken = token !== EMPTY_FIELD_VALUE;
          if (!hasFiat && !hasToken) return <span>{EMPTY_FIELD_VALUE}</span>;
          return (
            <div className="leading-tight">
              {hasFiat ? (
                <div>
                  {fiat} {currency}
                </div>
              ) : null}
              {hasToken ? (
                <div className="text-xs text-muted-foreground">
                  {token} {row.original.tokenSymbol || ''}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: 'reconciliationStatus',
        header: t('reconciliation_0136'),
        cell: ({ row }) => {
          const status = row.original.reconciliationStatus;
          const tone = status != null ? RECON_STATUS_TONE[status] : undefined;
          const key = status != null ? getReconStatusKey(status) : undefined;
          return status != null ? (
            <StatusBadge tone={tone ?? ''}>
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
        cell: ({ row }) => {
          const data = row.original;
          // R2: only status===3 && canPostSuspense shows "Post to Suspense"
          const canPost =
            data.reconciliationStatus === 3 &&
            data.canPostSuspense === true;

          return (
            <div className="flex gap-3">
              {canPost ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => openPostModal(data)}
                >
                  {t('reconciliation_0095')}
                </Button>
              ) : (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => openLogModal(data)}
                >
                  {t('reconciliation_0110')}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [t, basicInfo, openPostModal, openLogModal],
  );

  const txColumns = React.useMemo(
    () => buildTxColumns(),
    [buildTxColumns]
  );

  // 筛选下拉项（txType 随 tokenType 条件裁剪；status 固定 4 项）。
  const txTypeOptions = React.useMemo(
    () => buildTxTypeOptions(t, basicInfo?.tokenType),
    [t, basicInfo?.tokenType],
  );
  const statusOptions = React.useMemo(
    () => buildStatusOptions(t),
    [t],
  );

  // ── Filter form component ─────────────────────────────────────────────────
  const renderFilterForm = React.useCallback(
    (tab: 'list' | 'investigation') => {
      const values =
        tab === 'list' ? listFormValues : investFormValues;
      const setValues =
        tab === 'list' ? setListFormValues : setInvestFormValues;
      const onSubmit =
        tab === 'list' ? onListFilterSubmit : onInvestFilterSubmit;

      return (
        <form
          onSubmit={onSubmit}
          className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${tab}-keyword`}>
              {t('reconciliation_0138')}
            </Label>
            <Input
              id={`${tab}-keyword`}
              placeholder={t('reconciliation_0138')}
              value={values.keyword}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, keyword: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${tab}-txType`}>
              {t('reconciliation_0055')}
            </Label>
            <Select
              value={values.txType}
              onValueChange={(v) =>
                setValues((prev) => ({ ...prev, txType: v }))
              }
            >
              <SelectTrigger id={`${tab}-txType`}>
                <SelectValue placeholder={t('common_all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common_all')}</SelectItem>
                {txTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${tab}-reconStatus`}>
              {t('reconciliation_0136')}
            </Label>
            <Select
              value={values.reconciliationStatus}
              onValueChange={(v) =>
                setValues((prev) => ({
                  ...prev,
                  reconciliationStatus: v,
                }))
              }
            >
              <SelectTrigger id={`${tab}-reconStatus`}>
                <SelectValue placeholder={t('common_all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common_all')}</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit">{t('common_query')}</Button>
          </div>
        </form>
      );
    },
    [
      t,
      listFormValues,
      investFormValues,
      onListFilterSubmit,
      onInvestFilterSubmit,
      txTypeOptions,
      statusOptions,
    ],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Basic Info Section ───────────────────────────────────────────── */}
      <ReconciliationSection title={t('reconciliation_0145')}>
        {basicLoading ? (
          <Skeleton className="h-48" />
        ) : basicInfo ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
            <InfoItem
              label={t('reconciliation_0052')}
              value={basicInfo.tokenName || EMPTY_FIELD_VALUE}
            />
            <InfoItem
              label={t('reconciliation_0053')}
              value={basicInfo.tokenType != null ? String(basicInfo.tokenType) : EMPTY_FIELD_VALUE}
            />
            <InfoItem
              label={t('reconciliation_0047')}
              value={basicInfo.financeBookName || EMPTY_FIELD_VALUE}
            />
            <InfoItem
              label={t('reconciliation_0048')}
              value={
                <CopyableEllipsisText
                  value={basicInfo.bookNo}
                  copyLabel={t('common_copy')}
                />
              }
            />
            <InfoItem
              label={t('reconciliation_0032')}
              value={basicInfo.currencySymbol || EMPTY_FIELD_VALUE}
            />
            <InfoItem
              label={t('PUB_Blockchain')}
              value={basicInfo.blockchainName || EMPTY_FIELD_VALUE}
            />
            <InfoItem
              label={t('reconciliation_0076')}
              value={formatTimestamp(basicInfo.lastReconciliationTime)}
            />
            <InfoItem
              label={t('reconciliation_0140')}
              value={basicInfo.createdBy || EMPTY_FIELD_VALUE}
            />
            <InfoItem
              label={t('reconciliation_0141')}
              value={formatTimestamp(basicInfo.createTime)}
            />
          </div>
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            {EMPTY_FIELD_VALUE}
          </p>
        )}
      </ReconciliationSection>

      {/* ── Metric Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ReconciliationMetricCard
          label={t('reconciliation_0073')}
          className="h-[164px]"
          value={
            <span className="font-semibold text-[#52c41a]">
              {basicInfo?.matchedCount != null
                ? basicInfo.matchedCount
                : EMPTY_FIELD_VALUE}
            </span>
          }
          extra={
            <div className="text-xs text-[#8c8c8c]">
              {t('reconciliation_0142', {
                time: basicInfo?.lastReconciliationTime
                  ? formatTimestamp(basicInfo.lastReconciliationTime)
                  : EMPTY_FIELD_VALUE,
              })}
            </div>
          }
        />
        <ReconciliationMetricCard
          label={t('reconciliation_0074')}
          className="h-[164px]"
          value={
            <span className="font-semibold text-[#f5222d]">
              {basicInfo?.unmatchedCount ?? 0}
            </span>
          }
          extra={
            <div className="text-xs text-[#8c8c8c]">
              {t('reconciliation_0142', {
                time: basicInfo?.lastReconciliationTime
                  ? formatTimestamp(basicInfo.lastReconciliationTime)
                  : EMPTY_FIELD_VALUE,
              })}
            </div>
          }
        />
        <ReconciliationMetricCard
          label={t('reconciliation_0075')}
          className="h-[164px]"
          value={
            <span className="font-semibold text-[#1677ff]">
              {basicInfo?.actionedCount != null
                ? basicInfo.actionedCount
                : EMPTY_FIELD_VALUE}
            </span>
          }
          extra={
            <div className="text-xs text-[#8c8c8c]">
              {t('reconciliation_0142', {
                time: basicInfo?.lastReconciliationTime
                  ? formatTimestamp(basicInfo.lastReconciliationTime)
                  : EMPTY_FIELD_VALUE,
              })}
            </div>
          }
        />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'list' | 'investigation')}
      >
        <TabsList>
          <TabsTrigger value="list">
            {t('reconciliation_0143')}
          </TabsTrigger>
          <TabsTrigger value="investigation">
            {t('reconciliation_0144')}
            {investTotal > 0 ? (
              <Badge variant="destructive" className="ml-1.5">
                {investTotal}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ── Reconciliation List Tab ──────────────────────────────────────── */}
        <TabsContent value="list">
          <ReconciliationSection title={t('reconciliation_0143')}>
            {renderFilterForm('list')}
            <DataTable
              columns={txColumns}
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

        {/* ── Investigation Tab ────────────────────────────────────────────── */}
        <TabsContent value="investigation">
          <ReconciliationSection title={t('reconciliation_0144')}>
            {renderFilterForm('investigation')}
            <DataTable
              columns={txColumns}
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

      {/* ── Post to Suspense Modal ─────────────────────────────────────────── */}
      <PostToSuspenseModal
        open={modalType === 'post'}
        reconciliationTxId={selectedRow?.reconciliationTxId}
        unmatchedType={selectedRow?.unmatchedType}
        postedAmount={
          selectedRow
            ? {
                amount: selectedRow.chainAmount,
                count: selectedRow.chainCount,
                currency:
                  selectedRow.currencyCode ?? basicInfo?.currencySymbol,
                tokenSymbol: selectedRow.tokenSymbol,
              }
            : undefined
        }
        mismatchedAmount={
          selectedRow
            ? {
                amount:
                  selectedRow.chainAmount != null &&
                  selectedRow.financeAmount != null
                    ? Number(selectedRow.chainAmount) -
                      Number(selectedRow.financeAmount)
                    : null,
                count:
                  selectedRow.chainCount != null &&
                  selectedRow.financeCount != null
                    ? Number(selectedRow.chainCount) -
                      Number(selectedRow.financeCount)
                    : null,
                currency:
                  selectedRow.currencyCode ?? basicInfo?.currencySymbol,
                tokenSymbol: selectedRow.tokenSymbol,
              }
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) closeModals();
        }}
      />

      {/* ── Recon Log Modal ────────────────────────────────────────────────── */}
      <RealTimeReconLogModal
        open={modalType === 'log'}
        reconciliationTxId={selectedRow?.reconciliationTxId}
        onOpenChange={(open) => {
          if (!open) closeModals();
        }}
      />
    </div>
  );
}

// ── Inline InfoItem (KV pair) ─────────────────────────────────────────────────

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
