'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { Button, DataTable } from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useAccrualDetailQuery,
  useAccrualWalletRecordsQuery,
  type AccrualWalletListFilters,
  type AccrualWalletRecord,
} from '@myorg/modules/mmf/data-access';
import {
  MmfBasicDetails,
  MmfStatusBadge,
  type MmfBasicDetailItem,
} from '@myorg/modules/mmf/ui';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/mmf/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const DATE_FMT = 'YYYY-MM-DD';

/**
 * reSet 的本地等价：value >= 0 → 千分位 + 2 位小数；否则 '--'。
 * 与 settlement-list-page / settlement-detail-page / accrual-list-page 同款语义，
 * 便于后续抽到 util（暂不抽，遵循 Rule 2：单一用途内联）。
 */
function reSet(
  value: string | number | undefined | null,
  symbol?: string,
): string {
  if (value == null || Number.isNaN(Number(value)) || Number(value) < 0) {
    return symbol ? `${EMPTY_DISPLAY} ${symbol}` : EMPTY_DISPLAY;
  }
  const formatted = Number(value).toFixed(2)
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
}

const EMPTY_WALLET_FILTER: WalletFilterForm = {
  walletAddress: '',
};

/**
 * 构造钱包明细子表格 filters。
 *
 * - `billCode` 作为 initialValue 常量随请求带上（源 useCustomTable initialValues 语义），
 *   与 settlement-detail 的 settlementId initialValue 同构。
 * - `walletAddress` 仅在用户填写时带上筛选。
 */
function walletFormToFilters(
  f: WalletFilterForm,
  billCode: string | null,
): AccrualWalletListFilters {
  return {
    billCode: billCode ?? undefined,
    walletAddress: f.walletAddress || undefined,
  };
}

/**
 * AccrualDetailPage — 分红计提详情页。
 *
 * 迁移自 td-manage src/pages/mmf/accrual/view.tsx（218 行）。
 * useSWR + useCustomTable → TanStack Query + react-hook-form + DataTable。
 *
 * 布局（对齐源 CustomIBasicDetailsInfo + CustomTable）：
 *   - 基本信息（MmfBasicDetails）：13 字段，状态字段 `span:3` 打破默认 2 列网格。
 *     金额字段统一 `reSet(value) + ' ' + tokenSymbol`；token 名带链名括注
 *     （`tokenName (blockchainName)`）。
 *   - 钱包明细子表格（DataTable）：按 `walletAddress` 筛选，initialValues 带 `billCode`
 *     （来自列表页跳转 query）。rowKey 源为 `accrualTime`，金额两列拼 tokenSymbol。
 *
 * 底部「返回」按钮（对齐 statements-detail / settlement-detail 的 `flex justify-end`）。
 */
export function AccrualDetailPage() {
  const t = useTranslations('modules.mmf');
  const router = useRouter();
  const params = useParams<{ slug?: string[] }>();
  const searchParams = useSearchParams();
  const accrualRecordIdRaw = params?.slug?.[1];
  const billCode = searchParams?.get('billCode') ?? null;
  const accrualRecordId = accrualRecordIdRaw
    ? Number(accrualRecordIdRaw)
    : undefined;
  const hasId = accrualRecordId != null && accrualRecordId > 0;

  const { data: detail, isLoading: detailLoading } =
    useAccrualDetailQuery(accrualRecordIdRaw);

  // ── 钱包明细子表格 ──
  const { register, handleSubmit, reset } = useForm<WalletFilterForm>({
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
        ? walletFormToFilters(walletQueryValues, billCode)
        : { billCode: billCode ?? undefined },
    }),
    [
      walletPagination.pageNum,
      walletPagination.pageSize,
      walletQueryValues,
      hasId,
      billCode,
    ],
  );
  const walletList = useAccrualWalletRecordsQuery(walletParams);
  const walletRows = walletList.data?.rows ?? [];
  const walletTotal = walletList.data?.page?.total ?? 0;
  const walletLoading = walletList.isLoading || walletList.isFetching;

  const walletColumns = React.useMemo<ColumnDef<AccrualWalletRecord>[]>(
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
        accessorKey: 'walletBalance',
        header: t('field.walletBalance'),
        cell: ({ row }) => (
          <span>
            {reSet(row.original.walletBalance, row.original.tokenSymbol)}
          </span>
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

  // ── 基本信息描述项（13 字段，状态 span:3 打破网格）──
  const basicItems: MmfBasicDetailItem[] = React.useMemo(() => {
    if (!detail) return [];
    const tokenCell =
      detail.tokenName || detail.blockchainName
        ? `${detail.tokenName ?? ''}${
            detail.blockchainName ? ` (${detail.blockchainName})` : ''
          }`
        : '';
    return [
      {
        key: 'accrualDate',
        label: t('field.accrualDate'),
        value: <span>{formatDateOnly(detail.accrualDate)}</span>,
      },
      {
        key: 'tokenName',
        label: t('field.tokenName'),
        value: <span>{tokenCell || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'fundName',
        label: t('field.fundName'),
        value: <span>{detail.fundName || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'fundCode',
        label: t('field.fundCode'),
        value: <span>{detail.fundCode || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'totalUnits',
        label: t('field.totalUnits'),
        value: (
          <span>{reSet(detail.totalUnits, detail.totalUnitsSymbol)}</span>
        ),
      },
      {
        key: 'dividendMethod',
        label: t('field.dividendMethod'),
        value: <span>{detail.dividendMethod || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'totalWalletBalance',
        label: t('field.totalWalletBalance'),
        value: (
          <span>{reSet(detail.totalWalletBalance, detail.totalUnitsSymbol)}</span>
        ),
      },
      {
        key: 'totalWallets',
        label: t('field.totalWallets'),
        value: <span>{detail.totalWallets ?? EMPTY_DISPLAY}</span>,
      },
      {
        key: 'createdBy',
        label: t('field.createUser'),
        value: <span>{detail.createdBy || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'createdOn',
        label: t('field.createTime'),
        value: <span>{formatTime(detail.createdOn)}</span>,
      },
      {
        key: 'appliedBy',
        label: t('field.appliedBy'),
        value: <span>{detail.appliedBy || EMPTY_DISPLAY}</span>,
      },
      {
        key: 'appliedOn',
        label: t('field.appliedTime'),
        value: <span>{formatTime(detail.appliedOn)}</span>,
      },
      // 状态字段 span:3 占满整行，打破默认 2 列布局（源 Descriptions.Item span:3）。
      {
        key: 'status',
        label: t('field.status'),
        value: <MmfStatusBadge kind="accrual" status={detail.status} />,
        span: 3,
      },
    ];
  }, [detail, t]);

  if (!hasId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {t('accrual.detail.title')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MmfBasicDetails
        title={t('accrual.detail.title')}
        items={basicItems}
        isLoading={detailLoading}
        emptyMessage={t('empty')}
      />

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('accrual.detail.walletRecords')}
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

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
