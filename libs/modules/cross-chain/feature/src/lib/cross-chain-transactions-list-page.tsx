'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { ArrowRightCircle } from 'lucide-react';
import { Button, CopyableEllipsisText, DataTable } from '@myorg/shared/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import { CrossChainStatusBadge } from '@myorg/modules/cross-chain/ui';
import {
  useBlockchainListQuery,
  useCrossChainTxListQuery,
  useStablecoinSearchesQuery,
  type CrossChainTxItem,
  type CrossChainTxListFilters,
} from '@myorg/modules/cross-chain/data-access';
import {
  CROSS_CHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/cross-chain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 「全部」占位 value（对齐 fx-rate / blockchain 列表筛选约定）。 */
const ALL_VALUE = 'all';

/**
 * 钱包地址缩写（迁移自 td-manage src/utils/index.ts:62 `showAddress`）。
 *
 * 源码：val.substring(0, 4) + '....' + val.substring(len - 4)。
 * 完整搬运勿简化（前 4 + 四个点 + 后 4）。
 */
function showAddress(val: string | undefined | null): string {
  if (!val) return EMPTY_DISPLAY;
  const len = val.length;
  return val.substring(0, 4) + '....' + val.substring(len - 4, len);
}

/**
 * CrossChainTransactionsListPage — 跨链交易记录列表页。
 *
 * 迁移自 td-manage src/pages/cross-chain/cross-chain-transactions/index.tsx（426 行）。
 * useCustomTable → react-hook-form + DataTable；useSWR 下拉 → useBlockchainListQuery / useStablecoinSearchesQuery。
 *
 * 6 个筛选条件：源 token / 源链（status===1 可选否则 disabled）/ 目标 token /
 * 目标链（status===1 可选否则 disabled）/ 状态（20/30/35/40）/ 创建时间范围。
 *
 * 硬约束（cc-9 summary + 迁移文档第 7.9 节）：
 * - 请求体 pageNum/pageSize（data-access 已封装）。
 * - 源链 / 目标链下拉项 status!==1 时 disabled（源码 options.disabled 逻辑）；
 *   FormSelect 不透传单项 disabled，故手写 Controller + Select/SelectItem（对齐 blockchain node-list-page）。
 * - transferId 列展示索引（源码 dataIndex='transferId' width 5%）。
 * - tokens 列：sourceTokenName + ArrowRightCircle + destinationTokenName，下方币种-pegged（源码 cross_chain_00104）。
 * - from/to 列：CopyableEllipsisText 缩写 + 副行 count + symbol。
 * - serviceFee 列：serviceFee + sourceSymbol + cross_chain_0090（per transaction）。
 * - fxRate 列：sourceCurrencySymbol/destinationCurrencySymbol = fxRate。
 * - 状态列走 CrossChainStatusBadge kind="cross-chain-tx"（CROSS_CHAIN_TX_STATUS_COLOR + cross_chain_transactions_status_${status}）。
 * - 行「查看」受 CCT_VIEW_BTN 控制，跳 `/cross-chain/cross-chain-transactions/view?transferId=<id>`。
 * - **Refund 行操作为注释死代码，不迁移**（权限码 670504 在 token-pair Enable 复用，勿删）。
 */
interface CrossChainTxFilterForm {
  /** 源 token ID（stablecoinId）。'' 表示全部。 */
  sourceTokenId: string;
  /** 源链 ID。'' 表示全部。 */
  sourceBlockchainId: string;
  /** 目标 token ID。'' 表示全部。 */
  destinationTokenId: string;
  /** 目标链 ID。'' 表示全部。 */
  destinationBlockchainId: string;
  /** 状态：20/30/35/40。'' 表示全部。 */
  status: string;
  /** 创建时间起。 */
  createdTimeStart: string;
  /** 创建时间止。 */
  createdTimeEnd: string;
}

const EMPTY_FILTER: CrossChainTxFilterForm = {
  sourceTokenId: ALL_VALUE,
  sourceBlockchainId: ALL_VALUE,
  destinationTokenId: ALL_VALUE,
  destinationBlockchainId: ALL_VALUE,
  status: ALL_VALUE,
  createdTimeStart: '',
  createdTimeEnd: '',
};

function formToFilters(f: CrossChainTxFilterForm): CrossChainTxListFilters {
  return {
    sourceTokenId: f.sourceTokenId !== ALL_VALUE ? f.sourceTokenId : undefined,
    sourceBlockchainId:
      f.sourceBlockchainId !== ALL_VALUE ? f.sourceBlockchainId : undefined,
    destinationTokenId:
      f.destinationTokenId !== ALL_VALUE ? f.destinationTokenId : undefined,
    destinationBlockchainId:
      f.destinationBlockchainId !== ALL_VALUE
        ? f.destinationBlockchainId
        : undefined,
    status: f.status !== ALL_VALUE ? f.status : undefined,
    createdTimeStart: f.createdTimeStart
      ? startOfDay(parseISO(f.createdTimeStart)).getTime()
      : undefined,
    createdTimeEnd: f.createdTimeEnd
      ? endOfDay(parseISO(f.createdTimeEnd)).getTime()
      : undefined,
  };
}

export function CrossChainTransactionsListPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<CrossChainTxFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<CrossChainTxFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ── 下拉数据源 ──
  // 链：common/blockchain/list，status===1 可选否则 disabled。
  const blockchainQuery = useBlockchainListQuery();
  const blockchainOptions = React.useMemo(
    () =>
      (blockchainQuery.data ?? []).filter(
        (b) => b.key != null && b.key !== '',
      ),
    [blockchainQuery.data],
  );

  // token：common/stablecoin/enabled/searches，{ stablecoinId, name }。
  const tokenQuery = useStablecoinSearchesQuery();
  const tokenOptions = React.useMemo(() => {
    const list = tokenQuery.data ?? [];
    return list.map((el) => ({ value: String(el.stablecoinId), label: el.name }));
  }, [tokenQuery.data]);

  // 状态选项：20/30/35/40（源码 options.value 为字符串）。
  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      { value: '20', label: t('cross_chain_transactions_status_20') },
      { value: '30', label: t('cross_chain_transactions_status_30') },
      { value: '35', label: t('cross_chain_transactions_status_35') },
      { value: '40', label: t('cross_chain_transactions_status_40') },
    ],
    [t],
  );

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );
  const listResult = useCrossChainTxListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const columns = React.useMemo<ColumnDef<CrossChainTxItem>[]>(
    () => [
      // 索引列（源码 dataIndex='transferId' width 5%，直接展示 transferId）。
      {
        id: 'transferId',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>{row.original.transferId ?? EMPTY_DISPLAY}</span>
        ),
      },
      // tokens 列：sourceTokenName + ArrowRightCircle + destinationTokenName + 币种-pegged。
      {
        id: 'tokens',
        header: t('cross_chain_0083'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-start">
              <div>
                <div>
                  <span>{r.sourceTokenName}</span>
                </div>
                <div className="text-xs">{`${
                  r.sourceCurrencySymbol ?? ''
                }-${t('cross_chain_00104')}`}</div>
              </div>
              <ArrowRightCircle className="mx-2 mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div>
                  <span>{r.destinationTokenName}</span>
                </div>
                <div className="text-xs">{`${
                  r.destinationCurrencySymbol ?? ''
                }-${t('cross_chain_00104')}`}</div>
              </div>
            </div>
          );
        },
      },
      // from 列：showAddress 缩写 + copyable + 副行 count + sourceSymbol。
      {
        accessorKey: 'fromAddress',
        header: t('cross_chain_0063'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div>
              <CopyableEllipsisText
                value={showAddress(r.fromAddress)}
                maxWidth={180}
              />
              <div className="text-xs">{`${
                r.fromCount ?? ''
              } ${r.sourceSymbol ?? ''}`}</div>
            </div>
          );
        },
      },
      // to 列：同 from。
      {
        accessorKey: 'toAddress',
        header: t('cross_chain_0064'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div>
              <CopyableEllipsisText
                value={showAddress(r.toAddress)}
                maxWidth={180}
              />
              <div className="text-xs">{`${
                r.toCount ?? ''
              } ${r.destinationSymbol ?? ''}`}</div>
            </div>
          );
        },
      },
      // serviceFee 列：serviceFee + sourceSymbol + cross_chain_0090。
      {
        accessorKey: 'serviceFee',
        header: t('cross_chain_0084'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span>{`${r.serviceFee ?? ''} ${r.sourceSymbol ?? ''} ${t(
              'cross_chain_0090',
            )}`}</span>
          );
        },
      },
      // fxRate 列：sourceCurrencySymbol/destinationCurrencySymbol = fxRate。
      {
        accessorKey: 'fxRate',
        header: t('cross_chain_0067'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span>{`${
              r.sourceCurrencySymbol ?? ''
            }/${r.destinationCurrencySymbol ?? ''} = ${r.fxRate ?? ''}`}</span>
          );
        },
      },
      // createdOn 列：时间戳格式化。
      {
        accessorKey: 'createdOn',
        header: t('filter.createTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createdOn
              ? formatDate(Number(row.original.createdOn), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      // 状态列：CrossChainStatusBadge kind="cross-chain-tx"。
      {
        accessorKey: 'status',
        header: t('filter.status'),
        cell: ({ row }) => (
          <CrossChainStatusBadge
            kind="cross-chain-tx"
            status={row.original.status}
          />
        ),
      },
      // 行操作：查看（Refund 死代码不迁移）。
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.CCT_VIEW_BTN}>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/cross-chain/cross-chain-transactions/view?transferId=${
                      r.transferId ?? ''
                    }`,
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
    [t, router],
  );

  const onSubmit = React.useCallback((f: CrossChainTxFilterForm) => {
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
          <FormSelect
            name="sourceTokenId"
            control={control}
            label={t('cross_chain_0078')}
            options={[{ value: ALL_VALUE, label: t('filter.all') }, ...tokenOptions]}
            placeholder={t('filter.all')}
          />
          {/*
            源链：status!==1 的链单项 disabled（源码 options.disabled: el.status === 1 ? false : true）。
            FormSelect 不透传单项 disabled，故手写 Controller + Select/SelectItem。
          */}
          <Controller
            control={control}
            name="sourceBlockchainId"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="cct-sourceBlockchainId"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('cross_chain_0079')}
                </label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="cct-sourceBlockchainId">
                    <SelectValue placeholder={t('filter.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t('filter.all')}</SelectItem>
                    {blockchainOptions.map((b) => (
                      <SelectItem
                        key={b.key}
                        value={String(b.key)}
                        disabled={b.status !== 1}
                      >
                        {b.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <FormSelect
            name="destinationTokenId"
            control={control}
            label={t('cross_chain_0080')}
            options={[{ value: ALL_VALUE, label: t('filter.all') }, ...tokenOptions]}
            placeholder={t('filter.all')}
          />
          <Controller
            control={control}
            name="destinationBlockchainId"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="cct-destinationBlockchainId"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('cross_chain_0081')}
                </label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="cct-destinationBlockchainId">
                    <SelectValue placeholder={t('filter.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t('filter.all')}</SelectItem>
                    {blockchainOptions.map((b) => (
                      <SelectItem
                        key={b.key}
                        value={String(b.key)}
                        disabled={b.status !== 1}
                      >
                        {b.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
          <FormSelect
            name="status"
            control={control}
            label={t('filter.status')}
            options={statusOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="createdTimeStart"
            control={control}
            label={t('filter.createTime')}
          />
          <FormDatePicker
            name="createdTimeEnd"
            control={control}
            label={t('filter.createTime')}
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
          <div className="text-sm font-semibold">{t('cross_chain_0093')}</div>
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
