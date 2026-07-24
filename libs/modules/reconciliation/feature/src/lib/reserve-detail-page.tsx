'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';

import {
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import {
  InfoItem,
  ReconciliationMetricCard,
  ReconciliationSection,
  StatusBadge,
} from '@myorg/modules/reconciliation/ui';
import {
  type ReconciliationListParams,
  useReserveBasicDetailQuery,
  useReserveListQuery,
  useReserveInvestigationListQuery,
  type ReserveReconDetailRespVo,
  type ReserveReconListReqVo,
} from '@myorg/modules/reconciliation/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FIELD_VALUE,
  formatCurrencyValue,
  formatTimestamp,
  RESERVE_STATUS_TONE,
  getReserveStatusKey,
  getReserveTypeKey,
  resolveDetailTab,
} from '@myorg/modules/reconciliation/util';

import { ReserveReconLogModal } from './reserve/reserve-recon-log-modal';

// ── 表格面板 ─────────────────────────────────────────────────────────────────────

interface DetailTablePanelProps {
  columns: ColumnDef<ReserveReconDetailRespVo>[];
  data: readonly ReserveReconDetailRespVo[];
  isLoading: boolean;
  total: number;
  emptyMessage: string;
  pageNum: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function DetailTablePanel({
  columns,
  data,
  isLoading,
  total,
  emptyMessage,
  pageNum,
  pageSize,
  onPageChange,
}: DetailTablePanelProps) {
  return (
    <div className="p-4">
      <DataTable
        columns={columns}
        data={[...(data ?? [])]}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        pagination={{
          page: pageNum,
          pageSize,
          total,
          onPageChange,
        }}
      />
    </div>
  );
}

// ── Modal 状态 ──────────────────────────────────────────────────────────────────

interface ModalState {
  mode: 'log' | null;
  reconciliationReserveId?: number;
  unmatchedType?: number;
}

// ── 页面组件 ─────────────────────────────────────────────────────────────────────

/**
 * ReserveDetailPage — 储备资产对账详情页。
 *
 * 迁移自 td-manage `reconciliation/reserve/detail.tsx`（622 行）。
 *
 * - 顶部基本信息（ReserveAssetBasicDetailRespVo）
 * - 2 个统计卡：Matched + Exceptions
 * - 双 Tab：list（useReserveListQuery）+ investigation
 *   （useReserveInvestigationListQuery，R2: NOT pre-filtered）
 * - Recon Log Modal（只读 Drawer）
 * - 不挂载 ReservePostToSuspenseModal（R1）
 */
export function ReserveDetailPage() {
  const t = useTranslations('modules.reconciliation');
  const searchParams = useSearchParams();

  const reserveAccountIdRaw = searchParams.get('id');
  const reserveAccountId = reserveAccountIdRaw
    ? Number(reserveAccountIdRaw)
    : undefined;
  const tabParam = searchParams.get('tab');

  // ── 基本信息 ──────────────────────────────────────────────────────────────
  const { data: basicInfo, isLoading: basicLoading } =
    useReserveBasicDetailQuery(reserveAccountId);

  // ── Tab 状态 ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState<'list' | 'investigation'>(
    resolveDetailTab(tabParam),
  );

  React.useEffect(() => {
    setActiveTab(resolveDetailTab(tabParam));
  }, [tabParam]);

  // ── 分页状态（Tab 独立） ──────────────────────────────────────────────────
  const [listPageNum, setListPageNum] = React.useState(1);
  const [investPageNum, setInvestPageNum] = React.useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

  // ── 筛选状态（Tab 独立；ALL_VALUE='all' 规避 Radix Select 空串崩溃） ────────
  // 对齐源 `formItems`（keyword / type / reconciliationStatus 三项可交互筛选；
  // 源两段 RangePicker 在目标侧详情页按 real-time 同级约定省略）。
  interface ReserveFilterValues {
    keyword: string;
    type: string;
    reconciliationStatus: string;
  }

  const defaultFilters: ReserveFilterValues = {
    keyword: '',
    type: 'all',
    reconciliationStatus: 'all',
  };

  // 已提交（驱动查询）的筛选值
  const [listFilterValues, setListFilterValues] =
    React.useState<ReserveFilterValues>(defaultFilters);
  const [investFilterValues, setInvestFilterValues] =
    React.useState<ReserveFilterValues>(defaultFilters);

  // 表单内编辑态（提交前不触发查询）
  const [listFormValues, setListFormValues] =
    React.useState<ReserveFilterValues>(defaultFilters);
  const [investFormValues, setInvestFormValues] =
    React.useState<ReserveFilterValues>(defaultFilters);

  const makeReserveParams = React.useCallback(
    (
      pageNum: number,
      filters: ReserveFilterValues,
    ): ReconciliationListParams<ReserveReconListReqVo> => ({
      pageNum,
      pageSize,
      filters: {
        reserveAccountId: reserveAccountId ?? 0,
        keyword: filters.keyword || undefined,
        type:
          filters.type && filters.type !== 'all'
            ? Number(filters.type)
            : undefined,
        reconciliationStatus:
          filters.reconciliationStatus &&
          filters.reconciliationStatus !== 'all'
            ? Number(filters.reconciliationStatus)
            : undefined,
      },
    }),
    [reserveAccountId, pageSize],
  );

  // ── Recon List 查询 ───────────────────────────────────────────────────────
  const listResult = useReserveListQuery(
    makeReserveParams(listPageNum, listFilterValues),
  );

  // ── Investigation 查询（R2: NOT pre-filtered） ────────────────────────────
  const investResult = useReserveInvestigationListQuery(
    makeReserveParams(investPageNum, investFilterValues),
  );

  const investTotal = investResult.data?.page?.total ?? 0;

  // ── Modal 状态 ────────────────────────────────────────────────────────────
  const [modal, setModal] = React.useState<ModalState>({ mode: null });
  const closeModal = () => setModal({ mode: null });

  // ── 筛选提交（form 编辑态 → 已提交态，并重置分页） ──────────────────────────
  const onListFilterSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setListFilterValues(listFormValues);
      setListPageNum(1);
    },
    [listFormValues],
  );

  const onInvestFilterSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setInvestFilterValues(investFormValues);
      setInvestPageNum(1);
    },
    [investFormValues],
  );

  // ── 筛选表单（对齐 real-time 详情页约定：keyword + type + status 原生 form） ──
  const renderFilterForm = React.useCallback(
    (tab: 'list' | 'investigation') => {
      const values = tab === 'list' ? listFormValues : investFormValues;
      const setValues =
        tab === 'list' ? setListFormValues : setInvestFormValues;
      const onSubmit =
        tab === 'list' ? onListFilterSubmit : onInvestFilterSubmit;

      return (
        <form
          onSubmit={onSubmit}
          className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4"
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
            <Label htmlFor={`${tab}-type`}>{t('reconciliation_0055')}</Label>
            <Select
              value={values.type}
              onValueChange={(v) =>
                setValues((prev) => ({ ...prev, type: v }))
              }
            >
              <SelectTrigger id={`${tab}-type`}>
                <SelectValue placeholder={t('common_all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common_all')}</SelectItem>
                <SelectItem value="1">
                  {t('reserve_type_1' as never)}
                </SelectItem>
                <SelectItem value="2">
                  {t('reserve_type_2' as never)}
                </SelectItem>
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
                <SelectItem value="2">
                  {t('reserve_status_2' as never)}
                </SelectItem>
                <SelectItem value="3">
                  {t('reserve_status_3' as never)}
                </SelectItem>
                <SelectItem value="4">
                  {t('reserve_status_4' as never)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit">{t('common_query')}</Button>
          </div>
        </form>
      );
    },
    [t, listFormValues, investFormValues, onListFilterSubmit, onInvestFilterSubmit],
  );

  // ── 列定义 ────────────────────────────────────────────────────────────────
  const buildColumns = React.useCallback<
    () => ColumnDef<ReserveReconDetailRespVo>[]
  >(
    () => [
      {
        accessorKey: 'lastReconciliationTime',
        header: t('reconciliation_0076'),
        cell: ({ row }) => formatTimestamp(row.original.lastReconciliationTime),
      },
      {
        accessorKey: 'reconciliationNo',
        header: t('reconciliation_0133'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.reconciliationNo}
            copyLabel={t('common_copy')}
            className="max-w-[180px]"
          />
        ),
      },
      {
        accessorKey: 'type',
        header: t('reconciliation_0055'),
        cell: ({ row }) => {
          const key = getReserveTypeKey(row.original.type);
          return key ? (t(key as never) ?? EMPTY_FIELD_VALUE) : EMPTY_FIELD_VALUE;
        },
      },
      {
        accessorKey: 'txHash',
        header: t('reconciliation_0015'),
        cell: ({ row }) => {
          const hash = row.original.txHash;
          if (!hash) {
            return <span className="text-destructive">{t('common_none')}</span>;
          }
          return (
            <CopyableEllipsisText
              value={hash}
              copyLabel={t('common_copy')}
              className="max-w-[200px]"
            />
          );
        },
      },
      {
        id: 'availableBalanceAtApproval',
        header: t('reconciliation_0215'),
        cell: ({ row }) => {
          if (Number(row.original.type) !== 1) return 'N/A';
          return (
            <span className="tabular-nums">
              {formatCurrencyValue(row.original.availableBalanceAtApproval)}
            </span>
          );
        },
      },
      {
        id: 'actualAmount',
        header: t('reconciliation_0040'),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div>
              <div className="tabular-nums">
                {formatCurrencyValue(record.actualAmount)}
              </div>
              {record.tokenCount != null ? (
                <div className="text-xs text-muted-foreground">
                  {record.tokenCount.toLocaleString()}
                  {record.tokenSymbol ? ` ${record.tokenSymbol}` : ''}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: 'reserveDiff',
        header: t('reconciliation_0233'),
        cell: ({ row }) => (
          <span
            className={
              Number(row.original.reserveDiff) < 0
                ? 'tabular-nums text-destructive'
                : 'tabular-nums'
            }
          >
            {formatCurrencyValue(row.original.reserveDiff)}
          </span>
        ),
      },
      {
        accessorKey: 'reconciliationStatus',
        header: t('reconciliation_0136'),
        cell: ({ row }) => {
          const status = row.original.reconciliationStatus;
          const tone = RESERVE_STATUS_TONE[status];
          const key = getReserveStatusKey(status);
          return (
            <StatusBadge tone={tone}>
              {key ? (t(key as never) ?? EMPTY_FIELD_VALUE) : EMPTY_FIELD_VALUE}
            </StatusBadge>
          );
        },
      },
      {
        id: 'actions',
        header: t('common_action'),
        cell: ({ row }) => (
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => {
              setModal({
                mode: 'log',
                reconciliationReserveId:
                  row.original.reconciliationReserveId,
                unmatchedType: row.original.reconciliationStatus === 3 ? 3 : undefined,
              });
            }}
          >
            {t('reconciliation_0110')}
          </Button>
        ),
      },
    ],
    [t],
  );

  const columns = React.useMemo(() => buildColumns(), [buildColumns]);

  // ── 关联 Token 渲染 ──────────────────────────────────────────────────────
  const renderAssociatedTokens = () => {
    const tokens = basicInfo?.associatedTokens ?? [];
    const tokenNames = tokens
      .map((token) => token.tokenName?.trim())
      .filter(Boolean);

    if (tokenNames.length === 0) return EMPTY_FIELD_VALUE;

    const shown = tokenNames.slice(0, 2);
    const moreCount = tokenNames.length - shown.length;
    return moreCount > 0
      ? `${shown.join(', ')}, ... + ${moreCount} more`
      : shown.join(', ');
  };

  // ── 标题 ──────────────────────────────────────────────────────────────────
  const title = React.useMemo(() => {
    const name =
      basicInfo?.reserveAssetName?.trim() ||
      basicInfo?.reserveAccountName?.trim();
    return name ? `${name} Reconciliation` : t('reconciliation_0145');
  }, [basicInfo, t]);

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <ReconciliationSection title={title}>
        {basicLoading ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
            <InfoItem label={t('reconciliation_0203')}>
              {formatCurrencyValue(basicInfo?.assetValue)}
            </InfoItem>
            <InfoItem label={t('reconciliation_0032')}>
              {basicInfo?.currencySymbol || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0047')}>
              {basicInfo?.financeBookName || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0048')}>
              <CopyableEllipsisText
                value={basicInfo?.bookNo}
                copyLabel={t('common_copy')}
                className="max-w-[200px]"
              />
            </InfoItem>
            <InfoItem label={t('reconciliation_0205')}>
              {renderAssociatedTokens()}
            </InfoItem>
            <InfoItem label={t('reconciliation_0140')}>
              {basicInfo?.createdBy || EMPTY_FIELD_VALUE}
            </InfoItem>
            <InfoItem label={t('reconciliation_0141')}>
              {formatTimestamp(basicInfo?.createTime)}
            </InfoItem>
            <InfoItem label={t('reconciliation_0076')}>
              {formatTimestamp(basicInfo?.lastReconciliationTime)}
            </InfoItem>
          </div>
        )}
      </ReconciliationSection>

      {/* 统计卡片：Matched + Exceptions（Reserve 无 Actioned） */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReconciliationMetricCard
          label={t('reconciliation_0073')}
          value={
            <span className="font-semibold text-[#52c41a]">
              {basicInfo?.matchedCount ?? 0}
            </span>
          }
          extra={
            <div className="text-xs text-muted-foreground">
              {t.rich('reconciliation_0142', {
                time: formatTimestamp(basicInfo?.lastReconciliationTime),
              })}
            </div>
          }
        />
        <ReconciliationMetricCard
          label={t('reconciliation_0204')}
          value={
            <span className="font-semibold text-destructive">
              {basicInfo?.exceptionsCount ?? 0}
            </span>
          }
          extra={
            <div className="text-xs text-muted-foreground">
              {t.rich('reconciliation_0142', {
                time: formatTimestamp(basicInfo?.lastReconciliationTime),
              })}
            </div>
          }
        />
      </div>

      {/* 双 Tab */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'list' | 'investigation')}
      >
        <TabsList>
          <TabsTrigger value="list">{t('reconciliation_0143')}</TabsTrigger>
          <TabsTrigger value="investigation">
            {t('reconciliation_0144')} ({investTotal})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {renderFilterForm('list')}
          <DetailTablePanel
            columns={columns}
            data={listResult.data?.rows ?? []}
            isLoading={listResult.isLoading || listResult.isFetching}
            total={listResult.data?.page?.total ?? 0}
            emptyMessage={t('common_no_data')}
            pageNum={listPageNum}
            pageSize={pageSize}
            onPageChange={setListPageNum}
          />
        </TabsContent>

        <TabsContent value="investigation">
          {renderFilterForm('investigation')}
          <DetailTablePanel
            columns={columns}
            data={investResult.data?.rows ?? []}
            isLoading={investResult.isLoading || investResult.isFetching}
            total={investTotal}
            emptyMessage={t('common_no_data')}
            pageNum={investPageNum}
            pageSize={pageSize}
            onPageChange={setInvestPageNum}
          />
        </TabsContent>
      </Tabs>

      {/* Recon Log Modal（只读，R1: PostToSuspense 不接线） */}
      <ReserveReconLogModal
        open={modal.mode === 'log'}
        reconciliationReserveId={modal.reconciliationReserveId}
        unmatchedType={modal.unmatchedType}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      />
    </div>
  );
}
