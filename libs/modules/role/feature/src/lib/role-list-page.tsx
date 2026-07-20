'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';

import { Button, DataTable, useToast } from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import { RoleStatusTag } from '@myorg/modules/role/ui';
import {
  ROLE_PAGE_SIZE,
  RoleStatus,
} from '@myorg/modules/role/util';
import {
  useRoleListQuery,
  useUpdateRoleStatusMutation,
  useDeleteRoleMutation,
  type RoleItem,
  type RoleQueryParams,
} from '@myorg/modules/role/data-access';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

interface RoleFilterForm {
  roleName?: string;
}

const EMPTY_FORM: RoleFilterForm = { roleName: '' };

/**
 * 把 RHF 筛选表单翻译为查询参数；空串字段被剔除。
 */
function formToParams(form: RoleFilterForm): RoleQueryParams {
  const params: RoleQueryParams = { page: 1, pageSize: ROLE_PAGE_SIZE };
  if (form.roleName) params.roleName = form.roleName;
  return params;
}

/**
 * RoleListPage — 角色管理列表页。
 *
 * 迁移自 td-manage `src/pages/sys/role/index.tsx`（162 行）。
 * - 筛选：仅 roleName（Input，单字段查询，对齐旧页）。
 * - 列：序号（行号，非真实 roleId）/ roleName / status（RoleStatusTag）。
 * - 行操作：View / Edit / Disable / Enable / Delete（含 confirm）。
 * - 顶部 Add 按钮跳 /sys/role/create。
 *
 * 注意：
 * 1. DataTable 强约束 `{ id: string }`，而 RoleItem rowKey 为 `roleId: number`，
 *    沿用 key-management 的既有约定——行数据 map 出 `id: String(roleId)`。
 * 2. 行操作 disabled 守卫引用 `roleType`（role.md 7.1：OpenAPI 未声明，后端实际返回）。
 *    旧页逻辑为 `roleType !== 0`（系统内置角色 0 不可编辑/删除）；roleType 为 undefined
 *    时守卫不生效（恒可点）——此处保留旧逻辑现状，未做额外假设。
 */
export function RoleListPage() {
  const t = useTranslations('modules.role');
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, reset } = useForm<RoleFilterForm>({
    defaultValues: EMPTY_FORM,
  });

  const [params, setParams] = React.useState<RoleQueryParams>(() =>
    formToParams(EMPTY_FORM)
  );

  const { data, isLoading } = useRoleListQuery(PROJECT_ID, params);
  const statusMutation = useUpdateRoleStatusMutation(PROJECT_ID);
  const deleteMutation = useDeleteRoleMutation(PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSubmit = React.useCallback((form: RoleFilterForm) => {
    setParams(formToParams(form));
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setParams(formToParams(EMPTY_FORM));
  }, [reset]);

  /** 行操作：View。 */
  const onView = React.useCallback(
    (roleId: number) => {
      router.push(`/sys/role/view?roleId=${roleId}`);
    },
    [router]
  );

  /** 行操作：Edit。 */
  const onEdit = React.useCallback(
    (roleId: number) => {
      router.push(`/sys/role/edit?roleId=${roleId}`);
    },
    [router]
  );

  /** 行操作：Disable/Enable，含 confirm（role.md 5.1）。 */
  const onToggleStatus = React.useCallback(
    (row: RoleItem) => {
      const nextStatus =
        row.status === RoleStatus.Enabled
          ? RoleStatus.Disabled
          : RoleStatus.Enabled;
      const confirmKey =
        nextStatus === RoleStatus.Disabled
          ? t('confirm.disable')
          : t('confirm.enable');
      if (!window.confirm(confirmKey)) return;
      statusMutation.mutate(
        { roleId: row.roleId, status: nextStatus },
        {
          onSuccess: () =>
            toast.success(
              nextStatus === RoleStatus.Disabled
                ? t('toast.disableSuccess')
                : t('toast.enableSuccess')
            ),
        }
      );
    },
    [statusMutation, t, toast]
  );

  /** 行操作：Delete，含 confirm（role.md 5.1）。 */
  const onDelete = React.useCallback(
    (row: RoleItem) => {
      if (!window.confirm(t('confirm.delete'))) return;
      deleteMutation.mutate(row.roleId, {
        onSuccess: () => toast.success(t('toast.deleteSuccess')),
      });
    },
    [deleteMutation, t, toast]
  );

  const columns = React.useMemo<ColumnDef<RoleItem & { id: string }>[]>(
    () => [
      {
        // 序号列：行号（非真实 roleId），对齐旧页 `${index+1}` 渲染。
        id: 'index',
        header: t('field.index'),
        cell: ({ row }) => <span>{row.index + 1}</span>,
      },
      { accessorKey: 'roleName', header: t('field.roleName') },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <RoleStatusTag
            status={row.original.status}
            enabledLabel={t('status.enabled')}
            disabledLabel={t('status.disabled')}
          />
        ),
      },
      {
        id: 'actions',
        header: t('field.action'),
        cell: ({ row }) => {
          const item = row.original;
          // roleType 守卫（role.md 5.1 / 7.1）：disabled 条件精确复刻旧页表达式。
          // 注意陷阱：OpenAPI 未声明 roleType，后端可能不返回 → roleType 为 undefined。
          //   而 `undefined !== 0` 在 JS 中为 **true**（非 false），故守卫并非"恒不生效"：
          //   - roleType 缺失时 `roleType!==0`=true，则 Edit/Delete/Enable 仅在禁用态(status===1)可用。
          //   - Disable 仅在启用态(status==0)可用。
          // 后端若实际返回 roleType=0（系统内置角色），则 `roleType!==0`=false → 这些操作恒 disabled。
          // 此处不臆测后端语义，按旧页运算符原样保留（Rule 11/12）。
          const editDisabled = !(item.status === 1 && item.roleType !== 0);
          const disableDisabled = !(item.status === 0 && item.roleType !== 0);
          const enableDisabled = !(item.status === 1 && item.roleType !== 0);
          const deleteDisabled = !(item.status === 1 && item.roleType !== 0);

          return (
            <div className="flex items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => onView(item.roleId)}
              >
                {t('action.view')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={editDisabled}
                onClick={() => onEdit(item.roleId)}
              >
                {t('action.edit')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={disableDisabled}
                onClick={() => onToggleStatus(item)}
              >
                {t('action.disable')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={enableDisabled}
                onClick={() => onToggleStatus(item)}
              >
                {t('action.enable')}
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-destructive"
                disabled={deleteDisabled}
                onClick={() => onDelete(item)}
              >
                {t('action.delete')}
              </Button>
            </div>
          );
        },
      },
    ],
    [t, onView, onEdit, onToggleStatus, onDelete]
  );

  // DataTable 约束 { id: string }；role rowKey 为 roleId:number，map 出 id（既有约定）。
  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.roleId) })),
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
          <FormField
            name="roleName"
            label={t('field.roleName')}
            register={register('roleName')}
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
          <Button
            type="button"
            size="sm"
            onClick={() => router.push('/sys/role/create')}
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
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) => setParams((prev) => ({ ...prev, page })),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
