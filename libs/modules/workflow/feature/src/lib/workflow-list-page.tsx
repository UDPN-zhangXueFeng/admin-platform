'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';

import { Button, DataTable, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';
import { FormDatePicker } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import { WorkflowStatusTag } from '@myorg/modules/workflow/ui';
import { WORKFLOW_PAGE_SIZE, WorkflowStatus } from '@myorg/modules/workflow/util';
import {
  useBusinessListQuery,
  useWorkflowListQuery,
  useModifyWorkflowStatusMutation,
  type WorkflowItem,
  type WorkflowListParams,
} from '@myorg/modules/workflow/data-access';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

interface WorkflowFilterForm {
  workflowName?: string;
  businessCode?: string;
  status?: string;
  beginDate?: string; // yyyy-mm-dd
  endDate?: string;
}

const EMPTY_FORM: WorkflowFilterForm = {
  workflowName: '',
  businessCode: '',
  status: '',
  beginDate: '',
  endDate: '',
};

/** 把日期字符串转为毫秒时间戳（旧页 RangePicker 传时间戳给后端）。 */
function dateToTs(d?: string): number | undefined {
  if (!d) return undefined;
  const ts = new Date(d).getTime();
  return Number.isFinite(ts) ? ts : undefined;
}

/**
 * 把 RHF 筛选表单翻译为查询参数；空串/未选字段被剔除。
 *
 * 注意：列表筛选 status 只暴露 1/2（不含 3=已删除），后端 modifyStatus 才会用到 3。
 */
function formToParams(form: WorkflowFilterForm): WorkflowListParams {
  const params: WorkflowListParams = { page: 1, pageSize: WORKFLOW_PAGE_SIZE };
  if (form.workflowName) params.workflowName = form.workflowName;
  if (form.businessCode) params.businessCode = form.businessCode;
  if (form.status) {
    params.status = Number(form.status) as typeof WorkflowStatus.Active | typeof WorkflowStatus.Inactive;
  }
  const beginTs = dateToTs(form.beginDate);
  const endTs = dateToTs(form.endDate);
  if (beginTs != null) params.beginDate = beginTs;
  if (endTs != null) params.endDate = endTs;
  return params;
}

/**
 * WorkflowListPage — 审批工作流列表页。
 *
 * 迁移自 td-manage `src/pages/sys/workflow/index.tsx`（227 行）。
 * - 筛选：workflowName / businessCode（Select，含「全部」）/ 创建时间范围 / status（1/2）。
 * - 列：序号（行号）/ workflowName / businessName / workflowNodes（节点数）/ createdDate
 *   / status（WorkflowStatusTag）。
 * - 行操作：View / Edit / Disable / Enable / Delete（含 confirm）。
 * - 顶部 Add 按钮：跳 /sys/workflow/create（**收敛单一新增入口**，移除旧页双 Add 占位，
 *   旧页第二个 Add 跳 t_edit 阈值原型，迁移决策见 workflow.md §8.5：不单独建路由）。
 *
 * 行操作 disabled 守卫（对齐旧页 status 数字语义，workflow.md §6.1）：
 *   - Disable 仅 status=1 可用；Edit/Enable/Delete 仅 status=2 可用；View 恒可用。
 */
export function WorkflowListPage() {
  const t = useTranslations('modules.workflow');
  const router = useRouter();
  const { control, register, handleSubmit, reset, watch, setValue } =
    useForm<WorkflowFilterForm>({ defaultValues: EMPTY_FORM });

  const [params, setParams] = React.useState<WorkflowListParams>(() =>
    formToParams(EMPTY_FORM)
  );

  const { data: businessList } = useBusinessListQuery(PROJECT_ID);
  const { data, isLoading } = useWorkflowListQuery(PROJECT_ID, params);
  const statusMutation = useModifyWorkflowStatusMutation(PROJECT_ID);

  const rows = data?.rows ?? [];
  const page = data?.page;

  const onSubmit = React.useCallback((form: WorkflowFilterForm) => {
    setParams(formToParams(form));
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setParams(formToParams(EMPTY_FORM));
  }, [reset]);

  /** Disable/Enable/Delete 走 modifyStatus（1/2/3）。含 confirm（i18n 模板替换 name）。 */
  const onModifyStatus = React.useCallback(
    (row: WorkflowItem, nextStatus: 1 | 2 | 3) => {
      const name = row.workflowName;
      let confirmKey: string;
      if (nextStatus === WorkflowStatus.Deleted) confirmKey = t('confirm.delete', { name });
      else if (nextStatus === WorkflowStatus.Active) confirmKey = t('confirm.enable', { name });
      else confirmKey = t('confirm.disable', { name });
      if (!window.confirm(confirmKey)) return;
      statusMutation.mutate({
        workflowId: row.workflowId,
        status: nextStatus,
      });
    },
    [statusMutation, t]
  );

  const columns = React.useMemo<ColumnDef<WorkflowItem & { id: string }>[]>(
    () => [
      {
        id: 'index',
        header: t('field.index'),
        cell: ({ row }) => <span>{row.index + 1}</span>,
      },
      { accessorKey: 'workflowName', header: t('field.workflowName') },
      { accessorKey: 'businessName', header: t('field.businessName') },
      {
        /** Approval Type — 原项目固定文案列（td-manage sys_workflow_0004 / sys_workflow_0034）。 */
        id: 'approvalType',
        header: t('field.approvalType'),
        cell: () => <span>{t('field.executionModeValue')}</span>,
      },
      {
        accessorKey: 'workflowNodes',
        header: t('field.nodes'),
      },
      {
        accessorKey: 'createdDate',
        header: t('field.createdDate'),
        cell: ({ row }) => {
          const ts = Number(row.original.createdDate);
          if (!Number.isFinite(ts) || !ts) return '—';
          return new Date(ts).toLocaleString();
        },
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <WorkflowStatusTag
            status={row.original.status}
            activeLabel={t('status.active')}
            inactiveLabel={t('status.inactive')}
          />
        ),
      },
      {
        id: 'actions',
        header: t('field.action'),
        cell: ({ row }) => {
          const item = row.original;
          // disabled 守卫精确复刻旧页 status 数字语义（workflow.md §6.1）。
          const editDisabled = !(item.status === WorkflowStatus.Inactive);
          const disableDisabled = !(item.status === WorkflowStatus.Active);
          const enableDisabled = !(item.status === WorkflowStatus.Inactive);
          const deleteDisabled = !(item.status === WorkflowStatus.Inactive);
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`/sys/workflow/view?id=${item.workflowId}`)
                }
              >
                {t('action.view')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={editDisabled}
                onClick={() =>
                  router.push(`/sys/workflow/edit?id=${item.workflowId}`)
                }
              >
                {t('action.edit')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={disableDisabled}
                onClick={() => onModifyStatus(item, WorkflowStatus.Inactive)}
              >
                {t('action.disable')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={enableDisabled}
                onClick={() => onModifyStatus(item, WorkflowStatus.Active)}
              >
                {t('action.enable')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-destructive"
                disabled={deleteDisabled}
                onClick={() => onModifyStatus(item, WorkflowStatus.Deleted)}
              >
                {t('action.delete')}
              </Button>
            </div>
          );
        },
      },
    ],
    [t, router, onModifyStatus]
  );

  // DataTable 约束 { id: string }；workflow rowKey 为 workflowId:number，map 出 id（既有约定）。
  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.workflowId) })),
    [rows]
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">{t('query')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('field.workflowName')}</label>
            <Input {...register('workflowName')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('field.businessName')}</label>
            <Select
              value={watch('businessCode') || 'all'}
              onValueChange={(v) =>
                setValue('businessCode', v === 'all' ? '' : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t('field.businessName')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {(businessList ?? []).map((b) => (
                  <SelectItem key={b.code} value={b.code}>
                    {b.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('field.status')}</label>
            <Select
              value={watch('status') || 'all'}
              onValueChange={(v) => setValue('status', v === 'all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('field.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value={String(WorkflowStatus.Active)}>
                  {t('status.active')}
                </SelectItem>
                <SelectItem value={String(WorkflowStatus.Inactive)}>
                  {t('status.inactive')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('field.createdDate')}</label>
            <div className="flex items-center gap-2">
              <FormDatePicker
                name="beginDate"
                control={control}
                label={t('field.createdDate')}
                hideLabel
              />
              <span className="text-muted-foreground">—</span>
              <FormDatePicker
                name="endDate"
                control={control}
                label={t('field.createdDate')}
                hideLabel
              />
            </div>
          </div>
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
          <Button
            type="button"
            size="sm"
            onClick={() => router.push('/sys/workflow/create')}
          >
            {t('action.add')}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage={t('empty')}
          pagination={
            page
              ? {
                  page: page.pageNum,
                  pageSize: page.pageSize,
                  total: page.total,
                  onPageChange: (p) => setParams((prev) => ({ ...prev, page: p })),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
