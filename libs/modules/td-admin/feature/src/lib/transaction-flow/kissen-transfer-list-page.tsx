'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import {
  Badge,
  CopyableEllipsisText,
  DataTable,
  type DataTablePagination,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import {
  FormDateRangePicker,
  FormField,
  FormSelect,
} from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import {
  useKissenTransferList,
  type KissenTransferFilters,
  type KissenTransferRow,
} from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import { createRowActionsColumn } from '../row-actions';
import {
  formatRate,
  formatTokenAmount,
  isTruthyFlag,
  KISSEN_EMPTY_DISPLAY,
  KISSEN_STATUS_FILTER_CODES,
  KISSEN_TRANSFER_PERMISSIONS,
  KISSEN_TX_STATUS,
} from './kissen-transfer.constants';

const ALL = 'all';
const PAIR_ID_PATTERN = /^\d+$/;
const PAGE_SIZE = 10;

interface KissenFilterForm {
  txNo: string;
  pairId: string;
  senderAccount: string;
  receiverAccount: string;
  lpName: string;
  status: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FILTER: KissenFilterForm = {
  txNo: '',
  pairId: '',
  senderAccount: '',
  receiverAccount: '',
  lpName: '',
  status: ALL,
  startTime: '',
  endTime: '',
};

function toFilters(values: KissenFilterForm): KissenTransferFilters {
  const filters: KissenTransferFilters = {};
  if (values.txNo.trim()) filters.txNo = values.txNo.trim();
  if (PAIR_ID_PATTERN.test(values.pairId.trim())) {
    filters.pairId = Number(values.pairId.trim());
  }
  if (values.senderAccount.trim()) {
    filters.senderAccount = values.senderAccount.trim();
  }
  if (values.receiverAccount.trim()) {
    filters.receiverAccount = values.receiverAccount.trim();
  }
  if (values.lpName.trim()) filters.lpName = values.lpName.trim();
  if (values.status !== ALL) filters.status = Number(values.status);
  if (values.startTime) {
    filters.startTime = startOfDay(parseISO(values.startTime)).getTime();
  }
  if (values.endTime) {
    filters.endTime = endOfDay(parseISO(values.endTime)).getTime();
  }
  return filters;
}

/**
 * Kissen 跨行转账列表。
 *
 * 迁移自 td-manage `pages/transaction-flow/kissen-transfer/index.tsx`：
 * 筛选 txNo / pairId / From / To / LP Name / Status / Created Date，
 * 列与旧页对齐（Transaction No. / Tokens / From / To / FX Rate / Created on / Status），
 * Details 跳转详情页（携带 txUuid / sourceCsTxId / targetCsTxId）。
 */
export function KissenTransferListPage() {
  const t = useTranslations('modules.transaction-flow');
  const tc = useTranslations('common');
  const router = useRouter();
  const { permissions } = useAuth();
  /** 权限未配置（空集）时全放开，兼容权限未接入场景（chart-of-accounts 约定）。 */
  const canViewDetails =
    permissions.size === 0 ||
    permissions.has(KISSEN_TRANSFER_PERMISSIONS.DETAILS_BTN);

  const form = useForm<KissenFilterForm>({
    defaultValues: EMPTY_FILTER,
    mode: 'onChange',
  });
  const values = form.watch();
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: PAGE_SIZE,
  });

  const filters = React.useMemo(() => toFilters(values), [values]);
  const { data, isLoading } = useKissenTransferList({
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    filters,
  });
  const rows = data?.rows ?? [];

  const statusOptions = React.useMemo(
    () => [
      { value: ALL, label: tc('PUB_All') },
      ...KISSEN_STATUS_FILTER_CODES.map((code) => ({
        value: String(code),
        label: t(KISSEN_TX_STATUS[code].labelKey),
      })),
    ],
    [t, tc],
  );

  const openDetail = React.useCallback(
    (row: KissenTransferRow) => {
      const query = new URLSearchParams();
      if (row.txUuid) query.set('txUuid', row.txUuid);
      if (row.sourceCsTxId) query.set('sourceCsTxId', row.sourceCsTxId);
      if (row.targetCsTxId) query.set('targetCsTxId', row.targetCsTxId);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      router.push(
        `/transaction-flow/kissen-transfer/${row.transactionId}${suffix}`,
      );
    },
    [router],
  );

  const columns = React.useMemo<ColumnDef<KissenTransferRow>[]>(
    () => [
      {
        id: 'txNo',
        header: t('kissen_transfer_col_transaction_no'),
        accessorKey: 'txNo',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const record = row.original;
          const value = record.txNo || record.txUuid;
          return (
            <div className="inline-flex flex-wrap items-center gap-2">
              {value ? (
                <CopyableEllipsisText
                  value={value}
                  truncate="middle"
                  maxWidth={190}
                />
              ) : (
                <span>{KISSEN_EMPTY_DISPLAY}</span>
              )}
              {isTruthyFlag(record.selfTrade) && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Badge variant="warning" size="sm">
                          {t('kissen_transfer_self_trade')}
                        </Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('kissen_transfer_self_trade_hint')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
      {
        id: 'tokens',
        header: t('kissen_transfer_col_tokens'),
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const record = row.original;
          if (!record.sourceTokenSymbol && !record.targetTokenSymbol) {
            return <span>{KISSEN_EMPTY_DISPLAY}</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-sm">
                  {record.sourceTokenSymbol || KISSEN_EMPTY_DISPLAY}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {record.sourceBankCode || KISSEN_EMPTY_DISPLAY}
                </span>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="flex flex-col items-center">
                <span className="rounded-full border border-success/40 bg-card px-2.5 py-0.5 text-sm text-success">
                  {record.targetTokenSymbol || KISSEN_EMPTY_DISPLAY}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {record.targetBankCode || KISSEN_EMPTY_DISPLAY}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'from',
        header: t('kissen_transfer_col_from'),
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div className="min-w-0">
              <div className="text-sm font-medium tabular-nums">
                {record.userDeduction === null ||
                record.userDeduction === undefined
                  ? KISSEN_EMPTY_DISPLAY
                  : `${formatTokenAmount(record.userDeduction)} ${
                      record.sourceTokenSymbol || ''
                    }`.trim()}
              </div>
              {record.senderAccount ? (
                <CopyableEllipsisText
                  value={record.senderAccount}
                  truncate="middle"
                  maxWidth={190}
                  className="font-mono"
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {record.senderBankName || KISSEN_EMPTY_DISPLAY}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'to',
        header: t('kissen_transfer_col_to'),
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div className="min-w-0">
              <div className="text-sm font-medium tabular-nums">
                {record.receiverAmount === null ||
                record.receiverAmount === undefined
                  ? KISSEN_EMPTY_DISPLAY
                  : `${formatTokenAmount(record.receiverAmount)} ${
                      record.targetTokenSymbol || ''
                    }`.trim()}
              </div>
              {record.receiverAccount ? (
                <CopyableEllipsisText
                  value={record.receiverAccount}
                  truncate="middle"
                  maxWidth={190}
                  className="font-mono"
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {record.receivingBankName || KISSEN_EMPTY_DISPLAY}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'userRate',
        header: t('kissen_transfer_col_fx_rate'),
        accessorKey: 'userRate',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatRate(row.original.userRate)}
          </span>
        ),
      },
      {
        id: 'createTime',
        header: t('kissen_transfer_col_created_on'),
        accessorKey: 'createTime',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatAdminTimestamp(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('kissen_transfer_col_status'),
        accessorKey: 'status',
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const record = row.original;
          const meta =
            record.status === null || record.status === undefined
              ? undefined
              : KISSEN_TX_STATUS[Number(record.status)];
          return (
            <div className="flex flex-wrap items-center gap-1">
              {meta ? (
                <Badge variant={meta.variant} dot>
                  {t(meta.labelKey)}
                </Badge>
              ) : (
                <span>{KISSEN_EMPTY_DISPLAY}</span>
              )}
              {isTruthyFlag(record.pendingFlag) && (
                <Badge variant="warning">
                  {t('kissen_transfer_pending')}
                </Badge>
              )}
            </div>
          );
        },
      },
      createRowActionsColumn<KissenTransferRow>({
        header: tc('PUB_Action'),
        detail: canViewDetails
          ? () => ({
              label: t('kissen_transfer_details'),
              onClick: openDetail,
            })
          : undefined,
      }),
    ],
    [canViewDetails, openDetail, t, tc],
  );

  const tablePagination = React.useMemo<DataTablePagination>(
    () => ({
      page: pagination.pageNum,
      pageSize: pagination.pageSize,
      total: data?.page?.total ?? 0,
      onPageChange: (page: number) =>
        setPagination((prev) => ({ ...prev, pageNum: page })),
      onPageSizeChange: (pageSize: number) =>
        setPagination({ pageNum: 1, pageSize }),
    }),
    [pagination.pageNum, pagination.pageSize, data?.page?.total],
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField
          name="txNo"
          label={t('kissen_transfer_filter_tx_no')}
          register={form.register('txNo')}
          placeholder={t('kissen_transfer_filter_tx_no')}
        />
        <FormField
          name="pairId"
          label={t('kissen_transfer_filter_tokens')}
          register={form.register('pairId', {
            pattern: {
              value: PAIR_ID_PATTERN,
              message: t('kissen_transfer_pair_id_invalid'),
            },
          })}
          error={form.formState.errors.pairId?.message}
          placeholder={t('kissen_transfer_filter_tokens')}
        />
        <FormField
          name="senderAccount"
          label={t('kissen_transfer_filter_from')}
          register={form.register('senderAccount')}
          placeholder={t('kissen_transfer_filter_from')}
        />
        <FormField
          name="receiverAccount"
          label={t('kissen_transfer_filter_to')}
          register={form.register('receiverAccount')}
          placeholder={t('kissen_transfer_filter_to')}
        />
        <FormField
          name="lpName"
          label={t('kissen_transfer_filter_lp_name')}
          register={form.register('lpName')}
          placeholder={t('kissen_transfer_filter_lp_name')}
        />
        <FormSelect
          name="status"
          label={t('kissen_transfer_filter_status')}
          control={form.control}
          options={statusOptions}
          placeholder={tc('PUB_All')}
        />
        <FormDateRangePicker
          startName="startTime"
          endName="endTime"
          control={form.control}
          label={t('kissen_transfer_filter_created_date')}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        pagination={tablePagination}
        emptyMessage={t('empty')}
      />
    </div>
  );
}
