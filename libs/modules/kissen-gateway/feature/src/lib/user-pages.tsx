'use client';

/**
 * 用户管理域页面（源 `views/system/user.vue`）。
 *
 * 源是「列表 + 两个弹窗（新增/编辑用户、分配角色）」单页；目标按 registry
 * 契约拆为四键（/system/user + create/edit/detail）：
 * - list   = 列表筛选 + 行操作（启停/重置密码/强制下线/分配角色弹窗）
 * - create = 新建用户表单（源新增弹窗；保存成功展示一次性密码）
 * - edit   = 编辑用户表单（源编辑弹窗；登录名/类型禁用）
 * - detail = 用户详情（registry 契约新增，源无对应视图；行数据经暂存/列表回查）
 */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
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
  createActionColumn,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RadioGroup,
  RadioGroupItem,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, createFormResolver } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import { useGatewayPerm } from './use-gateway-perm';

import { DescField, DescGrid } from './desc-grid';
import { OPT_ALL, formatTime, orDash } from './kit';
import { PageHead } from './page-head';
import { LoadingBlock, QueryErrorRetry } from './state-blocks';

import {
  KISSEN_GATEWAY_PROJECT_ID,
  USER_FIRST_LOGIN_LABEL,
  USER_STATUS_VARIANT,
  USER_TYPE_LABEL,
  USER_TYPE_RADIO_OPTIONS,
  USER_TYPE_VARIANT,
  useUserAssignRoleMutation,
  useUserForceLogoutMutation,
  useUserPageQuery,
  useUserResetPwdMutation,
  useUserRoleOptionsQuery,
  useUserSaveMutation,
  useUserStatusMutation,
  useUserUpdateMutation,
  type OneTimePassword,
  type UserPageReq,
  type UserRow,
} from '@myorg/modules/kissen-gateway/data-access';

/* ================================================================== */
/* 展示工具                                                            */
/* ================================================================== */

const USER_PAGE_SIZE_DEFAULT = 10;

/**
 * 状态 tag/筛选文案（源 0 正常 success / 1 停用 info；本组英文口径
 * Enabled/Disabled，variant 沿用 data-access 的 success→default / info→outline 映射）。
 */
const USER_STATUS_TAG_LABEL: Record<number, string> = {
  0: 'Enabled',
  1: 'Disabled',
};

/** 路由 query 中的用户 ID → 正整数；非法 → undefined。 */
function parseUserId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/* ================================================================== */
/* 行暂存（后端无 GET /user/{id}，详情/编辑优先读暂存行，缺失回查列表） */
/* ================================================================== */

const USER_STASH_PREFIX = 'kissen_gateway_user_stash:';

/** 列表页跳转前暂存当前行；写入失败静默忽略（回退列表扫描）。 */
function stashUserRow(row: UserRow): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${USER_STASH_PREFIX}${row.userId}`,
      JSON.stringify(row),
    );
  } catch {
    // 非关键路径：目标页回退列表扫描。
  }
}

/** 详情/编辑页读取暂存行；无暂存或解析失败返回 null。 */
function peekUserRow(userId: number): UserRow | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${USER_STASH_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as UserRow) : null;
  } catch {
    return null;
  }
}

/** 角色多选（源 el-select multiple → Checkbox 列表，角色数量有限）。 */
function RoleCheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: ReadonlyArray<{ roleId: number; roleName: string }>;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No roles available to assign (adjustable after saving)</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((r) => (
        <label key={r.roleId} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selected.includes(r.roleId)}
            onCheckedChange={(c) =>
              c === true
                ? onChange([...selected, r.roleId])
                : onChange(selected.filter((i) => i !== r.roleId))
            }
          />
          <span>{r.roleName}</span>
        </label>
      ))}
    </div>
  );
}

/* ================================================================== */
/* 一次性密码弹窗（源 ElMessageBox.alert「初始密码/重置成功」+ 复制语义）*/
/* ================================================================== */

/**
 * 源 alert 文案三段：提示行 / 密码 / 「请立即抄送用户。」；确认按钮「我已抄送」。
 * warning（创建）与 success（重置）色调区分。
 */
function OneTimePasswordDialog({
  open,
  onClose,
  title,
  lead,
  otp,
  tone,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  lead: string;
  otp: string | null;
  tone: 'warning' | 'success';
}) {
  const toast = useToast();

  const onCopy = React.useCallback(async () => {
    if (!otp) return;
    try {
      await navigator.clipboard.writeText(otp);
      toast.success('One-time password copied');
    } catch {
      toast.error('Copy failed, please note it down manually');
    }
  }, [otp, toast]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">{lead}</p>
          <div
            className={
              tone === 'warning'
                ? 'rounded-md border border-amber-300 bg-amber-50 p-3 text-center font-mono text-lg tracking-widest dark:border-amber-800 dark:bg-amber-950'
                : 'rounded-md border border-emerald-300 bg-emerald-50 p-3 text-center font-mono text-lg tracking-widest dark:border-emerald-800 dark:bg-emerald-950'
            }
          >
            {otp ?? '—'}
          </div>
          <p className="text-xs text-muted-foreground">Please copy it to the user immediately.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCopy} disabled={!otp}>
            Copy
          </Button>
          <Button onClick={onClose}>I have copied it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 列表页（源筛选：登录名/姓名/状态 + 行操作五件套）                     */
/* ================================================================== */

const userFilterSchema = z.object({
  loginName: z.string(),
  userName: z.string(),
  status: z.string(),
});
type UserFilterForm = z.infer<typeof userFilterSchema>;

const USER_FILTER_DEFAULT: UserFilterForm = {
  loginName: '',
  userName: '',
  status: OPT_ALL,
};

/** RHF 筛选表单 → 后端 UserPageReq（源 load() 的 query 组装，模糊匹配空串不上送）。 */
function userFilterToParams(
  form: UserFilterForm,
  pageNum: number,
  pageSize: number,
): UserPageReq {
  return {
    pageNum,
    pageSize,
    filter: {
      loginName: form.loginName.trim() || undefined,
      userName: form.userName.trim() || undefined,
      status: form.status === OPT_ALL ? undefined : Number(form.status),
    },
  };
}

/**
 * 分配角色弹窗（源 rolesVisible dialog：标题「分配角色:${userName}」）。
 * 由父级条件渲染——每次打开重新挂载，`selected` 从 user.roleIds 重新拷贝
 * （源 openRoles：`rolesForm.roleIds = [...(row.roleIds ?? [])]`）。
 */
function UserAssignRoleDialog({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: rolePage } = useUserRoleOptionsQuery(KISSEN_GATEWAY_PROJECT_ID);
  const [selected, setSelected] = React.useState<number[]>(() => [
    ...(user.roleIds ?? []),
  ]);
  const mutation = useUserAssignRoleMutation(KISSEN_GATEWAY_PROJECT_ID);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Roles: {user.userName}</DialogTitle>
          <DialogDescription>Effective on this user's next request after saving.</DialogDescription>
        </DialogHeader>
        <RoleCheckboxGroup
          options={rolePage?.data ?? []}
          selected={selected}
          onChange={setSelected}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {/* 源基线 #3：分配角色保存按钮无 loading（仅新增/编辑弹窗有 saving）。 */}
          <Button
            onClick={() => {
              mutation.mutate(
                { userId: user.userId, roleIds: selected },
                {
                  onSuccess: () => {
                    // 源 onAssignRoles：ElMessage.success + 关弹窗 + load()（mutation 失效列表缓存即刷新）。
                    toast.success("Assigned. Takes effect on the user's next request.");
                    onClose();
                  },
                  onError: (e) => toast.error((e as Error).message),
                },
              );
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useGatewayPerm();
  const { register, handleSubmit, reset, control } = useForm<UserFilterForm>({
    resolver: createFormResolver(userFilterSchema),
    defaultValues: USER_FILTER_DEFAULT,
  });

  const [params, setParams] = React.useState(() =>
    userFilterToParams(USER_FILTER_DEFAULT, 1, USER_PAGE_SIZE_DEFAULT),
  );
  const { data, isLoading, isError, error, refetch } = useUserPageQuery(
    KISSEN_GATEWAY_PROJECT_ID,
    params,
  );

  const statusMutation = useUserStatusMutation(KISSEN_GATEWAY_PROJECT_ID);
  const resetPwdMutation = useUserResetPwdMutation(KISSEN_GATEWAY_PROJECT_ID);
  const forceLogoutMutation = useUserForceLogoutMutation(
    KISSEN_GATEWAY_PROJECT_ID,
  );

  const [assignUser, setAssignUser] = React.useState<UserRow | null>(null);
  const [resetOtp, setResetOtp] = React.useState<{ pwd: string } | null>(null);
  /* 行操作确认目标（受控 open；确认弹窗打开时行操作不直接触发 mutation）。 */
  const [toggleTarget, setToggleTarget] = React.useState<UserRow | null>(null);
  const [resetPwdTarget, setResetPwdTarget] = React.useState<UserRow | null>(
    null,
  );
  const [forceLogoutTarget, setForceLogoutTarget] =
    React.useState<UserRow | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  // Load failure feedback is surfaced as a toast (retry via action) instead of a banner.
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load users', {
        description: error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  const onSearch = React.useCallback(
    (form: UserFilterForm) => {
      setParams(userFilterToParams(form, 1, params.pageSize));
    },
    [params.pageSize],
  );

  const onResetSearch = React.useCallback(() => {
    reset(USER_FILTER_DEFAULT);
    setParams(userFilterToParams(USER_FILTER_DEFAULT, 1, params.pageSize));
  }, [reset, params.pageSize]);

  /** 启停动作词（源 onToggle 文案「确认${停用|启用}「name」?」1:1）。 */
  const toggleVerb = toggleTarget?.status === 0 ? 'Disable' : 'Enable';

  /** 启停确认（源 onToggle：确认 → toggleStatus → 「操作成功」→ 刷新）。 */
  const onConfirmToggle = React.useCallback(() => {
    if (!toggleTarget) return;
    const next = toggleTarget.status === 0 ? 1 : 0;
    statusMutation.mutate(
      { userId: toggleTarget.userId, status: next },
      {
        onSuccess: () => toast.success('Operation succeeded'),
        onError: (e) => toast.error((e as Error).message),
      },
    );
    setToggleTarget(null);
  }, [toggleTarget, statusMutation, toast]);

  /** 重置密码确认（源 onResetPwd：确认 → resetPwd → 一次性密码 alert，不刷新列表）。 */
  const onConfirmResetPwd = React.useCallback(() => {
    if (!resetPwdTarget) return;
    resetPwdMutation.mutate(resetPwdTarget.userId, {
      onSuccess: (otp: OneTimePassword) =>
        setResetOtp({ pwd: otp.oneTimePassword }),
      onError: (e) => toast.error((e as Error).message),
    });
    setResetPwdTarget(null);
  }, [resetPwdTarget, resetPwdMutation, toast]);

  /** 强制下线确认（源 onForceLogout：确认 → forceLogout → 「已强制下线」，不刷新列表）。 */
  const onConfirmForceLogout = React.useCallback(() => {
    if (!forceLogoutTarget) return;
    forceLogoutMutation.mutate(forceLogoutTarget.userId, {
      onSuccess: () => toast.success('Forced offline'),
      onError: (e) => toast.error((e as Error).message),
    });
    setForceLogoutTarget(null);
  }, [forceLogoutTarget, forceLogoutMutation, toast]);

  const columns = React.useMemo<ColumnDef<UserRow & { id: string }>[]>(
    () => [
      { accessorKey: 'loginName', header: 'Username' },
      { accessorKey: 'userName', header: 'Name' },
      {
        id: 'userType',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={USER_TYPE_VARIANT[row.original.userType] ?? 'outline'}>
            {USER_TYPE_LABEL[row.original.userType] ?? row.original.userType}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={USER_STATUS_VARIANT[row.original.status] ?? 'outline'}>
            {USER_STATUS_TAG_LABEL[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => <span>{orDash(row.original.phone)}</span>,
      },
      /* R-3：源 260px fixed 操作列 5 链接按钮（+View 超集）→ ⋯ 菜单收纳，1280×800 不横向溢出。 */
      createActionColumn<UserRow & { id: string }>((u) => [
        {
          label: 'View',
          onClick: () => {
            stashUserRow(u);
            router.push(`/system/user/detail?id=${u.userId}`);
          },
        },
        {
          label: 'Edit',
          onClick: () => {
            stashUserRow(u);
            router.push(`/system/user/edit?id=${u.userId}`);
          },
        },
        { label: 'Assign Roles', onClick: () => setAssignUser(u) },
        { label: 'Reset Password', onClick: () => setResetPwdTarget(u) },
        {
          /* 源：停用 danger / 启用 success，文案随 row.status 切换。 */
          label: u.status === 0 ? 'Disable' : 'Enable',
          destructive: u.status === 0,
          onClick: () => setToggleTarget(u),
        },
        {
          label: 'Force Logout',
          destructive: true,
          onClick: () => setForceLogoutTarget(u),
        },
      ]),
    ],
    [
      router,
      setAssignUser,
      setResetPwdTarget,
      setToggleTarget,
      setForceLogoutTarget,
    ],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.userId) })),
    [rows],
  );

  /* 状态筛选：Enabled=0 / Disabled=1（本组英文口径，详见 USER_STATUS_TAG_LABEL）。 */
  const statusSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      { value: '0', label: USER_STATUS_TAG_LABEL[0] },
      { value: '1', label: USER_STATUS_TAG_LABEL[1] },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHead variant="toolbar" title="User Management">
        {/* 源 v-perm="'bank:user:manage'"：未命中 menuKeys 不渲染。 */}
        {hasPerm('bank:user:manage') && (
          <Button onClick={() => router.push('/system/user/create')}>
            Create User
          </Button>
        )}
      </PageHead>

      <form
        onSubmit={handleSubmit(onSearch)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Filters</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="loginName"
            label="Username"
            register={register('loginName')}
            placeholder="Fuzzy match"
          />
          <FormField
            name="userName"
            label="Name"
            register={register('userName')}
            placeholder="Fuzzy match"
          />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            options={statusSelectOptions}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onResetSearch}>
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
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
                  onPageSizeChange: (n) =>
                    setParams((prev) => ({ ...prev, pageNum: 1, pageSize: n })),
                }
              : undefined
          }
        />
      </div>

      {assignUser && (
        <UserAssignRoleDialog
          user={assignUser}
          onClose={() => setAssignUser(null)}
        />
      )}
      <OneTimePasswordDialog
        open={!!resetOtp}
        onClose={() => setResetOtp(null)}
        title="Reset Successful"
        lead="New one-time password (forced change on first login):"
        otp={resetOtp?.pwd ?? null}
        tone="success"
      />

      {/* 行操作确认弹窗（源 ElMessageBox.confirm 文案语义 1:1；destructive 仅破坏性动作）。 */}
      <AlertDialog
        open={toggleTarget != null}
        onOpenChange={(o) => !o && setToggleTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleVerb} User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {toggleVerb.toLowerCase()} "{toggleTarget?.userName}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                toggleVerb === 'Disable'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={onConfirmToggle}
            >
              {toggleVerb}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={resetPwdTarget != null}
        onOpenChange={(o) => !o && setResetPwdTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Reset password for "{resetPwdTarget?.userName}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmResetPwd}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={forceLogoutTarget != null}
        onOpenChange={(o) => !o && setForceLogoutTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Force logout "{forceLogoutTarget?.userName}"? All sessions of
              "{forceLogoutTarget?.userName}" will be invalidated immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmForceLogout}
            >
              Force Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ================================================================== */
/* 新建/编辑表单页（源 dialogVisible 弹窗；create/edit 两键复用）        */
/* ================================================================== */

/** 表单校验（源 formRules：loginName/userName 必填 blur 触发）。 */
const userFormSchema = z.object({
  loginName: z.string().min(1, { message: 'Please enter a username' }),
  userName: z.string().min(1, { message: 'Please enter a name' }),
  userType: z.string(),
  email: z.string(),
  phone: z.string(),
  roleIds: z.array(z.number()),
});
type UserFormValues = z.infer<typeof userFormSchema>;

const USER_FORM_DEFAULT: UserFormValues = {
  loginName: '',
  userName: '',
  userType: '1', // 源 openCreate 默认 userType: 1（运营用户）。
  email: '',
  phone: '',
  roleIds: [],
};

export function UserFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const userId = parseUserId(searchParams.get('id'));
  const isEdit = userId != null;

  const { data: rolePage } = useUserRoleOptionsQuery(KISSEN_GATEWAY_PROJECT_ID);
  const saveMutation = useUserSaveMutation(KISSEN_GATEWAY_PROJECT_ID);
  const updateMutation = useUserUpdateMutation(KISSEN_GATEWAY_PROJECT_ID);

  const { register, handleSubmit, reset, control, formState } =
    useForm<UserFormValues>({
      resolver: createFormResolver(userFormSchema),
      mode: 'onTouched',
      defaultValues: USER_FORM_DEFAULT,
    });

  /** 编辑回显：无 GET /user/{id}，优先读列表页暂存行，缺失时回查列表（pageSize 200）。 */
  const loadedRef = React.useRef(false);
  const stashedUser = React.useMemo(
    () => (isEdit && userId != null ? peekUserRow(userId) : null),
    [isEdit, userId],
  );
  const { data: userPage, isLoading: scanning } = useUserPageQuery(
    KISSEN_GATEWAY_PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    isEdit && !stashedUser,
  );

  React.useEffect(() => {
    if (!isEdit || loadedRef.current) return;
    const row = stashedUser ?? userPage?.data.find((u) => u.userId === userId);
    if (row) {
      // 源 openEdit：loginName/userName/userType/email/phone/roleIds 全量回显。
      reset({
        loginName: row.loginName,
        userName: row.userName,
        userType: String(row.userType),
        email: row.email ?? '',
        phone: row.phone ?? '',
        roleIds: row.roleIds ?? [],
      });
      loadedRef.current = true;
    }
  }, [isEdit, stashedUser, userPage, userId, reset]);

  const [createdOtp, setCreatedOtp] = React.useState<string | null>(null);

  const onSubmit = handleSubmit((v) => {
    if (isEdit) {
      // 源 onSave 编辑分支：仅送 userName/email/phone/roleIds（登录名/类型禁用不送）。
      updateMutation.mutate(
        {
          userId: userId as number,
          userName: v.userName,
          email: v.email,
          phone: v.phone,
          roleIds: v.roleIds ?? [],
        },
        {
          onSuccess: () => {
            toast.success('Saved successfully');
            router.push('/system/user');
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else {
      // 源 onSave 新建分支：{...form} 全量上送，成功后弹初始密码（无 toast）。
      saveMutation.mutate(
        {
          loginName: v.loginName,
          userName: v.userName,
          userType: Number(v.userType),
          email: v.email,
          phone: v.phone,
          roleIds: v.roleIds ?? [],
        },
        {
          onSuccess: (otp) => setCreatedOtp(otp.oneTimePassword),
          onError: (e) => toast.error((e as Error).message),
        },
      );
    }
  });

  if (isEdit && !loadedRef.current) {
    if (scanning || !userPage) {
      return (
        <div className="space-y-4">
          <PageHead variant="toolbar" title="Edit User" />
          <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
            <LoadingBlock variant="skeleton" />
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <PageHead variant="toolbar" title="Edit User" />
        <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <p className="text-sm text-muted-foreground">User not found.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/system/user')}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHead variant="toolbar" title={isEdit ? 'Edit User' : 'Create User'} />
      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            name="loginName"
            label="Username"
            required
            disabled={isEdit}
            placeholder="Letters, digits, _.-, up to 30 characters"
            error={formState.errors.loginName?.message}
            register={register('loginName')}
          />
          <FormField
            name="userName"
            label="Name"
            required
            error={formState.errors.userName?.message}
            register={register('userName')}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <Controller
            control={control}
            name="userType"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                disabled={isEdit}
                className="flex gap-6"
              >
                {USER_TYPE_RADIO_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <RadioGroupItem value={o.value} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
          {/* 源编辑态禁用类型，超管/运营创建后不可改。 */}
          {isEdit && (
            <p className="text-xs text-muted-foreground">Type cannot be changed after creation</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            name="email"
            label="Email"
            register={register('email')}
          />
          <FormField name="phone" label="Phone" register={register('phone')} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Roles</label>
          <Controller
            control={control}
            name="roleIds"
            render={({ field }) => (
              <RoleCheckboxGroup
                options={rolePage?.data ?? []}
                selected={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">
            Assign roles (adjustable after saving)
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={saveMutation.isPending || updateMutation.isPending}
          >
            {saveMutation.isPending || updateMutation.isPending
              ? 'Saving…'
              : 'Save'}
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

      {/* 源：创建成功 ElMessageBox.alert 初始密码，确认「我已抄送」后回列表。 */}
      <OneTimePasswordDialog
        open={!!createdOtp}
        onClose={() => {
          setCreatedOtp(null);
          router.push('/system/user');
        }}
        title="Initial Password"
        lead="User created. Initial password (one-time, forced change on first login):"
        otp={createdOtp}
        tone="warning"
      />
    </div>
  );
}

/* ================================================================== */
/* 详情页（registry detail 键契约；源无对应视图，字段取 UserRow 全量）   */
/* ================================================================== */

export function UserDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = parseUserId(searchParams.get('id'));

  const { data: rolePage } = useUserRoleOptionsQuery(KISSEN_GATEWAY_PROJECT_ID);

  /** 无 GET /user/{id}：优先读列表页暂存行，缺失时回查列表。 */
  const stashedUser = React.useMemo(
    () => (userId != null ? peekUserRow(userId) : null),
    [userId],
  );
  const { data, isLoading, isError, error, refetch } = useUserPageQuery(
    KISSEN_GATEWAY_PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    userId != null && !stashedUser,
  );
  const user =
    stashedUser ?? (userId != null
      ? data?.data.find((u) => u.userId === userId)
      : undefined);
  const roleNames = (user?.roleIds ?? [])
    .map((rid) => rolePage?.data.find((r) => r.roleId === rid)?.roleName)
    .filter(Boolean)
    .join(', ');

  if (userId == null) {
    return (
      <div className="space-y-4">
        <PageHead variant="toolbar" title="User Detail" />
        <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <p className="text-sm text-muted-foreground">Missing user ID.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/system/user')}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHead variant="toolbar" title="User Detail">
        <Button
          variant="outline"
          onClick={() => router.push(`/system/user/edit?id=${userId}`)}
        >
          Edit
        </Button>
      </PageHead>
      <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        {isError ? (
          <QueryErrorRetry error={error} onRetry={() => refetch()} />
        ) : isLoading || !user ? (
          user == null && !isLoading && data ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">User not found.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/system/user')}
              >
                Back to List
              </Button>
            </div>
          ) : (
            <LoadingBlock variant="skeleton" />
          )
        ) : (
          <DescGrid>
            <DescField label="Username" variant="plain">{user.loginName}</DescField>
            <DescField label="Name" variant="plain">{user.userName}</DescField>
            <DescField label="Type" variant="plain">
              <Badge
                variant={USER_TYPE_VARIANT[user.userType] ?? 'outline'}
              >
                {USER_TYPE_LABEL[user.userType] ?? user.userType}
              </Badge>
            </DescField>
            <DescField label="Status" variant="plain">
              <Badge variant={USER_STATUS_VARIANT[user.status] ?? 'outline'}>
                {USER_STATUS_TAG_LABEL[user.status] ?? user.status}
              </Badge>
            </DescField>
            <DescField label="Phone" variant="plain">{orDash(user.phone)}</DescField>
            <DescField label="Email" variant="plain">{orDash(user.email)}</DescField>
            <DescField label="Roles" variant="plain">{roleNames || '-'}</DescField>
            <DescField label="First Login" variant="plain">
              <Badge variant="outline">
                {USER_FIRST_LOGIN_LABEL[user.firstLogin] ?? user.firstLogin}
              </Badge>
            </DescField>
            <DescField label="Created At" variant="plain">
              {formatTime(user.createTime)}
            </DescField>
          </DescGrid>
        )}
      </div>
    </div>
  );
}
