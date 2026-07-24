'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Button,
  DataTable,
  type DataTablePagination,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';

import {
  type TokenReconSummaryRespVo,
  useTokenListQuery,
} from '@myorg/modules/reconciliation/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FIELD_VALUE,
  RECONCILIATION_PERMISSIONS,
  TOKEN_TYPE_VALUES,
  formatTimestamp,
  getTokenTypeKey,
} from '@myorg/modules/reconciliation/util';
import { ReconciliationSection } from '@myorg/modules/reconciliation/ui';

// ── 常量 ──────────────────────────────────────────────────────────────────────

/**
 * “全部”占位值。
 *
 * Radix Select 禁止 `SelectItem value=""`（运行时崩溃），故列表筛选的“全部”
 * 一律用 `'all'`，提交时 `!== ALL_VALUE` 才转成真实值，否则传 `undefined`。
 */
const ALL_VALUE = 'all';

/** 区块链/币种下拉项（动态从 list 行抽取或回退通用）。 */
interface FilterOption {
  label: string;
  value: string | number;
}

// ── 筛选表单值 ──────────────────────────────────────────────────────────────────

interface TokenListFormValues {
  tokenName: string;
  tokenType: string;
  blockchainId: string;
  financeBookName: string;
  bookNo: string;
  currencyCode: string;
  lastReconciliationDateStart: string;
  lastReconciliationDateEnd: string;
}

const EMPTY_FORM: TokenListFormValues = {
  tokenName: '',
  tokenType: ALL_VALUE,
  blockchainId: ALL_VALUE,
  financeBookName: '',
  bookNo: '',
  currencyCode: ALL_VALUE,
  lastReconciliationDateStart: '',
  lastReconciliationDateEnd: '',
};

// ── 动态下拉：从 list 行抽取 blockchain / currency 可选项 ──────────────────────

/**
 * 迁移自源 `real-time/index.tsx` 的 `updateAvailableOptions`。
 *
 * 列表请求返回的汇总行天然带 `blockchainName`/`currencySymbol`（及回显的
 * `blockchainId`/`currencyCode`），用作筛选下拉的可选项，避免再发一次通用下拉请求。
 * 用 Map 去重；`JSON.stringify` 前后对比避免无意义 setState 重渲染。
 */
function buildOptionsFromRows(rows: TokenReconSummaryRespVo[]): {
  blockchain: FilterOption[];
  currency: FilterOption[];
} {
  const blockchainMap = new Map<string | number, string>();
  const currencyMap = new Map<string | number, string>();

  rows.forEach((row) => {
    const blockchainValue = row.blockchainId ?? row.blockchainName;
    if (blockchainValue != null && row.blockchainName) {
      blockchainMap.set(blockchainValue, row.blockchainName);
    }
    const currencyValue = row.currencySymbol;
    if (currencyValue) {
      currencyMap.set(currencyValue, currencyValue);
    }
  });

  const toOptions = (map: Map<string | number, string>): FilterOption[] =>
    Array.from(map, ([value, label]) => ({ label, value }));

  return {
    blockchain: toOptions(blockchainMap),
    currency: toOptions(currencyMap),
  };
}

// ── 页面组件 ─────────────────────────────────────────────────────────────────────

/**
 * RealTimeListPage — Token 对账列表页。
 *
 * 迁移自 td-manage `reconciliation/real-time/index.tsx`（273 行）。
 *
 * 关键逻辑（源码逐行对照）：
 * - 7 项筛选：tokenName / tokenType(1/5) / blockchainId / financeBookName / bookNo
 *   / currencyCode / lastReconciliationDate 范围（RangePicker 拆 Start-End）。
 * - 动态下拉 `updateAvailableOptions`：从 list 行抽取 blockchain/currency 可选项；
 *   非空用动态集，空则回退通用（目标侧通用 hook 未在本模块提供，回退空集，
 *   首次加载后由动态集接管，行为等价源“空回退”）。
 * - 10 列汇总：tokenName/tokenType/blockchainName/financeBookName/bookNo/
 *   currencySymbol/lastReconciliationTime/matched/unmatched/actioned，
 *   统计列着色（绿/红/蓝）。
 * - action：Details 恒显；`unmatchedCount>0` 追加 PostToSuspense。二者均跳详情页，
 *   PostToSuspense 带 `tab=investigation`，Details 带 `tab=list`。
 */
export function RealTimeListPage() {
  const t = useTranslations('modules.reconciliation');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  const canView =
    authPermissions.size === 0 ||
    authPermissions.has(RECONCILIATION_PERMISSIONS.VIEW);

  // ── 筛选表单 ──────────────────────────────────────────────────────────────
  const { register, control, handleSubmit, reset } =
    useForm<TokenListFormValues>({ defaultValues: EMPTY_FORM });

  const [queryValues, setQueryValues] =
    React.useState<TokenListFormValues>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ── 动态下拉（从 list 行抽取 blockchain/currency） ─────────────────────────
  const [availableBlockchainOptions, setAvailableBlockchainOptions] =
    React.useState<FilterOption[]>([]);
  const [availableCurrencyOptions, setAvailableCurrencyOptions] =
    React.useState<FilterOption[]>([]);

  const updateAvailableOptions = React.useCallback(
    (rows: TokenReconSummaryRespVo[]) => {
      const { blockchain, currency } = buildOptionsFromRows(rows);
      setAvailableBlockchainOptions((prev) =>
        JSON.stringify(prev) === JSON.stringify(blockchain) ? prev : blockchain,
      );
      setAvailableCurrencyOptions((prev) =>
        JSON.stringify(prev) === JSON.stringify(currency) ? prev : currency,
      );
    },
    [],
  );

  // ── 查询参数 ──────────────────────────────────────────────────────────────
  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: {
        tokenName: queryValues.tokenName || undefined,
        tokenType:
          queryValues.tokenType && queryValues.tokenType !== ALL_VALUE
            ? Number(queryValues.tokenType)
            : undefined,
        blockchainId:
          queryValues.blockchainId && queryValues.blockchainId !== ALL_VALUE
            ? queryValues.blockchainId
            : undefined,
        financeBookName: queryValues.financeBookName || undefined,
        bookNo: queryValues.bookNo || undefined,
        currencyCode:
          queryValues.currencyCode && queryValues.currencyCode !== ALL_VALUE
            ? queryValues.currencyCode
            : undefined,
        lastReconciliationDateStart:
          queryValues.lastReconciliationDateStart || undefined,
        lastReconciliationDateEnd:
          queryValues.lastReconciliationDateEnd || undefined,
      },
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );

  const listResult = useTokenListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // 列表数据到达后抽取动态筛选项（等价源 fetchTokenReconList → updateAvailableOptions）
  React.useEffect(() => {
    updateAvailableOptions(rows);
  }, [rows, updateAvailableOptions]);

  // ── tokenType 静态子集下拉（1/5） ─────────────────────────────────────────
  const tokenTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('PUB_All') },
      ...Array.from(TOKEN_TYPE_VALUES).map((value) => {
        const key = getTokenTypeKey(value);
        return {
          value: String(value),
          label: key ? (t(key as never) ?? String(value)) : String(value),
        };
      }),
    ],
    [t],
  );

  // 区块链/币种下拉：动态集非空用动态集，否则回退（目标无通用 hook，回退仅“全部”）
  const blockchainOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('PUB_All') },
      ...availableBlockchainOptions.map((opt) => ({
        value: String(opt.value),
        label: opt.label,
      })),
    ],
    [t, availableBlockchainOptions],
  );
  const currencyOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('PUB_All') },
      ...availableCurrencyOptions.map((opt) => ({
        value: String(opt.value),
        label: opt.label,
      })),
    ],
    [t, availableCurrencyOptions],
  );

  // ── 列定义 ────────────────────────────────────────────────────────────────
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
          return (
            <span>{key ? (t(key as never) ?? EMPTY_FIELD_VALUE) : EMPTY_FIELD_VALUE}</span>
          );
        },
      },
      {
        accessorKey: 'blockchainName',
        header: t('PUB_Blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'financeBookName',
        header: t('reconciliation_0077'),
        cell: ({ row }) => (
          <span>{row.original.financeBookName || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'bookNo',
        header: t('reconciliation_0048'),
        cell: ({ row }) => (
          <span>{row.original.bookNo || EMPTY_FIELD_VALUE}</span>
        ),
      },
      {
        accessorKey: 'currencySymbol',
        header: t('reconciliation_0032'),
        cell: ({ row }) => (
          <span>{row.original.currencySymbol || EMPTY_FIELD_VALUE}</span>
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
        header: t('PUB_Detail'),
        cell: ({ row }) => {
          if (!canView) {
            return <span className="text-muted-foreground">{EMPTY_FIELD_VALUE}</span>;
          }
          // 列表为 Token 维度汇总，Post to Suspense 实际作用于明细记录(reconciliationTxId)，
          // 故列表与 Details 均跳详情页，在详情页对具体 Unmatched 记录执行调账。
          const go = (tab: 'list' | 'investigation') =>
            router.push(
              `/reconciliation/real-time/view?id=${row.original.tokenId}&tab=${tab}`,
            );
          const hasUnmatched = (row.original.unmatchedCount ?? 0) > 0;
          return (
            <div className="flex items-center gap-3">
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => go('list')}
              >
                {t('PUB_Detail')}
              </Button>
              {hasUnmatched && (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => go('investigation')}
                >
                  {t('reconciliation_0078')}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [t, canView, router],
  );

  const tablePagination = React.useMemo<DataTablePagination>(
    () => ({
      page: pagination.pageNum,
      pageSize: pagination.pageSize,
      total,
      onPageChange: (page) =>
        setPagination((prev) => ({ ...prev, pageNum: page })),
    }),
    [pagination.pageNum, pagination.pageSize, total],
  );

  // ── 查询/重置 ─────────────────────────────────────────────────────────────
  const onSubmit = handleSubmit((data) => {
    setQueryValues(data);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  });

  const onReset = () => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ReconciliationSection title={t('reconciliation_0072')}>
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <FormField
            name="tokenName"
            label={t('reconciliation_0052')}
            register={register('tokenName')}
            placeholder={t('reconciliation_0052')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label={t('reconciliation_0053')}
            options={tokenTypeOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="blockchainId"
            control={control}
            label={t('PUB_Blockchain')}
            options={blockchainOptions}
            placeholder={t('PUB_All')}
          />
          <FormField
            name="financeBookName"
            label={t('reconciliation_0077')}
            register={register('financeBookName')}
            placeholder={t('reconciliation_0077')}
          />
          <FormField
            name="bookNo"
            label={t('reconciliation_0048')}
            register={register('bookNo')}
            placeholder={t('reconciliation_0048')}
          />
          <FormSelect
            name="currencyCode"
            control={control}
            label={t('reconciliation_0032')}
            options={currencyOptions}
            placeholder={t('PUB_All')}
          />
          <FormDatePicker
            name="lastReconciliationDateStart"
            control={control}
            label={t('reconciliation_0071')}
          />
          <FormDatePicker
            name="lastReconciliationDateEnd"
            control={control}
            label={t('reconciliation_0071')}
          />
          <div className="flex items-end gap-2">
            <Button type="submit">{t('PUB_Query')}</Button>
            <Button type="button" variant="outline" onClick={onReset}>
              {t('PUB_Reset')}
            </Button>
          </div>
        </form>
      </ReconciliationSection>

      <DataTable
        columns={tokenColumns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('common_no_data')}
        pagination={tablePagination}
      />
    </div>
  );
}
