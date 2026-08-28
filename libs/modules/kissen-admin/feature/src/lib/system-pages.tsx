'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';
import { peekRow, stashRow } from './row-stash';
import { useKissenPerm } from './use-kissen-perm';

import {
  KISSEN_PROJECT_ID,
  MENU_TYPE_LABEL,
  OPERATE_LOG_RESULT_LABEL,
  OPERATE_LOG_RESULT_VARIANT,
  RBAC_FIRST_LOGIN_LABEL,
  RBAC_FIRST_LOGIN_VARIANT,
  RBAC_USER_STATUS_LABEL,
  RBAC_USER_STATUS_VARIANT,
  RBAC_USER_TYPE_LABEL,
  RBAC_USER_TYPE_VARIANT,
  useMenuDeleteMutation,
  useMenuPermListQuery,
  useMenuPermSaveMutation,
  useMenuSaveMutation,
  useMenuTreeQuery,
  useMenuUpdateMutation,
  useOperateLogListQuery,
  useRbacRoleListQuery,
  useRbacRoleOptionsQuery,
  useRbacUserListQuery,
  useRbacUserOptionsQuery,
  useRoleAssignMenuMutation,
  useRoleDeleteMutation,
  useRoleMenuIdsQuery,
  useRoleSaveMutation,
  useRoleUpdateMutation,
  useUserAssignRoleMutation,
  useUserForceLogoutMutation,
  useUserResetPwdMutation,
  useUserSaveMutation,
  useUserStatusMutation,
  useUserUpdateMutation,
  useWorkflowBusinessesQuery,
  useWorkflowDetailQuery,
  useWorkflowListQuery,
  useWorkflowSaveMutation,
  useWorkflowStatusMutation,
  useWorkflowUpdateMutation,
  WORKFLOW_BUSINESS_OPTIONS,
  WORKFLOW_STATUS_LABEL,
  WORKFLOW_STATUS_VARIANT,
  WORKFLOW_STEP_TYPE_LABEL,
  type MenuPermissionItem,
  type MenuTreeRespVO,
  type OneTimePassword,
  type OperateLogRow,
  type RoleRow,
  type UserRow,
  type WorkflowRow,
} from '@myorg/modules/kissen-admin/data-access';

/* ============================================================ */
/* 共享格式化 / 展示辅助                                          */
/* ============================================================ */

const PAGE_SIZE_DEFAULT = 10;

/** 路由 search param → number（无效/缺失返回 undefined）。 */
function parseNum(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 毫秒时间戳 → 本地 YYYY-MM-DD HH:mm:ss；0/空 → '--'。 */
function formatTimestamp(ms: number | undefined | null): string {
  if (!ms) return '--';
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 「全部」哨兵值（Radix Select 禁空串 value）。 */
const ALL = 'all';
function optAll() {
  return { value: ALL, label: 'All' };
}

/** 下拉字符串 → number；ALL/空 → undefined。 */
function toNum(v: string | undefined): number | undefined {
  if (!v || v === ALL) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="text-sm tabular-nums">{children}</div>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
      <div className="mb-6 text-base font-semibold">{title}</div>
      {children}
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** 一次性密码展示弹窗（创建用户 / 重置密码后，源 el-message → 目标 Dialog）。 */
function OneTimePasswordDialog({
  open,
  onClose,
  title,
  description,
  otp,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  otp: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">One-time login password (password change required on first sign-in):</p>
          <div className="rounded-md border bg-muted p-3 text-center font-mono text-lg tracking-widest">
            {otp ?? '—'}
          </div>
          <p className="text-xs text-muted-foreground">
            Deliver it to the user securely; it cannot be viewed again after closing.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>I have recorded it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


interface ConfirmRequest {
  title: string;
  message: string;
  confirmText?: string;
  /** 破坏性动作（禁用/删除/强制下线）→ destructive 按钮样式。 */
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * 行操作确认弹窗：源 `window.confirm` / ElMessageBox.confirm → 受控 AlertDialog。
 * 各页面持 `useState<ConfirmRequest | null>`，点确认后关闭弹窗再执行动作。
 */
function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open={request != null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              request?.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
            onClick={() => request?.onConfirm()}
          >
            {request?.confirmText ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ============================================================ */
/* ============================================================ */
/* sys-user — 用户管理（源 views/system/user/index.vue）          */
/* ============================================================ */

interface UserFilterForm {
  loginName: string;
  userName: string;
  status: string;
}
const EMPTY_USER_FILTER: UserFilterForm = {
  loginName: '',
  userName: '',
  status: ALL,
};

function userFilterToParams(
  form: UserFilterForm,
  pageNum: number,
  pageSize: number,
) {
  return {
    pageNum,
    pageSize,
    filter: {
      loginName: form.loginName || undefined,
      userName: form.userName || undefined,
      status: toNum(form.status),
    },
  };
}

const USER_STATUS_OPTIONS = [
  optAll(),
  { value: '0', label: RBAC_USER_STATUS_LABEL[0] },
  { value: '1', label: RBAC_USER_STATUS_LABEL[1] },
];

/** 角色多选（源 el-select multiple → Checkbox 列表，角色数量有限）。 */
function RoleCheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: RoleRow[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No roles available to assign.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((r) => (
        <label
          key={r.roleId}
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox
            checked={selected.includes(r.roleId)}
            onCheckedChange={(c) =>
              c
                ? onChange([...selected, r.roleId])
                : onChange(selected.filter((i) => i !== r.roleId))
            }
          />
          <span>
            {r.roleName} ({r.roleCode})
          </span>
        </label>
      ))}
    </div>
  );
}

/** 分配角色弹窗（源 user/index.vue assignRoles dialog）。 */
function UserAssignRoleDialog({
  user,
  onClose,
}: {
  user: UserRow | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: roles } = useRbacRoleOptionsQuery(KISSEN_PROJECT_ID);
  const [selected, setSelected] = React.useState<number[]>([]);
  const mutation = useUserAssignRoleMutation(KISSEN_PROJECT_ID);

  React.useEffect(() => {
    if (user) setSelected(user.roleIds ?? []);
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Roles — {user?.userName}</DialogTitle>
          <DialogDescription>
            Assign roles to user {user?.loginName}; takes effect immediately after saving.
          </DialogDescription>
        </DialogHeader>
        <RoleCheckboxGroup
          options={roles ?? []}
          selected={selected}
          onChange={setSelected}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { userId: user!.userId, roleIds: selected },
                {
                  onSuccess: () => {
                    toast.success('Roles updated');
                    onClose();
                  },
                  onError: (e) => toast.error((e as Error).message),
                },
              )
            }
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SysUserListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useKissenPerm();
  const { register, handleSubmit, reset, control } = useForm<UserFilterForm>({
    defaultValues: EMPTY_USER_FILTER,
  });

  const [params, setParams] = React.useState(() =>
    userFilterToParams(EMPTY_USER_FILTER, 1, PAGE_SIZE_DEFAULT),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const { data, isLoading } = useRbacUserListQuery(KISSEN_PROJECT_ID, params);

  const statusMutation = useUserStatusMutation(KISSEN_PROJECT_ID);
  const resetMutation = useUserResetPwdMutation(KISSEN_PROJECT_ID);
  const forceLogoutMutation = useUserForceLogoutMutation(KISSEN_PROJECT_ID);

  const [assignUser, setAssignUser] = React.useState<UserRow | null>(null);
  const [resetOtp, setResetOtp] = React.useState<{
    userName: string;
    pwd: string;
  } | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSearch = React.useCallback(
    (form: UserFilterForm) => {
      setParams(userFilterToParams(form, 1, pageSize));
    },
    [pageSize],
  );
  const onResetSearch = React.useCallback(() => {
    reset(EMPTY_USER_FILTER);
    setParams(userFilterToParams(EMPTY_USER_FILTER, 1, pageSize));
  }, [reset, pageSize]);

  /** 启停（源 userStatus：status 0 正常 / 1 停用）。 */
  const onToggleStatus = React.useCallback(
    (row: UserRow) => {
      const next = row.status === 0 ? 1 : 0;
      const verb = next === 1 ? 'disable' : 'enable';
      setConfirm({
        title: verb === 'disable' ? 'Disable User' : 'Enable User',
        message: `Are you sure you want to ${verb} "${row.userName}"?`,
        confirmText: verb === 'disable' ? 'Disable' : 'Enable',
        destructive: next === 1,
        onConfirm: () =>
          statusMutation.mutate(
            { userId: row.userId, status: next },
            {
              onSuccess: () => toast.success(`User ${verb}d`),
              onError: (e) => toast.error((e as Error).message),
            },
          ),
      });
    },
    [statusMutation, toast],
  );

  /** 重置密码（源 userResetPwd → OneTimePassword）。 */
  const onResetPwd = React.useCallback(
    (row: UserRow) => {
      setConfirm({
        title: 'Reset Password',
        message: `Are you sure you want to reset the password of "${row.userName}"?`,
        onConfirm: () =>
          resetMutation.mutate(row.userId, {
            onSuccess: (otp: OneTimePassword) =>
              setResetOtp({ userName: row.loginName, pwd: otp.oneTimePassword }),
            onError: (e) => toast.error((e as Error).message),
          }),
      });
    },
    [resetMutation, toast],
  );

  /** 强制下线（源 userForceLogout，踢出所有会话）。 */
  const onForceLogout = React.useCallback(
    (row: UserRow) => {
      setConfirm({
        title: 'Force Sign Out',
        message: `Force sign out of "${row.userName}"? All of their sessions will be invalidated immediately.`,
        confirmText: 'Force Sign Out',
        destructive: true,
        onConfirm: () =>
          forceLogoutMutation.mutate(row.userId, {
            onSuccess: () => toast.success('Force signed out'),
            onError: (e) => toast.error((e as Error).message),
          }),
      });
    },
    [forceLogoutMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<UserRow & { id: string }>[]
  >(() => [
    { accessorKey: 'loginName', header: 'Login Name' },
    { accessorKey: 'userName', header: 'Full Name' },
    {
      id: 'userType',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={RBAC_USER_TYPE_VARIANT[row.original.userType]}>
          {RBAC_USER_TYPE_LABEL[row.original.userType] ?? row.original.userType}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={RBAC_USER_STATUS_VARIANT[row.original.status]}>
          {RBAC_USER_STATUS_LABEL[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      id: 'firstLogin',
      header: 'First Login',
      cell: ({ row }) => (
        <Badge variant={RBAC_FIRST_LOGIN_VARIANT[row.original.firstLogin]}>
          {RBAC_FIRST_LOGIN_LABEL[row.original.firstLogin] ??
            row.original.firstLogin}
        </Badge>
      ),
    },
    {
      accessorKey: 'createTime',
      header: 'Created At',
      cell: ({ row }) => formatTimestamp(row.original.createTime),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => {
                stashRow('user', u.userId, u);
                router.push(`/system/user/detail?id=${u.userId}`);
              }}
            >
              View
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => {
                stashRow('user', u.userId, u);
                router.push(`/system/user/edit?id=${u.userId}`);
              }}
            >
              Edit
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setAssignUser(u)}
            >
              Assign Roles
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onResetPwd(u)}
            >
              Reset Password
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onToggleStatus(u)}
            >
              {u.status === 0 ? 'Disable' : 'Enable'}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-destructive"
              onClick={() => onForceLogout(u)}
            >
              Force Sign Out
            </Button>
          </div>
        );
      },
    },
  ], [router, onResetPwd, onToggleStatus, onForceLogout]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.userId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="loginName"
            label="Login Name"
            register={register('loginName')}
            placeholder="Fuzzy match"
          />
          <FormField
            name="userName"
            label="Full Name"
            register={register('userName')}
            placeholder="Fuzzy match"
          />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            placeholder="All"
            options={USER_STATUS_OPTIONS}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">Users</div>
          {hasPerm('rbac:user:manage') && (
            <Button size="sm" onClick={() => router.push('/system/user/create')}>
              Add User
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
                  },
                }
              : undefined
          }
        />
      </div>

      <UserAssignRoleDialog
        user={assignUser}
        onClose={() => setAssignUser(null)}
      />
      <OneTimePasswordDialog
        open={!!resetOtp}
        onClose={() => setResetOtp(null)}
        title="Password Reset"
        description={`One-time password of user "${resetOtp?.userName ?? ''}":`}
        otp={resetOtp?.pwd ?? null}
      />
      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

/** 用户表单值。 */
interface UserFormValues {
  loginName: string;
  userName: string;
  userType: string;
  email: string;
  phoneNumber: string;
}

export function SysUserFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));
  const isEdit = !!id;

  const { data: roles } = useRbacRoleOptionsQuery(KISSEN_PROJECT_ID);
  const [selectedRoles, setSelectedRoles] = React.useState<number[]>([]);

  const saveMutation = useUserSaveMutation(KISSEN_PROJECT_ID);
  const updateMutation = useUserUpdateMutation(KISSEN_PROJECT_ID);

  const { register, handleSubmit, reset, control } = useForm<UserFormValues>({
    defaultValues: {
      loginName: '',
      userName: '',
      userType: '1',
      email: '',
      phoneNumber: '',
    },
  });

  /** 编辑回显：无 GET /user/{id}，优先读列表页暂存行，缺失时经列表定位（pageSize 200）。 */
  const loadedRef = React.useRef(false);
  const stashedUser = React.useMemo(
    () => (isEdit && id != null ? peekRow<UserRow>('user', id) : null),
    [isEdit, id],
  );
  const { data: userPage } = useRbacUserListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    isEdit && !stashedUser,
  );
  React.useEffect(() => {
    if (isEdit && !loadedRef.current) {
      const row = stashedUser ?? userPage?.data.find((u) => u.userId === id);
      if (row) {
        reset({
          loginName: row.loginName,
          userName: row.userName,
          userType: String(row.userType),
          email: row.email ?? '',
          phoneNumber: row.phoneNumber ?? '',
        });
        setSelectedRoles(row.roleIds ?? []);
        loadedRef.current = true;
      }
    }
  }, [isEdit, stashedUser, userPage, id, reset]);

  const [createdOtp, setCreatedOtp] = React.useState<string | null>(null);

  const onSubmit = handleSubmit((form) => {
    // 源 formRules：loginName/userName 必填（新增与编辑共用）。
    if (!form.loginName.trim()) {
      toast.warning('Please enter a login name');
      return;
    }
    if (!form.userName.trim()) {
      toast.warning('Please enter a full name');
      return;
    }
    if (isEdit) {
      updateMutation.mutate(
        {
          userId: id!,
          userName: form.userName,
          email: form.email || undefined,
          phoneNumber: form.phoneNumber || undefined,
          roleIds: selectedRoles,
        },
        {
          onSuccess: () => {
            toast.success('User updated');
            router.push('/system/user');
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else {
      saveMutation.mutate(
        {
          loginName: form.loginName,
          userName: form.userName,
          userType: toNum(form.userType),
          email: form.email || undefined,
          phoneNumber: form.phoneNumber || undefined,
          roleIds: selectedRoles,
        },
        {
          onSuccess: (otp: OneTimePassword) =>
            setCreatedOtp(otp.oneTimePassword),
          onError: (e) => toast.error((e as Error).message),
        },
      );
    }
  });

  return (
    <div className="space-y-4">
      <DetailCard title={isEdit ? 'Edit User' : 'Add User'}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              name="loginName"
              label="Login Name"
              register={register('loginName')}
              required
              disabled={isEdit}
              placeholder="Login name (immutable after creation)"
            />
            <FormField
              name="userName"
              label="Full Name"
              register={register('userName')}
              required
            />
            <FormSelect
              name="userType"
              control={control}
              disabled={isEdit}
              label="User Type"
              options={[
                { value: '0', label: RBAC_USER_TYPE_LABEL[0] },
                { value: '1', label: RBAC_USER_TYPE_LABEL[1] },
              ]}
            />
            <FormField name="email" label="Email" register={register('email')} />
            <FormField name="phoneNumber" label="Phone Number" register={register('phoneNumber')} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Roles</label>
            <RoleCheckboxGroup
              options={roles ?? []}
              selected={selectedRoles}
              onChange={setSelectedRoles}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending || updateMutation.isPending}>
              {saveMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/system/user')}
            >
              Back
            </Button>
          </div>
        </form>
      </DetailCard>

      <OneTimePasswordDialog
        open={!!createdOtp}
        onClose={() => {
          setCreatedOtp(null);
          router.push('/system/user');
        }}
        title="User Created"
        description="Deliver the following one-time password to the user (password change required on first sign-in):"
        otp={createdOtp}
      />
    </div>
  );
}

export function SysUserDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));
  const { data: roles } = useRbacRoleOptionsQuery(KISSEN_PROJECT_ID);

  /** 无 GET /user/{id}：优先读列表页暂存行，缺失时经列表定位。 */
  const stashedUser = React.useMemo(
    () => (id != null ? peekRow<UserRow>('user', id) : null),
    [id],
  );
  const { data, isLoading } = useRbacUserListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    !!id && !stashedUser,
  );
  const user = stashedUser ?? data?.data.find((u) => u.userId === id);
  const roleNames = (user?.roleIds ?? [])
    .map((rid) => roles?.find((r) => r.roleId === rid)?.roleName)
    .filter(Boolean)
    .join(', ');

  if (!id) {
    return (
      <DetailCard title="User Details">
        <p className="text-sm text-muted-foreground">Missing user ID.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/system/user')}>
          Back
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="User Details">
        {isLoading || !user ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Login Name">{user.loginName}</DetailField>
            <DetailField label="Full Name">{user.userName}</DetailField>
            <DetailField label="Type">
              <Badge variant={RBAC_USER_TYPE_VARIANT[user.userType]}>
                {RBAC_USER_TYPE_LABEL[user.userType] ?? user.userType}
              </Badge>
            </DetailField>
            <DetailField label="Status">
              <Badge variant={RBAC_USER_STATUS_VARIANT[user.status]}>
                {RBAC_USER_STATUS_LABEL[user.status] ?? user.status}
              </Badge>
            </DetailField>
            <DetailField label="First Login">
              <Badge variant={RBAC_FIRST_LOGIN_VARIANT[user.firstLogin]}>
                {RBAC_FIRST_LOGIN_LABEL[user.firstLogin] ?? user.firstLogin}
              </Badge>
            </DetailField>
            <DetailField label="Email">{user.email || '--'}</DetailField>
            <DetailField label="Phone Number">{user.phoneNumber || '--'}</DetailField>
            <DetailField label="Roles">{roleNames || '--'}</DetailField>
            <DetailField label="Created At">
              {formatTimestamp(user.createTime)}
            </DetailField>
          </div>
        )}
      </DetailCard>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/system/user')}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* sys-role — 角色管理（源 views/system/role/index.vue）          */
/* ============================================================ */

interface RoleFilterForm {
  roleCode: string;
  roleName: string;
}
const EMPTY_ROLE_FILTER: RoleFilterForm = { roleCode: '', roleName: '' };

function roleFilterToParams(
  form: RoleFilterForm,
  pageNum: number,
  pageSize: number,
) {
  return {
    pageNum,
    pageSize,
    filter: {
      roleCode: form.roleCode || undefined,
      roleName: form.roleName || undefined,
    },
  };
}

/* ---- 菜单勾选树（源 el-tree check-strictly=false） ---- */

function collectLeaves(nodes: MenuTreeRespVO[]): MenuTreeRespVO[] {
  const out: MenuTreeRespVO[] = [];
  const walk = (n: MenuTreeRespVO) => {
    if (n.children && n.children.length) n.children.forEach(walk);
    else out.push(n);
  };
  nodes.forEach(walk);
  return out;
}

function subtreeLeafIds(node: MenuTreeRespVO): number[] {
  const out: number[] = [];
  const walk = (n: MenuTreeRespVO) => {
    if (n.children && n.children.length) n.children.forEach(walk);
    else out.push(n.menuId);
  };
  walk(node);
  return out;
}

function buildParentMap(nodes: MenuTreeRespVO[]): Map<number, number> {
  const map = new Map<number, number>();
  const walk = (n: MenuTreeRespVO) => {
    if (n.children) {
      for (const c of n.children) {
        map.set(c.menuId, n.menuId);
        walk(c);
      }
    }
  };
  nodes.forEach(walk);
  return map;
}

/** 保存时的 menuIds = 已勾选叶子 ∪ 其所有祖先（等价 getCheckedKeys+getHalfCheckedKeys）。 */
function collectMenuIds(
  nodes: MenuTreeRespVO[],
  checkedLeaves: Set<number>,
): number[] {
  const parentMap = buildParentMap(nodes);
  const result = new Set<number>(checkedLeaves);
  for (const leafId of checkedLeaves) {
    let cur = parentMap.get(leafId);
    while (cur) {
      result.add(cur);
      cur = parentMap.get(cur);
    }
  }
  return [...result];
}

function nodeCheckState(
  node: MenuTreeRespVO,
  checkedLeaves: Set<number>,
): { checked: boolean; indeterminate: boolean } {
  const leaves = subtreeLeafIds(node);
  const count = leaves.filter((id) => checkedLeaves.has(id)).length;
  if (count === leaves.length) return { checked: true, indeterminate: false };
  if (count === 0) return { checked: false, indeterminate: false };
  return { checked: false, indeterminate: true };
}

function toggleNode(
  node: MenuTreeRespVO,
  checkedLeaves: Set<number>,
): Set<number> {
  const leaves = subtreeLeafIds(node);
  const allChecked = leaves.every((id) => checkedLeaves.has(id));
  const next = new Set(checkedLeaves);
  if (allChecked) leaves.forEach((id) => next.delete(id));
  else leaves.forEach((id) => next.add(id));
  return next;
}

function MenuCheckTreeNode({
  node,
  depth,
  checkedLeaves,
  onToggle,
}: {
  node: MenuTreeRespVO;
  depth: number;
  checkedLeaves: Set<number>;
  onToggle: (n: MenuTreeRespVO) => void;
}) {
  const st = nodeCheckState(node, checkedLeaves);
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1"
        style={{ paddingLeft: depth * 18 }}
      >
        <Checkbox
          checked={st.indeterminate ? 'indeterminate' : st.checked}
          onCheckedChange={() => onToggle(node)}
        />
        <span className="text-sm">{node.menuName}</span>
        <Badge variant="outline" className="text-[10px]">
          {MENU_TYPE_LABEL[node.menuType]}
        </Badge>
      </div>
      {node.children?.map((c) => (
        <MenuCheckTreeNode
          key={c.menuId}
          node={c}
          depth={depth + 1}
          checkedLeaves={checkedLeaves}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

/** 分配菜单弹窗（源 role/index.vue assignMenu dialog）。 */
function RoleAssignMenuDialog({
  role,
  onClose,
}: {
  role: RoleRow | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: tree } = useMenuTreeQuery(KISSEN_PROJECT_ID);
  const { data: menuIds } = useRoleMenuIdsQuery(
    KISSEN_PROJECT_ID,
    role?.roleId,
  );
  const mutation = useRoleAssignMenuMutation(KISSEN_PROJECT_ID);

  const [checkedLeaves, setCheckedLeaves] = React.useState<Set<number>>(
    new Set(),
  );
  const [clearConfirm, setClearConfirm] =
    React.useState<ConfirmRequest | null>(null);

  // 回显：仅叶子（避免 check-strictly=false 下级联误勾父节点）。
  React.useEffect(() => {
    if (menuIds && tree) {
      const leafIds = new Set(collectLeaves(tree).map((n) => n.menuId));
      setCheckedLeaves(new Set(menuIds.filter((id) => leafIds.has(id))));
    }
  }, [menuIds, tree]);

  const onToggle = (n: MenuTreeRespVO) =>
    setCheckedLeaves((prev) => toggleNode(n, prev));

  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Menus — {role?.roleName}</DialogTitle>
          <DialogDescription>
            Check menu and button permissions; takes effect immediately after saving.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] rounded-md border p-3">
          {!tree ? (
            <LoadingBlock />
          ) : (
            tree.map((n) => (
              <MenuCheckTreeNode
                key={n.menuId}
                node={n}
                depth={0}
                checkedLeaves={checkedLeaves}
                onToggle={onToggle}
              />
            ))
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              if (!tree) return;
              const nextIds = collectMenuIds(tree, checkedLeaves);
              // 源 role/index.vue onAssign：空勾选需显式确认后才会清空。
              const doAssign = (menuIds: number[]) =>
                mutation.mutate(
                  {
                    roleId: role!.roleId,
                    menuIds,
                  },
                  {
                    onSuccess: () => {
                      toast.success('Menus updated');
                      onClose();
                    },
                    onError: (e) => toast.error((e as Error).message),
                  },
                );
              if (nextIds.length === 0) {
                setClearConfirm({
                  title: 'Clear Menus',
                  message: 'This will clear all menus of this role. Confirm?',
                  destructive: true,
                  onConfirm: () => doAssign([]),
                });
                return;
              }
              doAssign(nextIds);
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
        <ConfirmDialog
          request={clearConfirm}
          onClose={() => setClearConfirm(null)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function SysRoleListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useKissenPerm();
  const { register, handleSubmit, reset } = useForm<RoleFilterForm>({
    defaultValues: EMPTY_ROLE_FILTER,
  });

  const [params, setParams] = React.useState(() =>
    roleFilterToParams(EMPTY_ROLE_FILTER, 1, PAGE_SIZE_DEFAULT),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const { data, isLoading } = useRbacRoleListQuery(KISSEN_PROJECT_ID, params);

  const deleteMutation = useRoleDeleteMutation(KISSEN_PROJECT_ID);
  const [assignRole, setAssignRole] = React.useState<RoleRow | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSearch = React.useCallback(
    (form: RoleFilterForm) => {
      setParams(roleFilterToParams(form, 1, pageSize));
    },
    [pageSize],
  );
  const onResetSearch = React.useCallback(() => {
    reset(EMPTY_ROLE_FILTER);
    setParams(roleFilterToParams(EMPTY_ROLE_FILTER, 1, pageSize));
  }, [reset, pageSize]);

  const onDelete = React.useCallback(
    (row: RoleRow) => {
      setConfirm({
        title: 'Delete Role',
        message: `Delete role "${row.roleName}"? Built-in roles or roles referenced by users cannot be deleted.`,
        destructive: true,
        onConfirm: () =>
          deleteMutation.mutate(row.roleId, {
            onSuccess: () => toast.success('Role deleted'),
            onError: (e) => toast.error((e as Error).message),
          }),
      });
    },
    [deleteMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<RoleRow & { id: string }>[]
  >(() => [
    { accessorKey: 'roleCode', header: 'Role Code' },
    { accessorKey: 'roleName', header: 'Role Name' },
    {
      id: 'roleType',
      header: 'Type',
      cell: ({ row }) =>
        row.original.roleType === 0 ? 'Built-in' : 'Custom',
    },
    {
      accessorKey: 'remarks',
      header: 'Remarks',
      cell: ({ row }) => row.original.remarks || '--',
    },
    {
      accessorKey: 'createTime',
      header: 'Created At',
      cell: ({ row }) => formatTimestamp(row.original.createTime),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => router.push(`/system/role/detail?id=${r.roleId}`)}
            >
              View
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => router.push(`/system/role/edit?id=${r.roleId}`)}
            >
              Edit
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setAssignRole(r)}
            >
              Assign Menus
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-destructive"
              onClick={() => onDelete(r)}
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ], [router, onDelete]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.roleId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="roleCode"
            label="Role Code"
            register={register('roleCode')}
            placeholder="Fuzzy match"
          />
          <FormField
            name="roleName"
            label="Role Name"
            register={register('roleName')}
            placeholder="Fuzzy match"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">Roles</div>
          {hasPerm('rbac:role:manage') && (
            <Button size="sm" onClick={() => router.push('/system/role/create')}>
              Add Role
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
                  },
                }
              : undefined
          }
        />
      </div>

      <RoleAssignMenuDialog
        role={assignRole}
        onClose={() => setAssignRole(null)}
      />
      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

interface RoleFormValues {
  roleCode: string;
  roleName: string;
  remarks: string;
}

export function SysRoleFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));
  const isEdit = !!id;

  const saveMutation = useRoleSaveMutation(KISSEN_PROJECT_ID);
  const updateMutation = useRoleUpdateMutation(KISSEN_PROJECT_ID);

  const { register, handleSubmit, reset } = useForm<RoleFormValues>({
    defaultValues: { roleCode: '', roleName: '', remarks: '' },
  });

  const loadedRef = React.useRef(false);
  const { data: rolePage } = useRbacRoleListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    isEdit,
  );
  const currentRow = isEdit
    ? rolePage?.data.find((r) => r.roleId === id)
    : undefined;
  React.useEffect(() => {
    if (isEdit && rolePage && !loadedRef.current) {
      const row = rolePage.data.find((r) => r.roleId === id);
      if (row) {
        reset({
          roleCode: row.roleCode,
          roleName: row.roleName,
          remarks: row.remarks ?? '',
        });
        loadedRef.current = true;
      }
    }
  }, [isEdit, rolePage, id, reset]);


  const onSubmit = handleSubmit((form) => {
    if (!form.roleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    if (isEdit) {
      updateMutation.mutate(
        { roleId: id!, roleName: form.roleName, remarks: form.remarks || undefined, status: currentRow?.status },
        {
          onSuccess: () => {
            toast.success('Role updated');
            router.push('/system/role');
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else {
      if (!form.roleCode.trim()) {
        toast.error('Role code is required');
        return;
      }
      saveMutation.mutate(
        { roleCode: form.roleCode, roleName: form.roleName, remarks: form.remarks || undefined },
        {
          onSuccess: () => {
            toast.success('Role created');
            router.push('/system/role');
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    }
  });

  return (
    <DetailCard title={isEdit ? 'Edit Role' : 'Add Role'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            name="roleCode"
            label="Role Code"
            register={register('roleCode')}
            required
            disabled={isEdit}
            placeholder="Unique code (immutable after creation)"
          />
          <FormField
            name="roleName"
            label="Role Name"
            register={register('roleName')}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="remarks">Remarks</Label>
          <Textarea id="remarks" rows={3} {...register('remarks')} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saveMutation.isPending || updateMutation.isPending}>
            {saveMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/system/role')}
          >
            Back
          </Button>
        </div>
      </form>
    </DetailCard>
  );
}

export function SysRoleDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));

  const { data: rolePage, isLoading } = useRbacRoleListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    !!id,
  );
  const role = rolePage?.data.find((r) => r.roleId === id);

  const { data: menuIds } = useRoleMenuIdsQuery(KISSEN_PROJECT_ID, id);
  const { data: tree } = useMenuTreeQuery(KISSEN_PROJECT_ID);

  /** menuId → 菜单名（含路径前缀）。 */
  const menuNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    const walk = (n: MenuTreeRespVO, prefix: string) => {
      const full = prefix ? `${prefix} / ${n.menuName}` : n.menuName;
      map.set(n.menuId, full);
      n.children?.forEach((c) => walk(c, full));
    };
    tree?.forEach((n) => walk(n, ''));
    return map;
  }, [tree]);

  if (!id) {
    return (
      <DetailCard title="Role Details">
        <p className="text-sm text-muted-foreground">Missing role ID.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/system/role')}>
          Back
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="Role Details">
        {isLoading || !role ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Role Code">{role.roleCode}</DetailField>
            <DetailField label="Role Name">{role.roleName}</DetailField>
            <DetailField label="Type">
              {role.roleType === 0 ? 'Built-in' : 'Custom'}
            </DetailField>
            <DetailField label="Status">
              <Badge variant={RBAC_USER_STATUS_VARIANT[role.status]}>
                {RBAC_USER_STATUS_LABEL[role.status] ?? role.status}
              </Badge>
            </DetailField>
            <DetailField label="Remarks">{role.remarks || '--'}</DetailField>
            <DetailField label="Created At">
              {formatTimestamp(role.createTime)}
            </DetailField>
          </div>
        )}
      </DetailCard>

      <DetailCard title="Assigned Menus">
        {isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(menuIds ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No menus assigned.</p>
            ) : (
              (menuIds ?? []).map((mid) => (
                <Badge key={mid} variant="secondary">
                  {menuNameById.get(mid) ?? `#${mid}`}
                </Badge>
              ))
            )}
          </div>
        )}
      </DetailCard>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/system/role')}>
          Back
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* sys-menu — 菜单 & 接口权限（源 views/system/menu/index.vue）   */
/* 单页两栏：左树选择，右栏表单 + 接口权限。                       */
/* ============================================================ */

interface MenuFormState {
  menuId?: number;
  menuName: string;
  menuNameEn: string;
  menuKey: string;
  parentId: number;
  menuType: 0 | 1 | 2 | 3 | 4;
  orderNum: number;
  visible: 0 | 1;
  menuUrl: string;
  icon: string;
}

const EMPTY_MENU_FORM: MenuFormState = {
  menuName: '',
  menuNameEn: '',
  menuKey: '',
  parentId: 0,
  menuType: 1,
  orderNum: 0,
  visible: 0,
  menuUrl: '',
  icon: '',
};

function MenuTreeNode({
  node,
  depth,
  selectedKey,
  onSelect,
}: {
  node: MenuTreeRespVO;
  depth: number;
  selectedKey: number | null;
  onSelect: (n: MenuTreeRespVO) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent',
          selectedKey === node.menuId && 'bg-accent font-medium',
        )}
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        <span>{node.menuName}</span>
        <Badge variant="outline" className="text-[10px]">
          {MENU_TYPE_LABEL[node.menuType]}
        </Badge>
      </button>
      {node.children?.map((c) => (
        <MenuTreeNode
          key={c.menuId}
          node={c}
          depth={depth + 1}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

/** 接口权限编辑器（源 menu-permission/list + save，全量替换）。 */
function MenuPermEditor({ menuKey }: { menuKey: string }) {
  const toast = useToast();
  const { data: perms, isLoading } = useMenuPermListQuery(
    KISSEN_PROJECT_ID,
    menuKey,
  );
  const saveMutation = useMenuPermSaveMutation(KISSEN_PROJECT_ID);

  const [items, setItems] = React.useState<MenuPermissionItem[]>([]);
  const [newUrl, setNewUrl] = React.useState('');
  const [newMethod, setNewMethod] = React.useState('');

  React.useEffect(() => {
    if (perms) setItems(perms.map((p) => ({ ...p })));
  }, [perms]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">API Permissions (menuKey: {menuKey})</div>
      {isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No API permissions.</p>
          )}
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={it.url}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((p, i) =>
                      i === idx ? { ...p, url: e.target.value } : p,
                    ),
                  )
                }
                className="flex-1"
                placeholder="/v1/manage/bank/**"
              />
              <Input
                value={it.httpMethod ?? ''}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((p, i) =>
                      i === idx ? { ...p, httpMethod: e.target.value } : p,
                    ),
                  )
                }
                className="w-28"
                placeholder="POST/GET"
              />
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-destructive"
                onClick={() =>
                  setItems((prev) => prev.filter((_, i) => i !== idx))
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="w-64"
          placeholder="New URL"
        />
        <Input
          value={newMethod}
          onChange={(e) => setNewMethod(e.target.value)}
          className="w-28"
          placeholder="POST/GET"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!newUrl.trim()) return;
            setItems((prev) => [
              ...prev,
              { menuKey, url: newUrl.trim(), httpMethod: newMethod.trim() || undefined },
            ]);
            setNewUrl('');
            setNewMethod('');
          }}
        >
          Add
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saveMutation.isPending}
          onClick={() =>
            saveMutation.mutate(
              { menuKey, items },
              {
                onSuccess: () => toast.success('API permissions saved'),
                onError: (e) => toast.error((e as Error).message),
              },
            )
          }
        >
          {saveMutation.isPending ? 'Saving…' : 'Save API Permissions'}
        </Button>
      </div>
    </div>
  );
}

export function SysMenuListPage() {
  const toast = useToast();
  const { data: tree, isLoading } = useMenuTreeQuery(KISSEN_PROJECT_ID);
  const saveMutation = useMenuSaveMutation(KISSEN_PROJECT_ID);
  const updateMutation = useMenuUpdateMutation(KISSEN_PROJECT_ID);
  const deleteMutation = useMenuDeleteMutation(KISSEN_PROJECT_ID);

  const [selectedKey, setSelectedKey] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<'view' | 'new-root' | 'new-child'>(
    'view',
  );
  const [form, setForm] = React.useState<MenuFormState>(EMPTY_MENU_FORM);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  const patch = (p: Partial<MenuFormState>) =>
    setForm((prev) => ({ ...prev, ...p }));

  const selectNode = (node: MenuTreeRespVO) => {
    setSelectedKey(node.menuId);
    setMode('view');
    setForm({
      menuId: node.menuId,
      menuName: node.menuName,
      menuNameEn: node.menuNameEn ?? '',
      menuKey: node.menuKey,
      parentId: node.parentId,
      menuType: node.menuType,
      orderNum: node.orderNum,
      visible: node.visible,
      menuUrl: node.menuUrl ?? '',
      icon: node.icon ?? '',
    });
  };

  const startNewRoot = () => {
    setSelectedKey(null);
    setMode('new-root');
    setForm({ ...EMPTY_MENU_FORM, parentId: 0, menuType: 1 });
  };

  const startNewChild = () => {
    if (selectedKey == null) return;
    setMode('new-child');
    setForm({ ...EMPTY_MENU_FORM, parentId: selectedKey, menuType: 3 });
  };

  const onSave = () => {
    if (!form.menuKey.trim()) {
      toast.error('Menu Key is required');
      return;
    }
    const payload = {
      menuName: form.menuName,
      menuNameEn: form.menuNameEn || undefined,
      menuKey: form.menuKey,
      parentId: form.parentId,
      menuType: form.menuType,
      orderNum: form.orderNum,
      visible: form.visible,
      menuUrl: form.menuUrl || undefined,
      icon: form.icon || undefined,
    };
    if (mode === 'view' && form.menuId) {
      updateMutation.mutate(
        { ...payload, menuId: form.menuId },
        {
          onSuccess: () => toast.success('Saved successfully; menus take effect after signing in again'),
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else {
      saveMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Saved successfully; menus take effect after signing in again');
          setMode('view');
        },
        onError: (e) => toast.error((e as Error).message),
      });
    }
  };

  const onDelete = () => {
    if (form.menuId == null) return;
    setConfirm({
      title: 'Delete Menu',
      message: `Are you sure you want to delete menu "${form.menuName}"? Menus with submenus or references will be rejected.`,
      destructive: true,
      onConfirm: () =>
        deleteMutation.mutate(form.menuId!, {
          onSuccess: () => {
            toast.success('Menu deleted');
            setMode('view');
            setForm(EMPTY_MENU_FORM);
            setSelectedKey(null);
          },
          onError: (e) => toast.error((e as Error).message),
        }),
    });
  };

  const isFormDisabled = saveMutation.isPending || updateMutation.isPending;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* 左：菜单树 */}
      <div className="rounded-lg border-border/60 bg-card p-4 shadow-float">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Menu Tree</div>
          <Button type="button" size="sm" variant="outline" onClick={startNewRoot}>
            Add Root Menu
          </Button>
        </div>
        {isLoading ? (
          <LoadingBlock />
        ) : (
          <ScrollArea className="max-h-[70vh]">
            {(tree ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No menus
              </p>
            ) : (
              (tree ?? []).map((n) => (
                <MenuTreeNode
                  key={n.menuId}
                  node={n}
                  depth={0}
                  selectedKey={selectedKey}
                  onSelect={selectNode}
                />
              ))
            )}
          </ScrollArea>
        )}
      </div>

      {/* 右：表单 + 接口权限 */}
      <div className="space-y-4">
        {mode === 'view' && selectedKey == null ? (
          <DetailCard title="Menu Details">
            <p className="text-sm text-muted-foreground">
              Select a menu node on the left to view/edit, or click Add Root Menu.
            </p>
          </DetailCard>
        ) : (
          <DetailCard
            title={
              mode === 'view'
                ? 'Edit Menu'
                : mode === 'new-root'
                  ? 'Add Root Menu'
                  : 'Add Submenu'
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Menu Name<span className="text-destructive"> *</span>
                </Label>
                <Input
                  value={form.menuName}
                  onChange={(e) => patch({ menuName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Menu Name (EN)</Label>
                <Input
                  value={form.menuNameEn}
                  onChange={(e) => patch({ menuNameEn: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Menu Key<span className="text-destructive"> *</span>
                </Label>
                <Input
                  value={form.menuKey}
                  onChange={(e) => patch({ menuKey: e.target.value })}
                  placeholder="e.g. rbac:user:manage, unique"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Menu Type</Label>
                <Select
                  value={String(form.menuType)}
                  onValueChange={(v) =>
                    patch({ menuType: Number(v) as MenuFormState['menuType'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map((t) => (
                      <SelectItem key={t} value={String(t)}>
                        {MENU_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.orderNum}
                  onChange={(e) => patch({ orderNum: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Visible</Label>
                <Select
                  value={String(form.visible)}
                  onValueChange={(v) =>
                    patch({ visible: Number(v) as 0 | 1 })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Visible</SelectItem>
                    <SelectItem value="1">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Route Path</Label>
                <Input
                  value={form.menuUrl}
                  onChange={(e) => patch({ menuUrl: e.target.value })}
                  placeholder="Frontend route, e.g. /system/user"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => patch({ icon: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" disabled={isFormDisabled} onClick={onSave}>
                {isFormDisabled ? 'Saving…' : 'Save'}
              </Button>
              {mode === 'view' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startNewChild}
                  >
                    Add Submenu
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={onDelete}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </DetailCard>
        )}

        {mode === 'view' && selectedKey != null && form.menuKey ? (
          <DetailCard title="API Permissions">
            <MenuPermEditor menuKey={form.menuKey} />
          </DetailCard>
        ) : null}
      </div>
      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

/* ============================================================ */
/* workflow-config — 审批流定义（源 views/system/workflow/index.vue） */
/* 列表无分页（源 pageSize 500 全量）；表单含动态步骤。            */
/* ============================================================ */

interface WorkflowFilterForm {
  busCode: string;
}
const EMPTY_WF_FILTER: WorkflowFilterForm = { busCode: ALL };

function wfFilterToBusCode(form: WorkflowFilterForm): string | undefined {
  return form.busCode === ALL ? undefined : form.busCode;
}

const WF_BUS_OPTIONS = [
  optAll(),
  ...WORKFLOW_BUSINESS_OPTIONS.map((b) => ({
    value: b.code,
    label: `${b.code} ${b.name}`,
  })),
];

export function WorkflowConfigListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useKissenPerm();
  const { handleSubmit, reset, control } =
    useForm<WorkflowFilterForm>({ defaultValues: EMPTY_WF_FILTER });

  const [busCode, setBusCode] = React.useState<string | undefined>(undefined);
  const { data, isLoading } = useWorkflowListQuery(
    KISSEN_PROJECT_ID,
    busCode,
  );

  const statusMutation = useWorkflowStatusMutation(KISSEN_PROJECT_ID);
  const { data: businesses } = useWorkflowBusinessesQuery(KISSEN_PROJECT_ID);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  const rows = data ?? [];

  const onSearch = React.useCallback((form: WorkflowFilterForm) => {
    setBusCode(wfFilterToBusCode(form));
  }, []);
  const onResetSearch = React.useCallback(() => {
    reset(EMPTY_WF_FILTER);
    setBusCode(undefined);
  }, [reset]);

  const onToggleStatus = React.useCallback(
    (row: WorkflowRow) => {
      const next = row.status === 1 ? 2 : 1;
      const verb = next === 1 ? 'enable' : 'disable';
      setConfirm({
        title: verb === 'enable' ? 'Enable Workflow' : 'Disable Workflow',
        message: `Are you sure you want to ${verb} workflow "${row.workflowName}"?`,
        confirmText: verb === 'enable' ? 'Enable' : 'Disable',
        destructive: next === 2,
        onConfirm: () =>
          statusMutation.mutate(
            { workflowId: row.workflowId, status: next },
            {
              onSuccess: () => toast.success(`Workflow ${verb}d`),
              onError: (e) => toast.error((e as Error).message),
            },
          ),
      });
    },
    [statusMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<WorkflowRow & { id: string }>[]
  >(() => [
    {
      id: 'business',
      header: 'Business',
      cell: ({ row }) => (
        <span>
          {row.original.businessCode} {row.original.businessName}
        </span>
      ),
    },
    { accessorKey: 'workflowName', header: 'Workflow Name' },
    {
      accessorKey: 'stepCount',
      header: 'Steps',
      cell: ({ row }) => row.original.stepCount,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={WORKFLOW_STATUS_VARIANT[row.original.status]}>
          {WORKFLOW_STATUS_LABEL[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'createTime',
      header: 'Created At',
      cell: ({ row }) => formatTimestamp(row.original.createTime),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const w = row.original;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push(`/system/workflow/detail?id=${w.workflowId}`)
              }
            >
              View
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push(`/system/workflow/edit?id=${w.workflowId}`)
              }
            >
              Edit
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onToggleStatus(w)}
            >
              {w.status === 1 ? 'Disable' : 'Enable'}
            </Button>
          </div>
        );
      },
    },
  ], [router, onToggleStatus]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.workflowId) })),
    [rows],
  );

  const canCreate = (businesses ?? []).length > 0;

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="busCode"
            control={control}
            label="Business Type"
            placeholder="All"
            options={WF_BUS_OPTIONS}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            Reset
          </Button>
        </div>
      </form>

      {/* 源 workflow/index.vue:41 — 同一 busCode 单启用版本语义提示 */}
      <div
        role="note"
        className="rounded-md border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground"
      >
        Only one enabled version per busCode; changes go through a new version and do not affect in-flight approvals. Approvers must be designated users.
      </div>
      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="text-sm font-semibold">Workflow Definitions</div>
          {hasPerm('workflow:config') && (
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() => router.push('/system/workflow/create')}
              title={canCreate ? undefined : 'All businesses already have workflows configured'}
            >
              Add Workflow
            </Button>
          )}
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
        />
      </div>
      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

interface WfStepForm {
  stepName: string;
  stepType: number;
  userIds: number[];
}

/** 审批人多选（源 el-select multiple filterable → 可搜索 Checkbox 列表）。 */
function UserMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: UserRow[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = React.useState('');
  const filtered = options.filter(
    (u) => !q || u.userName.includes(q) || u.loginName.includes(q),
  );
  return (
    <div className="space-y-2">
      <Input
        placeholder="Search by name/login name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8"
      />
      <ScrollArea className="h-32 rounded-md border">
        <div className="space-y-1 p-2">
          {filtered.map((u) => (
            <label key={u.userId} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(u.userId)}
                onCheckedChange={(c) =>
                  c
                    ? onChange([...selected, u.userId])
                    : onChange(selected.filter((i) => i !== u.userId))
                }
              />
              <span>
                {u.userName} ({u.loginName})
              </span>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function WfStepEditor({
  step,
  index,
  users,
  onChange,
  onRemove,
}: {
  step: WfStepForm;
  index: number;
  users: UserRow[];
  onChange: (s: WfStepForm) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Step {index + 1}</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-destructive"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Step Name</Label>
          <Input
            value={step.stepName}
            onChange={(e) => onChange({ ...step, stepName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Step Type</Label>
          <Select
            value={String(step.stepType)}
            onValueChange={(v) => onChange({ ...step, stepType: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">{WORKFLOW_STEP_TYPE_LABEL[5]}</SelectItem>
              <SelectItem value="10">{WORKFLOW_STEP_TYPE_LABEL[10]}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label>Approvers</Label>
        <UserMultiSelect
          options={users}
          selected={step.userIds}
          onChange={(ids) => onChange({ ...step, userIds: ids })}
        />
      </div>
    </div>
  );
}

export function WorkflowConfigFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));
  const isEdit = !!id;

  const { data: users } = useRbacUserOptionsQuery(KISSEN_PROJECT_ID);
  const { data: businesses } = useWorkflowBusinessesQuery(KISSEN_PROJECT_ID);
  const { data: detail } = useWorkflowDetailQuery(KISSEN_PROJECT_ID, id, isEdit);

  const saveMutation = useWorkflowSaveMutation(KISSEN_PROJECT_ID);
  const updateMutation = useWorkflowUpdateMutation(KISSEN_PROJECT_ID);

  const [businessId, setBusinessId] = React.useState<number | undefined>();
  const [workflowName, setWorkflowName] = React.useState('');
  const [steps, setSteps] = React.useState<WfStepForm[]>([]);

  // 编辑回显（源 openDetail：无步骤时播种一行默认步骤）。
  React.useEffect(() => {
    if (isEdit && detail) {
      setBusinessId(detail.businessId);
      setWorkflowName(detail.workflowName);
      const mapped = (detail.steps ?? []).map((s) => ({
        stepName: s.stepName,
        stepType: s.stepType ?? 5,
        userIds: s.userIds ?? [],
      }));
      setSteps(
        mapped.length > 0
          ? mapped
          : [{ stepName: 'Review', stepType: 5, userIds: [] }],
      );
    }
  }, [isEdit, detail]);

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      { stepName: `Level ${prev.length + 1}`, stepType: 5, userIds: [] },
    ]);

  const businessOptions = (businesses ?? []).map((b) => ({
    value: String(b.businessId),
    label: `${b.businessCode} ${b.businessName}`,
  }));

  const onSave = () => {
    if (!workflowName.trim()) {
      toast.error('Workflow name is required');
      return;
    }
    if (!businessId) {
      toast.error('Please select a business type');
      return;
    }
    if (steps.length === 0) {
      toast.error('At least one approval step is required');
      return;
    }
    if (steps.some((s) => !s.stepName.trim())) {
      toast.error('Each step needs a name');
      return;
    }
    if (steps.some((s) => s.userIds.length === 0)) {
      toast.error('Each step needs at least one approver');
      return;
    }
    const stepsReq = steps.map((s, i) => ({
      stepName: s.stepName,
      // 源 onSave：stepOrder 恒等于列表位置（i+1），不采信输入。
      stepOrder: i + 1,
      stepType: s.stepType,
      userIds: s.userIds,
    }));

    const isEditingEnabled = detail?.status === 1;
    if (isEdit && isEditingEnabled) {
      updateMutation.mutate(
        { workflowId: id!, businessId, workflowName, steps: stepsReq },
        {
          onSuccess: () => {
            toast.success('Workflow updated');
            router.push('/system/workflow');
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else {
      saveMutation.mutate(
        { businessId, workflowName, steps: stepsReq },
        {
          onSuccess: () => {
            toast.success(isEdit ? 'Workflow created as a new version' : 'Workflow created');
            router.push('/system/workflow');
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;

  return (
    <DetailCard title={isEdit ? 'Edit Workflow' : 'Add Workflow'}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>
              Business Type<span className="text-destructive"> *</span>
            </Label>
            {isEdit ? (
              <Input
                value={`${detail?.businessCode ?? ''} ${detail?.businessName ?? ''}`}
                disabled
              />
            ) : (
              <Select
                value={businessId != null ? String(businessId) : undefined}
                onValueChange={(v) => {
                  // 源 onCreateBusinessChange：流程名称默认取业务名称，可修改。
                  setBusinessId(Number(v));
                  const b = (businesses ?? []).find(
                    (x) => x.businessId === Number(v),
                  );
                  setWorkflowName(b?.businessName ?? '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  {businessOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>
              Workflow Name<span className="text-destructive"> *</span>
            </Label>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Approval Steps</span>
            <Button type="button" size="sm" variant="outline" onClick={addStep}>
              Add Step
            </Button>
          </div>
          {steps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Click the Add Step button to configure the approval chain.
            </p>
          )}
          {steps.map((s, i) => (
            <WfStepEditor
              key={i}
              index={i}
              step={s}
              users={users ?? []}
              onChange={(ns) =>
                setSteps((prev) => prev.map((p, j) => (j === i ? ns : p)))
              }
              onRemove={() =>
                setSteps((prev) => prev.filter((_, j) => j !== i))
              }
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" disabled={isPending} onClick={onSave}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/system/workflow')}
          >
            Back
          </Button>
        </div>
      </div>
    </DetailCard>
  );
}

export function WorkflowConfigDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));
  const { data: detail, isLoading } = useWorkflowDetailQuery(
    KISSEN_PROJECT_ID,
    id,
  );
  const { data: users } = useRbacUserOptionsQuery(KISSEN_PROJECT_ID);

  const userNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    users?.forEach((u) => map.set(u.userId, `${u.userName} (${u.loginName})`));
    return map;
  }, [users]);

  if (!id) {
    return (
      <DetailCard title="Workflow Details">
        <p className="text-sm text-muted-foreground">Missing workflow ID.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/system/workflow')}
        >
          Back
        </Button>
      </DetailCard>
    );
  }

  return (
    <div className="space-y-4">
      <DetailCard title="Workflow Details">
        {isLoading || !detail ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Business">
              {detail.businessCode} {detail.businessName}
            </DetailField>
            <DetailField label="Workflow Name">{detail.workflowName}</DetailField>
            <DetailField label="Steps">{detail.stepCount}</DetailField>
            <DetailField label="Status">
              <Badge variant={WORKFLOW_STATUS_VARIANT[detail.status]}>
                {WORKFLOW_STATUS_LABEL[detail.status] ?? detail.status}
              </Badge>
            </DetailField>
            <DetailField label="Created At">
              {formatTimestamp(detail.createTime)}
            </DetailField>
          </div>
        )}
      </DetailCard>

      <DetailCard title="Approval Steps">
        {isLoading || !detail ? (
          <LoadingBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Order</th>
                  <th className="py-2 pr-4">Step Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Approvers</th>
                </tr>
              </thead>
              <tbody>
                {(detail.steps ?? []).map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 tabular-nums">{s.stepOrder}</td>
                    <td className="py-2 pr-4">{s.stepName}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary">
                        {WORKFLOW_STEP_TYPE_LABEL[s.stepType ?? 5] ??
                          s.stepType}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      {(s.userIds ?? [])
                        .map((uid) => userNameById.get(uid) ?? `#${uid}`)
                        .join(', ') || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DetailCard>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push('/system/workflow')}
        >
          Back
        </Button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* log — 操作日志（源 views/system/log/index.vue）                */
/* ============================================================ */

interface OperateLogFilterForm {
  module: string;
  operateName: string;
  status: string;
}
const EMPTY_OPERATE_LOG_FILTER: OperateLogFilterForm = {
  module: '',
  operateName: '',
  status: ALL,
};

function operateLogFilterToParams(
  form: OperateLogFilterForm,
  pageNum: number,
  pageSize: number,
) {
  return {
    pageNum,
    pageSize,
    filter: {
      module: form.module || undefined,
      operateName: form.operateName || undefined,
      status: toNum(form.status),
    },
  };
}

const OPERATE_LOG_RESULT_OPTIONS = [
  optAll(),
  { value: '0', label: OPERATE_LOG_RESULT_LABEL[0] },
  { value: '1', label: OPERATE_LOG_RESULT_LABEL[1] },
];

/** 源 detail 参数：JSON 合法时格式化美化，否则原文展示；空 → '-'。 */
function prettyOperateParam(raw: string | undefined | null): string {
  if (!raw) return '-';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** 详情弹窗（源 el-dialog width=720px：参数美化 pre + 红色错误信息 pre）。 */
function OperateLogDetailDialog({
  row,
  onClose,
}: {
  row: OperateLogRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={row != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Operation Detail</DialogTitle>
          <DialogDescription>
            Log #{row?.operateLogId ?? ''} —{' '}
            {formatTimestamp(row?.operateTime)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailField label="Operator">{row?.operateName || '--'}</DetailField>
          <DetailField label="User ID">{row?.userId ?? '--'}</DetailField>
          <div className="md:col-span-2">
            <DetailField label="Module">{row?.module || '--'}</DetailField>
          </div>
          <div className="md:col-span-2">
            <DetailField label="Method">{row?.method || '--'}</DetailField>
          </div>
          <div className="md:col-span-2">
            <DetailField label="URL">
              <span className="block break-all font-mono text-xs">
                {row?.operateUrl || '--'}
              </span>
            </DetailField>
          </div>
          <DetailField label="IP">{row?.operateIp || '--'}</DetailField>
          <DetailField label="Duration">
            {row ? `${row.costTime}ms` : '--'}
          </DetailField>
          <div className="md:col-span-2">
            <DetailField label="Parameters">
              <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-3 font-mono text-xs">
                {prettyOperateParam(row?.operateParam)}
              </pre>
            </DetailField>
          </div>
          {row?.errorMsg ? (
            <div className="md:col-span-2">
              <DetailField label="Error Message">
                <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-destructive/5 p-3 font-mono text-xs text-destructive">
                  {row.errorMsg}
                </pre>
              </DetailField>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 操作日志列表（源仅一个查询端点：POST /manage/log/page，纯只读页）。 */
export function OperateLogListPage() {
  const { register, handleSubmit, reset, control } =
    useForm<OperateLogFilterForm>({ defaultValues: EMPTY_OPERATE_LOG_FILTER });

  const [params, setParams] = React.useState(() =>
    operateLogFilterToParams(EMPTY_OPERATE_LOG_FILTER, 1, PAGE_SIZE_DEFAULT),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const { data, isLoading } = useOperateLogListQuery(
    KISSEN_PROJECT_ID,
    params,
  );

  const [detail, setDetail] = React.useState<OperateLogRow | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const onSearch = React.useCallback(
    (form: OperateLogFilterForm) => {
      setParams(operateLogFilterToParams(form, 1, pageSize));
    },
    [pageSize],
  );
  const onResetSearch = React.useCallback(() => {
    reset(EMPTY_OPERATE_LOG_FILTER);
    setParams(operateLogFilterToParams(EMPTY_OPERATE_LOG_FILTER, 1, pageSize));
  }, [reset, pageSize]);

  const columns = React.useMemo<
    ColumnDef<OperateLogRow & { id: string }>[]
  >(() => [
    {
      accessorKey: 'operateTime',
      header: 'Time',
      cell: ({ row }) => formatTimestamp(row.original.operateTime),
    },
    { accessorKey: 'operateName', header: 'Operator' },
    { accessorKey: 'module', header: 'Module' },
    {
      accessorKey: 'operateUrl',
      header: 'Request URL',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.operateUrl}</span>
      ),
    },
    {
      id: 'costTime',
      header: 'Duration',
      cell: ({ row }) => (
        <div className="text-right font-mono tabular-nums">
          {row.original.costTime}ms
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Result',
      cell: ({ row }) => (
        <Badge
          variant={
            OPERATE_LOG_RESULT_VARIANT[row.original.status] ?? 'secondary'
          }
        >
          {OPERATE_LOG_RESULT_LABEL[row.original.status] ??
            row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'traceId',
      header: 'TraceId',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.traceId || '-'}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => setDetail(row.original)}
        >
          Detail
        </Button>
      ),
    },
  ], []);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.operateLogId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="module"
            label="Module"
            register={register('module')}
            placeholder="Fuzzy match"
          />
          <FormField
            name="operateName"
            label="Operator"
            register={register('operateName')}
            placeholder="Fuzzy match"
          />
          <FormSelect
            name="status"
            control={control}
            label="Result"
            placeholder="All"
            options={OPERATE_LOG_RESULT_OPTIONS}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="border-b border-border/50 px-6 py-3 text-sm font-semibold">
          Operation Logs
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: (page) =>
                    setParams((prev) => ({ ...prev, pageNum: page })),
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n }));
                  },
                }
              : undefined
          }
        />
      </div>

      <OperateLogDetailDialog
        row={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
