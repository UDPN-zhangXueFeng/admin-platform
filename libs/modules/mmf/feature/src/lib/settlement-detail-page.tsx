'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DataTable,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import { PermissionGuard } from '@myorg/shared/util-auth';
import {
  useSettlementApprovalRecordsQuery,
  useSettlementDetailQuery,
  useSettlementWalletRecordsQuery,
  type SettlementApprovalListFilters,
  type SettlementApprovalRecord,
  type SettlementWalletListFilters,
  type SettlementWalletRecord,
} from '@myorg/modules/mmf/data-access';
import {
  MmfBasicDetails,
  MmfStatusBadge,
  type MmfBasicDetailItem,
} from '@myorg/modules/mmf/ui';
import {
  ALL_VALUE,
  buildApprovalViewUrl,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  MMF_PERMISSIONS,
  SETTLEMENT_OP_TYPE_KEY_PREFIX,
  SETTLEMENT_WALLET_RECORD_STATUS_OPTIONS,
  statusToneClass,
} from '@myorg/modules/mmf/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FMT = 'YYYY-MM-DD';

/** 审批记录状态色值走 mmf.json 根级扁平 i18n key（与源 router.json 命名一致）。 */
const APPROVAL_STATUS_COLOR_KEY = 'approval_task_status_color_';
const APPROVAL_STATUS_LABEL_KEY = 'common_task_status_';

/**
 * reSet 的本地等价：value >= 0 → 千分位 + 2 位小数；否则 '--'。
 * 与 settlement-list-page / accrual-apply-modal 同款语义，便于后续抽到 util。
 */
function reSet(
  value: number | undefined | null,
  symbol?: string,
): string {
  if (value == null || Number.isNaN(value) || value < 0) {
    return symbol ? `${EMPTY_DISPLAY} ${symbol}` : EMPTY_DISPLAY;
  }
  const formatted = value
    .toFixed(2)
    .replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
  return symbol ? `${formatted} ${symbol}` : formatted;
}

function formatTime(ts: number | undefined): string {
  return ts ? formatDate(ts, DATETIME_FMT) : EMPTY_DISPLAY;
}

function formatDateOnly(ts: number | undefined): string {
  return ts ? formatDate(ts, DATE_FMT) : EMPTY_DISPLAY;
}

interface WalletFilterForm {
  walletAddress: string;
  status: string;
}

const EMPTY_WALLET_FILTER: WalletFilterForm = {
  walletAddress: '',
  status: ALL_VALUE,
};

function walletFormToFilters(
  f: WalletFilterForm,
  settlementId: number,
): SettlementWalletListFilters {
  return {
    settlementId,
    walletAddress: f.walletAddress || undefined,
    status: f.status !== ALL_VALUE ? f.status : undefined,
  };
}

/**
 * SettlementDetailPage — 分红结算详情页。
 *
 * 迁移自 td-manage src/pages/mmf/settlement/view.tsx（337 行）。
 * useSWR + useCustomTable → TanStack Query + react-hook-form + DataTable。
 *
 * Tabs 双页签：
 *   - Tab1（基本信息）：MmfBasicDetails（8 字段，不含注释掉的 riskLevel/createUser 死代码）
 *     + 钱包记录子表格（按 walletAddress + status 筛选，initialValues 带 settlementId，
 *     状态色用 MmfStatusBadge kind="settlement-wallet-record"）。
 *   - Tab2（审批记录）：审批记录子表格，行「查看」跳 `/approval-manage/view`
 *     （传 taskId + busCode），状态色走 i18n key `approval_task_status_color_${state}`。
 *
 * 底部「返回」按钮。
 */
export function SettlementDetailPage() {
  const t = useTranslations('modules.mmf');
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const settlementIdRaw = params?.id;
  const settlementId = settlementIdRaw ? Number(settlementIdRaw) : undefined;
  const hasId = settlementId != null && settlementId > 0;
  // 已校验的有效结算 ID（无 id 时退化为 0，保证子表格查询不报错；hasId false 时已早返回或显示空）。
  const settlementIdValue = settlementId ?? 0;

  const { data: detail, isLoading: detailLoading } =
    useSettlementDetailQuery(settlementIdRaw);

  // ── Tab1：钱包记录子表格 ──
  const { control, register, handleSubmit, reset } = useForm<WalletFilterForm>({
    defaultValues: EMPTY_WALLET_FILTER,
  });
  const [walletQueryValues, setWalletQueryValues] =
    React.useState<WalletFilterForm>(EMPTY_WALLET_FILTER);
  const [walletPagination, setWalletPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const walletParams = React.useMemo(
    () => ({
      pageNum: walletPagination.pageNum,
      pageSize: walletPagination.pageSize,
      filters: hasId
        ? walletFormToFilters(walletQueryValues, settlementIdValue)
        : { settlementId: settlementIdValue },
    }),
    [walletPagination.pageNum, walletPagination.pageSize, walletQueryValues, hasId, settlementIdValue],
  );
  const walletList = useSettlementWalletRecordsQuery(walletParams);
  const walletRows = walletList.data?.rows ?? [];
  const walletTotal = walletList.data?.page?.total ?? 0;
  const walletLoading = walletList.isLoading || walletList.isFetching;

  const walletStatusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...SETTLEMENT_WALLET_RECORD_STATUS_OPTIONS.map((o) => ({
        value: String(o.value),
        label: t(o.labelKey),
      })),
    ],
    [t],
  );

  const walletColumns = React.useMemo<ColumnDef<SettlementWalletRecord>[]>(
    () => [
      {
        id: 'index',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>
            {(walletPagination.pageNum - 1) * walletPagination.pageSize +
              row.index +
              1}
          </span>
        ),
      },
      {
        accessorKey: 'walletAddress',
        header: t('field.walletAddress'),
        cell: ({ row }) => (
          <span className="break-all">
            {row.original.walletAddress || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('field.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'accrualDate',
        header: t('field.accrualDate'),
        cell: ({ row }) => (
          <span>{formatDateOnly(row.original.accrualDate)}</span>
        ),
      },
      {
        accessorKey: 'accrualUnits',
        header: t('field.accrualUnits'),
        cell: ({ row }) => (
          <span>
            {reSet(row.original.accrualUnits, row.original.tokenSymbol)}
          </span>
        ),
      },
      {
        accessorKey: 'finalDistributed',
        header: t('field.finalDistributed'),
        cell: ({ row }) => (
          <span>
            {reSet(row.original.finalDistributed, row.original.tokenSymbol)}
          </span>
        ),
      },
      {
        accessorKey: 'txTime',
        header: t('field.txTime'),
        cell: ({ row }) => <span>{formatTime(row.original.txTime)}</span>,
      },
      {
        accessorKey: 'txHash',
        header: t('field.txHash'),
        cell: ({ row }) => (
          <span className="break-all">
            {row.original.txHash || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <MmfStatusBadge
            kind="settlement-wallet-record"
            status={row.original.status}
          />
        ),
      },
    ],
    [t, walletPagination.pageNum, walletPagination.pageSize],
  );

  const onWalletSubmit = React.useCallback((f: WalletFilterForm) => {
    setWalletPagination((p) => ({ ...p, pageNum: 1 }));
    setWalletQueryValues(f);
  }, []);
  const onWalletReset = React.useCallback(() => {
    reset(EMPTY_WALLET_FILTER);
    setWalletQueryValues(EMPTY_WALLET_FILTER);
    setWalletPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  // ── Tab2：审批记录子表格 ──
  const [approvalPagination, setApprovalPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const approvalParams = React.useMemo(
    () => ({
      pageNum: approvalPagination.pageNum,
      pageSize: approvalPagination.pageSize,
      filters: {
        settlementId: settlementIdValue,
      } as SettlementApprovalListFilters,
    }),
    [approvalPagination.pageNum, approvalPagination.pageSize, settlementIdValue],
  );
  const approvalList = useSettlementApprovalRecordsQuery(approvalParams);
  const approvalRows = approvalList.data?.rows ?? [];
  const approvalTotal = approvalList.data?.page?.total ?? 0;
  const approvalLoading = approvalList.isLoading || approvalList.isFetching;

  const approvalColumns = React.useMemo<ColumnDef<SettlementApprovalRecord>[]>(
    () => [
      {
        id: 'index',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>
            {(approvalPagination.pageNum - 1) * approvalPagination.pageSize +
              row.index +
              1}
          </span>
        ),
      },
      {
        accessorKey: 'operationType',
        header: t('field.operationType'),
        cell: ({ row }) => {
          const opType = row.original.operationType;
          return opType == null ? (
            <span>{EMPTY_DISPLAY}</span>
          ) : (
            <span>{t(`${SETTLEMENT_OP_TYPE_KEY_PREFIX}_${opType}`)}</span>
          );
        },
      },
      {
        accessorKey: 'createBy',
        header: t('field.createBy'),
        cell: ({ row }) => (
          <span>{row.original.createBy || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('field.createTime'),
        cell: ({ row }) => <span>{formatTime(row.original.createTime)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => {
          const state = row.original.status;
          if (state == null) return <span>{EMPTY_DISPLAY}</span>;
          const tone = t(`${APPROVAL_STATUS_COLOR_KEY}${state}`);
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusToneClass(
                tone,
              )}`}
            >
              {t(`${APPROVAL_STATUS_LABEL_KEY}${state}`)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <PermissionGuard permission={MMF_PERMISSIONS.SETTLEMENT_RECORD_VIEW_BTN}>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    buildApprovalViewUrl(r.taskId, r.businessCode),
                  )
                }
              >
                {t('action.view')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, router, approvalPagination.pageNum, approvalPagination.pageSize],
  );

  // ── 基本信息描述项（8 字段，不含 riskLevel / createUser 死代码）──
  const basicItems: MmfBasicDetailItem[] = React.useMemo(() => {
    if (!detail) return [];
    return [
      {
        key: 'settlementCode',
        label: t('field.settlementCode'),
        value: <span>{detail.settlementCode || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'createTime',
        label: t('field.applyTime'),
        value: <span>{formatDateOnly(detail.createTime)}</span>,
      },
      {
        key: 'tokenName',
        label: t('field.tokenName'),
        value: <span>{detail.tokenName || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'blockchainName',
        label: t('field.blockchain'),
        value: <span>{detail.blockchainName || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'fundName',
        label: t('field.fundName'),
        value: <span>{detail.fundName || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'dividendMethod',
        label: t('field.dividendMethod'),
        value: <span>{detail.dividendMethod || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'totalUnits',
        label: t('field.totalUnits'),
        value: (
          <span>{reSet(detail.totalUnits, detail.totalUnitsSymbol)}</span>
        ),
      },
      {
        key: 'finalDistributed',
        label: t('field.finalDistributed'),
        value: (
          <span>{reSet(detail.finalDistributed, detail.totalUnitsSymbol)}</span>
        ),
      },
    ];
  }, [detail, t]);

  if (!hasId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {t('settlement.detail.title')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">{t('tabs.basicInfo')}</TabsTrigger>
          <TabsTrigger value="approval">
            {t('tabs.approvalRecords')}
          </TabsTrigger>
        </TabsList>

        {/* Tab1：基本信息 + 钱包记录子表格 */}
        <TabsContent value="basic" className="space-y-4 pt-4">
          <MmfBasicDetails
            title={t('settlement.detail.title')}
            items={basicItems}
            isLoading={detailLoading}
            emptyMessage={t('empty')}
          />

          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('tabs.walletRecords')}
            </div>
            <div className="p-4">
              <form
                onSubmit={handleSubmit(onWalletSubmit)}
                className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                <FormField
                  name="walletAddress"
                  label={t('field.walletAddress')}
                  register={register('walletAddress')}
                  placeholder={t('field.walletAddress')}
                />
                <FormSelect
                  name="status"
                  control={control}
                  label={t('field.status')}
                  options={walletStatusOptions}
                  placeholder={t('filter.all')}
                />
                <div className="flex items-end gap-2">
                  <Button type="submit">{t('filter.query')}</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onWalletReset}
                  >
                    {t('filter.reset')}
                  </Button>
                </div>
              </form>

              <DataTable
                columns={walletColumns}
                data={walletRows}
                isLoading={walletLoading}
                emptyMessage={t('empty')}
                pagination={{
                  page: walletPagination.pageNum,
                  pageSize: walletPagination.pageSize,
                  total: walletTotal,
                  onPageChange: (p) =>
                    setWalletPagination((prev) => ({ ...prev, pageNum: p })),
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* Tab2：审批记录子表格 */}
        <TabsContent value="approval" className="pt-4">
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="border-b px-6 py-3 text-sm font-semibold">
              {t('tabs.approvalRecords')}
            </div>
            <div className="p-4">
              <DataTable
                columns={approvalColumns}
                data={approvalRows}
                isLoading={approvalLoading}
                emptyMessage={t('empty')}
                pagination={{
                  page: approvalPagination.pageNum,
                  pageSize: approvalPagination.pageSize,
                  total: approvalTotal,
                  onPageChange: (p) =>
                    setApprovalPagination((prev) => ({ ...prev, pageNum: p })),
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
