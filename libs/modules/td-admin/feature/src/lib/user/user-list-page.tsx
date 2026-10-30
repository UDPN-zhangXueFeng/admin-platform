'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';

import { Button, DataTable, useToast } from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { PermissionGuard } from '@myorg/shared/util-auth';

import {
  USER_PAGE_SIZE,
  USER_PERMISSIONS,
  UserStatus,
  UserStatusBadge,
} from '.';
import {
  useDeleteUserMutation,
  useResetUserPasswordMutation,
  useUpdateUserStatusMutation,
  useUserListQuery,
  type UserQueryParams,
  type UserRespVo,
} from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

interface UserFilterForm {
  userName?: string;
  email?: string;
}

const EMPTY_FORM: UserFilterForm = { userName: '', email: '' };

/**
 * 把 RHF 筛选表单翻译为查询参数；空串字段被剔除。
 */
function formToParams(form: UserFilterForm): UserQueryParams {
  const params: UserQueryParams = { page: 1, pageSize: USER_PAGE_SIZE };
  if (form.userName) params.userName = form.userName;
  if (form.email) params.email = form.email;
  return params;
}

/**
 * UserListPage — 用户管理列表页。
 *
 * 迁移自 td-manage `src/pages/sys/user/index.tsx`（200 行）。
 * - 筛选：userName + email（两 Input，对齐旧页，无角色/状态筛选）。
 * - 列：序号（行号）/ userName / email / phoneNumber / tdName（逗号→、）/ createTime / status（UserStatusBadge）。
 * - 行操作：View / Edit / Disable / Enable / Reset / Delete（含 confirm，按 status 动态 disabled）。
 * - 顶部 Add 按钮跳 /sys/user/create。
 *
 * disabled 守卫（user.md §5.1，精确复刻旧页 `disabled:` 表达式）：
 *  - View         恒可用。
 *  - Edit         仅 status===1 禁用（旧页 `disabled: !(data.status === 1)` → status===0 时 disabled）。
 *  - Disable      仅 status===0 可点。
 *  - Enable/Reset/Delete  仅 status===1 可点。
 */
export function UserListPage() {
  const t = useTranslations('modules.user');
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, reset } = useForm<UserFilterForm>({
    defaultValues: EMPTY_FORM,
  });

  const [params, setParams] = React.useState<UserQueryParams>(() =>
    formToParams(EMPTY_FORM)
  );

  const { data, isLoading, isError } = useUserListQuery(PROJECT_ID, params);
  const statusMutation = useUpdateUserStatusMutation(PROJECT_ID);
  const resetMutation = useResetUserPasswordMutation(PROJECT_ID);
  const deleteMutation = useDeleteUserMutation(PROJECT_ID);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSubmit = React.useCallback((form: UserFilterForm) => {
    setParams(formToParams(form));
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setParams(formToParams(EMPTY_FORM));
  }, [reset]);

  /** 行操作：View。 */
  const onView = React.useCallback(
    (userId: number) => {
      router.push(`/sys/user/view?userId=${userId}`);
    },
    [router]
  );

  /** 行操作：Edit。 */
  const onEdit = React.useCallback(
    (userId: number) => {
      router.push(`/sys/user/edit?userId=${userId}`);
    },
    [router]
  );

  /** 行操作：Disable/Enable，含 confirm（user.md §5.1）。 */
  const onToggleStatus = React.useCallback(
    (row: UserRespVo) => {
      const nextStatus =
        row.status === UserStatus.Enabled
          ? UserStatus.Disabled
          : UserStatus.Enabled;
      const confirmKey =
        nextStatus === UserStatus.Disabled
          ? t('confirm.disable')
          : t('confirm.enable');
      if (!window.confirm(confirmKey)) return;
      statusMutation.mutate(
        { userId: row.userId, status: nextStatus },
        {
          onSuccess: () => toast.success(t('action.statusUpdated')),
          onError: () => toast.error(t('action.operationFailed')),
        }
      );
    },
    [statusMutation, t, toast]
  );

  /** 行操作：Reset password，含 confirm（user.md §5.1）。 */
  const onResetPassword = React.useCallback(
    (row: UserRespVo) => {
      if (!window.confirm(t('confirm.reset'))) return;
      resetMutation.mutate(row.userId, {
        onSuccess: () => toast.success(t('action.passwordReset')),
        onError: () => toast.error(t('action.operationFailed')),
      });
    },
    [resetMutation, t, toast]
  );

  /** 行操作：Delete，含 confirm（user.md §5.1）。 */
  const onDelete = React.useCallback(
    (row: UserRespVo) => {
      if (!window.confirm(t('confirm.delete'))) return;
      deleteMutation.mutate(row.userId, {
        onSuccess: () => toast.success(t('action.deleteSuccess')),
        onError: () => toast.error(t('action.operationFailed')),
      });
    },
    [deleteMutation, t, toast]
  );

  const columns = React.useMemo<ColumnDef<UserRespVo & { id: string }>[]>(
    () => [
      {
        // 序号跨页连续，后端可能不回 pageNum/pageSize 时由请求参数回退。
        id: 'index',
        header: t('field.index'),
        cell: ({ row }) => {
          const page = paginationMeta?.page ?? 1;
          const pageSize = paginationMeta?.pageSize ?? USER_PAGE_SIZE;
          return <span>{(page - 1) * pageSize + row.index + 1}</span>;
        },
      },
      { accessorKey: 'userName', header: t('field.userName') },
      { accessorKey: 'email', header: t('field.email') },
      {
        accessorKey: 'phoneNumber',
        header: t('field.phoneNumber'),
        cell: ({ row }) => (
          <span>{row.original.phoneNumber || '--'}</span>
        ),
      },
      {
        accessorKey: 'tdName',
        header: t('field.tdName'),
        cell: ({ row }) => (
          <span>
            {row.original.tdName ? row.original.tdName.split(',').join('、') : '--'}
          </span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('field.createTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createTime
              ? formatAdminTimestamp(Number(row.original.createTime))
              : '--'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('field.status'),
        cell: ({ row }) => (
          <UserStatusBadge
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
          // 守卫精确复刻旧页（user.md §5.1）。
          const editDisabled = !(item.status === 1);
          const disableDisabled = !(item.status === 0);
          const enableDisabled = !(item.status === 1);
          const resetDisabled = !(item.status === 1);
          const deleteDisabled = !(item.status === 1);

          return (
            <div className="flex flex-wrap items-center gap-2">
              <PermissionGuard permission={USER_PERMISSIONS.view}>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => onView(item.userId)}
                >
                  {t('action.view')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={USER_PERMISSIONS.edit}>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  disabled={editDisabled}
                  onClick={() => onEdit(item.userId)}
                >
                  {t('action.edit')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={USER_PERMISSIONS.disable}>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  disabled={disableDisabled}
                  onClick={() => onToggleStatus(item)}
                >
                  {t('action.disable')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={USER_PERMISSIONS.enable}>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  disabled={enableDisabled}
                  onClick={() => onToggleStatus(item)}
                >
                  {t('action.enable')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={USER_PERMISSIONS.reset}>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  disabled={resetDisabled}
                  onClick={() => onResetPassword(item)}
                >
                  {t('action.reset')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={USER_PERMISSIONS.delete}>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-destructive"
                  disabled={deleteDisabled}
                  onClick={() => onDelete(item)}
                >
                  {t('action.delete')}
                </Button>
              </PermissionGuard>
            </div>
          );
        },
      },
    ],
    [t, paginationMeta, onView, onEdit, onToggleStatus, onResetPassword, onDelete]
  );

  // DataTable 约束 { id: string }；user rowKey 为 userId:number，map 出 id（既有约定）。
  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.userId) })),
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
            name="userName"
            label={t('field.userName')}
            register={register('userName')}
          />
          <FormField
            name="email"
            label={t('field.email')}
            register={register('email')}
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
          <PermissionGuard permission={USER_PERMISSIONS.add}>
            <Button
              type="button"
              size="sm"
              onClick={() => router.push('/sys/user/create')}
            >
              {t('action.add')}
            </Button>
          </PermissionGuard>
        </div>
        {isError ? (
          <div role="alert" className="border-b px-6 py-3 text-sm text-destructive">
            {t('loadFailed')}
          </div>
        ) : null}
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
