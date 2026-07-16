'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Button, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import { PermissionGuard } from '@myorg/shared/util-auth';
import {
  useFundListQuery,
  useSettlementRecordListQuery,
  type SettlementListFilters,
  type SettlementRecordItem,
} from '@myorg/modules/mmf/data-access';
import { MmfStatusBadge } from '@myorg/modules/mmf/ui';
import {
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  MMF_PERMISSIONS,
  SETTLEMENT_STATUS_OPTIONS,
  SETTLEMENT_TX_TYPE_KEY_PREFIX,
} from '@myorg/modules/mmf/util';

const DATETIME_FMT = 'YYYY-MM-DD';

interface SettlementFilterForm {
  settlementCode: string;
  appliedTimeFrom: string;
  appliedTimeTo: string;
  ruleId: string;
  status: string;
}

const EMPTY_FILTER: SettlementFilterForm = {
  settlementCode: '',
  appliedTimeFrom: '',
  appliedTimeTo: '',
  ruleId: ALL_VALUE,
  status: ALL_VALUE,
};

function formToFilters(f: SettlementFilterForm): SettlementListFilters {
  return {
    settlementCode: f.settlementCode || undefined,
    appliedTimeStartDate: f.appliedTimeFrom
      ? startOfDay(parseISO(f.appliedTimeFrom)).getTime()
      : undefined,
    appliedTimeEndDate: f.appliedTimeTo
      ? endOfDay(parseISO(f.appliedTimeTo)).getTime()
      : undefined,
    ruleId: f.ruleId !== ALL_VALUE ? f.ruleId : undefined,
    status: f.status !== ALL_VALUE ? f.status : undefined,
  };
}

/**
 * reSet 的本地等价：value >= 0 → 千分位 + 2 位小数；否则 '--'。
 * 迁移自 td-manage libs/utils 的 reSet（len=2 默认）。
 *
 * 与源码实现一致：先 `toFixed(2)` 再对小数点前的整数部分插入千分位。
 * 与 accrual-apply-modal 的 reSet 保持同款语义，便于后续抽到 util。
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

/**
 * SettlementListPage — 分红结算列表页。
 *
 * 迁移自 td-manage src/pages/mmf/settlement/index.tsx（183 行）。
 * useCustomTable → react-hook-form + DataTable。
 *
 * 4 个筛选条件：结算编码 / 申请时间范围 / 基金 / 状态。
 * 行操作「查看」跳 `/mmf/settlement/:id`（受 SETTLEMENT_VIEW_BTN 权限码控制）。
 * 状态色用 SETTLEMENT_STATUS_COLOR（via MmfStatusBadge kind="settlement"）。
 */
export function SettlementListPage() {
  const t = useTranslations('modules.mmf');
  const router = useRouter();

  const { control, register, handleSubmit, reset } = useForm<SettlementFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<SettlementFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );
  const listResult = useSettlementRecordListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const fundListQuery = useFundListQuery();
  const fundOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...(fundListQuery.data ?? []).map((f) => ({
        value: String(f.ruleId ?? ''),
        label: f.fundName ?? '',
      })),
    ],
    [t, fundListQuery.data],
  );
  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      ...SETTLEMENT_STATUS_OPTIONS.map((o) => ({
        value: String(o.value),
        label: t(o.labelKey),
      })),
    ],
    [t],
  );

  const columns = React.useMemo<ColumnDef<SettlementRecordItem>[]>(
    () => [
      {
        id: 'index',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>
            {(pagination.pageNum - 1) * pagination.pageSize + row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: 'settlementCode',
        header: t('field.settlementCode'),
        cell: ({ row }) => (
          <span>{row.original.settlementCode || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('field.applyTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatDate(row.original.createTime, DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'fundName',
        header: t('field.fundName'),
        cell: ({ row }) => (
          <span>{row.original.fundName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenName',
        header: t('field.tokenName'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
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
        accessorKey: 'transactionType',
        header: t('field.transactionType'),
        cell: ({ row }) => {
          const txType = row.original.transactionType;
          return txType == null ? (
            <span>{EMPTY_DISPLAY}</span>
          ) : (
            <span>{t(`${SETTLEMENT_TX_TYPE_KEY_PREFIX}_${txType}`)}</span>
          );
        },
      },
      {
        accessorKey: 'accruedTokenCount',
        header: t('field.dividendAmount'),
        cell: ({ row }) => (
          <span>
            {reSet(row.original.accruedTokenCount, row.original.tokenSymbol)}
          </span>
        ),
      },
      {
        accessorKey: 'realityTokenCount',
        header: t('field.distributedDividend'),
        cell: ({ row }) => (
          <span>
            {reSet(row.original.realityTokenCount, row.original.tokenSymbol)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <MmfStatusBadge kind="settlement" status={row.original.status} />
        ),
      },
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <PermissionGuard permission={MMF_PERMISSIONS.SETTLEMENT_VIEW_BTN}>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`/mmf/settlement/${r.settlementId ?? ''}`)
                }
              >
                {t('action.view')}
              </Button>
            </PermissionGuard>
          );
        },
      },
    ],
    [t, router, pagination.pageNum, pagination.pageSize],
  );

  const onSubmit = React.useCallback((f: SettlementFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="settlementCode"
            label={t('field.settlementCode')}
            register={register('settlementCode')}
            placeholder={t('field.settlementCode')}
          />
          <FormDatePicker
            name="appliedTimeFrom"
            control={control}
            label={t('field.applyTimeFrom')}
          />
          <FormDatePicker
            name="appliedTimeTo"
            control={control}
            label={t('field.applyTimeTo')}
          />
          <FormSelect
            name="ruleId"
            control={control}
            label={t('field.fundName')}
            options={fundOptions}
            placeholder={t('filter.all')}
          />
          <FormSelect
            name="status"
            control={control}
            label={t('field.status')}
            options={statusOptions}
            placeholder={t('filter.all')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('filter.query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('filter.reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">
            {t('settlement.list.title')}
          </div>
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (p) =>
                setPagination((prev) => ({ ...prev, pageNum: p })),
            }}
          />
        </div>
      </div>
    </div>
  );
}
