'use client';

import * as React from 'react';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
import { useTranslations } from 'next-intl';
import { type ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';

import {
  Button,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import { ReconciliationSection } from '@myorg/modules/reconciliation/ui';
import {
  useReserveAssetListQuery,
  type ReserveAssetSummaryRespVo,
  type ReserveAssetListReqVo,
} from '@myorg/modules/reconciliation/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FIELD_VALUE,
  formatCurrencyValue,
  TOKEN_TYPE_VALUES,
  getTokenTypeKey,
} from '@myorg/modules/reconciliation/util';

// ── 表单值类型 ──────────────────────────────────────────────────────────────────

interface FilterFormValues {
  reserveAssetName?: string;
  bookNo?: string;
  tokenType?: string;
}

// ── 表格面板 ─────────────────────────────────────────────────────────────────────

interface TablePanelProps {
  title: string;
  columns: ColumnDef<ReserveAssetSummaryRespVo>[];
  data: readonly ReserveAssetSummaryRespVo[];
  isLoading: boolean;
  total: number;
  emptyMessage: string;
  pageNum: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function TablePanel({
  title,
  columns,
  data,
  isLoading,
  total,
  emptyMessage,
  pageNum,
  pageSize,
  onPageChange,
}: TablePanelProps) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-6 py-3 text-sm font-semibold">{title}</div>
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
    </div>
  );
}

// ── 关联 Token 渲染 ─────────────────────────────────────────────────────────────

function renderAssociatedTokens(
  tokens: ReserveAssetSummaryRespVo['associatedTokens'],
) {
  const list = tokens ?? [];
  if (list.length === 0) return EMPTY_FIELD_VALUE;

  const shown = list
    .slice(0, 2)
    .map((i) => i.tokenName)
    .filter(Boolean);

  if (shown.length === 0) return EMPTY_FIELD_VALUE;

  const more = list.length - shown.length;
  return more > 0 ? `${shown.join(', ')} +${more} more` : shown.join(', ');
}

// ── 页面组件 ─────────────────────────────────────────────────────────────────────

/**
 * ReserveListPage — 储备资产对账列表页。
 *
 * 迁移自 td-manage `reconciliation/reserve/index.tsx`（183 行）。
 *
 * - 筛选栏：reserveAssetName / bookNo（R3） / tokenType
 * - 列表列：reserveAccountName / reserveAccount / assetValue / exceptions /
 *   associatedTokens / actions(详情链接)
 * - 服务端分页 + keepPreviousData 平滑翻页
 */
export function ReserveListPage() {
  const t = useTranslations('modules.reconciliation');
  const router = useRouter();
  const { permissions } = useAuth();
  const canView =
    permissions.size === 0 || permissions.has('reconciliation:view');

  // ── 筛选表单 ──────────────────────────────────────────────────────────────
  const { register, handleSubmit, watch, reset, setValue } =
    useForm<FilterFormValues>({
      defaultValues: {
        reserveAssetName: '',
        bookNo: '',
        tokenType: '',
      },
    });

  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize] = React.useState(DEFAULT_PAGE_SIZE);

  // 构建筛选参数
  const buildFilters = React.useCallback(
    (values: FilterFormValues): ReserveAssetListReqVo => ({
      reserveAssetName: values.reserveAssetName || undefined,
      bookNo: values.bookNo || undefined,
    }),
    [],
  );

  const formValues = watch();
  const filters = buildFilters(formValues);

  const result = useReserveAssetListQuery({
    pageNum,
    pageSize,
    filters,
  });

  const rows = result.data?.rows ?? [];
  const total = result.data?.page?.total ?? 0;
  const isLoading = result.isLoading || result.isFetching;

  // ── 查询触发 ──────────────────────────────────────────────────────────────
  const onSearch = handleSubmit(() => {
    setPageNum(1);
  });

  const onReset = () => {
    reset();
    setPageNum(1);
  };

  // ── 列定义 ────────────────────────────────────────────────────────────────
  const columns = React.useMemo<ColumnDef<ReserveAssetSummaryRespVo>[]>(
    () => [
      {
        accessorKey: 'reserveAccountName',
        header: t('reconciliation_0201'),
        cell: ({ row }) => row.original.reserveAccountName || EMPTY_FIELD_VALUE,
      },
      {
        accessorKey: 'reserveAccount',
        header: t('reconciliation_0202'),
        cell: ({ row }) => row.original.reserveAccount || EMPTY_FIELD_VALUE,
      },
      {
        accessorKey: 'assetValue',
        header: t('reconciliation_0203'),
        cell: ({ row }) => formatCurrencyValue(row.original.assetValue),
      },
      {
        accessorKey: 'exceptionsCount',
        header: t('reconciliation_0204'),
        cell: ({ row }) => (
          <span className="font-semibold text-destructive">
            {row.original.exceptionsCount ?? 0}
          </span>
        ),
      },
      {
        id: 'associatedTokens',
        header: t('reconciliation_0205'),
        cell: ({ row }) => renderAssociatedTokens(row.original.associatedTokens),
      },
      {
        id: 'actions',
        header: t('common_detail'),
        cell: ({ row }) => {
          if (!canView) return null;
          return (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `/reconciliation/reserve/view?id=${row.original.reserveAccountId}`,
                )
              }
            >
              {t('common_detail')}
            </Button>
          );
        },
      },
    ],
    [t, canView, router],
  );

  // ── Token 类型下拉选项 ────────────────────────────────────────────────────
  const tokenTypeOptions = React.useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: 'all', label: t('common_all') },
    ];
    TOKEN_TYPE_VALUES.forEach((v) => {
      const key = getTokenTypeKey(v);
      opts.push({
        value: String(v),
        label: key ? (t(key as never) ?? String(v)) : String(v),
      });
    });
    return opts;
  }, [t]);

  const selectedTokenType = watch('tokenType');

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <ReconciliationSection
        title={t('reconciliation_0206')}
        description={t('reconciliation_0200') ?? ''}
      >
        <form
          onSubmit={onSearch}
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="reserveAssetName">
              {t('reconciliation_0201')}
            </Label>
            <Input
              id="reserveAssetName"
              placeholder={t('reconciliation_0201')}
              {...register('reserveAssetName')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bookNo">{t('reconciliation_0048')}</Label>
            <Input
              id="bookNo"
              placeholder={t('reconciliation_0048')}
              {...register('bookNo')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="tokenType">{t('reconciliation_0053')}</Label>
            <Select
              value={selectedTokenType}
              onValueChange={(v) => {
                setValue('tokenType', v);
              }}
            >
              <SelectTrigger id="tokenType">
                <SelectValue placeholder={t('common_all')} />
              </SelectTrigger>
              <SelectContent>
                {tokenTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit">{t('common_query')}</Button>
            <Button type="button" variant="outline" onClick={onReset}>
              {t('common_reset')}
            </Button>
          </div>
        </form>
      </ReconciliationSection>

      {/* 表格 */}
      <TablePanel
        title={t('reconciliation_0206')}
        columns={columns}
        data={rows}
        isLoading={isLoading}
        total={total}
        emptyMessage={t('common_no_data')}
        pageNum={pageNum}
        pageSize={pageSize}
        onPageChange={setPageNum}
      />
    </div>
  );
}
