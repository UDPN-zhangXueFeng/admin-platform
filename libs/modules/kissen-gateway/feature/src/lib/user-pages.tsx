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
  ChevronLeft,
  KeyRound,
  LogOut,
  MoreHorizontal,
  UserCheck,
  UserX,
} from 'lucide-react';

import {
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  RadioGroup,
  RadioGroupItem,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, createFormResolver } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import { DescField, DescGrid } from './desc-grid';
import { OPT_ALL, orDash } from './kit';
import { PageHead } from './page-head';
import { LoadingBlock, QueryErrorRetry } from './state-blocks';
import {
  ActionConfirmDialog,
  ProtoStatusBadge,
  type ActionConfirmTone,
  type ProtoStatusTone,
} from './proto-ui';
import { formatUtc8 } from './proto-format';
import { PROTO_USER_STATUS, protoStatusText } from './proto-enums';
import {
  ColumnPicker,
  SortHeader,
  compareProtoValues,
  filterVisibleColumns,
  useColumnPreferences,
  useTableSort,
  type ProtoColumnDef,
} from './proto-table';

import {
  KISSEN_GATEWAY_PROJECT_ID,
  USER_FIRST_LOGIN_LABEL,
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

/** 用户状态徽章色调（PROTO_USER_STATUS：0 Active=success / 1 Inactive=warning）。 */
const USER_STATUS_TONES: Record<number, ProtoStatusTone> = {
  0: 'success',
  1: 'warning',
};

/** 列偏好定义（原型 COLUMNS 逐字；Username/Status/Actions 必选）。 */
const USER_COLUMNS: ProtoColumnDef[] = [
  { id: 'username', label: 'Username', required: true },
  { id: 'fullName', label: 'Full Name' },
  { id: 'type', label: 'Type' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'createdAt', label: 'Created on (UTC+8)' },
  { id: 'firstLogin', label: 'First Login' },
  { id: 'status', label: 'Status', required: true },
  { id: 'actions', label: 'Actions', required: true },
];
const USER_COLUMN_PREF_KEY = 'gw.user-list.columns';

/** 行/头操作确认四动作（原型 USER_ACTION_CONFIG 文案 1:1，ActionConfirmDialog 复用）。 */
type UserConfirmAction =
  | 'deactivate'
  | 'activate'
  | 'resetPassword'
  | 'forceSignOut';

const USER_ACTION_CONFIG: Record<
  UserConfirmAction,
  {
    title: string;
    body1: (name: string) => string;
    body2: string;
    confirmLabel: string;
    variant: 'confirm' | 'destructive';
    tone: ActionConfirmTone;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  deactivate: {
    title: 'Deactivate User',
    body1: (name) => `Deactivate user "${name}"?`,
    body2: 'Once deactivated, the user can no longer sign in, and any session that is still open stops being accepted.',
    confirmLabel: 'Deactivate',
    variant: 'destructive',
    tone: 'warning',
    icon: UserX,
  },
  activate: {
    title: 'Activate User',
    body1: (name) => `Activate user "${name}"?`,
    body2: 'Once activated, the user can sign in again with the existing password and assigned roles.',
    confirmLabel: 'Activate',
    variant: 'confirm',
    tone: 'success',
    icon: UserCheck,
  },
  resetPassword: {
    title: 'Reset Password',
    body1: (name) => `Reset the password of user "${name}"?`,
    body2: 'Once reset, the current password stops working and a new initial password is issued by the system. The user has to set a new password at the next sign-in.',
    confirmLabel: 'Reset Password',
    variant: 'destructive',
    tone: 'warning',
    icon: KeyRound,
  },
  forceSignOut: {
    title: 'Force Sign Out',
    body1: (name) => `Force user "${name}" to sign out?`,
    body2: 'All open sessions of this user are terminated immediately, and the user has to sign in again to continue working.',
    confirmLabel: 'Force Sign Out',
    variant: 'destructive',
    tone: 'warning',
    icon: LogOut,
  },
};

/** 统计卡（原型 StatCard：顶部语义色条 + 大数字；role-pages 复用）。 */
export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'success' | 'warning' | 'danger';
}) {
  const bar =
    tone === 'success'
      ? 'bg-emerald-500'
      : tone === 'warning'
        ? 'bg-amber-500'
        : 'bg-red-500';
  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <div className={`h-1 ${bar}`} aria-hidden="true" />
      <div className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}

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
  userType: z.string(),
  status: z.string(),
});
type UserFilterForm = z.infer<typeof userFilterSchema>;

const USER_FILTER_DEFAULT: UserFilterForm = {
  loginName: '',
  userName: '',
  userType: OPT_ALL,
  status: OPT_ALL,
};

/** RHF 筛选表单 → 后端 UserPageReq（模糊匹配空串不上送）。
 *  userType 不上送：UserListReq 无该参数（GAP-GW-07 族）——列表页本地过滤当前页，
 *  后端参数就绪后回写服务端。 */
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
  const { register, reset, control, watch } = useForm<UserFilterForm>({
    resolver: createFormResolver(userFilterSchema),
    defaultValues: USER_FILTER_DEFAULT,
  });

  const [params, setParams] = React.useState(() =>
    userFilterToParams(USER_FILTER_DEFAULT, 1, USER_PAGE_SIZE_DEFAULT),
  );
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useUserPageQuery(KISSEN_GATEWAY_PROJECT_ID, params);

  /* STATIC-FILLER(GAP-GW-07): 用户计数无聚合端点——pageSize 200 全量拉取本地计数
   * （>200 户时 Active/Inactive 低估，Total 取 pagination.total）。 */
  const { data: statsPage } = useUserPageQuery(KISSEN_GATEWAY_PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });

  const statusMutation = useUserStatusMutation(KISSEN_GATEWAY_PROJECT_ID);
  const resetPwdMutation = useUserResetPwdMutation(KISSEN_GATEWAY_PROJECT_ID);
  const forceLogoutMutation = useUserForceLogoutMutation(
    KISSEN_GATEWAY_PROJECT_ID,
  );

  const [assignUser, setAssignUser] = React.useState<UserRow | null>(null);
  const [resetOtp, setResetOtp] = React.useState<{ pwd: string } | null>(null);
  /* 行操作确认（ActionConfirmDialog 单实例：目标行 + 动作键，文案见 USER_ACTION_CONFIG）。 */
  const [confirmTarget, setConfirmTarget] = React.useState<UserRow | null>(
    null,
  );
  const [confirmAction, setConfirmAction] =
    React.useState<UserConfirmAction | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;
  const { sort, toggle } = useTableSort('createdAt', 'desc');
  const columnPreferences = useColumnPreferences(
    USER_COLUMN_PREF_KEY,
    USER_COLUMNS,
  );

  // Load failure feedback is surfaced as a toast (retry via action) instead of a banner.
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load users', {
        description: error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  /* 原型 Filters embedded：输入即时生效（300ms 防抖回写服务端检索 + 回页 1），无 Search 按钮。 */
  const filterTimer = React.useRef<number | null>(null);
  React.useEffect(() => {
    const subscription = watch((values) => {
      if (filterTimer.current != null) window.clearTimeout(filterTimer.current);
      filterTimer.current = window.setTimeout(() => {
        setParams((prev) =>
          userFilterToParams(values as UserFilterForm, 1, prev.pageSize),
        );
      }, 300);
    });
    return () => {
      subscription.unsubscribe();
      if (filterTimer.current != null)
        window.clearTimeout(filterTimer.current);
    };
  }, [watch]);

  /** 渲染期订阅：Reset 置灰态即时跟随（含本地 Type 下拉）。 */
  const watched = watch();
  const hasFilter =
    (watched.loginName ?? '').trim() !== '' ||
    (watched.userName ?? '').trim() !== '' ||
    (watched.userType ?? OPT_ALL) !== OPT_ALL ||
    (watched.status ?? OPT_ALL) !== OPT_ALL;

  const onResetSearch = React.useCallback(() => {
    reset(USER_FILTER_DEFAULT);
    setParams((prev) =>
      userFilterToParams(USER_FILTER_DEFAULT, 1, prev.pageSize),
    );
  }, [reset]);

  /** 统计卡数据（原型 Total / Active / Inactive）。 */
  const stats = React.useMemo(() => {
    const list = statsPage?.data ?? [];
    return {
      total: statsPage?.pagination?.total ?? list.length,
      active: list.filter((u) => u.status === 0).length,
      inactive: list.filter((u) => u.status === 1).length,
    };
  }, [statsPage]);

  const openConfirm = React.useCallback(
    (user: UserRow, action: UserConfirmAction) => {
      setConfirmTarget(user);
      setConfirmAction(action);
    },
    [],
  );
  const closeConfirm = React.useCallback(() => {
    setConfirmTarget(null);
    setConfirmAction(null);
  }, []);

  /** 确认弹窗统一分发：启停 / 重置密码（成功→一次性密码弹窗）/ 强制下线。 */
  const onConfirm = React.useCallback(() => {
    if (!confirmTarget || !confirmAction) return;
    if (confirmAction === 'deactivate' || confirmAction === 'activate') {
      statusMutation.mutate(
        {
          userId: confirmTarget.userId,
          status: confirmAction === 'deactivate' ? 1 : 0,
        },
        {
          onSuccess: () => toast.success('Operation succeeded'),
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else if (confirmAction === 'resetPassword') {
      resetPwdMutation.mutate(confirmTarget.userId, {
        onSuccess: (otp: OneTimePassword) =>
          setResetOtp({ pwd: otp.oneTimePassword }),
        onError: (e) => toast.error((e as Error).message),
      });
    } else {
      forceLogoutMutation.mutate(confirmTarget.userId, {
        onSuccess: () => toast.success('Forced offline'),
        onError: (e) => toast.error((e as Error).message),
      });
    }
    closeConfirm();
  }, [
    confirmTarget,
    confirmAction,
    statusMutation,
    resetPwdMutation,
    forceLogoutMutation,
    toast,
    closeConfirm,
  ]);

  /* 排序 + Type 过滤：服务端 /user/page 无排序与 userType 参数——当前页内处理。 */
  const sortAccessors = React.useMemo<
    Record<string, (u: UserRow) => string | number | null | undefined>
  >(
    () => ({
      username: (u) => u.loginName,
      fullName: (u) => u.userName,
      type: (u) => u.userType,
      createdAt: (u) => u.createTime,
      status: (u) => u.status,
    }),
    [],
  );
  const sortedRows = React.useMemo(() => {
    const accessor = sort.key ? sortAccessors[sort.key] : undefined;
    const base =
      watched.userType === OPT_ALL
        ? rows
        : rows.filter((u) => String(u.userType) === watched.userType);
    if (!accessor) return base;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...base].sort(
      (a, b) => compareProtoValues(accessor(a), accessor(b)) * dir,
    );
  }, [rows, sort, sortAccessors, watched.userType]);

  const tableData = React.useMemo(
    () => sortedRows.map((u) => ({ ...u, id: String(u.userId) })),
    [sortedRows],
  );

  const typeSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All Types' },
      ...Object.entries(USER_TYPE_LABEL).map(([code, label]) => ({
        value: code,
        label,
      })),
    ],
    [],
  );
  const statusSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...Object.entries(PROTO_USER_STATUS)
        .sort(([, a], [, b]) => a.rank - b.rank)
        .map(([code, meta]) => ({ value: code, label: meta.text })),
    ],
    [],
  );

  /**
   * 列集对齐 BP 原型 COLUMNS 逐字：Username / Full Name / Type / Phone / Email /
   * Created on (UTC+8) / First Login / Status / Actions（源 Name→Full Name）。
   */
  const columns = React.useMemo<ColumnDef<UserRow & { id: string }>[]>(() => {
    return [
      {
        id: 'username',
        header: (
          <SortHeader
            label="Username"
            direction={sort.key === 'username' ? sort.direction : null}
            onToggle={() => toggle('username')}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.loginName}</span>
        ),
      },
      {
        id: 'fullName',
        header: (
          <SortHeader
            label="Full Name"
            direction={sort.key === 'fullName' ? sort.direction : null}
            onToggle={() => toggle('fullName')}
          />
        ),
        cell: ({ row }) => <span>{orDash(row.original.userName)}</span>,
      },
      {
        id: 'type',
        header: (
          <SortHeader
            label="Type"
            direction={sort.key === 'type' ? sort.direction : null}
            onToggle={() => toggle('type')}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={USER_TYPE_VARIANT[row.original.userType] ?? 'outline'}
          >
            {USER_TYPE_LABEL[row.original.userType] ?? row.original.userType}
          </Badge>
        ),
      },
      {
        id: 'phone',
        header: 'Phone',
        cell: ({ row }) => <span>{orDash(row.original.phone)}</span>,
      },
      {
        id: 'email',
        header: 'Email',
        cell: ({ row }) => <span>{orDash(row.original.email)}</span>,
      },
      {
        id: 'createdAt',
        header: (
          <SortHeader
            label="Created on (UTC+8)"
            direction={sort.key === 'createdAt' ? sort.direction : null}
            onToggle={() => toggle('createdAt', 'desc')}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'firstLogin',
        header: 'First Login',
        cell: ({ row }) => (
          /* 本仓 firstLogin：0=首登待改密（warning）/ 1=已就绪（muted）；原型同形。 */
          <ProtoStatusBadge
            label={USER_FIRST_LOGIN_LABEL[row.original.firstLogin] ?? '-'}
            tone={row.original.firstLogin === 0 ? 'warning' : 'muted'}
          />
        ),
      },
      {
        id: 'status',
        header: (
          <SortHeader
            label="Status"
            direction={sort.key === 'status' ? sort.direction : null}
            onToggle={() => toggle('status')}
          />
        ),
        cell: ({ row }) => (
          <ProtoStatusBadge
            label={protoStatusText(PROTO_USER_STATUS, row.original.status)}
            tone={USER_STATUS_TONES[row.original.status] ?? 'muted'}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const u = row.original;
          const active = u.status === 0;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  stashUserRow(u);
                  router.push(`/system/user/detail?id=${u.userId}`);
                }}
              >
                Details
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* 原型 menuActionsFor 状态裁剪 + 本仓超集 Assign Roles；
                      原型 Delete 无 /user/delete 端点（缺口未提供，见 GAP 记录）。 */}
                  {!active && (
                    <DropdownMenuItem
                      onClick={() => {
                        stashUserRow(u);
                        router.push(`/system/user/edit?id=${u.userId}`);
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setAssignUser(u)}>
                    Assign Roles
                  </DropdownMenuItem>
                  {active ? (
                    <>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => openConfirm(u, 'deactivate')}
                      >
                        Deactivate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => openConfirm(u, 'forceSignOut')}
                      >
                        Force Sign Out
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={() => openConfirm(u, 'activate')}
                      >
                        Activate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => openConfirm(u, 'resetPassword')}
                      >
                        Reset Password
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [openConfirm, router, sort, toggle]);

  /* 列偏好：required 列恒显，其余按用户选择过滤。 */
  const visibleColumns = React.useMemo(
    () =>
      filterVisibleColumns(
        columns,
        USER_COLUMNS,
        columnPreferences.isColumnVisible,
      ),
    [columns, columnPreferences],
  );

  return (
    <div className="space-y-4">
      {/* 页头（原型 PageHeader：标题 + 描述 + Create User）。 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            System
          </div>
          <h1 className="text-xl font-semibold">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage system users, assign roles, and control system access.
          </p>
        </div>
        {/* 源 v-perm="'bank:user:manage'"：未命中 menuKeys 不渲染。 */}
        {hasPerm('bank:user:manage') && (
          <Button onClick={() => router.push('/system/user/create')}>
            Create User
          </Button>
        )}
      </div>

      {/* 统计卡（原型 StatCard 行：Total / Active / Inactive）。 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={stats.total} tone="success" />
        <StatCard label="Active" value={stats.active} tone="success" />
        <StatCard label="Inactive" value={stats.inactive} tone="warning" />
      </div>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Users
            </div>
            {data && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {paginationMeta?.total ?? 0} results
              </span>
            )}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatUtc8(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ColumnPicker
              columns={USER_COLUMNS}
              isColumnVisible={columnPreferences.isColumnVisible}
              onColumnVisibilityChange={columnPreferences.setColumnVisible}
              onReset={columnPreferences.resetColumns}
            />
          </div>
        </div>

        {/* 原型 Filters embedded：Username/Full Name/Status 服务端即时检索；
            Type 本地过滤当前页（UserListReq 无 userType 参数）。 */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="loginName"
              label="Username"
              register={register('loginName')}
            />
            <FormField
              name="userName"
              label="Full Name"
              register={register('userName')}
            />
            <FormSelect
              name="userType"
              control={control}
              label="Type"
              options={typeSelectOptions}
              placeholder="All Types"
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              options={statusSelectOptions}
              placeholder="All"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!hasFilter}
              onClick={onResetSearch}
            >
              Reset
            </Button>
          </div>
        </form>


        <div className="p-4">
          <DataTable
            columns={visibleColumns}
            data={tableData}
            isLoading={isLoading}
            emptyMessage="No users found. Try adjusting the filters."
            pagination={
              paginationMeta
                ? {
                    page: paginationMeta.page,
                    pageSize: paginationMeta.pageSize,
                    total: paginationMeta.total,
                    onPageChange: (page) =>
                      setParams((prev) => ({ ...prev, pageNum: page })),
                    onPageSizeChange: (n) =>
                      setParams((prev) => ({
                        ...prev,
                        pageNum: 1,
                        pageSize: n,
                      })),
                  }
                : undefined
            }
          />
        </div>
      </section>

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

      {/* 行操作确认（原型 USER_ACTION_CONFIG 文案逐字；ActionConfirmDialog 单实例复用）。 */}
      <ActionConfirmDialog
        open={confirmTarget != null && confirmAction != null}
        onOpenChange={(o) => !o && closeConfirm()}
        icon={
          confirmAction ? USER_ACTION_CONFIG[confirmAction].icon : undefined
        }
        tone={confirmAction ? USER_ACTION_CONFIG[confirmAction].tone : undefined}
        title={confirmAction ? USER_ACTION_CONFIG[confirmAction].title : null}
        body1={
          confirmTarget && confirmAction
            ? USER_ACTION_CONFIG[confirmAction].body1(confirmTarget.userName)
            : null
        }
        body2={confirmAction ? USER_ACTION_CONFIG[confirmAction].body2 : null}
        confirmLabel={
          confirmAction
            ? USER_ACTION_CONFIG[confirmAction].confirmLabel
            : undefined
        }
        variant={
          confirmAction ? USER_ACTION_CONFIG[confirmAction].variant : undefined
        }
        loading={
          statusMutation.isPending ||
          resetPwdMutation.isPending ||
          forceLogoutMutation.isPending
        }
        onConfirm={onConfirm}
      />
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
          <div className="space-y-1">
            <FormField
              name="loginName"
              label="Username"
              required
              disabled={isEdit}
              placeholder="Letters, digits, _.-, up to 30 characters"
              error={formState.errors.loginName?.message}
              register={register('loginName')}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Username cannot be changed after creation
              </p>
            )}
          </div>
          <FormField
            name="userName"
            label="Full Name"
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

        <div className="flex items-center gap-2">
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
          {formState.isDirty && (
            <span className="text-xs text-muted-foreground" role="status">
              ● Unsaved changes
            </span>
          )}
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
  const toast = useToast();

  const { data: rolePage } = useUserRoleOptionsQuery(KISSEN_GATEWAY_PROJECT_ID);
  const statusMutation = useUserStatusMutation(KISSEN_GATEWAY_PROJECT_ID);
  const resetPwdMutation = useUserResetPwdMutation(KISSEN_GATEWAY_PROJECT_ID);
  const forceLogoutMutation = useUserForceLogoutMutation(
    KISSEN_GATEWAY_PROJECT_ID,
  );

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
    stashedUser ??
    (userId != null
      ? data?.data.find((u) => u.userId === userId)
      : undefined);
  const roles = (user?.roleIds ?? [])
    .map((rid) => rolePage?.data.find((r) => r.roleId === rid))
    .filter((r): r is NonNullable<typeof r> => r != null);
  const active = user?.status === 0;

  /* 状态裁剪动作（原型 UserDetails 头部）：Active → Deactivate/Force Sign Out；
     Inactive → Activate/Edit User/Reset Password；确认文案与列表共用 USER_ACTION_CONFIG。 */
  const [confirmAction, setConfirmAction] =
    React.useState<UserConfirmAction | null>(null);
  const [resetOtp, setResetOtp] = React.useState<string | null>(null);
  const closeConfirm = React.useCallback(() => setConfirmAction(null), []);

  const onConfirm = React.useCallback(() => {
    if (!confirmAction || !user) return;
    if (confirmAction === 'deactivate' || confirmAction === 'activate') {
      statusMutation.mutate(
        { userId: user.userId, status: confirmAction === 'deactivate' ? 1 : 0 },
        {
          onSuccess: () => toast.success('Operation succeeded'),
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else if (confirmAction === 'resetPassword') {
      resetPwdMutation.mutate(user.userId, {
        onSuccess: (otp: OneTimePassword) => setResetOtp(otp.oneTimePassword),
        onError: (e) => toast.error((e as Error).message),
      });
    } else {
      forceLogoutMutation.mutate(user.userId, {
        onSuccess: () => toast.success('Forced offline'),
        onError: (e) => toast.error((e as Error).message),
      });
    }
    closeConfirm();
  }, [
    confirmAction,
    user,
    statusMutation,
    resetPwdMutation,
    forceLogoutMutation,
    toast,
    closeConfirm,
  ]);

  if (userId == null) {
    return (
      <div className="space-y-4">
        <PageHead variant="toolbar" title="User Details" />
        <div className="rounded-lg border border-border/60 bg-card p-6 shadow-float">
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Back to list"
            onClick={() => router.push('/system/user')}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-7 text-foreground">
                User Details
              </h1>
              {user ? (
                <ProtoStatusBadge
                  label={protoStatusText(PROTO_USER_STATUS, user.status)}
                  tone={USER_STATUS_TONES[user.status] ?? 'muted'}
                />
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                Username:{' '}
                <span className="font-medium text-foreground">
                  {user?.loginName ?? '-'}
                </span>
              </span>
              <span aria-hidden="true">|</span>
              <span>
                Created on{' '}
                <span className="font-medium tabular-nums text-foreground">
                  {formatUtc8(user?.createTime)}
                </span>
              </span>
            </div>
          </div>
        </div>
        {user && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {active ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmAction('deactivate')}
                >
                  Deactivate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmAction('forceSignOut')}
                >
 Force Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmAction('activate')}
                >
                  Activate
                </Button>
                <Button
                  onClick={() => {
                    stashUserRow(user);
                    router.push(`/system/user/edit?id=${user.userId}`);
                  }}
                >
                  Edit User
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmAction('resetPassword')}
                >
                  Reset Password
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {isError ? (
          <div className="rounded-lg border border-border/60 bg-card p-6 lg:col-span-2">
            <QueryErrorRetry error={error} onRetry={() => refetch()} />
          </div>
        ) : isLoading || !user ? (
          user == null && !isLoading && data ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-10 text-center lg:col-span-2">
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
            <div className="lg:col-span-2">
              <LoadingBlock variant="skeleton" />
            </div>
          )
        ) : (
          <>
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                Basic Information
              </h2>
              <DescGrid>
                <DescField label="Username" variant="plain">
                  {user.loginName}
                </DescField>
                <DescField label="Full Name" variant="plain">
                  {user.userName}
                </DescField>
                <DescField label="Type" variant="plain">
                  <Badge
                    variant={USER_TYPE_VARIANT[user.userType] ?? 'outline'}
                  >
                    {USER_TYPE_LABEL[user.userType] ?? user.userType}
                  </Badge>
                </DescField>
              </DescGrid>
            </section>
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                Contact Information
              </h2>
              <DescGrid>
                <DescField label="Email" variant="plain">
                  {orDash(user.email)}
                </DescField>
                <DescField label="Phone Number" variant="plain">
                  {orDash(user.phone)}
                </DescField>
              </DescGrid>
            </section>
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                Account Activity
              </h2>
              <DescGrid>
                <DescField label="Status" variant="plain">
                  <ProtoStatusBadge
                    label={protoStatusText(PROTO_USER_STATUS, user.status)}
                    tone={USER_STATUS_TONES[user.status] ?? 'muted'}
                  />
                </DescField>
                <DescField label="First Login" variant="plain">
                  <ProtoStatusBadge
                    label={USER_FIRST_LOGIN_LABEL[user.firstLogin] ?? '-'}
                    tone={user.firstLogin === 0 ? 'warning' : 'muted'}
                  />
                </DescField>
                <DescField label="Created on" variant="plain">
                  <span className="tabular-nums">
                    {formatUtc8(user.createTime)}
                  </span>
                </DescField>
              </DescGrid>
            </section>
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                Roles
              </h2>
              {roles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => (
                    <span
                      key={r.roleId}
                      className="inline-flex flex-col rounded-md border border-border/70 px-2.5 py-1"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {r.roleName}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.roleCode}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No role assigned.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      <OneTimePasswordDialog
        open={!!resetOtp}
        onClose={() => setResetOtp(null)}
        title="Reset Successful"
        lead="New one-time password (forced change on first login):"
        otp={resetOtp}
        tone="success"
      />

      {/* 头部动作确认（文案与列表页共用 USER_ACTION_CONFIG）。 */}
      <ActionConfirmDialog
        open={confirmAction != null && user != null}
        onOpenChange={(o) => !o && closeConfirm()}
        icon={
          confirmAction ? USER_ACTION_CONFIG[confirmAction].icon : undefined
        }
        tone={
          confirmAction ? USER_ACTION_CONFIG[confirmAction].tone : undefined
        }
        title={confirmAction ? USER_ACTION_CONFIG[confirmAction].title : null}
        body1={
          confirmAction && user
            ? USER_ACTION_CONFIG[confirmAction].body1(user.userName)
            : null
        }
        body2={
          confirmAction ? USER_ACTION_CONFIG[confirmAction].body2 : null
        }
        confirmLabel={
          confirmAction
            ? USER_ACTION_CONFIG[confirmAction].confirmLabel
            : undefined
        }
        variant={
          confirmAction ? USER_ACTION_CONFIG[confirmAction].variant : undefined
        }
        loading={
          statusMutation.isPending ||
          resetPwdMutation.isPending ||
          forceLogoutMutation.isPending
        }
        onConfirm={onConfirm}
      />
    </div>
  );
}
