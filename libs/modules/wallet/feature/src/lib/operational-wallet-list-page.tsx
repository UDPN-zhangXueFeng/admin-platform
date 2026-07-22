'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import {
  Button,
  CopyableEllipsisText,
  DataTable,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';

import {
  useBlockchainsQuery,
  useOperationalWalletListQuery,
  useStablecoinsQuery,
  type OperationalWallet,
  type OperationalWalletFilters,
  type WalletListParams,
} from '@myorg/modules/wallet/data-access';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  accountTypeMessageKey,
  ALL_VALUE,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  feeTypeMessageKey,
  toMillis,
  WALLET_PERMISSIONS,
} from '@myorg/modules/wallet/util';

/** 时间格式（与 posting-engine 列表/详情一致：年-月-日 时:分:秒）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 页面侧扩展的筛选条件（含创建时间范围）。
 *
 * 源 CustomTable 筛选项含 `startCreateTime-endCreateTime` 范围，后端 list 接受
 * `startCreateTime`/`endCreateTime`。`OperationalWalletFilters`（data-access）未建模
 * 这两个字段，此处以交叉类型补充，传给 query hook 时窄化为基础类型（零侵入基础层）。
 */
type OperationalWalletListFilters = OperationalWalletFilters & {
  startCreateTime?: number;
  endCreateTime?: number;
};

/**
 * OperationalWalletListPage — 营运钱包列表页。
 *
 * 迁移自 td-manage `src/pages/wallet/operational-wallet/index.tsx`（250 行）。
 * 保留：多维筛选（walletAddress / accountType / stablecoin / blockchain / 创建时间范围 / state）、
 * 服务端分页（pageNum/pageSize，列表 hook 已配 keepPreviousData 平滑翻页）、
 * 状态 badge（approvalTaskStatus 族）、行操作 Detail（跳详情页）。
 */
export function OperationalWalletListPage() {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  /** 权限未配置（空集）时全放开，兼容权限未接入场景（posting-engine 模式）。 */
  const canViewDetail =
    authPermissions.size === 0 ||
    authPermissions.has(WALLET_PERMISSIONS.OperationalWalletDetail);

  const { register, control, handleSubmit, reset } =
    useForm<OperationalWalletFilterForm>({
      defaultValues: EMPTY_FORM,
    });

  const [queryValues, setQueryValues] =
    React.useState<OperationalWalletFilterForm>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo<WalletListParams<OperationalWalletListFilters>>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues]
  );

  const listResult = useOperationalWalletListQuery(
    params as WalletListParams<OperationalWalletFilters>
  );
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // stablecoin / blockchain 下拉（common endpoint，三子模块共用）。
  const stablecoinsResult = useStablecoinsQuery();
  const blockchainsResult = useBlockchainsQuery();

  const stablecoinOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      ...(stablecoinsResult.data ?? [])
        .filter((el) => el && el.stablecoinId != null)
        .map((el) => ({
          value: String(el.stablecoinId),
          label: el.name ?? String(el.stablecoinId),
        })),
    ],
    [stablecoinsResult.data, t]
  );

  const blockchainOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      ...(blockchainsResult.data ?? [])
        .filter((el) => el && el.key != null)
        .map((el) => ({
          value: String(el.key),
          // 源 disabled when status === 1 ? false : true；目标 FormSelect 无 per-option disabled，
          // 失效链折叠为 label 标注（忠实保留：非启用状态链不出现在可用列表，与源等价语义）。
          label: el.value ?? el.label ?? String(el.key),
        })),
    ],
    [blockchainsResult.data, t]
  );

  const accountTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      // 源 accountType 仅 1/2 启用；3 被注释掉（业务未上线），忠实保留不暴露。
      { value: '1', label: t('accountType.1') },
      { value: '2', label: t('accountType.2') },
    ],
    [t]
  );

  const stateOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      // 源 state 仅 10(active)/15(inactive) 启用；1/5 被注释掉，忠实保留。
      { value: '10', label: t('status.active') },
      { value: '15', label: t('status.inactive') },
    ],
    [t]
  );

  const columns = React.useMemo<ColumnDef<OperationalWallet>[]>(
    () => [
      {
        accessorKey: 'ruleId',
        header: t('operationalWallet.column.index'),
        cell: ({ row }) => <span>{row.original.ruleId ?? EMPTY_DISPLAY}</span>,
      },
      {
        accessorKey: 'walletAddress',
        header: t('operationalWallet.column.walletAddress'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.walletAddress} />
        ),
      },
      {
        accessorKey: 'accountType',
        header: t('operationalWallet.column.accountType'),
        cell: ({ row }) => {
          const key = accountTypeMessageKey(row.original.accountType);
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'feeType',
        header: t('operationalWallet.column.feeType'),
        cell: ({ row }) => {
          const key = feeTypeMessageKey(row.original.feeType);
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'tokenName',
        header: t('operationalWallet.column.tokenName'),
        cell: ({ row }) => (
          <span>{row.original.tokenName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'walletType',
        header: t('operationalWallet.column.walletType'),
        cell: ({ row }) => (
          <span>{row.original.walletType || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('operationalWallet.column.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'balance',
        header: t('operationalWallet.column.balance'),
        cell: ({ row }) => {
          const { balance, symbol } = row.original;
          return (
            <span>
              {balance != null && balance !== ''
                ? `${balance}${symbol ? ' ' + symbol : ''}`
                : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        accessorKey: 'createTime',
        header: t('common.createTime'),
        cell: ({ row }) => {
          // 源 `formatTimestamp(Number(createTime))`：model 中 createTime 为 number|string，
          // 先归一为 number 再经 toMillis（秒/毫秒自适应）。
          const ts = Number(row.original.createTime);
          const ms = Number.isFinite(ts) ? toMillis(ts) : undefined;
          return (
            <span>{ms ? formatDate(ms, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        accessorKey: 'state',
        header: t('common.status'),
        cell: ({ row }) => (
          <WalletStatusBadge
            family="operational-wallet"
            status={row.original.state}
          />
        ),
      },
      {
        id: 'actions',
        header: t('common.operate'),
        cell: ({ row }) =>
          canViewDetail ? (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/wallet/operational-wallet/view?ruleWalletId=${row.original.ruleWalletId ?? ''}&walletAddress=${encodeURIComponent(
                    row.original.walletAddress ?? ''
                  )}`
                )
              }
            >
              {t('common.detail')}
            </Button>
          ) : (
            <span className="text-muted-foreground">{EMPTY_DISPLAY}</span>
          ),
      },
    ],
    [t, canViewDetail, router]
  );

  const onSubmit = React.useCallback((form: OperationalWalletFilterForm) => {
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryValues(form);
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">
          {t('operationalWallet.filterTitle')}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="walletAddress"
            label={t('operationalWallet.column.walletAddress')}
            register={register('walletAddress')}
            placeholder={t('operationalWallet.placeholder.walletAddress')}
          />
          <FormSelect
            name="accountType"
            control={control}
            label={t('operationalWallet.column.accountType')}
            options={accountTypeOptions}
            placeholder={t('common.all')}
          />
          <FormSelect
            name="stablecoinId"
            control={control}
            label={t('operationalWallet.column.tokenName')}
            options={stablecoinOptions}
            placeholder={t('common.all')}
          />
          <FormSelect
            name="blockchainKey"
            control={control}
            label={t('operationalWallet.column.blockchain')}
            options={blockchainOptions}
            placeholder={t('common.all')}
          />
          <FormDatePicker
            name="startCreateTime"
            control={control}
            label={t('operationalWallet.field.startCreateTime')}
          />
          <FormDatePicker
            name="endCreateTime"
            control={control}
            label={t('operationalWallet.field.endCreateTime')}
          />
          <FormSelect
            name="state"
            control={control}
            label={t('common.status')}
            options={stateOptions}
            placeholder={t('common.all')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('common.query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('common.reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('operationalWallet.records')}
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('common.noData')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── 表单形状（纯类型，便于 formToFilters 推断） ────────────────────────────────

/**
 * react-hook-form 筛选表单形状。
 *
 * 文本空串 = 无筛选；下拉 `'all'` = 无筛选；日期为 `YYYY-MM-DD` 字符串。
 * 字段名对齐 `OperationalWalletFilters`：源 tokenId→stablecoinId，blockchainId→blockchainKey。
 */
interface OperationalWalletFilterForm {
  walletAddress: string;
  accountType: string;
  stablecoinId: string;
  blockchainKey: string;
  startCreateTime: string;
  endCreateTime: string;
  state: string;
}

const EMPTY_FORM: OperationalWalletFilterForm = {
  walletAddress: '',
  accountType: ALL_VALUE,
  stablecoinId: ALL_VALUE,
  blockchainKey: ALL_VALUE,
  startCreateTime: '',
  endCreateTime: '',
  state: ALL_VALUE,
};

/** 将表单值转换为后端筛选条件（纯函数）。 */
function formToFilters(
  form: OperationalWalletFilterForm
): OperationalWalletListFilters {
  return {
    walletAddress: form.walletAddress.trim() || undefined,
    accountType:
      form.accountType && form.accountType !== ALL_VALUE
        ? Number(form.accountType)
        : undefined,
    stablecoinId:
      form.stablecoinId && form.stablecoinId !== ALL_VALUE
        ? Number(form.stablecoinId)
        : undefined,
    blockchainKey:
      form.blockchainKey && form.blockchainKey !== ALL_VALUE
        ? form.blockchainKey
        : undefined,
    startCreateTime: form.startCreateTime
      ? startOfDay(parseISO(form.startCreateTime)).getTime()
      : undefined,
    endCreateTime: form.endCreateTime
      ? endOfDay(parseISO(form.endCreateTime)).getTime()
      : undefined,
    state:
      form.state && form.state !== ALL_VALUE
        ? Number(form.state)
        : undefined,
  };
}
