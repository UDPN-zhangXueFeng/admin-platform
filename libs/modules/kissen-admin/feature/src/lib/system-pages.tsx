/**
 * kissen-admin system 内容页 — 用户/角色/菜单/工作流/操作日志。
 *
 * 原型对齐（/tmp/kissen_prototype/udpn-kissen-network-mgt/client/src/pages/*.jsx）：
 * UserManagementPage / UserFormPage / UserDetailsPage / RoleManagementPage /
 * RoleFormPage / RoleDetailsPage / MenuManagementPage / WorkflowSettingsPage /
 * WorkflowSettingsDetailsPage / OperationLogsPage / OperationLogDetailsPage。
 * 原型是行为规格（文案/列/Tab/动作逐字对齐），UI 沿用本仓库 shadcn 体系。
 *
 * 服务端分页端点无 sortBy → 客户端排序仅作用于当前页（同 approval-pages 口径，
 * 原型为全量客户端分页，此处为最小偏差，已在文件头统一登记）。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CircleCheck,
  CirclePause,
  KeyRound,
  ListTree,
  Lock,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  Alert,
  AlertTitle,
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
  Input,
  Label,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { peekRow, stashRow } from './row-stash';
import { useKissenPerm } from './use-kissen-perm';
import { ActionConfirmDialog, CopyableId, Dash, ProtoStatusBadge } from './proto-ui';
import { formatUtc8 } from './proto-format';
import { ProtoSortHeader, useProtoSort } from './proto-sort';
import {
  PROTO_OPERATE_LOG_RESULT,
  PROTO_USER_STATUS,
  PROTO_WORKFLOW_SETTING_STATUS,
  protoStatusLabel,
  protoStatusRank,
} from './proto-enums';
import {
  KISSEN_PROJECT_ID,
  MENU_TYPE_LABEL,
  RBAC_USER_TYPE_LABEL,
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
  type MenuPermissionItem,
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
  WORKFLOW_STEP_TYPE_LABEL,
  type MenuTreeRespVO,
  type OneTimePassword,
  type OperateLogRow,
  type RoleRow,
  type UserRow,
  type WorkflowRow,
} from '@myorg/modules/kissen-admin/data-access';

/* ============================================================ */
/* 常量（集中）                                                  */
/* ============================================================ */

const USER_LIST_PATH = '/system/user';
const USER_CREATE_PATH = '/system/user/create';
const USER_EDIT_PATH = '/system/user/edit';
const USER_DETAIL_PATH = '/system/user/detail';
const ROLE_LIST_PATH = '/system/role';
const ROLE_CREATE_PATH = '/system/role/create';
const ROLE_EDIT_PATH = '/system/role/edit';
const ROLE_DETAIL_PATH = '/system/role/detail';
const WORKFLOW_LIST_PATH = '/system/workflow';
const WORKFLOW_CREATE_PATH = '/system/workflow/create';
const WORKFLOW_EDIT_PATH = '/system/workflow/edit';
const WORKFLOW_DETAIL_PATH = '/system/workflow/detail';
const LOG_LIST_PATH = '/system/log';
const LOG_DETAIL_PATH = '/system/log/detail';

/** 行暂存 scope（详情页跨路由传行数据；user 沿用既有 scope）。 */
const USER_STASH = 'user' as const;
const ROLE_STASH = 'admRole' as const;
const WORKFLOW_STASH = 'admWorkflow' as const;
const OPERATE_LOG_STASH = 'admOperateLog' as const;

const USER_PAGE_SIZE = 10;
const ROLE_PAGE_SIZE = 20;
const LOG_PAGE_SIZE = 10;
/** 探针查询窗口：统计卡/反查（Assigned Users、日志详情兜底）用大窗口扫描。 */
const PROBE_PAGE_SIZE = 200;

const FILTER_DEBOUNCE_MS = 250;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** First Login 徽章（KNMS firstLoginLabel：0 待改密 → 'Password Not Changed'）。 */
const FIRST_LOGIN_BADGE: Record<number, { label: string; tone: 'warning' | 'muted' }> = {
  0: { label: 'Password Not Changed', tone: 'warning' },
  1: { label: 'Password Changed', tone: 'muted' },
};

const STAT_TONE_TEXT: Record<'primary' | 'success' | 'warning', string> = {
  primary: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
};

/* ============================================================ */
/* 共享小助手                                                    */
/* ============================================================ */

const ALL = 'ALL';

function parseNum(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toNum(v: string): number | undefined {
  return v === ALL ? undefined : Number(v);
}

/** 纯数字输入视为精确 userId，其余走客户端子串匹配（GAP-ADM-01：无按操作人姓名查询端点）。 */
function isNumericText(v: string): boolean {
  return /^\d+$/.test(v);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '-';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-medium leading-6">{children ?? <Dash />}</div>
    </div>
  );
}

function DetailCard({
  title,
  description,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icon;
  return (
    <section className={cn('rounded-lg border border-border/60 bg-card', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : null}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-5">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** 列表/详情空态（原型 EmptyState 逐字）。 */
function EmptyStateBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** 表单页头（左返回 + 标题 + 描述）。 */
function FormPageHeader({
  backTo,
  backLabel,
  title,
  description,
  actions,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label={`Back to ${backLabel}`}
          onClick={() => router.push(backTo)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** 列表页头（标题 + 描述 + 右侧动作）。 */
function ListPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-7">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** 统计卡（KNMS 列表页 stats 三卡；KpiCard 为 dashboard 专属，此处轻量实现）。 */
interface StatItem {
  label: string;
  value: React.ReactNode;
  help: string;
  tone: 'primary' | 'success' | 'warning';
}

function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-border/60 bg-card p-4"
        >
          <div className="text-sm font-medium text-muted-foreground">{it.label}</div>
          <div
            className={cn(
              'mt-1.5 text-2xl font-semibold leading-none tabular-nums',
              STAT_TONE_TEXT[it.tone],
            )}
          >
            {it.value}
          </div>
          <div className="mt-2 text-xs leading-4 text-muted-foreground">{it.help}</div>
        </div>
      ))}
    </div>
  );
}

/** 筛选字段外壳（approval-pages 式标签 + 控件）。 */
function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium leading-snug text-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/** 状态徽章（Active/Enabled/Success→success、Inactive/Disabled→muted、Failed→danger）。 */
function UserStatusBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={status === 0 ? 'success' : 'muted'}>
      {protoStatusLabel(PROTO_USER_STATUS, status)}
    </ProtoStatusBadge>
  );
}

function FirstLoginBadge({ firstLogin }: { firstLogin: number }) {
  const meta = FIRST_LOGIN_BADGE[firstLogin] ?? { label: String(firstLogin), tone: 'muted' as const };
  return <ProtoStatusBadge tone={meta.tone}>{meta.label}</ProtoStatusBadge>;
}

function WorkflowStatusBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={status === 1 ? 'success' : 'muted'}>
      {protoStatusLabel(PROTO_WORKFLOW_SETTING_STATUS, status)}
    </ProtoStatusBadge>
  );
}

function OperateLogResultBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={status === 0 ? 'success' : 'danger'}>
      {protoStatusLabel(PROTO_OPERATE_LOG_RESULT, status)}
    </ProtoStatusBadge>
  );
}

/** ⋮ 溢出菜单触发按钮（token-manage 同款）。 */
function RowMenuTrigger({ ariaLabel }: { ariaLabel: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={ariaLabel}>
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
  );
}

/** 初始密码弹窗（源后端 OneTimePassword；UserForm create / Reset Password 成功后展示）。 */
function OneTimePasswordDialog({
  otp,
  onClose,
}: {
  otp: OneTimePassword | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  return (
    <Dialog open={!!otp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Initial Password</DialogTitle>
          <DialogDescription>
            The system issued an initial password. Share it with the user through a
            secure channel; it must be changed at first sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
            {otp?.oneTimePassword || '-'}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!otp?.oneTimePassword) return;
                void navigator.clipboard?.writeText(otp.oneTimePassword);
                toast({ description: 'Initial password copied.' });
              }}
            >
              Copy
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}

/** 表单脏检查放弃确认（UserForm/RoleForm D5 逐字；icon=Lock warning）。 */
function DiscardChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <ActionConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onKeepEditing()}
      icon={Lock}
      variant="destructive"
      title="Discard changes?"
      body1="You have unsaved changes in this form."
      body2="Your unsaved changes will be lost."
      confirmLabel="Discard"
      cancelLabel="Keep Editing"
      onConfirm={onDiscard}
    />
  );
}

/* ============================================================ */
/* sys-user — 用户管理（原型 UserManagementPage / UserFormPage /  */
/* UserDetailsPage）                                            */
/* ============================================================ */

type UserActionKind = 'deactivate' | 'activate' | 'resetPassword' | 'forceSignOut';

interface UserActionCopy {
  icon: React.ComponentType<{ className?: string }>;
  variant: 'confirm' | 'destructive';
  title: string;
  body1: (user: UserRow) => string;
  body2: string;
  confirmLabel: string;
  success: (user: UserRow) => string;
}

/** 动作确认弹窗文案表（原型 USER_ACTION_CONFIG 逐字；无 Delete —— GAP-ADM-08 后端无 userDelete 端点）。 */
const USER_ACTION_CONFIG: Record<UserActionKind, UserActionCopy> = {
  deactivate: {
    icon: CirclePause,
    variant: 'destructive',
    title: 'Deactivate User',
    body1: (user) => `Deactivate user "${user.loginName}"?`,
    body2: 'Once deactivated, the user can no longer sign in, and any session that is still open stops being accepted.',
    confirmLabel: 'Deactivate',
    success: (user) => `User "${user.loginName}" is deactivated.`,
  },
  activate: {
    icon: CircleCheck,
    variant: 'confirm',
    title: 'Activate User',
    body1: (user) => `Activate user "${user.loginName}"?`,
    body2: 'Once activated, the user can sign in again with the existing password and assigned roles.',
    confirmLabel: 'Activate',
    success: (user) => `User "${user.loginName}" is activated.`,
  },
  resetPassword: {
    icon: KeyRound,
    variant: 'confirm',
    title: 'Reset Password',
    body1: (user) => `Reset the password of user "${user.loginName}"?`,
    body2: 'Once reset, the current password stops working and a new initial password is issued by the system. The user has to set a new password at the next sign-in.',
    confirmLabel: 'Reset Password',
    success: (user) => `A password reset is pending for user "${user.loginName}".`,
  },
  forceSignOut: {
    icon: LogOut,
    variant: 'confirm',
    title: 'Force Sign Out',
    body1: (user) => `Force user "${user.loginName}" to sign out?`,
    body2: 'All open sessions of this user are terminated immediately, and the user has to sign in again to continue working.',
    confirmLabel: 'Force Sign Out',
    success: (user) => `User "${user.loginName}" is signed out.`,
  },
};

interface UserConfirmRequest {
  kind: UserActionKind;
  user: UserRow;
}

type UserTableRow = UserRow & { id: string };

export function SysUserListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const hasPerm = useKissenPerm();

  const [username, setUsername] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [statusSel, setStatusSel] = React.useState(ALL);
  const debouncedUsername = useDebouncedValue(username, FILTER_DEBOUNCE_MS);
  const debouncedFullName = useDebouncedValue(fullName, FILTER_DEBOUNCE_MS);

  const [params, setParams] = React.useState({
    pageNum: 1,
    pageSize: USER_PAGE_SIZE,
    filter: {} as { loginName?: string; userName?: string; status?: number },
  });

  // 筛选即时生效：文本防抖、下拉立即；条件变化回第 1 页。
  React.useEffect(() => {
    setParams((prev) => ({
      pageNum: 1,
      pageSize: prev.pageSize,
      filter: {
        loginName: debouncedUsername || undefined,
        userName: debouncedFullName || undefined,
        status: toNum(statusSel),
      },
    }));
  }, [debouncedUsername, debouncedFullName, statusSel]);

  const { data, isLoading, isError, dataUpdatedAt } = useRbacUserListQuery(
    KISSEN_PROJECT_ID,
    params,
  );

  // STATIC-FILLER(GAP-ADM-08): 无按状态的 count 端点；Active/Inactive 统计来自 200 条探针窗口。
  const { data: statData } = useRbacUserListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: PROBE_PAGE_SIZE,
    filter: {},
  });

  const statusMutation = useUserStatusMutation(KISSEN_PROJECT_ID);
  const resetPwdMutation = useUserResetPwdMutation(KISSEN_PROJECT_ID);
  const forceLogoutMutation = useUserForceLogoutMutation(KISSEN_PROJECT_ID);

  const [confirm, setConfirm] = React.useState<UserConfirmRequest | null>(null);
  const [otp, setOtp] = React.useState<OneTimePassword | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;
  const statRows = statData?.data ?? [];

  const tableData = React.useMemo<UserTableRow[]>(
    () => rows.map((r) => ({ ...r, id: String(r.userId) })),
    [rows],
  );

  const { sorted, toggle, sortState } = useProtoSort<UserTableRow>(
    tableData,
    {
      username: { value: (r) => r.loginName },
      userName: { value: (r) => r.userName },
      type: { value: (r) => RBAC_USER_TYPE_LABEL[r.userType] ?? String(r.userType) },
      email: { value: (r) => r.email },
      createdOn: { value: (r) => r.createTime, defaultDir: 'desc' },
      status: { value: (r) => protoStatusRank(PROTO_USER_STATUS, r.status) },
      firstLogin: {
        value: (r) => FIRST_LOGIN_BADGE[r.firstLogin]?.label ?? String(r.firstLogin),
      },
    },
    'createdOn',
    'desc',
    true,
  );

  const activeCount = statRows.filter((u) => u.status === 0).length;
  const isFiltered =
    !!debouncedUsername || !!debouncedFullName || statusSel !== ALL;

  const onConfirm = React.useCallback(() => {
    if (!confirm) return;
    const { kind, user } = confirm;
    const copy = USER_ACTION_CONFIG[kind];
    const close = () => setConfirm(null);
    if (kind === 'deactivate' || kind === 'activate') {
      statusMutation.mutate(
        { userId: user.userId, status: kind === 'deactivate' ? 1 : 0 },
        {
          onSuccess: () => {
            toast({ description: copy.success(user) });
            close();
          },
          onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    } else if (kind === 'resetPassword') {
      // 真实 API 返回 OneTimePassword → OTP 弹窗（优先于原型 fixture toast 口径）。
      resetPwdMutation.mutate(user.userId, {
        onSuccess: (issued) => {
          setOtp(issued);
          close();
        },
        onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
      });
    } else {
      forceLogoutMutation.mutate(user.userId, {
        onSuccess: () => {
          toast({ description: copy.success(user) });
          close();
        },
        onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
      });
    }
    // 三个 mutation 引用来自模块级 hook 工厂，按 projectId 稳定。
  }, [confirm, statusMutation, resetPwdMutation, forceLogoutMutation, toast]);

  const columns = React.useMemo<ColumnDef<UserTableRow>[]>(
    () => [
      {
        accessorKey: 'loginName',
        header: () => (
          <ProtoSortHeader label="Username" columnKey="username" toggle={toggle} sortState={sortState('username')} />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.original.loginName}</span>
            {/* STATIC-FILLER(GAP-ADM-08): 后端无 userCode，副行以 #userId 顶替。 */}
            <span className="text-xs text-muted-foreground">#{row.original.userId}</span>
          </div>
        ),
      },
      {
        accessorKey: 'userName',
        header: () => (
          <ProtoSortHeader label="Full Name" columnKey="userName" toggle={toggle} sortState={sortState('userName')} />
        ),
      },
      {
        accessorKey: 'userType',
        header: () => (
          <ProtoSortHeader label="Type" columnKey="type" toggle={toggle} sortState={sortState('type')} />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">
            {RBAC_USER_TYPE_LABEL[row.original.userType] ?? row.original.userType}
          </Badge>
        ),
      },
      {
        accessorKey: 'email',
        header: () => (
          <ProtoSortHeader label="Email" columnKey="email" toggle={toggle} sortState={sortState('email')} />
        ),
        cell: ({ row }) => (
          <span className="truncate">{row.original.email || <Dash />}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: () => (
          <ProtoSortHeader label="Created on (UTC+8)" columnKey="createdOn" toggle={toggle} sortState={sortState('createdOn')} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatUtc8(row.original.createTime)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <ProtoSortHeader label="Status" columnKey="status" toggle={toggle} sortState={sortState('status')} />
        ),
        cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'firstLogin',
        header: () => (
          <ProtoSortHeader label="First Login" columnKey="firstLogin" toggle={toggle} sortState={sortState('firstLogin')} />
        ),
        cell: ({ row }) => <FirstLoginBadge firstLogin={row.original.firstLogin} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const u = row.original;
          const isActive = u.status === 0;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  stashRow(USER_STASH, u.userId, u);
                  router.push(`${USER_DETAIL_PATH}?id=${u.userId}`);
                }}
              >
                Details
              </Button>
              <DropdownMenu>
                <RowMenuTrigger ariaLabel={`More actions for ${u.loginName}`} />
                <DropdownMenuContent align="end">
                  {isActive ? (
                    <>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirm({ kind: 'deactivate', user: u })}
                      >
                        Deactivate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setConfirm({ kind: 'forceSignOut', user: u })}>
                        Force Sign Out
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => router.push(`${USER_EDIT_PATH}?id=${u.userId}`)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setConfirm({ kind: 'activate', user: u })}>
                        Activate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setConfirm({ kind: 'resetPassword', user: u })}>
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
    ],
    [router, toggle, sortState],
  );

  const emptyMessage = isFiltered
    ? 'No users found.'
    : 'No users yet.';

  const pending =
    statusMutation.isPending || resetPwdMutation.isPending || forceLogoutMutation.isPending;

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="User Management"
        description="Accounts that can sign in to this portal."
        actions={
          hasPerm('system:user') ? (
            <Button onClick={() => router.push(USER_CREATE_PATH)}>
              <Plus className="size-4" aria-hidden="true" />
              Add User
            </Button>
          ) : undefined
        }
      />

      {/* STATIC-FILLER(GAP-ADM-08): 无 count 端点；total 用分页 total，Active/Inactive 来自探针窗口。 */}
      <StatGrid
        items={[
          { label: 'Total Users', value: paginationMeta?.total ?? statRows.length, help: 'All registered accounts.', tone: 'primary' },
          { label: 'Active', value: activeCount, help: 'Allowed to sign in to the system.', tone: 'success' },
          { label: 'Inactive', value: statRows.length - activeCount, help: 'Sign-in is disabled.', tone: 'warning' },
        ]}
      />

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold leading-6">Users</h2>
            {!isLoading && paginationMeta ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {paginationMeta.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Username" htmlFor="user-filter-username">
            <Input
              id="user-filter-username"
              placeholder="Fuzzy match"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </FilterField>
          <FilterField label="Full Name" htmlFor="user-filter-fullname">
            <Input
              id="user-filter-fullname"
              placeholder="Fuzzy match"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </FilterField>
          <FilterField label="Status">
            <Select value={statusSel} onValueChange={setStatusSel}>
              <SelectTrigger id="user-filter-status" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                <SelectItem value="0">{protoStatusLabel(PROTO_USER_STATUS, 0)}</SelectItem>
                <SelectItem value="1">{protoStatusLabel(PROTO_USER_STATUS, 1)}</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setUsername('');
                setFullName('');
                setStatusSel(ALL);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={sorted}
              isLoading={isLoading}
              emptyMessage={emptyMessage}
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
          )}
        </div>
      </section>

      {confirm ? (
        <ActionConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          icon={USER_ACTION_CONFIG[confirm.kind].icon}
          variant={USER_ACTION_CONFIG[confirm.kind].variant}
          title={USER_ACTION_CONFIG[confirm.kind].title}
          body1={USER_ACTION_CONFIG[confirm.kind].body1(confirm.user)}
          body2={USER_ACTION_CONFIG[confirm.kind].body2}
          confirmLabel={USER_ACTION_CONFIG[confirm.kind].confirmLabel}
          cancelLabel="Cancel"
          loading={pending}
          onConfirm={onConfirm}
        />
      ) : null}
      <OneTimePasswordDialog otp={otp} onClose={() => setOtp(null)} />
    </div>
  );
}

/** 角色多选卡片（原型 RoleCheckboxGroup：卡片式、选中态描边）。 */
function RoleOptionCard({
  role,
  checked,
  onToggle,
}: {
  role: RoleRow;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        checked
          ? 'border-primary bg-primary/5'
          : 'border-border/60 hover:bg-accent/50',
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-5">{role.roleName}</span>
        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
          {role.roleCode}
        </span>
      </span>
    </label>
  );
}

interface UserFormValues {
  loginName: string;
  userName: string;
  userType: number;
  email: string;
  phoneNumber: string;
}

export function SysUserFormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));
  const isEdit = !!id;

  const { data: userPage, isLoading } = useRbacUserListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: PROBE_PAGE_SIZE, filter: {} },
    isEdit,
  );
  const { data: roles } = useRbacRoleOptionsQuery(KISSEN_PROJECT_ID);

  const saveMutation = useUserSaveMutation(KISSEN_PROJECT_ID);
  const updateMutation = useUserUpdateMutation(KISSEN_PROJECT_ID);

  const source = id != null ? (userPage?.data ?? []).find((u) => u.userId === id) : undefined;
  const loaded = !isEdit || (!isLoading && userPage != null);

  const baseRoleIds = React.useMemo(() => source?.roleIds ?? [], [source]);
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<number[]>([]);
  const [roleIdsTouched, setRoleIdsTouched] = React.useState(false);
  const [rolesError, setRolesError] = React.useState<string | undefined>(undefined);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [otp, setOtp] = React.useState<OneTimePassword | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<UserFormValues>({
    defaultValues: {
      loginName: '',
      userName: '',
      userType: 0,
      email: '',
      phoneNumber: '',
    },
  });

  React.useEffect(() => {
    if (isEdit && source) {
      reset({
        loginName: source.loginName,
        userName: source.userName,
        userType: source.userType,
        email: source.email ?? '',
        phoneNumber: source.phoneNumber ?? '',
      });
      setSelectedRoleIds(source.roleIds ?? []);
    }
  }, [isEdit, source, reset]);

  const rolesDirty = roleIdsTouched && selectedRoleIds !== baseRoleIds;
  const formDirty = isDirty || rolesDirty || (!isEdit && selectedRoleIds.length > 0);
  const selectedRoles = (roles ?? []).filter((r) => selectedRoleIds.includes(r.roleId));

  const onValid = (values: UserFormValues) => {
    if (selectedRoleIds.length === 0) {
      setRolesError('Assign at least one role.');
      return;
    }
    if (id != null) {
      updateMutation.mutate(
        {
          userId: id,
          userName: values.userName,
          email: values.email || undefined,
          phoneNumber: values.phoneNumber || undefined,
          roleIds: selectedRoleIds,
        },
        {
          onSuccess: () => {
            toast({ description: `User "${source?.loginName ?? values.loginName}" is updated.` });
            router.push(USER_LIST_PATH);
          },
          onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    } else {
      saveMutation.mutate(
        {
          loginName: values.loginName,
          userName: values.userName,
          userType: values.userType,
          email: values.email || undefined,
          phoneNumber: values.phoneNumber || undefined,
          roleIds: selectedRoleIds,
        },
        {
          // 真实 API 返回 OneTimePassword → OTP 弹窗（优先于原型 fixture toast 口径）。
          onSuccess: (issued) => {
            setOtp(issued);
          },
          onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    }
  };

  const onCancel = () => {
    if (formDirty) {
      setDiscardOpen(true);
    } else {
      router.push(USER_LIST_PATH);
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;

  if (isEdit && loaded && !source) {
    return (
      <div className="space-y-4">
        <FormPageHeader backTo={USER_LIST_PATH} backLabel="User List" title="Edit User" />
        <section className="rounded-lg border border-border/60 bg-card">
          <EmptyStateBlock
            title="This user no longer exists."
            description="The record may have been removed. Go back to the list."
            action={
              <Button variant="outline" onClick={() => router.push(USER_LIST_PATH)}>
                Back to User List
              </Button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormPageHeader
        backTo={USER_LIST_PATH}
        backLabel="User List"
        title={isEdit ? 'Edit User' : 'Create User'}
        description={
          isEdit
            ? 'Update the contact details and role assignment of this account.'
            : 'Create an account, set its profile, and assign its roles.'
        }
      />

      <form onSubmit={handleSubmit(onValid)} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DetailCard
            title="Basic Information"
            description="Sign-in identity and the contact details used for notifications."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="block text-sm font-medium leading-snug">User Code</span>
                <Input
                  disabled
                  value={
                    isEdit
                      ? `#${id}`
                      : ''
                  }
                  placeholder={isEdit ? undefined : 'Auto-generated on submission'}
                />
                {/* STATIC-FILLER(GAP-ADM-08): 后端无 userCode 字段；edit 以 #userId 展示。 */}
                {isEdit ? (
                  <p className="text-xs text-muted-foreground">User Code is immutable after creation.</p>
                ) : null}
              </div>
              {isEdit ? (
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium leading-snug">Username</span>
                  <Input disabled value={source?.loginName ?? ''} />
                  <p className="text-xs text-muted-foreground">Username is immutable after creation.</p>
                </div>
              ) : (
                <FormField
                  name="loginName"
                  label="Username"
                  error={errors.loginName?.message}
                  {...register('loginName', {
                    required: 'Username is required.',
                    validate: (v) => v.trim().length > 0 || 'Username is required.',
                  })}
                  placeholder="Sign-in name (immutable after creation)"
                />
              )}
              <FormField
                name="userName"
                label="Full Name"
                error={errors.userName?.message}
                {...register('userName', {
                  required: 'Full Name is required.',
                  validate: (v) => v.trim().length > 0 || 'Full Name is required.',
                })}
                placeholder="Name shown in lists and approvals"
              />
              <FormSelect
                name="userType"
                control={control}
                label="User Type"
                placeholder="Select user type"
                options={Object.keys(RBAC_USER_TYPE_LABEL).map((k) => ({
                  value: k,
                  label: RBAC_USER_TYPE_LABEL[Number(k)] ?? k,
                }))}
                disabled={isEdit}
              />
              <FormField
                name="email"
                label="Email"
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required.',
                  pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address.' },
                })}
                placeholder="name@example.com"
              />
              <FormField
                name="phoneNumber"
                label="Phone Number"
                {...register('phoneNumber')}
                placeholder="Optional"
              />
            </div>
          </DetailCard>

          <DetailCard
            title="Roles"
            description="Assign at least one role. A user gets the union of the menus granted by the selected roles."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(roles ?? []).map((role) => (
                <RoleOptionCard
                  key={role.roleId}
                  role={role}
                  checked={selectedRoleIds.includes(role.roleId)}
                  onToggle={() => {
                    setRoleIdsTouched(true);
                    setRolesError(undefined);
                    setSelectedRoleIds((prev) =>
                      prev.includes(role.roleId)
                        ? prev.filter((r) => r !== role.roleId)
                        : [...prev, role.roleId],
                    );
                  }}
                />
              ))}
            </div>
            {rolesError ? (
              <p className="mt-2 text-sm text-destructive">{rolesError}</p>
            ) : null}
          </DetailCard>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-border/60 bg-card p-4">
            <div className="text-sm font-medium">Preview</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Roles {selectedRoles.length}
            </div>
            {selectedRoles.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedRoles.map((role) => (
                  <Badge key={role.roleId} variant="secondary">
                    {role.roleName}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No role assigned yet.</p>
            )}
            <p className="mt-3 border-t border-border/50 pt-3 text-xs leading-5 text-muted-foreground">
              The account is Active immediately after creation. The initial password is issued by the system.
            </p>
          </section>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Save
            </Button>
          </div>
        </div>
      </form>

      <DiscardChangesDialog
        open={discardOpen}
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          router.push(USER_LIST_PATH);
        }}
      />
      <OneTimePasswordDialog
        otp={otp}
        onClose={() => {
          setOtp(null);
          router.push(USER_LIST_PATH);
        }}
      />
    </div>
  );
}

export function SysUserDetailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const hasPerm = useKissenPerm();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));

  const { data: userPage, isLoading } = useRbacUserListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: PROBE_PAGE_SIZE, filter: {} },
    id != null,
  );
  const { data: roles } = useRbacRoleOptionsQuery(KISSEN_PROJECT_ID);

  const statusMutation = useUserStatusMutation(KISSEN_PROJECT_ID);
  const resetPwdMutation = useUserResetPwdMutation(KISSEN_PROJECT_ID);
  const forceLogoutMutation = useUserForceLogoutMutation(KISSEN_PROJECT_ID);

  const source = id != null ? (userPage?.data ?? []).find((u) => u.userId === id) : undefined;

  // 动作后本地 override（原型 DecisionOverride 口径；列表失效后以本地状态为准直至离开）。
  const [statusOverride, setStatusOverride] = React.useState<number | null>(null);
  const [firstLoginOverride, setFirstLoginOverride] = React.useState<number | null>(null);
  const [confirm, setConfirm] = React.useState<UserConfirmRequest | null>(null);
  const [otp, setOtp] = React.useState<OneTimePassword | null>(null);

  const effectiveStatus = statusOverride ?? source?.status ?? 0;
  const effectiveFirstLogin = firstLoginOverride ?? source?.firstLogin ?? 1;

  const userNameByRoleId = React.useMemo(() => {
    const map = new Map<number, RoleRow>();
    (roles ?? []).forEach((r) => map.set(r.roleId, r));
    return map;
  }, [roles]);
  const assignedRoles = (source?.roleIds ?? [])
    .map((rid) => userNameByRoleId.get(rid))
    .filter(Boolean) as RoleRow[];

  const onConfirm = () => {
    if (!confirm || !source) return;
    const { kind } = confirm;
    const copy = USER_ACTION_CONFIG[kind];
    const close = () => setConfirm(null);
    if (kind === 'deactivate' || kind === 'activate') {
      const next = kind === 'deactivate' ? 1 : 0;
      statusMutation.mutate(
        { userId: source.userId, status: next },
        {
          onSuccess: () => {
            setStatusOverride(next);
            if (kind === 'activate') setFirstLoginOverride(0);
            toast({ description: copy.success(source) });
            close();
          },
          onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    } else if (kind === 'resetPassword') {
      resetPwdMutation.mutate(source.userId, {
        onSuccess: (issued) => {
          setFirstLoginOverride(0);
          setOtp(issued);
          close();
        },
        onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
      });
    } else {
      forceLogoutMutation.mutate(source.userId, {
        onSuccess: () => {
          toast({ description: copy.success(source) });
          close();
        },
        onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
      });
    }
  };

  const pending =
    statusMutation.isPending || resetPwdMutation.isPending || forceLogoutMutation.isPending;
  const isActive = effectiveStatus === 0;

  if (id == null || (!isLoading && userPage != null && !source)) {
    return (
      <div className="space-y-4">
        <FormPageHeader backTo={USER_LIST_PATH} backLabel="User List" title="User Details" />
        <section className="rounded-lg border border-border/60 bg-card">
          <EmptyStateBlock
            title="This user no longer exists."
            description="The record may have been removed. Go back to the list."
            action={
              <Button variant="outline" onClick={() => router.push(USER_LIST_PATH)}>
                Back to User List
              </Button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to User List"
            onClick={() => router.push(USER_LIST_PATH)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-7">
                {source?.userName ?? 'User Details'}
              </h1>
              <UserStatusBadge status={effectiveStatus} />
            </div>
            {/* STATIC-FILLER(GAP-ADM-08): 无 userCode，meta 以 User ID #userId 展示。 */}
            <p className="text-sm text-muted-foreground">
              User ID: <b className="font-semibold text-foreground">#{id}</b>
            </p>
          </div>
        </div>
        {hasPerm('system:user') ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`${USER_EDIT_PATH}?id=${id}`)}>
              Edit
            </Button>
            {isActive ? (
              <>
                <Button variant="outline" onClick={() => { if (source) setConfirm({ kind: 'forceSignOut', user: source }); }}>
                  Force Sign Out
                </Button>
                <Button variant="destructive" onClick={() => { if (source) setConfirm({ kind: 'deactivate', user: source }); }}>
                  Deactivate
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => { if (source) setConfirm({ kind: 'activate', user: source }); }}>
                Activate
              </Button>
            )}
          </div>
        ) : undefined}
      </div>

      {isLoading || !source ? (
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <LoadingBlock />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailCard title="Basic Information">
            <div className="space-y-4">
              <DetailField label="Full Name">{source.userName}</DetailField>
              <DetailField label="Username">{source.loginName}</DetailField>
              <DetailField label="Type">
                <Badge variant="secondary">
                  {RBAC_USER_TYPE_LABEL[source.userType] ?? source.userType}
                </Badge>
              </DetailField>
            </div>
          </DetailCard>
          <DetailCard title="Contact Information">
            <div className="space-y-4">
              <DetailField label="Email">{source.email || <Dash />}</DetailField>
              <DetailField label="Phone Number">{source.phoneNumber || <Dash />}</DetailField>
            </div>
          </DetailCard>
          <DetailCard title="Account Activity">
            <div className="space-y-4">
              <DetailField label="First Login">
                <FirstLoginBadge firstLogin={effectiveFirstLogin} />
              </DetailField>
              {/* STATIC-FILLER(GAP-ADM-08): 后端无 Last Updated On 字段，原型该项为 fixture 重复值。 */}
            </div>
          </DetailCard>
          <DetailCard title="Roles">
            {assignedRoles.length > 0 ? (
              <div className="space-y-2">
                {assignedRoles.map((role) => (
                  <div
                    key={role.roleId}
                    className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{role.roleName}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {role.roleCode}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No role assigned.</p>
            )}
          </DetailCard>
        </div>
      )}

      {confirm ? (
        <ActionConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          icon={USER_ACTION_CONFIG[confirm.kind].icon}
          variant={USER_ACTION_CONFIG[confirm.kind].variant}
          title={USER_ACTION_CONFIG[confirm.kind].title}
          body1={USER_ACTION_CONFIG[confirm.kind].body1(confirm.user)}
          body2={USER_ACTION_CONFIG[confirm.kind].body2}
          confirmLabel={USER_ACTION_CONFIG[confirm.kind].confirmLabel}
          cancelLabel="Cancel"
          loading={pending}
          onConfirm={onConfirm}
        />
      ) : null}
      <OneTimePasswordDialog otp={otp} onClose={() => setOtp(null)} />
    </div>
  );
}

/* ============================================================ */
/* sys-role — 角色管理（原型 RoleManagementPage / RoleFormPage /  */
/* RoleDetailsPage）                                            */
/* ============================================================ */

type RoleActionKind = 'deactivate' | 'activate' | 'delete';

interface RoleActionCopy {
  icon: React.ComponentType<{ className?: string }>;
  variant: 'confirm' | 'destructive';
  title: string;
  body1: (role: RoleRow) => string;
  body2: string;
  confirmLabel: string;
  success: (role: RoleRow) => string;
}

/** 动作确认弹窗文案表（原型 ROLE_ACTION_CONFIG 逐字）。 */
const ROLE_ACTION_CONFIG: Record<RoleActionKind, RoleActionCopy> = {
  deactivate: {
    icon: CirclePause,
    variant: 'destructive',
    title: 'Deactivate Role',
    body1: (role) => `Deactivate role "${role.roleName}" (${role.roleCode})?`,
    body2: 'Once deactivated, the role stops granting its menus; users who rely on it lose those menus immediately.',
    confirmLabel: 'Deactivate',
    success: (role) => `Role "${role.roleName}" is deactivated.`,
  },
  activate: {
    icon: CircleCheck,
    variant: 'confirm',
    title: 'Activate Role',
    body1: (role) => `Activate role "${role.roleName}" (${role.roleCode})?`,
    body2: 'Once activated, the role grants its menus to the users assigned to it again.',
    confirmLabel: 'Activate',
    success: (role) => `Role "${role.roleName}" is activated.`,
  },
  delete: {
    icon: Trash2,
    variant: 'destructive',
    title: 'Delete Role',
    body1: (role) => `Delete role "${role.roleName}" (${role.roleCode})?`,
    body2: 'Once deleted, the role is removed from every user it is assigned to; those users keep only their remaining roles. This action cannot be undone.',
    confirmLabel: 'Delete',
    success: (role) => `Role "${role.roleName}" is deleted.`,
  },
};

interface RoleConfirmRequest {
  kind: RoleActionKind;
  role: RoleRow;
}

type RoleTableRow = RoleRow & { id: string };

function RoleBuiltInBadge() {
  return (
    <Badge variant="mute" size="sm" className="shrink-0 gap-1">
      <ShieldCheck className="size-3" aria-hidden="true" />
      Built-in
    </Badge>
  );
}

export function SysRoleListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const hasPerm = useKissenPerm();

  const [roleName, setRoleName] = React.useState('');
  const debouncedRoleName = useDebouncedValue(roleName, FILTER_DEBOUNCE_MS);

  const [params, setParams] = React.useState({
    pageNum: 1,
    pageSize: ROLE_PAGE_SIZE,
    filter: {} as { roleName?: string },
  });

  React.useEffect(() => {
    setParams((prev) => ({
      pageNum: 1,
      pageSize: prev.pageSize,
      filter: { roleName: debouncedRoleName || undefined },
    }));
  }, [debouncedRoleName]);

  const { data, isLoading, isError, dataUpdatedAt } = useRbacRoleListQuery(
    KISSEN_PROJECT_ID,
    params,
  );
  // STATIC-FILLER(GAP-ADM-08): 无 count 端点；Active/Inactive 统计来自 200 条探针窗口。
  const { data: statData } = useRbacRoleListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: PROBE_PAGE_SIZE,
    filter: {},
  });

  const updateMutation = useRoleUpdateMutation(KISSEN_PROJECT_ID);
  const deleteMutation = useRoleDeleteMutation(KISSEN_PROJECT_ID);

  const [confirm, setConfirm] = React.useState<RoleConfirmRequest | null>(null);
  const [assignTarget, setAssignTarget] = React.useState<RoleRow | null>(null);

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;
  const statRows = statData?.data ?? [];
  const activeCount = statRows.filter((r) => r.status === 0).length;
  const isFiltered = !!debouncedRoleName;

  const tableData = React.useMemo<RoleTableRow[]>(
    () =>
      rows
        // Role Name 单输入：服务端 roleName + 客户端 roleCode 子串双重过滤（后端 roleCode 为精确匹配，此处放宽为子串）。
        .filter(
          (r) =>
            !debouncedRoleName ||
            r.roleName.toLowerCase().includes(debouncedRoleName.toLowerCase()) ||
            r.roleCode.toLowerCase().includes(debouncedRoleName.toLowerCase()),
        )
        .map((r) => ({ ...r, id: String(r.roleId) })),
    [rows, debouncedRoleName],
  );

  const { sorted, toggle, sortState } = useProtoSort<RoleTableRow>(
    tableData,
    {
      roleName: { value: (r) => r.roleName },
      type: { value: (r) => (r.roleType === 0 ? 'Built-in' : 'Custom') },
      description: { value: (r) => r.remarks },
      createdOn: { value: (r) => r.createTime, defaultDir: 'desc' },
      status: { value: (r) => protoStatusRank(PROTO_USER_STATUS, r.status) },
    },
    'createdOn',
    'desc',
    true,
  );

  const onConfirm = React.useCallback(() => {
    if (!confirm) return;
    const { kind, role } = confirm;
    const copy = ROLE_ACTION_CONFIG[kind];
    const close = () => setConfirm(null);
    if (kind === 'delete') {
      deleteMutation.mutate(role.roleId, {
        onSuccess: () => {
          toast({ description: copy.success(role) });
          close();
        },
        onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
      });
    } else {
      updateMutation.mutate(
        { roleId: role.roleId, status: kind === 'deactivate' ? 1 : 0 },
        {
          onSuccess: () => {
            toast({ description: copy.success(role) });
            close();
          },
          onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    }
  }, [confirm, deleteMutation, updateMutation, toast]);

  const columns = React.useMemo<ColumnDef<RoleTableRow>[]>(
    () => [
      {
        accessorKey: 'roleName',
        header: () => (
          <ProtoSortHeader label="Role Name" columnKey="roleName" toggle={toggle} sortState={sortState('roleName')} />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold">{row.original.roleName}</span>
              {row.original.roleType === 0 ? <RoleBuiltInBadge /> : null}
            </div>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {row.original.roleCode}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'roleType',
        header: () => (
          <ProtoSortHeader label="Type" columnKey="type" toggle={toggle} sortState={sortState('type')} />
        ),
        cell: ({ row }) => (row.original.roleType === 0 ? 'Built-in' : 'Custom'),
      },
      {
        accessorKey: 'remarks',
        header: () => (
          <ProtoSortHeader label="Description" columnKey="description" toggle={toggle} sortState={sortState('description')} />
        ),
        cell: ({ row }) => (
          <span className="block max-w-[320px] truncate" title={row.original.remarks ?? undefined}>
            {row.original.remarks || <Dash />}
          </span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: () => (
          <ProtoSortHeader label="Created on (UTC+8)" columnKey="createdOn" toggle={toggle} sortState={sortState('createdOn')} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatUtc8(row.original.createTime)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <ProtoSortHeader label="Status" columnKey="status" toggle={toggle} sortState={sortState('status')} />
        ),
        cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original;
          const isBuiltIn = r.roleType === 0;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  stashRow(ROLE_STASH, r.roleId, r);
                  router.push(`${ROLE_DETAIL_PATH}?id=${r.roleId}`);
                }}
              >
                Details
              </Button>
              <DropdownMenu>
                <RowMenuTrigger ariaLabel={`More actions for ${r.roleName}`} />
                <DropdownMenuContent align="end">
                  {!isBuiltIn ? (
                    <DropdownMenuItem onClick={() => router.push(`${ROLE_EDIT_PATH}?id=${r.roleId}`)}>
                      Edit
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => setAssignTarget(r)}>
                    Assign Menus
                  </DropdownMenuItem>
                  {!isBuiltIn ? (
                    <>
                      {r.status === 0 ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirm({ kind: 'deactivate', role: r })}
                        >
                          Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setConfirm({ kind: 'activate', role: r })}>
                          Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setConfirm({ kind: 'delete', role: r })}
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [router, toggle, sortState],
  );

  const emptyMessage = isFiltered ? 'No roles found.' : 'No roles yet.';

  return (
    <div className="space-y-4">
      <ListPageHeader
        title="Role Management"
        description="Roles group menus into reusable authorization profiles."
        actions={
          hasPerm('system:role') ? (
            <Button onClick={() => router.push(ROLE_CREATE_PATH)}>
              <Plus className="size-4" aria-hidden="true" />
              Add Role
            </Button>
          ) : undefined
        }
      />

      {/* STATIC-FILLER(GAP-ADM-08): 无 count 端点；total 用分页 total，Active/Inactive 来自探针窗口。 */}
      <StatGrid
        items={[
          { label: 'Total Roles', value: paginationMeta?.total ?? statRows.length, help: 'All roles defined in the system.', tone: 'primary' },
          { label: 'Active', value: activeCount, help: 'Effective authorization sources.', tone: 'success' },
          { label: 'Inactive', value: statRows.length - activeCount, help: 'Suspended from authorization.', tone: 'warning' },
        ]}
      />

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold leading-6">Roles</h2>
            {!isLoading && paginationMeta ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {paginationMeta.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Role Name" htmlFor="role-filter-name">
            <Input
              id="role-filter-name"
              placeholder="Fuzzy match"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            />
          </FilterField>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setRoleName('')}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={sorted}
              isLoading={isLoading}
              emptyMessage={emptyMessage}
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
          )}
        </div>
      </section>

      {confirm ? (
        <ActionConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          icon={ROLE_ACTION_CONFIG[confirm.kind].icon}
          variant={ROLE_ACTION_CONFIG[confirm.kind].variant}
          title={ROLE_ACTION_CONFIG[confirm.kind].title}
          body1={ROLE_ACTION_CONFIG[confirm.kind].body1(confirm.role)}
          body2={ROLE_ACTION_CONFIG[confirm.kind].body2}
          confirmLabel={ROLE_ACTION_CONFIG[confirm.kind].confirmLabel}
          cancelLabel="Cancel"
          loading={updateMutation.isPending || deleteMutation.isPending}
          onConfirm={onConfirm}
        />
      ) : null}

      <AssignMenusDialog role={assignTarget} onClose={() => setAssignTarget(null)} />
    </div>
  );
}

/** Assign Menus 就地弹窗（原型 D6：列表 ⋮ 与详情页共用；勾选口径=叶子）。 */
function AssignMenusDialog({
  role,
  onClose,
}: {
  role: RoleRow | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: menuTree, isLoading: treeLoading } = useMenuTreeQuery(
    KISSEN_PROJECT_ID,
    role != null,
  );
  const { data: grantedIds, isLoading: idsLoading } = useRoleMenuIdsQuery(
    KISSEN_PROJECT_ID,
    role?.roleId,
    role != null,
  );
  const assignMutation = useRoleAssignMenuMutation(KISSEN_PROJECT_ID);

  const [checkedLeaves, setCheckedLeaves] = React.useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);

  const tree = menuTree ?? [];
  const leaves = React.useMemo(() => collectLeaves(tree), [tree]);
  const parentMap = React.useMemo(() => buildParentMap(tree), [tree]);

  React.useEffect(() => {
    if (role != null && grantedIds != null && !hydrated) {
      // 后端返回全量（含目录）节点；勾选集只保留叶子。
      const leafOnly = (grantedIds ?? []).filter((id) => leaves.some((n) => n.menuId === id));
      setCheckedLeaves(new Set(leafOnly));
      setHydrated(true);
    }
  }, [role, grantedIds, leaves, hydrated]);

  React.useEffect(() => {
    setHydrated(false);
    setCheckedLeaves(new Set());
  }, [role?.roleId]);

  const onSave = () => {
    if (!role) return;
    if (checkedLeaves.size === 0) {
      setClearOpen(true);
      return;
    }
    const menuIds = collectMenuIds(checkedLeaves, parentMap);
    assignMutation.mutate(
      { roleId: role.roleId, menuIds },
      {
        onSuccess: () => {
          toast({
            description: `Menu access updated for "${role.roleName}" (${checkedLeaves.size} of ${leaves.length} menus).`,
          });
          onClose();
        },
        onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
      },
    );
  };

  const onClearConfirmed = () => {
    if (!role) return;
    setClearOpen(false);
    assignMutation.mutate(
      { roleId: role.roleId, menuIds: [] },
      {
        onSuccess: () => {
          toast({
            description: `Menu access updated for "${role.roleName}" (0 of ${leaves.length} menus).`,
          });
          onClose();
        },
        onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
      },
    );
  };

  return (
    <>
      <Dialog open={role != null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Assign Menus</DialogTitle>
            <DialogDescription>
              {role ? `Assign menu access for ${role.roleName} (${role.roleCode}).` : ''}
            </DialogDescription>
          </DialogHeader>
          {treeLoading || idsLoading ? (
            <LoadingBlock />
          ) : (
            <ScrollArea className="h-72 rounded-md border">
              <div className="p-2">
                {tree.map((node) => (
                  <MenuCheckTreeNode
                    key={node.menuId}
                    node={node}
                    checkedLeaves={checkedLeaves}
                    onToggle={(n) =>
                      setCheckedLeaves((prev) => toggleNode(n, prev))
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={assignMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActionConfirmDialog
        open={clearOpen}
        onOpenChange={(o) => !o && setClearOpen(false)}
        icon={ListTree}
        variant="destructive"
        title="Clear Menus"
        body1="This will clear all menus of this role."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        loading={assignMutation.isPending}
        onConfirm={onClearConfirmed}
      />
    </>
  );
}

interface RoleFormValues {
  roleCode: string;
  roleName: string;
  remarks: string;
}

const ROLE_NAME_MAX = 64;

export function SysRoleFormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));
  const isEdit = !!id;

  const { data: rolePage, isLoading } = useRbacRoleListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: PROBE_PAGE_SIZE, filter: {} },
    isEdit,
  );
  const { data: menuTree } = useMenuTreeQuery(KISSEN_PROJECT_ID);
  const { data: grantedIds } = useRoleMenuIdsQuery(KISSEN_PROJECT_ID, id, isEdit);

  const saveMutation = useRoleSaveMutation(KISSEN_PROJECT_ID);
  const updateMutation = useRoleUpdateMutation(KISSEN_PROJECT_ID);

  const source = id != null ? (rolePage?.data ?? []).find((r) => r.roleId === id) : undefined;
  const isBuiltIn = source?.roleType === 0;
  const loaded = !isEdit || (!isLoading && rolePage != null);

  const tree = menuTree ?? [];
  const leaves = React.useMemo(() => collectLeaves(tree), [tree]);
  const parentMap = React.useMemo(() => buildParentMap(tree), [tree]);
  const baseLeafIds = React.useMemo(() => {
    const granted = new Set(grantedIds ?? []);
    return leaves.filter((n) => granted.has(n.menuId)).map((n) => n.menuId);
    // grantedIds 随 edit 回显查询到位后一次性定格基准。
  }, [grantedIds, leaves]);
  const [checkedLeaves, setCheckedLeaves] = React.useState<Set<number>>(new Set());
  const [treeHydrated, setTreeHydrated] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [assignTarget, setAssignTarget] = React.useState<RoleRow | null>(null);

  React.useEffect(() => {
    if (isEdit && grantedIds != null && !treeHydrated) {
      setCheckedLeaves(new Set(baseLeafIds));
      setTreeHydrated(true);
    }
  }, [isEdit, grantedIds, baseLeafIds, treeHydrated]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<RoleFormValues>({
    defaultValues: { roleCode: '', roleName: '', remarks: '' },
  });

  React.useEffect(() => {
    if (isEdit && source) {
      reset({ roleCode: source.roleCode, roleName: source.roleName, remarks: source.remarks ?? '' });
    }
  }, [isEdit, source, reset]);

  const roleNameValue = watch('roleName');
  const rolesDirty =
    (isEdit ? treeHydrated && setEquals(checkedLeaves, new Set(baseLeafIds)) === false : checkedLeaves.size > 0);
  const formDirty = isDirty || rolesDirty;

  const onValid = (values: RoleFormValues) => {
    const menuIds = collectMenuIds(checkedLeaves, parentMap);
    if (id != null) {
      updateMutation.mutate(
        {
          roleId: id,
          roleName: values.roleName,
          remarks: values.remarks || undefined,
          menuIds,
        },
        {
          onSuccess: () => {
            toast({ description: `Role "${values.roleName}" is updated.` });
            router.push(ROLE_LIST_PATH);
          },
          onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    } else {
      saveMutation.mutate(
        {
          roleCode: values.roleCode,
          roleName: values.roleName,
          remarks: values.remarks || undefined,
          menuIds,
        },
        {
          onSuccess: () => {
            toast({
              description: `Role "${values.roleName}" is created (Role Code ${values.roleCode}).`,
            });
            router.push(ROLE_LIST_PATH);
          },
          onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    }
  };

  const onCancel = () => {
    if (formDirty) {
      setDiscardOpen(true);
    } else {
      router.push(ROLE_LIST_PATH);
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;

  if (isEdit && id != null && isBuiltIn) {
    return (
      <div className="space-y-4">
        <FormPageHeader backTo={ROLE_LIST_PATH} backLabel="Role List" title="Edit Role" />
        <section className="rounded-lg border border-border/60 bg-card">
          <EmptyStateBlock
            title="This built-in role cannot be modified."
            description="Built-in roles are provided by the system. You can still review them or assign their menus."
            action={
              <div className="flex gap-2">
                <Button onClick={() => setAssignTarget(source ?? null)}>Assign Menus</Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`${ROLE_DETAIL_PATH}?id=${id}`)}
                >
                  View Role
                </Button>
              </div>
            }
          />
        </section>
        <AssignMenusDialog role={assignTarget} onClose={() => setAssignTarget(null)} />
      </div>
    );
  }

  if (isEdit && loaded && !source) {
    return (
      <div className="space-y-4">
        <FormPageHeader backTo={ROLE_LIST_PATH} backLabel="Role List" title="Edit Role" />
        <section className="rounded-lg border border-border/60 bg-card">
          <EmptyStateBlock
            title="This role no longer exists."
            description="The record may have been removed. Go back to the list."
            action={
              <Button variant="outline" onClick={() => router.push(ROLE_LIST_PATH)}>
                Back to Role List
              </Button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormPageHeader
        backTo={ROLE_LIST_PATH}
        backLabel="Role List"
        title={isEdit ? 'Edit Role' : 'Add Role'}
        description={
          isEdit
            ? `Update the profile of role ${source?.roleCode ?? ''}.`
            : 'A new role is created as a custom role and starts without any menu access.'
        }
      />

      <form onSubmit={handleSubmit(onValid)} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DetailCard title="Basic Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isEdit ? (
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium leading-snug">Role Code</span>
                  <Input disabled value={source?.roleCode ?? ''} />
                  <p className="text-xs text-muted-foreground">Role Code is immutable after creation.</p>
                </div>
              ) : (
                <FormField
                  name="roleCode"
                  label="Role Code"
                  error={errors.roleCode?.message}
                  {...register('roleCode', {
                    required: 'Role Code is required.',
                    validate: (v) => v.trim().length > 0 || 'Role Code is required.',
                  })}
                  placeholder="Unique code (immutable after creation)"
                />
              )}
              <div className="space-y-1.5">
                  <span className="block text-sm font-medium leading-snug">Type</span>
                  <Input disabled value="Custom" />
                  <p className="text-xs text-muted-foreground">Role type is assigned by the system.</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FormField
                  name="roleName"
                  label="Role Name"
                  error={errors.roleName?.message}
                  {...register('roleName', {
                    required: 'Role Name is required.',
                    validate: (v) => v.trim().length > 0 || 'Role Name is required.',
                    maxLength: { value: ROLE_NAME_MAX, message: `Enter at most ${ROLE_NAME_MAX} characters.` },
                  })}
                  placeholder="Shown in role lists and user assignment"
                />
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  {(roleNameValue ?? '').length}/{ROLE_NAME_MAX}
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <span className="block text-sm font-medium leading-snug" htmlFor="role-form-remarks">
                  Description
                </span>
                <Textarea
                  id="role-form-remarks"
                  rows={3}
                  placeholder="What this role is for (optional)"
                  {...register('remarks')}
                />
              </div>
            </div>
          </DetailCard>

          <DetailCard
            title="Assigned Menus"
            description="Menu access granted to users with this role. Changes take effect after saving."
          >
            <div className="max-h-80 overflow-y-auto rounded-md border p-2">
              {tree.map((node) => (
                <MenuCheckTreeNode
                  key={node.menuId}
                  node={node}
                  checkedLeaves={checkedLeaves}
                  onToggle={(n) =>
                    setCheckedLeaves((prev) => toggleNode(n, prev))
                  }
                />
              ))}
            </div>
          </DetailCard>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-12 shrink-0 place-items-center rounded-md bg-muted font-semibold text-muted-foreground"
              >
                {initialsOf(roleNameValue ?? '')}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{roleNameValue || 'New Role'}</div>
                <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {isEdit ? source?.roleCode : <Dash />}
                </div>
              </div>
            </div>
            {checkedLeaves.size > 0 ? (
              <div className="mt-4 border-t border-border/50 pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Assigned Menus
                  <Badge variant="mute" size="sm">{checkedLeaves.size}</Badge>
                </div>
              </div>
            ) : (
              <Alert className="mt-4">
                The role is created with Active status and without any menu access.
              </Alert>
            )}
          </section>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Save
            </Button>
          </div>
        </div>
      </form>

      <DiscardChangesDialog
        open={discardOpen}
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          router.push(ROLE_LIST_PATH);
        }}
      />
    </div>
  );
}

function setEquals(a: Set<number>, b: Set<number>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** 只读菜单树行（详情 Assigned Menus 卡：勾选=已授权，未授权置灰）。 */
function MenuGrantedTreeNode({
  node,
  depth,
  grantedIds,
}: {
  node: MenuTreeRespVO;
  depth: number;
  grantedIds: Set<number>;
}) {
  const children = node.children ?? [];
  const granted = grantedIds.has(node.menuId);
  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 rounded px-2 py-1.5',
          granted ? 'text-foreground' : 'text-muted-foreground',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {children.length > 0 ? (
          <ListTree
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}
        <Checkbox
          checked={granted}
          disabled
          aria-hidden="true"
          className={granted ? undefined : 'opacity-40'}
        />
        <span className={cn('truncate text-sm', granted ? 'font-medium' : undefined)}>
          {node.menuName}
        </span>
      </div>
      {children.map((child) => (
        <MenuGrantedTreeNode
          key={child.menuId}
          node={child}
          depth={depth + 1}
          grantedIds={grantedIds}
        />
      ))}
    </div>
  );
}

export function SysRoleDetailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const hasPerm = useKissenPerm();
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const id = parseNum(searchParams.get('id'));

  const { data: rolePage, isLoading } = useRbacRoleListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: PROBE_PAGE_SIZE, filter: {} },
    id != null,
  );
  const { data: menuTree } = useMenuTreeQuery(KISSEN_PROJECT_ID, id != null);
  const { data: grantedIds, isLoading: menuIdsLoading } = useRoleMenuIdsQuery(
    KISSEN_PROJECT_ID,
    id,
    id != null,
  );
  // STATIC-FILLER(GAP-ADM-08): 无按角色查用户的端点；Assigned Users 来自 200 条用户探针扫描。
  const { data: userProbe } = useRbacUserListQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: PROBE_PAGE_SIZE,
    filter: {},
  });

  const updateMutation = useRoleUpdateMutation(KISSEN_PROJECT_ID);
  const [statusOverride, setStatusOverride] = React.useState<number | null>(null);
  const [confirm, setConfirm] = React.useState<RoleConfirmRequest | null>(null);
  const [assignTarget, setAssignTarget] = React.useState<RoleRow | null>(null);

  const source = id != null ? (rolePage?.data ?? []).find((r) => r.roleId === id) : undefined;
  const effectiveStatus = statusOverride ?? source?.status ?? 0;

  const assignDeepLink = searchParams.get('assignMenus') === '1';
  React.useEffect(() => {
    if (assignDeepLink && source) {
      setAssignTarget(source);
      // 深链消费后 strip 参数，避免刷新重复打开。
      const next = new URLSearchParams(searchParams);
      next.delete('assignMenus');
      navigate(
        { pathname: ROLE_DETAIL_PATH, search: next.toString() ? `?${next.toString()}` : '' },
        { replace: true },
      );
    }
  }, [assignDeepLink, source, searchParams, navigate]);

  const assignedUsers = React.useMemo(
    () => (userProbe?.data ?? []).filter((u) => (u.roleIds ?? []).includes(id ?? -1)),
    [userProbe, id],
  );

  const onConfirm = () => {
    if (!confirm || !source) return;
    const { kind, role } = confirm;
    const copy = ROLE_ACTION_CONFIG[kind];
    updateMutation.mutate(
      { roleId: role.roleId, status: kind === 'deactivate' ? 1 : 0 },
      {
        onSuccess: () => {
          setStatusOverride(kind === 'deactivate' ? 1 : 0);
          toast({ description: copy.success(role) });
          setConfirm(null);
        },
        onError: (e) => toast({ description: (e as Error).message, variant: 'destructive' }),
      },
    );
  };

  const grantedIdSet = React.useMemo(() => new Set(grantedIds ?? []), [grantedIds]);

  if (id == null || (!isLoading && rolePage != null && !source)) {
    return (
      <div className="space-y-4">
        <FormPageHeader backTo={ROLE_LIST_PATH} backLabel="Role List" title="Role Details" />
        <section className="rounded-lg border border-border/60 bg-card">
          <EmptyStateBlock
            title="This role no longer exists."
            description="The record may have been removed. Go back to the list."
            action={
              <Button variant="outline" onClick={() => router.push(ROLE_LIST_PATH)}>
                Back to Role List
              </Button>
            }
          />
        </section>
      </div>
    );
  }

  const isBuiltIn = source?.roleType === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to Role List"
            onClick={() => router.push(ROLE_LIST_PATH)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-7">
                {source?.roleName ?? 'Role Details'}
              </h1>
              <UserStatusBadge status={effectiveStatus} />
            </div>
            <p className="text-sm text-muted-foreground">
              Role Code: <b className="font-mono font-semibold text-foreground">{source?.roleCode}</b>
              {' | '}Created on{' '}
              <span className="tabular-nums">{source ? formatUtc8(source.createTime) : ''}</span>
            </p>
          </div>
        </div>
        {hasPerm('system:role') && source ? (
          <div className="flex items-center gap-2">
            {!isBuiltIn ? (
              <Button variant="outline" onClick={() => router.push(`${ROLE_EDIT_PATH}?id=${id}`)}>
                Edit
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setAssignTarget(source)}>
              Assign Menus
            </Button>
            {!isBuiltIn ? (
              effectiveStatus === 0 ? (
                <Button
                  variant="destructive"
                  onClick={() => setConfirm({ kind: 'deactivate', role: source })}
                >
                  Deactivate
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setConfirm({ kind: 'activate', role: source })}>
                  Activate
                </Button>
              )
            ) : null}
          </div>
        ) : undefined}
      </div>

      {isLoading || !source ? (
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <LoadingBlock />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailCard title="Basic Information">
            <div className="space-y-4">
              <DetailField label="Role Code">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {source.roleCode}
                </code>
              </DetailField>
              <DetailField label="Role Name">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{source.roleName}</span>
                  {isBuiltIn ? <RoleBuiltInBadge /> : null}
                </span>
              </DetailField>
              <DetailField label="Type">{isBuiltIn ? 'Built-in' : 'Custom'}</DetailField>
              <DetailField label="Description">{source.remarks || <Dash />}</DetailField>
            </div>
          </DetailCard>

          <DetailCard title="Role Activity">
            <div className="space-y-4">
              <DetailField label="Created on">
                <span className="tabular-nums">{formatUtc8(source.createTime)}</span>
              </DetailField>
              {/* STATIC-FILLER(GAP-ADM-08): Assigned Users 来自 200 条用户探针扫描。 */}
              <DetailField label="Assigned Users">
                {assignedUsers.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {assignedUsers.slice(0, 3).map((u) => (
                      <Badge key={u.userId} variant="secondary" className="gap-1.5">
                        <span
                          aria-hidden="true"
                          className="grid size-4 place-items-center rounded-full bg-muted-foreground/15 text-[9px] font-semibold"
                        >
                          {initialsOf(u.userName)}
                        </span>
                        {u.userName}
                      </Badge>
                    ))}
                    {assignedUsers.length > 3 ? (
                      <Badge variant="mute" size="sm">+{assignedUsers.length - 3}</Badge>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No user assigned.</span>
                )}
              </DetailField>
            </div>
          </DetailCard>

          <DetailCard
            title="Assigned Menus"
            description="Menu access granted to users with this role."
            className="md:col-span-2"
          >
            {menuIdsLoading ? (
              <LoadingBlock />
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-md border p-2">
                {(menuTree ?? []).map((node) => (
                  <MenuGrantedTreeNode
                    key={node.menuId}
                    node={node}
                    depth={0}
                    grantedIds={grantedIdSet}
                  />
                ))}
              </div>
            )}
          </DetailCard>
        </div>
      )}

      {confirm ? (
        <ActionConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          icon={ROLE_ACTION_CONFIG[confirm.kind].icon}
          variant={ROLE_ACTION_CONFIG[confirm.kind].variant}
          title={ROLE_ACTION_CONFIG[confirm.kind].title}
          body1={ROLE_ACTION_CONFIG[confirm.kind].body1(confirm.role)}
          body2={ROLE_ACTION_CONFIG[confirm.kind].body2}
          confirmLabel={ROLE_ACTION_CONFIG[confirm.kind].confirmLabel}
          cancelLabel="Cancel"
          loading={updateMutation.isPending}
          onConfirm={onConfirm}
        />
      ) : null}

      <AssignMenusDialog role={assignTarget} onClose={() => setAssignTarget(null)} />
    </div>
  );
}

/* ============================================================ */
/* sys-menu — 菜单管理（原型 MenuManagementPage + 旧实现后端字段） */
/* ============================================================ */

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
  checkedLeaves: Set<number>,
  parentMap: Map<number, number>,
): number[] {
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
  checkedLeaves,
  onToggle,
}: {
  node: MenuTreeRespVO;
  checkedLeaves: Set<number>;
  onToggle: (n: MenuTreeRespVO) => void;
}) {
  const st = nodeCheckState(node, checkedLeaves);
  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1">
        <Checkbox
          checked={st.indeterminate ? 'indeterminate' : st.checked}
          onCheckedChange={() => onToggle(node)}
          aria-label={node.menuName}
        />
        <span className="text-sm">{node.menuName}</span>
        <Badge variant="outline" className="text-[10px]">
          {MENU_TYPE_LABEL[node.menuType]}
        </Badge>
        {st.indeterminate ? (
          <span className="text-xs text-muted-foreground">Partial</span>
        ) : null}
      </div>
      {node.children?.length ? (
        <div className="ml-4 border-l border-border/60">
          {node.children.map((c) => (
            <MenuCheckTreeNode
              key={c.menuId}
              node={c}
              checkedLeaves={checkedLeaves}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

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

/** 树中按 menuId 递归查找节点（dirty 基线用）。 */
function findMenuNode(
  nodes: MenuTreeRespVO[],
  menuId: number,
): MenuTreeRespVO | undefined {
  for (const n of nodes) {
    if (n.menuId === menuId) return n;
    const hit = n.children ? findMenuNode(n.children, menuId) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/** 节点原始数据 → 表单基线（selectNode 与 dirty 比较共用同一映射，防漂移）。 */
function menuNodeToForm(node: MenuTreeRespVO): MenuFormState {
  return {
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
  };
}

function countMenuNodes(nodes: MenuTreeRespVO[]): number {
  return nodes.reduce(
    (sum, n) => sum + 1 + (n.children ? countMenuNodes(n.children) : 0),
    0,
  );
}

/** 菜单树过滤：节点自身命中保留整组；否则保留命中自身或后代的子树。 */
function filterMenuTree(
  nodes: MenuTreeRespVO[],
  query: string,
): MenuTreeRespVO[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const nodeMatches = (n: MenuTreeRespVO): boolean =>
    n.menuName.toLowerCase().includes(q) ||
    (n.menuNameEn ?? '').toLowerCase().includes(q) ||
    n.menuKey.toLowerCase().includes(q);
  const walk = (n: MenuTreeRespVO): MenuTreeRespVO | null => {
    if (nodeMatches(n)) return n;
    const children = (n.children ?? [])
      .map(walk)
      .filter((c): c is MenuTreeRespVO => c != null);
    if (children.length === 0) return null;
    return { ...n, children };
  };
  return nodes.map(walk).filter((n): n is MenuTreeRespVO => n != null);
}

function MenuTreeNode({
  node,
  selectedKey,
  onSelect,
}: {
  node: MenuTreeRespVO;
  selectedKey: number | null;
  onSelect: (n: MenuTreeRespVO) => void;
}) {
  const isSelected = selectedKey === node.menuId;
  return (
    <div>
      <button
        type="button"
        aria-current={isSelected ? 'true' : undefined}
        onClick={() => onSelect(node)}
        className={cn(
          'relative flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent',
          isSelected && 'bg-accent font-medium',
        )}
      >
        {isSelected ? (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          />
        ) : null}
        <span className="truncate">{node.menuName}</span>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {MENU_TYPE_LABEL[node.menuType]}
        </Badge>
      </button>
      {node.children?.length ? (
        <div className="ml-4 border-l border-border/60">
          {node.children.map((c) => (
            <MenuTreeNode
              key={c.menuId}
              node={c}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 接口权限编辑器（源 menu-permission/list + save，全量替换）。 */
function MenuPermEditor({ menuKey }: { menuKey: string }) {
  const { toast } = useToast();
  const { data: perms, isLoading } = useMenuPermListQuery(KISSEN_PROJECT_ID, menuKey);
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
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API permissions.</p>
          ) : null}
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={it.url}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, url: e.target.value } : p)),
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
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
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
                onSuccess: () => toast({ description: 'API permissions saved' }),
                onError: (e) =>
                  toast({ description: (e as Error).message, variant: 'destructive' }),
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
  const { toast } = useToast();
  const { data: tree, isLoading } = useMenuTreeQuery(KISSEN_PROJECT_ID);
  const saveMutation = useMenuSaveMutation(KISSEN_PROJECT_ID);
  const updateMutation = useMenuUpdateMutation(KISSEN_PROJECT_ID);
  const deleteMutation = useMenuDeleteMutation(KISSEN_PROJECT_ID);

  const [selectedKey, setSelectedKey] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<'view' | 'new-root' | 'new-child'>('view');
  const [form, setForm] = React.useState<MenuFormState>(EMPTY_MENU_FORM);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [menuFilter, setMenuFilter] = React.useState('');

  const patch = (p: Partial<MenuFormState>) => setForm((prev) => ({ ...prev, ...p }));

  const selectNode = (node: MenuTreeRespVO) => {
    setSelectedKey(node.menuId);
    setMode('view');
    setForm(menuNodeToForm(node));
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
      toast({ description: 'Menu Key is required', variant: 'destructive' });
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
          onSuccess: () =>
            toast({ description: `Menu node "${form.menuName}" updated.` }),
          onError: (e) =>
            toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    } else {
      saveMutation.mutate(payload, {
        onSuccess: () => {
          toast({
            description:
              mode === 'new-root'
                ? `Root menu "${form.menuName}" added.`
                : `Menu "${form.menuName}" added.`,
          });
          setMode('view');
        },
        onError: (e) =>
          toast({ description: (e as Error).message, variant: 'destructive' }),
      });
    }
  };

  const onDeleteConfirmed = () => {
    if (form.menuId == null) return;
    deleteMutation.mutate(form.menuId, {
      onSuccess: () => {
        toast({ description: 'Menu deleted' });
        setDeleteOpen(false);
        setMode('view');
        setForm(EMPTY_MENU_FORM);
        setSelectedKey(null);
      },
      onError: (e) => {
        setDeleteOpen(false);
        toast({ description: (e as Error).message, variant: 'destructive' });
      },
    });
  };

  const isFormDisabled = saveMutation.isPending || updateMutation.isPending;

  /** 视觉 dirty 提示（零交互）：view 比较选中节点原始值，new 比较创建初始值；纯派生。 */
  const isDirty = React.useMemo(() => {
    let base: MenuFormState | undefined;
    if (mode === 'view') {
      if (selectedKey == null || form.menuId !== selectedKey) return false;
      const node = findMenuNode(tree ?? [], selectedKey);
      base = node && menuNodeToForm(node);
    } else {
      base = {
        ...EMPTY_MENU_FORM,
        parentId: mode === 'new-root' ? 0 : selectedKey ?? 0,
        menuType: mode === 'new-root' ? 1 : 3,
      };
    }
    if (!base) return false;
    return (
      form.menuName !== base.menuName ||
      form.menuNameEn !== base.menuNameEn ||
      form.menuKey !== base.menuKey ||
      form.parentId !== base.parentId ||
      form.menuType !== base.menuType ||
      form.orderNum !== base.orderNum ||
      form.visible !== base.visible ||
      form.menuUrl !== base.menuUrl ||
      form.icon !== base.icon
    );
  }, [mode, selectedKey, form, tree]);

  const visibleTree = React.useMemo(
    () => filterMenuTree(tree ?? [], menuFilter),
    [tree, menuFilter],
  );
  const totalNodes = React.useMemo(() => countMenuNodes(tree ?? []), [tree]);
  const hasDraft = mode !== 'view' || selectedKey != null;

  return (
    <div className="space-y-4">
      <ListPageHeader title="Menu Management" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        {/* 左：Menu Structure 树（结构头 + 计数徽章 + 过滤） */}
        <section className="h-fit overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="border-b border-border/50 px-4 pb-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold leading-6">Menu Structure</h2>
                <Badge variant="mute" size="sm" className="tabular-nums">
                  {totalNodes} nodes
                </Badge>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={startNewRoot}>
                <Plus className="size-4" aria-hidden="true" />
                Add Root Menu
              </Button>
            </div>
            <div className="relative mt-3">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Filter menus"
                placeholder="Filter menus…"
                value={menuFilter}
                onChange={(e) => setMenuFilter(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {isLoading ? (
              <LoadingBlock />
            ) : (tree ?? []).length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No menus</p>
            ) : visibleTree.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No menus match this filter.
              </p>
            ) : (
              visibleTree.map((n) => (
                <MenuTreeNode
                  key={n.menuId}
                  node={n}
                  selectedKey={selectedKey}
                  onSelect={selectNode}
                />
              ))
            )}
          </div>
        </section>

        {/* 右：Menu Details 表单 + 接口权限 */}
        <div className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-6">Menu Details</h2>
                {hasDraft ? (
                  <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">Node Key:</span>
                    <code className="truncate rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">
                      {form.menuKey || <Dash />}
                    </code>
                  </div>
                ) : null}
              </div>
              {mode === 'view' && form.menuId != null && isDirty ? (
                <span className="text-xs font-medium text-warning">● Unsaved changes</span>
              ) : null}
            </div>
            <div className="p-4">
              {!hasDraft ? (
                <p className="text-sm text-muted-foreground">
                  Select a menu node on the left to view/edit, or click Add Root Menu.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="menu-form-name">
                        Menu Name<span className="text-destructive"> *</span>
                      </Label>
                      <Input
                        id="menu-form-name"
                        value={form.menuName}
                        onChange={(e) => patch({ menuName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="menu-form-name-en">Menu Name (EN)</Label>
                      <Input
                        id="menu-form-name-en"
                        value={form.menuNameEn}
                        onChange={(e) => patch({ menuNameEn: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="menu-form-key">
                        Menu Key<span className="text-destructive"> *</span>
                      </Label>
                      <Input
                        id="menu-form-key"
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
                      <Label htmlFor="menu-form-order">Sort Order</Label>
                      <Input
                        id="menu-form-order"
                        type="number"
                        value={form.orderNum}
                        onChange={(e) => patch({ orderNum: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Visible</Label>
                      <Select
                        value={String(form.visible)}
                        onValueChange={(v) => patch({ visible: Number(v) as 0 | 1 })}
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
                      <Label htmlFor="menu-form-url">Route Path</Label>
                      <Input
                        id="menu-form-url"
                        value={form.menuUrl}
                        onChange={(e) => patch({ menuUrl: e.target.value })}
                        placeholder="Frontend route, e.g. /system/user"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="menu-form-icon">Icon</Label>
                      <Input
                        id="menu-form-icon"
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
                    {mode === 'view' ? (
                      <>
                        <Button type="button" variant="outline" onClick={startNewChild}>
                          Add Submenu
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteOpen(true)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </section>

          {mode === 'view' && selectedKey != null && form.menuKey ? (
            <DetailCard title="API Permissions">
              <MenuPermEditor menuKey={form.menuKey} />
            </DetailCard>
          ) : null}
        </div>
      </div>

      <ActionConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        icon={Trash2}
        variant="destructive"
        title="Delete Menu"
        body1={`Delete menu "${form.menuName}"?`}
        body2="Menus with submenus or references will be rejected by the system."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteMutation.isPending}
        onConfirm={onDeleteConfirmed}
      />
    </div>
  );
}

/* ============================================================ */
/* workflow-config — 审批流定义（原型 WorkflowSettingsPage /     */
/* WorkflowSettingsDetailsPage + 旧实现表单）                    */
/* ============================================================ */

const WORKFLOW_HINT =
  'Only one enabled version per busCode; changes go through a new version and do not affect in-flight approvals. Approvers must be designated users.';


type WorkflowTableRow = WorkflowRow & { id: string };

export function WorkflowConfigListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const hasPerm = useKissenPerm();

  const [busCode, setBusCode] = React.useState<string>(ALL);
  const { data, isLoading, isError } = useWorkflowListQuery(
    KISSEN_PROJECT_ID,
    busCode === ALL ? undefined : busCode,
  );
  const statusMutation = useWorkflowStatusMutation(KISSEN_PROJECT_ID);
  const { data: businesses } = useWorkflowBusinessesQuery(KISSEN_PROJECT_ID);

  const [disableTarget, setDisableTarget] = React.useState<WorkflowRow | null>(null);

  const rows = data ?? [];

  /** 业务类型下拉：动态合成（可配置业务 ∪ 列表未覆盖 busCode），按 code 字典序。 */
  const wfBusOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const b of businesses ?? []) map.set(b.businessCode, b.businessName);
    for (const r of rows) {
      if (!map.has(r.businessCode)) map.set(r.businessCode, r.businessName);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, name]) => ({ value: code, label: `${code} ${name}` }));
  }, [businesses, rows]);

  const tableData = React.useMemo<WorkflowTableRow[]>(
    () => rows.map((r) => ({ ...r, id: String(r.workflowId) })),
    [rows],
  );

  const { sorted, toggle, sortState } = useProtoSort<WorkflowTableRow>(
    tableData,
    {
      business: { value: (r) => r.businessName.toLowerCase() },
      workflowName: { value: (r) => r.workflowName.toLowerCase() },
      steps: { value: (r) => r.stepCount },
      createdOn: { value: (r) => r.createTime ?? 0, defaultDir: 'desc' },
      status: { value: (r) => protoStatusRank(PROTO_WORKFLOW_SETTING_STATUS, r.status) },
    },
    'createdOn',
    'desc',
    true,
  );

  const onDisableConfirmed = () => {
    if (!disableTarget) return;
    const w = disableTarget;
    statusMutation.mutate(
      { workflowId: w.workflowId, status: 2 },
      {
        onSuccess: () => {
          toast({ description: `Workflow "${w.workflowName}" disabled.` });
          setDisableTarget(null);
        },
        onError: (e) =>
          toast({ description: (e as Error).message, variant: 'destructive' }),
      },
    );
  };

  const columns = React.useMemo<ColumnDef<WorkflowTableRow>[]>(
    () => [
      {
        id: 'business',
        header: () => (
          <ProtoSortHeader label="Business" columnKey="business" toggle={toggle} sortState={sortState('business')} />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{row.original.businessName}</span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {row.original.businessCode}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'workflowName',
        header: () => (
          <ProtoSortHeader label="Workflow Name" columnKey="workflowName" toggle={toggle} sortState={sortState('workflowName')} />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.workflowName}</span>
        ),
      },
      {
        accessorKey: 'stepCount',
        header: () => (
          <ProtoSortHeader label="Steps" columnKey="steps" toggle={toggle} sortState={sortState('steps')} className="text-right" />
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">{row.original.stepCount}</span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: () => (
          <ProtoSortHeader label="Created on (UTC+8)" columnKey="createdOn" toggle={toggle} sortState={sortState('createdOn')} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.createTime ? formatUtc8(row.original.createTime) : <Dash />}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <ProtoSortHeader label="Status" columnKey="status" toggle={toggle} sortState={sortState('status')} />
        ),
        cell: ({ row }) => <WorkflowStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const w = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  stashRow(WORKFLOW_STASH, w.workflowId, w);
                  router.push(`${WORKFLOW_DETAIL_PATH}?id=${w.workflowId}`);
                }}
              >
                Details
              </Button>
              <DropdownMenu>
                <RowMenuTrigger ariaLabel={`More actions for ${w.workflowName}`} />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => router.push(`${WORKFLOW_EDIT_PATH}?id=${w.workflowId}`)}
                  >
                    Edit
                  </DropdownMenuItem>
                  {w.status === 1 ? (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDisableTarget(w)}
                    >
                      Disable
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [router, toggle, sortState],
  );

  const canCreate = (businesses ?? []).length > 0;

  return (
    <div className="space-y-4">
      <ListPageHeader title="Workflow Settings" />

      <div role="note" className="rounded-md border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
        {WORKFLOW_HINT}
      </div>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="text-sm font-semibold leading-6">Workflow Definitions</div>
          {hasPerm('workflow:config') ? (
            <Button
              size="sm"
              disabled={!canCreate}
              onClick={() => router.push(WORKFLOW_CREATE_PATH)}
              title={canCreate ? undefined : 'All businesses already have workflows configured'}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Workflow
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Business Type">
            <Select value={busCode} onValueChange={setBusCode}>
              <SelectTrigger id="wf-filter-bus" aria-label="Business Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {wfBusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <div className="flex items-end">
            <Button variant="outline" onClick={() => setBusCode(ALL)}>
              Reset
            </Button>
          </div>
        </div>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={sorted}
              isLoading={isLoading}
              emptyMessage="No workflow definitions found."
            />
          )}
        </div>
      </section>

      <ActionConfirmDialog
        open={disableTarget != null}
        onOpenChange={(o) => !o && setDisableTarget(null)}
        icon={CirclePause}
        variant="destructive"
        title="Disable Workflow"
        body1={disableTarget ? `Disable workflow "${disableTarget.workflowName}"?` : ''}
        body2="Once disabled, new business requests no longer start this workflow and the version stays available for reference; approvals already in flight continue on their current version."
        confirmLabel="Disable"
        cancelLabel="Cancel"
        loading={statusMutation.isPending}
        onConfirm={onDisableConfirmed}
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
          {filtered.length === 0 ? (
            <p className="px-1 py-1.5 text-sm text-muted-foreground">No matched users</p>
          ) : null}
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
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <span className="text-sm font-medium">Step {index + 1}</span>
        </span>
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
          <Label htmlFor={`wf-step-name-${index}`}>Step Name</Label>
          <Input
            id={`wf-step-name-${index}`}
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
  const { toast } = useToast();
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
        mapped.length > 0 ? mapped : [{ stepName: 'Review', stepType: 5, userIds: [] }],
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
      toast({ description: 'Workflow name is required', variant: 'destructive' });
      return;
    }
    if (!businessId) {
      toast({ description: 'Please select a business type', variant: 'destructive' });
      return;
    }
    if (steps.length === 0) {
      toast({ description: 'At least one approval step is required', variant: 'destructive' });
      return;
    }
    if (steps.some((s) => !s.stepName.trim())) {
      toast({ description: 'Each step needs a name', variant: 'destructive' });
      return;
    }
    if (steps.some((s) => s.userIds.length === 0)) {
      toast({ description: 'Each step needs at least one approver', variant: 'destructive' });
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
    if (id != null && isEditingEnabled) {
      updateMutation.mutate(
        { workflowId: id, businessId, workflowName, steps: stepsReq },
        {
          onSuccess: () => {
            toast({ description: 'Workflow updated' });
            router.push(WORKFLOW_LIST_PATH);
          },
          onError: (e) =>
            toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    } else {
      saveMutation.mutate(
        { businessId, workflowName, steps: stepsReq },
        {
          onSuccess: () => {
            toast({
              description: isEdit ? 'Workflow created as a new version' : 'Workflow created',
            });
            router.push(WORKFLOW_LIST_PATH);
          },
          onError: (e) =>
            toast({ description: (e as Error).message, variant: 'destructive' }),
        },
      );
    }
  };

  const isPending = saveMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <FormPageHeader
        backTo={WORKFLOW_LIST_PATH}
        backLabel="Workflow Definitions"
        title={isEdit ? 'Edit Workflow' : 'Add Workflow'}
      />
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
                    const b = (businesses ?? []).find((x) => x.businessId === Number(v));
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
              {isEdit ? (
                <p className="text-xs text-muted-foreground">
                  Business type is immutable after creation.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wf-form-name">
                Workflow Name<span className="text-destructive"> *</span>
              </Label>
              <Input
                id="wf-form-name"
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
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Click the Add Step button to configure the approval chain.
              </p>
            ) : null}
            {steps.map((s, i) => (
              <WfStepEditor
                key={i}
                index={i}
                step={s}
                users={users ?? []}
                onChange={(ns) => setSteps((prev) => prev.map((p, j) => (j === i ? ns : p)))}
                onRemove={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
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
              onClick={() => router.push(WORKFLOW_LIST_PATH)}
            >
              Back
            </Button>
          </div>
        </div>
      </DetailCard>
    </div>
  );
}

const WORKFLOW_DETAIL_TABS = ['definition', 'operations'] as const;

export function WorkflowConfigDetailPage() {
  const router = useRouter();
  const hasPerm = useKissenPerm();
  const searchParams = useSearchParams();
  const id = parseNum(searchParams.get('id'));

  const { data: detail, isLoading } = useWorkflowDetailQuery(
    KISSEN_PROJECT_ID,
    id ?? undefined,
    id != null,
  );
  // 列表跳转带回的行快照兜底（详情查询失败/加载中时的展示回退）。
  const stashed = id != null ? peekRow<WorkflowRow>(WORKFLOW_STASH, id) : undefined;

  const { data: userOptions } = useRbacUserOptionsQuery(KISSEN_PROJECT_ID);

  // ?tab= 写 URL（原型 D7）：非法/缺省落 definition；replace 不留历史。
  const tabParam = searchParams.get('tab');
  const activeTab = (WORKFLOW_DETAIL_TABS as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as (typeof WORKFLOW_DETAIL_TABS)[number])
    : 'definition';
  const selectTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('id', String(id ?? ''));
    params.set('tab', next);
    router.replace(`${WORKFLOW_DETAIL_PATH}?${params.toString()}`);
  };

  const source = detail ?? stashed;
  const steps = React.useMemo(
    () => [...(detail?.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder),
    [detail],
  );
  const stepsCount = detail?.steps?.length ?? source?.stepCount ?? 0;

  const userNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    (userOptions ?? []).forEach((u) => map.set(u.userId, u.userName));
    return map;
  }, [userOptions]);

  const { sorted: sortedSteps, toggle: toggleSteps, sortState: stepsSortState } =
    useProtoSort<WorkflowStep>(
      steps,
      { name: { value: (s) => s.stepName.toLowerCase() } },
      null,
      'asc',
      false,
    );

  // STATIC-FILLER(GAP-ADM-02): 后端无工作流操作历史端点，Operation History 仅静态空态。
  const operations: unknown[] = [];

  if (id != null && isLoading && detail == null && stashed == null) {
    return (
      <div className="space-y-4">
        <FormPageHeader
          backTo={WORKFLOW_LIST_PATH}
          backLabel="Workflow Settings"
          title="Workflow Details"
        />
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <LoadingBlock />
        </section>
      </div>
    );
  }

  if (id == null || (!isLoading && detail == null && stashed == null)) {
    return (
      <div className="space-y-4">
        <FormPageHeader
          backTo={WORKFLOW_LIST_PATH}
          backLabel="Workflow Settings"
          title="Workflow Details"
        />
        <section className="rounded-lg border border-border/60 bg-card">
          <EmptyStateBlock
            title="Workflow not found"
            description="The definition may have been removed. Go back to the list."
            action={
              <Button variant="outline" onClick={() => router.push(WORKFLOW_LIST_PATH)}>
                Back to list
              </Button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to Workflow Settings"
            onClick={() => router.push(WORKFLOW_LIST_PATH)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-7">Workflow Details</h1>
              {source ? <WorkflowStatusBadge status={source.status} /> : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>
                Workflow: <b className="font-semibold text-foreground">{source?.workflowName}</b>
              </span>
              <span aria-hidden="true">|</span>
              <span>
                Business Code:{' '}
                <b className="font-mono text-sm font-semibold text-foreground">
                  {source?.businessCode}
                </b>
              </span>
              <span aria-hidden="true">|</span>
              <span>
                Created on{' '}
                <b className="font-semibold tabular-nums text-foreground">
                  {source?.createTime ? formatUtc8(source.createTime) : <Dash />}
                </b>
              </span>
            </p>
          </div>
        </div>
        {hasPerm('workflow:config') ? (
          <Button
            variant="outline"
            onClick={() => router.push(`${WORKFLOW_EDIT_PATH}?id=${id}`)}
          >
            Edit
          </Button>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={selectTab}>
        <TabsList>
          <TabsTrigger value="definition">Definition</TabsTrigger>
          <TabsTrigger value="operations">
            Operation History
            {operations.length > 0 ? (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {operations.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="definition" className="mt-4 space-y-4">
          <DetailCard title="Basic Information" icon={ListTree}>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Business Type">
                <div className="min-w-0">
                  <div className="break-words font-medium">{source?.businessName ?? <Dash />}</div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {source?.businessCode}
                  </div>
                </div>
              </DetailField>
              <DetailField label="Workflow Name">
                {source?.workflowName ?? <Dash />}
              </DetailField>
              {/* STATIC-FILLER(GAP-ADM-08): 后端 WorkflowDetail 无 version 字段，跳过原型 Version 展示。 */}
              <DetailField label="Steps">
                <span className="tabular-nums">{stepsCount}</span>
              </DetailField>
              <DetailField label="Created on">
                {source?.createTime ? (
                  <span className="tabular-nums">{formatUtc8(source.createTime)}</span>
                ) : (
                  <Dash />
                )}
              </DetailField>
            </div>
          </DetailCard>

          <DetailCard title="Workflow Process" icon={ListTree}>
            <div className="mb-4">
              <div className="text-right text-xs text-muted-foreground">
                {stepsCount} steps
              </div>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">{WORKFLOW_HINT}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left">
                    <th className="px-2 py-2 text-right font-medium">Step</th>
                    <th className="px-2 py-2 font-medium">
                      <ProtoSortHeader
                        label="Step Name"
                        columnKey="name"
                        toggle={toggleSteps}
                        sortState={stepsSortState('name')}
                      />
                    </th>
                    <th className="px-2 py-2 font-medium">Approver</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSteps.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-8 text-center text-muted-foreground">
                        <p className="text-sm font-medium text-foreground">
                          No steps configured.
                        </p>
                        <p className="mt-1 text-sm">
                          Add approval steps when editing the workflow.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    sortedSteps.map((s, index) => (
                      <tr key={s.workflowStepId ?? index} className="border-b border-border/40">
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {index + 1}
                        </td>
                        <td className="max-w-[260px] truncate px-2 py-2 font-medium">
                          {s.stepName}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {s.userNames?.join(', ') ||
                            s.userIds.map((uid) => userNameById.get(uid) ?? `#${uid}`).join(', ') ||
                            <Dash />}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DetailCard>
        </TabsContent>

        <TabsContent value="operations" className="mt-4">
          <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="px-4 py-2 font-medium" style={{ width: 230 }}>
                    Timestamp (UTC+8)
                  </th>
                  <th className="px-4 py-2 font-medium">Operator</th>
                  <th className="px-4 py-2 font-medium">Module</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" style={{ width: 240 }}>
                    Trace ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* STATIC-FILLER(GAP-ADM-02): 无操作历史端点；空态文案原型逐字。 */}
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    <p className="text-sm font-medium text-foreground">
                      No operations recorded yet.
                    </p>
                    <p className="mt-1 text-sm">
                      Operations on this workflow appear here once they are performed.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================ */
/* operate-log — 操作日志（原型 OperationLogsPage /              */
/* OperationLogDetailsPage）                                     */
/* ============================================================ */

type LogTableRow = OperateLogRow & { id: string };

/** 日期串（YYYY-MM-DD）→ 当日 00:00:00.000 本地毫秒；空串 undefined。 */
function dayStartMs(date: string): number | undefined {
  return date ? new Date(`${date}T00:00:00`).getTime() : undefined;
}

/** 日期串（YYYY-MM-DD）→ 当日 23:59:59.999 本地毫秒；空串 undefined。 */
function dayEndMs(date: string): number | undefined {
  return date ? new Date(`${date}T23:59:59.999`).getTime() : undefined;
}


const LOG_STATUS_OPTIONS = [
  { value: ALL, label: 'All' },
  { value: '0', label: 'Success' },
  { value: '1', label: 'Failed' },
] as const;

export function OperateLogListPage() {
  const router = useRouter();

  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [operator, setOperator] = React.useState('');
  const [moduleText, setModuleText] = React.useState('');
  const [statusSel, setStatusSel] = React.useState(ALL);

  const debouncedOperator = useDebouncedValue(operator, FILTER_DEBOUNCE_MS);
  const debouncedModule = useDebouncedValue(moduleText, FILTER_DEBOUNCE_MS);

  const [params, setParams] = React.useState({
    pageNum: 1,
    pageSize: LOG_PAGE_SIZE,
    filter: {} as OperateLogListReq,
  });

  // 筛选即时生效（原型 D4）：日期/下拉立即，文本防抖；变化回第 1 页。
  React.useEffect(() => {
    setParams((prev) => ({
      pageNum: 1,
      pageSize: prev.pageSize,
      filter: {
        // 纯数字视为 User ID 精确匹配，否则按操作人名称模糊（后端 operateName LIKE）。
        userId: isNumericText(debouncedOperator) ? Number(debouncedOperator) : undefined,
        operateName: isNumericText(debouncedOperator) || !debouncedOperator
          ? undefined
          : debouncedOperator,
        module: debouncedModule || undefined,
        status: statusSel === ALL ? undefined : Number(statusSel),
        startTime: dayStartMs(dateFrom),
        endTime: dayEndMs(dateTo),
      },
    }));
  }, [debouncedOperator, debouncedModule, statusSel, dateFrom, dateTo]);

  const { data, isLoading, isError, dataUpdatedAt } = useOperateLogListQuery(
    KISSEN_PROJECT_ID,
    params,
  );

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  const tableData = React.useMemo<LogTableRow[]>(
    () => rows.map((r) => ({ ...r, id: String(r.operateLogId) })),
    [rows],
  );

  const { sorted, toggle, sortState } = useProtoSort<LogTableRow>(
    tableData,
    {
      timestamp: { value: (r) => r.operateTime, defaultDir: 'desc' },
      operator: { value: (r) => r.operateName || `#${r.userId}` },
      module: { value: (r) => r.module },
      duration: { value: (r) => r.costTime },
      status: { value: (r) => protoStatusRank(PROTO_OPERATE_LOG_RESULT, r.status) },
      traceId: { value: (r) => r.traceId },
    },
    'timestamp',
    'desc',
    true,
  );

  const columns = React.useMemo<ColumnDef<LogTableRow>[]>(
    () => [
      {
        accessorKey: 'operateTime',
        header: () => (
          <ProtoSortHeader
            label="Timestamp (UTC+8)"
            columnKey="timestamp"
            toggle={toggle}
            sortState={sortState('timestamp')}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.operateTime ? formatUtc8(row.original.operateTime) : <Dash />}
          </span>
        ),
      },
      {
        accessorKey: 'operateName',
        header: () => (
          <ProtoSortHeader
            label="Operator"
            columnKey="operator"
            toggle={toggle}
            sortState={sortState('operator')}
          />
        ),
        cell: ({ row }) => row.original.operateName || `#${row.original.userId}`,
      },
      {
        accessorKey: 'module',
        header: () => (
          <ProtoSortHeader
            label="Module"
            columnKey="module"
            toggle={toggle}
            sortState={sortState('module')}
          />
        ),
        cell: ({ row }) => row.original.module || <Dash />,
      },
      {
        accessorKey: 'operateUrl',
        header: 'Request URL',
        cell: ({ row }) => (
          <span
            className="block max-w-[260px] truncate font-mono text-xs"
            title={row.original.operateUrl}
          >
            {row.original.operateUrl || <Dash />}
          </span>
        ),
      },
      {
        accessorKey: 'costTime',
        header: () => (
          <ProtoSortHeader
            label="Duration"
            columnKey="duration"
            toggle={toggle}
            sortState={sortState('duration')}
            className="text-right"
          />
        ),
        cell: ({ row }) => (
          <span className="block whitespace-nowrap text-right tabular-nums">
            {row.original.costTime} ms
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <ProtoSortHeader
            label="Status"
            columnKey="status"
            toggle={toggle}
            sortState={sortState('status')}
          />
        ),
        cell: ({ row }) => <OperateLogResultBadge status={row.original.status} />,
      },
      {
        accessorKey: 'traceId',
        header: () => (
          <ProtoSortHeader
            label="Trace ID"
            columnKey="traceId"
            toggle={toggle}
            sortState={sortState('traceId')}
          />
        ),
        cell: ({ row }) => <CopyableId value={row.original.traceId} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => {
              stashRow(OPERATE_LOG_STASH, row.original.operateLogId, row.original);
              router.push(`${LOG_DETAIL_PATH}?logId=${row.original.operateLogId}`);
            }}
          >
            Details
          </Button>
        ),
      },
    ],
    [router, toggle, sortState],
  );

  const onReset = () => {
    setDateFrom('');
    setDateTo('');
    setOperator('');
    setModuleText('');
    setStatusSel(ALL);
  };

  return (
    <div className="space-y-4">
      <ListPageHeader title="Operation Logs" />

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6">Operation Logs</div>
            {!isLoading && paginationMeta ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {paginationMeta.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>

        {/* 查询区（原型 §18 顺序）：Date Range → Operator → Module → Status。 */}
        <div className="grid grid-cols-1 gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Date Range">
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                aria-label="Date Range from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input
                type="date"
                aria-label="Date Range to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Operator">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search operator"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              />
            </div>
          </FilterField>
          {/* 偏差（原型为模块下拉）：后端模块清单无字典端点，保持文本模糊匹配。 */}
          <FilterField label="Module">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search module"
                value={moduleText}
                onChange={(e) => setModuleText(e.target.value)}
              />
            </div>
          </FilterField>
          <FilterField label="Status">
            <Select value={statusSel} onValueChange={setStatusSel}>
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOG_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <div className="flex items-end">
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
          </div>
        </div>

        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={sorted}
              isLoading={isLoading}
              emptyMessage="No operation logs found."
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
          )}
        </div>
      </section>
    </div>
  );
}

export function OperateLogDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = parseNum(searchParams.get('logId'));

  // 列表跳转带回的行快照优先；无快照时扫描 200 条窗口兜底。
  // STATIC-FILLER(GAP-ADM-01): 后端无日志单条详情端点，仅列表分页可查。
  const stashed =
    logId != null ? peekRow<OperateLogRow>(OPERATE_LOG_STASH, logId) : undefined;
  const { data: probe, isLoading } = useOperateLogListQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: PROBE_PAGE_SIZE, filter: {} },
    logId != null && stashed == null,
  );

  const log = stashed ?? (logId != null ? (probe?.data ?? []).find((r) => r.operateLogId === logId) : undefined);

  if (logId != null && log == null && stashed == null && isLoading) {
    return (
      <div className="space-y-4">
        <FormPageHeader
          backTo={LOG_LIST_PATH}
          backLabel="Operation Logs"
          title="Operation Details"
        />
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <LoadingBlock />
        </section>
      </div>
    );
  }

  if (logId == null || (!isLoading && probe != null && log == null)) {
    return (
      <div className="space-y-4">
        <FormPageHeader
          backTo={LOG_LIST_PATH}
          backLabel="Operation Logs"
          title="Operation Details"
        />
        <section className="rounded-lg border border-border/60 bg-card">
          <EmptyStateBlock
            title="Operation log not found"
            description="The record may have been removed. Go back to the list."
            action={
              <Button variant="outline" onClick={() => router.push(LOG_LIST_PATH)}>
                Back to Operation Logs
              </Button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to Operation Logs"
            onClick={() => router.push(LOG_LIST_PATH)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-7">Operation Details</h1>
              <OperateLogResultBadge status={log?.status ?? 0} />
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                Trace ID: <CopyableId value={log?.traceId} />
              </span>
              <span aria-hidden="true">|</span>
              <span>
                Timestamp:{' '}
                <b className="font-semibold tabular-nums text-foreground">
                  {log?.operateTime ? formatUtc8(log.operateTime) : <Dash />}
                </b>
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailCard title="Request" icon={Server}>
          <div className="space-y-5">
            <DetailField label="Module">{log?.module || <Dash />}</DetailField>
            <DetailField label="Request URL">
              <code className="break-all font-mono text-xs">{log?.operateUrl || <Dash />}</code>
            </DetailField>
            <DetailField label="Trace ID">
              <CopyableId value={log?.traceId} />
            </DetailField>
            <DetailField label="Duration">
              <span className="tabular-nums">{log?.costTime} ms</span>
            </DetailField>
            <DetailField label="Operator">{log?.operateName || <Dash />}</DetailField>
          </div>
        </DetailCard>

        <DetailCard title="Error Info" icon={AlertTriangle}>
          {log?.errorMsg ? (
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded bg-destructive/10 p-3 font-mono text-xs leading-5 text-destructive">
              {log.errorMsg}
            </pre>
          ) : (
            <EmptyStateBlock
              title="No error recorded"
              description="This operation finished without an error entry."
            />
          )}
        </DetailCard>
      </div>
    </div>
  );
}
