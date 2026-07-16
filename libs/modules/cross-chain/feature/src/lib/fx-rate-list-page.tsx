'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Button, DataTable } from '@myorg/shared/ui';
import { FormDatePicker, FormSelect } from '@myorg/shared/ui-forms';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useCurrencyPairListQuery,
  useFxRateListQuery,
  type FxRateItem,
  type FxRateListFilters,
} from '@myorg/modules/cross-chain/data-access';
import {
  CROSS_CHAIN_PERMISSIONS,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/cross-chain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * FxRateListPage — 汇率列表页。
 *
 * 迁移自 td-manage src/pages/cross-chain/fx-rate/index.tsx（118 行）。
 * useCustomTable → react-hook-form + DataTable；useSWR currency/pair/list → useCurrencyPairListQuery。
 *
 * 2 个筛选条件：货币对（Select，currency/pair/list 下拉，含「全部」）/ 时间范围（RangePicker）。
 *
 * 硬约束（本模块特有，对齐迁移文档第 7.7 节）：
 * - 请求前缀 `/api/fx/v1/`（非 manage），分页字段 pageNum/pageSize（data-access 已封装）。
 * - 货币对 Select 选项首位为「全部」value=''，其余为 `sendCurrencySymbol + '/' + receiveCurrencySymbol`（源码 options.map）。
 * - 货币对列渲染 `sendCurrencySymbol + '/' + receiveCurrencySymbol`（源码 dataIndex sendCurrencySymbol + item 拼接）。
 * - updateTime 为时间戳字符串，需 Number() 后格式化（源码 formatTimestamp(Number(updateTime))）。
 * - **fx-rate 无状态枚举、无写操作**（迁移文档第 8 章确认）：纯展示列表，无 Tag、无状态列。
 * - 行「查看」受 FX_RATE_VIEW_BTN 权限码控制，跳 `/cross-chain/fx-rate/view?rateId=<rateId>`。
 */
interface FxRateFilterForm {
  /** 货币对 ID（'' 表示全部）。 */
  rateId: string;
  /** 起始时间（ISO）。 */
  startTime: string;
  /** 结束时间（ISO）。 */
  endTime: string;
}

const EMPTY_FILTER: FxRateFilterForm = {
  rateId: '',
  startTime: '',
  endTime: '',
};

function formToFilters(f: FxRateFilterForm): FxRateListFilters {
  return {
    rateId: f.rateId || undefined,
    startTime: f.startTime
      ? startOfDay(parseISO(f.startTime)).getTime()
      : undefined,
    endTime: f.endTime ? endOfDay(parseISO(f.endTime)).getTime() : undefined,
  };
}

export function FxRateListPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<FxRateFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<FxRateFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // 货币对下拉（currency/pair/list）。select 过滤非数组/null，staleTime 5 分钟（queries 层已配置）。
  const currencyPairQuery = useCurrencyPairListQuery();
  const currencyPairOptions = React.useMemo(() => {
    // 源码 options 首位「全部」value=''，其余 sendCurrencySymbol/receiveCurrencySymbol 拼接。
    const pairs = currencyPairQuery.data ?? [];
    return [
      { value: '', label: t('filter.all') },
      ...pairs.map((el) => ({
        value: String(el.rateId),
        label: `${el.sendCurrencySymbol}/${el.receiveCurrencySymbol}`,
      })),
    ];
  }, [currencyPairQuery.data, t]);

  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues],
  );
  const listResult = useFxRateListQuery(params);
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  const columns = React.useMemo<ColumnDef<FxRateItem>[]>(
    () => [
      {
        // 货币对列：sendCurrencySymbol + '/' + receiveCurrencySymbol（源码 dataIndex + item 拼接）。
        id: 'currencyPair',
        header: t('cross_chain_0095'),
        cell: ({ row }) => {
          const { sendCurrencySymbol, receiveCurrencySymbol } = row.original;
          if (!sendCurrencySymbol && !receiveCurrencySymbol) {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          return (
            <span>
              {sendCurrencySymbol}/{receiveCurrencySymbol}
            </span>
          );
        },
      },
      {
        accessorKey: 'exchangeRate',
        header: t('cross_chain_0067'),
        cell: ({ row }) => (
          <span>{row.original.exchangeRate || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // 更新时间：时间戳字符串需 Number() 转换（源码 formatTimestamp(Number(updateTime))）。
        accessorKey: 'updateTime',
        header: t('cross_chain_0025'),
        cell: ({ row }) => {
          const { updateTime } = row.original;
          return (
            <span>
              {updateTime
                ? formatDate(Number(updateTime), DATETIME_FMT)
                : EMPTY_DISPLAY}
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
            <PermissionGuard
              permission={CROSS_CHAIN_PERMISSIONS.FX_RATE_VIEW_BTN}
            >
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(
                    `/cross-chain/fx-rate/view?rateId=${r.rateId ?? ''}`,
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

  const onSubmit = React.useCallback((f: FxRateFilterForm) => {
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
            name="rateId"
            control={control}
            label={t('cross_chain_0095')}
            options={currencyPairOptions}
            placeholder={t('filter.all')}
          />
          <FormDatePicker
            name="startTime"
            control={control}
            label={t('cross_chain_0025')}
          />
          <FormDatePicker
            name="endTime"
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
          <div className="text-sm font-semibold">{t('cross_chain_0096')}</div>
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
