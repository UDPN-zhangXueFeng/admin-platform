'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Button, DataTable } from '@myorg/shared/ui';
import { FormDatePicker } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useFxRateDetailListQuery,
  type FxRateDetailItem,
} from '@myorg/modules/cross-chain/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/cross-chain/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * FxRateDetailPage — 汇率详情页（历史汇率分页列表）。
 *
 * 迁移自 td-manage src/pages/cross-chain/fx-rate/view.tsx（96 行）。
 * useCustomTable → react-hook-form + DataTable。
 *
 * **特殊**（迁移文档第 7.8、8 章）：详情页用 DataTable 呈现历史汇率分页列表（**非常规 Descriptions**）。
 * 源码 `useCustomTable` initialValues 带 `rateId: Number(query.id)` 固定筛选，时间范围 RangePicker 可调。
 *
 * 硬约束：
 * - rateId 从 query string 取（列表页跳 `/cross-chain/fx-rate/view?rateId=<id>`），缺失时不请求。
 * - rateId 固定随请求体透传（对应源码 initialValues.rateId），时间范围 startTime/endTime 作为可选筛选。
 * - 请求前缀 `/api/fx/v1/`（非 manage），分页字段 pageNum/pageSize（data-access 已封装）。
 * - 货币对列渲染 `sendCurrencySymbol + '/' + receiveCurrencySymbol`（源码 dataIndex + item 拼接）。
 * - createTime 为时间戳，需 Number() 后格式化（源码 formatTimestamp(Number(createTime))）。
 * - 3 列：货币对 / 汇率（cross_chain_0067）/ 日期（cross_chain_0097）+ 底部「返回」按钮。
 * - **fx-rate 无状态枚举、无写操作**（迁移文档第 8 章确认）。
 */
interface FxRateDetailFilterForm {
  /** 起始时间（ISO）。 */
  startTime: string;
  /** 结束时间（ISO）。 */
  endTime: string;
}

const EMPTY_FILTER: FxRateDetailFilterForm = {
  startTime: '',
  endTime: '',
};

export function FxRateDetailPage(): React.JSX.Element {
  const t = useTranslations('modules.cross-chain');
  const router = useRouter();

  // 列表页跳 /cross-chain/fx-rate/view?rateId=<id>：
  // catch-all 路由把 slug[0]="view" 解析为 pageKey="detail"，rateId 走 query string。
  const searchParams = useSearchParams();
  const rateIdStr = searchParams.get('rateId') ?? '';
  const rateId = rateIdStr !== '' ? Number(rateIdStr) : NaN;

  const { control, handleSubmit, reset } = useForm<FxRateDetailFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<FxRateDetailFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const hasRateId = !Number.isNaN(rateId);

  const params = React.useMemo(() => {
    if (!hasRateId) return undefined;
    return {
      rateId,
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      startTime: queryValues.startTime
        ? startOfDay(parseISO(queryValues.startTime)).getTime()
        : undefined,
      endTime: queryValues.endTime
        ? endOfDay(parseISO(queryValues.endTime)).getTime()
        : undefined,
    };
  }, [hasRateId, rateId, pagination.pageNum, pagination.pageSize, queryValues]);

  // 详情列表查询（rateId 缺失时 enabled=false 不发起，queries 层已守卫）。
  const detailResult = useFxRateDetailListQuery(params, hasRateId);
  const rows = detailResult.data?.rows ?? [];
  const total = detailResult.data?.page?.total ?? 0;
  const isLoading = detailResult.isLoading || detailResult.isFetching;

  const columns = React.useMemo<ColumnDef<FxRateDetailItem>[]>(
    () => [
      {
        // 货币对列：sendCurrencySymbol + '/' + receiveCurrencySymbol。
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
        // 日期列：createTime 时间戳格式化（源码 formatTimestamp(Number(createTime))）。
        accessorKey: 'createTime',
        header: t('cross_chain_0097'),
        cell: ({ row }) => {
          const { createTime } = row.original;
          return (
            <span>
              {createTime
                ? formatDate(Number(createTime), DATETIME_FMT)
                : EMPTY_DISPLAY}
            </span>
          );
        },
      },
    ],
    [t],
  );

  const onSubmit = React.useCallback((f: FxRateDetailFilterForm) => {
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
          <FormDatePicker
            name="startTime"
            control={control}
            label={t('cross_chain_0097')}
          />
          <FormDatePicker
            name="endTime"
            control={control}
            label={t('cross_chain_0097')}
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
        {/* 标题为空（源码 CustomTableTitle title={''}），保留容器无标题。 */}
        <div className="px-6 py-3" />
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

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}
