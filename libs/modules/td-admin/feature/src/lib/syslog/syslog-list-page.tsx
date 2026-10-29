'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import { Button, DataTable, useToast } from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';

import { LogDescriptionText } from '.';
import { formatModuleName, SYSLOG_PAGE_SIZE } from '.';
import {
  useSysLogsQuery,
  useSysLogModulesQuery,
  useSysLogOperationTypesQuery,
  useSysLogUsersQuery,
  type SysLogItem,
  type SysLogQueryParams,
} from '@myorg/modules/td-admin/data-access';

/** react-hook-form 表单形状；'all' / 空串表示"不筛选"。 */
interface SysLogFilterForm {
  logId?: string;
  logTimeFrom?: string;
  logTimeTo?: string;
  userName?: string;
  module?: string;
  operationType?: string;
  sourceIp?: string;
}

/** DataTable 泛型约束要求行类型含 { id: string }，而 SysLogItem 用 logId，这里补 id 别名。 */
type SysLogRow = SysLogItem & { id: string };

const ALL = 'all';

const EMPTY_FORM: SysLogFilterForm = {
  logId: '',
  logTimeFrom: '',
  logTimeTo: '',
  userName: ALL,
  module: ALL,
  operationType: ALL,
  sourceIp: '',
};

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

/**
 * 由两个 `YYYY-MM-DD` 日期字符串构造毫秒级 epoch 时间范围 `[startLogTime, endLogTime]`，
 * 对齐旧页 CustomTable 的 getTimestamp()（返回 `new Date(...).getTime()` 毫秒）。
 *
 * 旧页 sysLog/index.tsx 内定义过除以 1000 的 onFinish，但该段代码被整体注释，未生效；
 * 真实运行时 CustomTable 的默认序列化直接输出 getTimestamp 毫秒值。
 */
function toTimeRange(
  from?: string,
  to?: string
): Pick<SysLogQueryParams, 'startLogTime' | 'endLogTime'> {
  const range: Pick<SysLogQueryParams, 'startLogTime' | 'endLogTime'> = {};

  if (from) {
    const parsed = parseISO(from);
    if (!Number.isNaN(parsed.getTime())) {
      range.startLogTime = startOfDay(parsed).getTime();
    }
  }
  if (to) {
    const parsed = parseISO(to);
    if (!Number.isNaN(parsed.getTime())) {
      range.endLogTime = endOfDay(parsed).getTime();
    }
  }

  return range;
}

/** 把 RHF 筛选表单翻译为查询参数；'all'/空串字段被剔除。 */
function formToParams(form: SysLogFilterForm): SysLogQueryParams {
  const params: SysLogQueryParams = { page: 1, pageSize: SYSLOG_PAGE_SIZE };

  if (form.logId) params.logId = form.logId;
  if (form.userName && form.userName !== ALL) params.userName = form.userName;
  if (form.module && form.module !== ALL) params.module = form.module;
  if (form.operationType && form.operationType !== ALL)
    params.operationType = form.operationType;
  if (form.sourceIp) params.sourceIp = form.sourceIp;

  Object.assign(params, toTimeRange(form.logTimeFrom, form.logTimeTo));

  return params;
}

/**
 * SysLogListPage — 系统操作日志的只读查询页。
 *
 * - 筛选表单：react-hook-form，提交查询 / 重置（对齐旧页 UX）。
 * - 下拉数据源：modules / operationTypes / users 三个独立查询并行加载。
 * - 表格：logTime 经 formatDate；module 走 code→name 映射 + formatModuleName；
 *   operationType 优先取下拉 name，否则查 i18n；desc 超长走 LogDescriptionText 截断。
 * - Export：保留入口；后端当前没有导出接口，点击后明确提示不可用。
 */
export function SysLogListPage() {
  const t = useTranslations('modules.syslog');
  const toast = useToast();
  const { register, control, handleSubmit, reset } =
    useForm<SysLogFilterForm>({ defaultValues: EMPTY_FORM });

  const [params, setParams] = React.useState<SysLogQueryParams>(() =>
    formToParams(EMPTY_FORM)
  );

  const { data, isLoading, isError } = useSysLogsQuery(PROJECT_ID, params);
  const { data: moduleOptions } = useSysLogModulesQuery(PROJECT_ID);
  const { data: operationTypeOptions } = useSysLogOperationTypesQuery(PROJECT_ID);
  const { data: userOptions } = useSysLogUsersQuery(PROJECT_ID);
  const rows: SysLogRow[] = (data?.data ?? []).map((d) => ({ ...d, id: d.logId }));
  const paginationMeta = data?.pagination;

  const onSubmit = React.useCallback((form: SysLogFilterForm) => {
    setParams(formToParams(form));
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setParams(formToParams(EMPTY_FORM));
  }, [reset]);

  const onExport = React.useCallback(() => {
    toast.info(t('exportUnavailable'));
  }, [t, toast]);

  const userSelectOptions = React.useMemo(() => {
    const base = [{ value: ALL, label: t('all') }];
    const items = (userOptions ?? []).map((u) => {
      const label = u.userName ?? u.name ?? '';
      return { value: label, label };
    });
    return [...base, ...items];
  }, [userOptions, t]);

  const moduleSelectOptions = React.useMemo(() => {
    const base = [{ value: ALL, label: t('all') }];
    const items = (moduleOptions ?? []).map((code) => ({
      value: code,
      label: formatModuleName(code),
    }));
    return [...base, ...items];
  }, [moduleOptions, t]);

  const operationTypeSelectOptions = React.useMemo(() => {
    const base = [{ value: ALL, label: t('all') }];
    const items = (operationTypeOptions ?? []).map((o) => {
      const code = String(o.code);
      const key = `operationType.${code}`;
      const translated = t.has(key) ? t(key) : undefined;
      return {
        value: code,
        label: translated ?? o.name ?? code,
      };
    });
    return [...base, ...items];
  }, [operationTypeOptions, t]);

  /** 列渲染：module code → 可读标题。 */
  const moduleLabel = React.useCallback(
    (code: string) => formatModuleName(code),
    []
  );

  /** 列渲染：优先使用本地化操作类型文案，后端 name 仅作未知 code 的兜底。 */
  const operationTypeLabel = React.useCallback(
    (code: string) => {
      const key = `operationType.${code}`;
      const translated = t.has(key) ? t(key) : undefined;
      return (
        translated ??
        operationTypeOptions?.find(
          (o) => String(o.code) === String(code)
        )?.name ??
        code
      );
    },
    [operationTypeOptions, t]
  );

  const columns = React.useMemo<ColumnDef<SysLogRow>[]>(
    () => [
      { accessorKey: 'logId', header: t('field.logId') },
      {
        accessorKey: 'logTime',
        header: t('field.logTime'),
        cell: ({ row }) => (
          <span>{formatDate(new Date(row.original.logTime), 'MMM dd, yyyy, HH:mm:ss')}</span>
        ),
      },
      { accessorKey: 'userName', header: t('field.userName') },
      {
        accessorKey: 'module',
        header: t('field.module'),
        cell: ({ row }) => <span>{moduleLabel(row.original.module)}</span>,
      },
      {
        accessorKey: 'operationType',
        header: t('field.operationType'),
        cell: ({ row }) => (
          <span>{operationTypeLabel(row.original.operationType)}</span>
        ),
      },
      {
        accessorKey: 'desc',
        header: t('field.desc'),
        cell: ({ row }) => (
          <LogDescriptionText
            desc={row.original.desc}
            moreLabel={t('more')}
          />
        ),
      },
      { accessorKey: 'sourceIp', header: t('field.sourceIp') },
    ],
    [t, moduleLabel, operationTypeLabel]
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">{t('query')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="logId"
            label={t('field.logId')}
            register={register('logId')}
          />
          <FormSelect
            name="userName"
            control={control}
            label={t('field.userName')}
            options={userSelectOptions}
            placeholder={t('all')}
          />
          <FormSelect
            name="module"
            control={control}
            label={t('field.module')}
            options={moduleSelectOptions}
            placeholder={t('all')}
          />
          <FormSelect
            name="operationType"
            control={control}
            label={t('field.operationType')}
            options={operationTypeSelectOptions}
            placeholder={t('all')}
          />
          <FormField
            name="sourceIp"
            label={t('field.sourceIp')}
            register={register('sourceIp')}
          />
          <FormDatePicker
            name="logTimeFrom"
            control={control}
            label={t('field.logTimeFrom')}
          />
          <FormDatePicker
            name="logTimeTo"
            control={control}
            label={t('field.logTimeTo')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">{t('records')}</div>
          <Button type="button" variant="outline" size="sm" onClick={onExport}>
            {t('export')}
          </Button>
        </div>
        {isError ? (
          <div role="alert" className="border-b px-6 py-3 text-sm text-destructive">
            {t('loadFailed')}
          </div>
        ) : null}
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage={t('empty')}
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, page })),
                  onPageSizeChange: (pageSize) =>
                    setParams((prev) => ({ ...prev, page: 1, pageSize })),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
