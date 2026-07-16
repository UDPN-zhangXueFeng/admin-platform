'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
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
  useLiquidityPoolListQuery,
  useStablecoinSearchesQuery,
  type LiquidityPoolItem,
  type LiquidityPoolListFilters,
} from '@myorg/modules/cross-chain/data-access';
import {
  CROSS_CHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/cross-chain/util';
import {
  LiquidityPoolActionModal,
  type LiquidityPoolAction,
  type LiquidityPoolModalInfo,
} from './liquidity-pool-action-modal';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
/** 「全部」占位 value（对齐 cct / fx-rate / rd-bridge 列表筛选约定）。 */
const ALL_VALUE = 'all';

/**
 * 钱包地址缩写（迁移自 td-manage src/utils/index.ts:62 `showAddress`）。
 *
 * 源码：val.substring(0, 4) + '....' + val.substring(len - 4)。
 * 列表地址列用缩写 + CopyableEllipsisText（对齐 cct-list from/to 列）。
 */
function showAddress(val: string | undefined | null): string {
  if (!val) return EMPTY_DISPLAY;
  const len = val.length;
  return val.substring(0, 4) + '....' + val.substring(len - 4, len);
}

/**
 * LiquidityPoolListPage — 流动性池列表页。
 *
 * 迁移自 td-manage src/pages/cross-chain/liquidity-pool/index.tsx（507 行）。
 * useCustomTable → react-hook-form + DataTable；useSWR 下拉 → useBlockchainListQuery /
 * useStablecoinSearchesQuery；Reauthorize/TransferOut 共用动态 Modal → LiquidityPoolActionModal
 * （feature 层 liquidity-pool-action-modal.tsx，cc-7 已建）。
 *
 * 5 个筛选条件：地址（Input）/ token（stablecoin 下拉）/ 链（common/blockchain/list，
 * status===1 可选否则 disabled）/ 状态（0/1/5）/ 更新时间范围。
 *
 * 硬约束（cc-14 summary + 迁移文档第 7.11 节）：
 * - 请求体 pageNum/pageSize（data-access 已封装）。
 * - 链下拉项 status!==1 时 disabled（源码 options.disabled: el.status === 1 ? false : true）；
 *   FormSelect 不透传单项 disabled，故手写 Controller + Select/SelectItem（对齐 cct-list）。
 * - 顶部「新增」受 LP_ADD_BTN 控制，跳 `/cross-chain/liquidity-pool/edit`（无参）。
 * - 行操作：查看（LP_VIEW_BTN，跳 view?id=）/ 编辑（LP_EDIT_BTN，status∈{0,5} 可用，跳 edit?id=）/
 *   重新授权（LP_REAUTHORIZE_BTN，status===5 可用 → Modal）/ 转出（LP_TRANSFER_OUT_BTN，
 *   status===5 可用 → Modal）。
 * - Reauthorize/TransferOut 填充 modalInfo（liquidityPoolId/action/balance/symbol/decimalPrecision/
 *   只读回填 tokenName/blockchain/liquidityPoolWalletAddress）后打开 LiquidityPoolActionModal；
 *   提交成功 mutation 自动 invalidate 列表缓存（action-modal 内 toast + onClose），列表自动刷新。
 * - balance/authorized 列含 symbol；状态列走 CrossChainStatusBadge kind="liquidity-pool"
 *   （LIQUIDITY_POOL_STATUS_COLOR + liquidity_pool_status_${status}）。
 */
interface LiquidityPoolFilterForm {
  /** 钱包地址（Input）。 */
  liquidityPoolWalletAddress: string;
  /** token ID（stablecoinId）。'' 表示全部。 */
  tokenId: string;
  /** 链 ID。'' 表示全部。 */
  blockchain: string;
  /** 状态：0/1/5。'' 表示全部。 */
  status: string;
  updatedTimeStart: string;
  updatedTimeEnd: string;
}

const EMPTY_FILTER: LiquidityPoolFilterForm = {
  liquidityPoolWalletAddress: '',
  tokenId: ALL_VALUE,
  blockchain: ALL_VALUE,
  status: ALL_VALUE,
  updatedTimeStart: '',
  updatedTimeEnd: '',
};

function formToFilters(
  f: LiquidityPoolFilterForm,
): LiquidityPoolListFilters {
  return {
    liquidityPoolWalletAddress: f.liquidityPoolWalletAddress || undefined,
    tokenId: f.tokenId !== ALL_VALUE ? f.tokenId : undefined,
    blockchain: f.blockchain !== ALL_VALUE ? f.blockchain : undefined,
    status: f.status !== ALL_VALUE ? f.status : undefined,
    updatedTimeStart: f.updatedTimeStart
      ? startOfDay(parseISO(f.updatedTimeStart)).getTime()
      : undefined,
    updatedTimeEnd: f.updatedTimeEnd
      ? endOfDay(parseISO(f.updatedTimeEnd)).getTime()
      : undefined,
  };
}

export function LiquidityPoolListPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  const { control, handleSubmit, reset, register } =
    useForm<LiquidityPoolFilterForm>({
      defaultValues: EMPTY_FILTER,
    });
  const [queryValues, setQueryValues] =
    React.useState<LiquidityPoolFilterForm>(EMPTY_FILTER);
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
  // 过滤空 stablecoinId 项：后端可能返回空 id，String('')='' 会让 SelectItem value 为空串
  // 触发 Radix 崩溃。FormSelect 已组件级兜底，这里再清洁数据源（对齐 blockchain 下拉 filter）。
  const tokenQuery = useStablecoinSearchesQuery();
  const tokenOptions = React.useMemo(() => {
    const list = tokenQuery.data ?? [];
    return list
      .filter((el) => el.stablecoinId != null && el.stablecoinId !== '')
      .map((el) => ({ value: String(el.stablecoinId), label: el.name }));
  }, [tokenQuery.data]);

  // 状态选项：0 未授权 / 1 授权中 / 5 已授权（源码 options.value 为字符串）。
  const statusOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('filter.all') },
      { value: '0', label: t('liquidity_pool_status_0') },
      { value: '1', label: t('liquidity_pool_status_1') },
      { value: '5', label: t('liquidity_pool_status_5') },
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
  const listResult = useLiquidityPoolListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // ── Reauthorize / TransferOut 共用动态 Modal ──
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalInfo, setModalInfo] = React.useState<LiquidityPoolModalInfo | null>(
    null,
  );

  /**
   * 打开 Reauthorize/TransferOut Modal（对齐源码 actionClick 的 Reauthorize/TransferOut 分支）。
   *
   * 填充 modalInfo：action 决定 Modal 渲染哪组字段 + 调哪个 mutation；balance/symbol/
   * decimalPrecision 来自行数据；只读回填 tokenName/blockchain/liquidityPoolWalletAddress。
   */
  const openActionModal = React.useCallback(
    (row: LiquidityPoolItem, action: LiquidityPoolAction) => {
      setModalInfo({
        id: row.id,
        liquidityPoolId: row.liquidityPoolId ?? 0,
        action,
        balance: row.balance ?? '',
        symbol: row.symbol ?? '',
        decimalPrecision: row.decimalPrecision ?? 0,
        tokenName: row.tokenName,
        blockchain: row.blockchain,
        liquidityPoolWalletAddress: row.liquidityPoolWalletAddress,
      });
      setModalOpen(true);
    },
    [],
  );

  const closeModal = React.useCallback(() => {
    setModalOpen(false);
    setModalInfo(null);
  }, []);

  const columns = React.useMemo<ColumnDef<LiquidityPoolItem>[]>(
    () => [
      // 索引列（源码 dataIndex='liquidityPoolId' width 5%）。
      {
        id: 'liquidityPoolId',
        header: t('field.index'),
        cell: ({ row }) => (
          <span>{row.original.liquidityPoolId ?? EMPTY_DISPLAY}</span>
        ),
      },
      // 地址列：showAddress 缩写 + copyable。
      {
        accessorKey: 'liquidityPoolWalletAddress',
        header: t('cross_chain_0045'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={showAddress(row.original.liquidityPoolWalletAddress)}
            maxWidth={180}
          />
        ),
      },
      // token 列。
      {
        accessorKey: 'tokenName',
        header: t('cross_chain_0044'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
        ),
      },
      // 链列。
      {
        accessorKey: 'blockchain',
        header: t('cross_chain_0000'),
        cell: ({ row }) => (
          <span>{row.original.blockchain || EMPTY_DISPLAY}</span>
        ),
      },
      // balance 列：balance + ' ' + symbol。
      {
        accessorKey: 'balance',
        header: t('cross_chain_0047'),
        cell: ({ row }) => (
          <span>
            {`${row.original.balance ?? ''} ${row.original.symbol ?? ''}`.trim()}
          </span>
        ),
      },
      // authorized 列：authorized + ' ' + symbol。
      {
        accessorKey: 'authorized',
        header: t('cross_chain_0048'),
        cell: ({ row }) => (
          <span>
            {`${row.original.authorized ?? ''} ${row.original.symbol ?? ''}`.trim()}
          </span>
        ),
      },
      // 更新时间列。
      {
        accessorKey: 'updatedOn',
        header: t('field.updateOn'),
        cell: ({ row }) => (
          <span>
            {row.original.updatedOn
              ? formatDate(Number(row.original.updatedOn), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      // 状态列：CrossChainStatusBadge kind="liquidity-pool"。
      {
        accessorKey: 'status',
        header: t('filter.status'),
        cell: ({ row }) => (
          <CrossChainStatusBadge
            kind="liquidity-pool"
            status={row.original.status}
          />
        ),
      },
      // 行操作：查看 / 编辑(status∈{0,5}) / 重新授权(status===5) / 转出(status===5)。
      {
        id: 'actions',
        header: t('field.actions'),
        cell: ({ row }) => {
          const r = row.original;
          const canEdit = r.status === 0 || r.status === 5;
          const canReauthOrTransfer = r.status === 5;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.LP_VIEW_BTN}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    router.push(
                      `/cross-chain/liquidity-pool/view?id=${
                        r.liquidityPoolId ?? ''
                      }`,
                    )
                  }
                >
                  {t('action.view')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.LP_EDIT_BTN}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={!canEdit}
                  onClick={() =>
                    router.push(
                      `/cross-chain/liquidity-pool/edit?id=${
                        r.liquidityPoolId ?? ''
                      }`,
                    )
                  }
                >
                  {t('action.edit')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permission={CROSS_CHAIN_PERMISSIONS.LP_REAUTHORIZE_BTN}
              >
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={!canReauthOrTransfer}
                  onClick={() => openActionModal(r, 'Reauthorize')}
                >
                  {t('cross_chain_0072')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permission={CROSS_CHAIN_PERMISSIONS.LP_TRANSFER_OUT_BTN}
              >
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={!canReauthOrTransfer}
                  onClick={() => openActionModal(r, 'TransferOut')}
                >
                  {t('cross_chain_0073')}
                </Button>
              </PermissionGuard>
            </div>
          );
        },
      },
    ],
    [t, router, openActionModal],
  );

  const onSubmit = React.useCallback((f: LiquidityPoolFilterForm) => {
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
          <div>
            <label
              htmlFor="lp-liquidityPoolWalletAddress"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {t('cross_chain_0045')}
            </label>
            <input
              id="lp-liquidityPoolWalletAddress"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('cross_chain_0045')}
              {...register('liquidityPoolWalletAddress')}
            />
          </div>
          <FormSelect
            name="tokenId"
            control={control}
            label={t('cross_chain_0044')}
            options={[{ value: ALL_VALUE, label: t('filter.all') }, ...tokenOptions]}
            placeholder={t('filter.all')}
          />
          {/*
            链：status!==1 的链单项 disabled（源码 options.disabled: el.status === 1 ? false : true）。
            FormSelect 不透传单项 disabled，故手写 Controller + Select/SelectItem（对齐 cct-list）。
          */}
          <Controller
            control={control}
            name="blockchain"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="lp-blockchain"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {t('cross_chain_0000')}
                </label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="lp-blockchain">
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
            name="updatedTimeStart"
            control={control}
            label={t('cross_chain_0025')}
          />
          <FormDatePicker
            name="updatedTimeEnd"
            control={control}
            label={t('cross_chain_0025')}
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
          <div className="text-sm font-semibold">{t('cross_chain_0046')}</div>
          <PermissionGuard permission={CROSS_CHAIN_PERMISSIONS.LP_ADD_BTN}>
            <Button
              size="sm"
              onClick={() => router.push('/cross-chain/liquidity-pool/edit')}
            >
              {t('action.add')}
            </Button>
          </PermissionGuard>
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

      <LiquidityPoolActionModal
        modalInfo={modalInfo}
        open={modalOpen}
        onClose={closeModal}
      />
    </div>
  );
}
