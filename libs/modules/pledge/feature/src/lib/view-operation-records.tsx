'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { type ColumnDef } from '@tanstack/react-table';
import { Button, DataTable } from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';
import { formatDate } from '@myorg/shared/util-dates';
import {
  useOperateRecordListQuery,
  type OperateRecord,
} from '@myorg/modules/pledge/data-access';
import { OPERATE_TYPE_OPTIONS, OP_RECORD_STATUS } from '@myorg/modules/pledge/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';
const EMPTY_DISPLAY = '--';
const TAB_PAGE_SIZE = 6;

/** 已知限制：approval-manage 模块本批未迁移，该跳转目标路由可能 404。 */
const APPROVAL_MANAGE_VIEW_PATH = '/approval-manage/view';

/**
 * ViewOperationRecords — 详情页 Operation Records Tab 组件。
 *
 * 迁移自 td-manage src/pages/pledge/reserve-asset-list/view-operation-records.tsx（227 行）。
 *
 * 接口：
 * - `reserve/asset/detail/operateRecordListPage`（`useOperateRecordListQuery`，pageNum 分页）。
 *
 * 硬约束：
 * - props.reserveAccountId 缺失时不请求。
 * - 操作类型下拉：OPERATE_TYPE_OPTIONS（value 0/1..5）。FormSelect 需 string value，故 options 转 string；
 *   提交时 Number() 还原——operateType===0 时 api 层 `toOperateRecordBody` 已转空串 ''（后端约定）。
 * - status 用 OP_RECORD_STATUS（**以 view-operation-records 内嵌 statusDict 为准**；
 *   new-view 传入的 opStatusColors 数组是键不一致的死参数，忽略）。
 * - 行 Details 跳 `/approval-manage/view?busCode=<>&opType=<label>&id=<taskId>`（**approval-manage 本批未迁移，
 *   404 风险**）。taskId 为空时不渲染链接（源 `row.taskId ? <a> : '--'`）。
 */
export interface ViewOperationRecordsProps {
  /** 储备资产 ID（详情页 query.id）。 */
  reserveAccountId: number;
}

interface OperateRecordFilterForm {
  /** 操作类型（string 化的 number：'0'/'1'..，'0'=All）。 */
  type: string;
}

const EMPTY_FILTER: OperateRecordFilterForm = { type: '0' };

interface OperationRow extends OperateRecord {
  /** DataTable 契约要求 id: string。 */
  id: string;
  /** 操作类型展示文案（operateType → label，用于 opType 跳转参数）。 */
  typeLabel: string;
}

export function ViewOperationRecords({
  reserveAccountId,
}: ViewOperationRecordsProps): React.JSX.Element {
  const t = useTranslations('modules.pledge');
  const router = useRouter();

  const { control, handleSubmit, reset } = useForm<OperateRecordFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<OperateRecordFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: TAB_PAGE_SIZE,
  });

  // 操作类型下拉：OPERATE_TYPE_OPTIONS（number value）→ string value（FormSelect 契约）。
  // label 走 i18n operateType.${value}（All 用 filter.all）。
  const operateTypeOptions = React.useMemo(
    () =>
      OPERATE_TYPE_OPTIONS.map((o) => ({
        value: String(o.value),
        label: o.value === 0 ? t('filter.all') : t(`operateType.${o.value}`),
      })),
    [t],
  );

  // 查询参数。type 还原 number；operateType===0 时 api 层转空串。
  const params = React.useMemo(
    () => ({
      reserveAccountId,
      operateType: Number(queryValues.type ?? 0),
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
    }),
    [reserveAccountId, queryValues.type, pagination],
  );

  const result = useOperateRecordListQuery(params);
  const rowsRaw = result.data?.rows ?? [];
  const total = result.data?.page?.total ?? 0;
  const isLoading = result.isLoading || result.isFetching;

  // 行映射：补 id + typeLabel（operateType → i18n label，opType 跳转参数与展示共用）。
  const rows = React.useMemo<OperationRow[]>(
    () =>
      rowsRaw.map((item) => {
        const ot = Number(item.operateType ?? 0);
        const typeLabel = ot > 0 ? t(`operateType.${ot}`) : EMPTY_DISPLAY;
        return {
          ...item,
          id: String(item.recordId ?? ''),
          typeLabel,
        };
      }),
    [rowsRaw, t],
  );

  const columns = React.useMemo<ColumnDef<OperationRow>[]>(
    () => [
      {
        id: 'type',
        header: t('operationRecord.type'),
        cell: ({ row }) => <span>{row.original.typeLabel}</span>,
      },
      {
        accessorKey: 'createUser',
        header: t('operationRecord.createdBy'),
        cell: ({ row }) => (
          <span>{row.original.createUser || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('operationRecord.createdOn'),
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
      {
        // 状态 Tag：OP_RECORD_STATUS（以 view-operation-records 内嵌 statusDict 为准）。
        accessorKey: 'status',
        header: t('operationRecord.status'),
        cell: ({ row }) => {
          const status = row.original.status;
          if (status === undefined || status === null) {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          const info =
            OP_RECORD_STATUS[status as keyof typeof OP_RECORD_STATUS] ?? {
              label: String(status),
              color: 'default',
            };
          const toneClass = opRecordStatusToneClass(info.color);
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}
            >
              {t(`opRecordStatus.${status}`)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('operationRecord.actions'),
        cell: ({ row }) => {
          const r = row.original;
          // taskId 为空时无审批流，不渲染链接（源 `row.taskId ? <a> : '--'`）。
          if (!r.taskId) {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          const query = new URLSearchParams({
            busCode: r.businessCode ?? '',
            opType: r.typeLabel,
            id: String(r.taskId),
          });
          return (
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                router.push(
                  `${APPROVAL_MANAGE_VIEW_PATH}?${query.toString()}`,
                )
              }
            >
              {t('action.details')}
            </Button>
          );
        },
      },
    ],
    [t, router],
  );

  const onSubmit = React.useCallback((f: OperateRecordFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: TAB_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="type"
            control={control}
            label={t('operationRecord.type')}
            options={operateTypeOptions}
            placeholder={t('filter.all')}
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
    </div>
  );
}

export default ViewOperationRecords;

/**
 * 操作记录状态 Tag 颜色 → Tailwind 类名。
 * OP_RECORD_STATUS 取值：orange / error / success。
 */
function opRecordStatusToneClass(color: string): string {
  switch (color) {
    case 'orange':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'success':
      return 'border-green-200 bg-green-50 text-green-700';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-600';
  }
}
