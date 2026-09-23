'use client';

/**
 * 系统管理页组（R2：C1 用户管理 + C3 菜单管理，源 `views/system/user|menu` 1:1 迁移）。
 *
 * 源语义要点（user）：
 * - 查询：登录名（模糊）/ 状态（0 正常 1 停用，可清空）；POST /lp/user/page 固定 pageSize 10；
 * - 启停走 el-switch before-change：确认弹窗 + 接口成功才翻转（本地行翻转 + load()），
 *   失败不动（受控 Switch 失败天然回弹）；停自己/最后管理员由后端 23_0008 拒绝；
 * - 重置密码 → 一次性密码弹窗（首登强制改密，需抄送）；强制下线 → toast；
 * - 新增/编辑弹窗：loginName 必填（≤30，编辑禁用）/userName 必填/邮箱/手机号/roleIds 多选；
 *   新增 save 返回 OTP 先弹「初始密码」再关闭重载；编辑 update 不携带 loginName；
 * - 分配角色弹窗：回显 row.roleIds，成功 toast「分配成功,该用户下次请求即生效」；
 * - 「新增用户」v-perm 'lp:user'（操作列按钮无 v-perm，源同款）。
 *
 * 源语义要点（menu）：
 * - 左树（node-key=menuId/default-expand-all/highlight-current，GET /lp/menu/tree）
 *   + 右详情表单（menuName/menuNameEn/menuKey 三必填；menuKey/类型编辑禁用）+ 接口权限表；
 * - menuId=0 为本地新建哨兵（顶级 seed 类型 2，子级 3）；保存后 loadTree 按 menuId 重新定位；
 * - 权限行先入本地表，「保存接口权限」逐行 POST；后端仅 insert 无删除端点，
 *   已保存行移除仅警告；保存后无论成败按服务端重载（防重复提交）；
 * - 「新增顶级」「新增子节点」v-perm 'lp:menu'（保存/删除无 v-perm）；
 * - 删除确认文案含「存在子菜单或被角色引用将被拒绝」。
 *
 * 源系统页无 0024 降级条：错误一律由 lp-client 拦截器统一 toast，旧数据保留。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Mail,
  MoreHorizontal,
  ShieldCheck,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Alert,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  DataTable,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  LP_PROJECT_ID,
  MENU_TYPE_TEXT,
  useMenuPermissionListQuery,
  useMenuPermissionSaveMutation,
  useMenuRemoveMutation,
  useMenuSaveMutation,
  useMenuTreeQuery,
  useMenuUpdateMutation,
  useRoleOptionsQuery,
  useUserAssignRoleMutation,
  useUserForceLogoutMutation,
  useUserPageQuery,
  useUserResetPwdMutation,
  useUserSaveMutation,
  useUserStatusMutation,
  useUserUpdateMutation,
  userKeys,
  type MenuPermissionItem,
  type MenuTree,
  type RoleRow,
  type UserRow,
} from '@myorg/modules/lp-portal/data-access';

import { PermButton } from './perm-button';
import { formatUtc8 } from './proto-format';
import {
  ActionConfirmDialog,
  Dash,
  ProtoStatusBadge,
  type ProtoTone,
} from './proto-ui';
import { LP_USER_STATUS_MAP } from './proto-enums';

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;
/** 下拉「全部」哨兵（FormSelect 禁空 value，非 ALL 即转 number 参与查询）。 */
const ALL = 'all';

/** 用户域路由（registry 组前缀 /sys/user；create/edit/detail 为子 pageKey）。 */
const USER_LIST_PATH = '/sys/user';

/**
 * STATIC-FILLER(GAP-LP-08): 无用户单查与 stats 端点——表单/详情回显与统计卡
 * 均以 /lp/user/page 大页拉全量本地定位/计数（量级 ≤200 假设，同角色 options
 * pageSize:200 先例；后端补 GET /users/:userId 后切换）。
 */
const USER_LOOKUP_PAGE_SIZE = 200;

/** 用户状态语义色（原型 StatusBadge：Active=success / Inactive=warning）。 */
const USER_STATUS_TONE: Record<number, ProtoTone> = {
  0: 'success',
  1: 'warning',
};

/** 用户状态筛选下拉（原型文案 Active / Inactive，LP_USER_STATUS_MAP 单一口径）。 */
const USER_STATUS_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'All' },
  { value: '0', label: LP_USER_STATUS_MAP[0].label },
  { value: '1', label: LP_USER_STATUS_MAP[1].label },
];


/* ================================================================== */
/* 通用确认弹窗（ElMessageBox.confirm 等价）                            */
/* ================================================================== */

interface ConfirmRequest {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

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
          <AlertDialogDescription>
            {request?.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={request?.onConfirm}>
            {request?.confirmText ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** 一次性密码展示弹窗（源 ElMessageBox.alert + 「我已抄送」等价）。 */
interface OtpRequest {
  title: string;
  message: string;
  onAcknowledge?: () => void;
}

function OtpDialog({
  request,
  onClose,
}: {
  request: OtpRequest | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={request != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap sr-only">
            {request?.message}
          </DialogDescription>
        </DialogHeader>
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-relaxed">
          {request?.message}
        </pre>
        <DialogFooter>
          <Button onClick={onClose}>I have saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 用户管理（源 views/system/user）                                     */
/* ================================================================== */

interface UserFilterForm {
  loginName: string;
  status: string;
}

const EMPTY_USER_FILTER: UserFilterForm = { loginName: '', status: ALL };


interface UserQueryParams {
  pageNum: number;
  loginName?: string;
  status?: number;
}

function userFormToParams(f: UserFilterForm, pageNum = 1): UserQueryParams {
  return {
    pageNum,
    loginName: f.loginName.trim() || undefined,
    status: f.status !== ALL ? Number(f.status) : undefined,
  };
}

/** 角色多选列表（FormSelect 仅单选，源 multiple 语义用 checkbox 列表承载）。 */
function RoleCheckboxList({
  roleIds,
  roleOptions,
  onToggle,
}: {
  roleIds: number[];
  roleOptions: RoleRow[];
  onToggle: (roleId: number, checked: boolean) => void;
}) {
  if (roleOptions.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
        No roles available
      </p>
    );
  }
  return (
    <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-3">
      {roleOptions.map((r) => (
        <label
          key={r.roleId}
          className="flex cursor-pointer items-center gap-2 text-sm"
        >
          <Checkbox
            checked={roleIds.includes(r.roleId)}
            onCheckedChange={(checked) => onToggle(r.roleId, checked === true)}
          />
          <span>{r.roleName}</span>
          <span className="text-xs text-muted-foreground">{r.roleCode}</span>
        </label>
      ))}
    </div>
  );
}


/** 分配角色弹窗（源 assign-role-dialog.vue；回显 row.roleIds）。 */
function AssignRoleDialog({
  row,
  roleOptions,
  onClose,
}: {
  row: UserRow;
  roleOptions: RoleRow[];
  onClose: (saved: boolean) => void;
}) {
  const toast = useToast();
  const [roleIds, setRoleIds] = React.useState<number[]>([
    ...(row.roleIds ?? []),
  ]);
  const assignMutation = useUserAssignRoleMutation(PROJECT_ID);

  const toggleRole = (roleId: number, checked: boolean) => {
    setRoleIds((prev) =>
      checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !assignMutation.isPending) onClose(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Roles: {row.userName}</DialogTitle>
        </DialogHeader>
        <RoleCheckboxList
          roleIds={roleIds}
          roleOptions={roleOptions}
          onToggle={toggleRole}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={assignMutation.isPending}
            onClick={() => onClose(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={assignMutation.isPending}
            onClick={() =>
              assignMutation.mutate(
                { userId: row.userId, roleIds },
                {
                  onSuccess: () => {
                    toast.success('Assigned successfully — effective on next request for this user');
                    onClose(true);
                  },
                },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 列表统计卡（原型 StatGrid 项：顶部语义色条 + label + 大数值 + 脚注）。 */
function StatCard({
  label,
  value,
  help,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  help: string;
  tone: ProtoTone;
}) {
  return (
    <section className="relative min-w-0 overflow-hidden rounded-lg border border-border/60 bg-card p-4 text-card-foreground shadow-float">
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-0.5 ${STAT_BAR_TONE[tone]}`}
      />
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{help}</div>
    </section>
  );
}

/** 统计卡顶部色条（StatCard 内部用）。 */
const STAT_BAR_TONE: Record<ProtoTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  primary: 'bg-primary',
  muted: 'bg-muted-foreground/40',
};

export function UserListPage() {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, control } =
    useForm<UserFilterForm>({ defaultValues: EMPTY_USER_FILTER });
  const [params, setParams] = React.useState<UserQueryParams>(() =>
    userFormToParams(EMPTY_USER_FILTER),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const [rolesRow, setRolesRow] = React.useState<UserRow | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [otp, setOtp] = React.useState<OtpRequest | null>(null);

  // 角色选项一次拉足（pageSize:200，取舍见 role 域 role.queries 头注释），分配角色弹窗共用
  const { data: roleOptionsData } = useRoleOptionsQuery(PROJECT_ID);
  const roleOptions = roleOptionsData?.data ?? [];

  const listParams = {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      loginName: params.loginName,
      userName: undefined,
      status: params.status,
    },
  };
  const listQuery = useUserPageQuery(PROJECT_ID, listParams);

  // STATIC-FILLER(GAP-LP-08)：统计卡无 stats 端点——不筛全量大页本地计数
  const statsQuery = useUserPageQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: USER_LOOKUP_PAGE_SIZE,
  });
  const statsRows = statsQuery.data?.data ?? [];
  const statsReady = statsQuery.data != null;

  const statusMutation = useUserStatusMutation(PROJECT_ID);
  const resetPwdMutation = useUserResetPwdMutation();
  const forceLogoutMutation = useUserForceLogoutMutation();

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const hasFilter = params.loginName != null || params.status != null;

  // 源 beforeStatusChange：确认 + 接口成功才翻转（本地行翻转 + load()）
  const toggleStatus = (row: UserRow) => {
    const next = row.status === 0 ? 1 : 0;
    setConfirm({
      title: 'Confirm',
      message: `Confirm ${next === 1 ? 'disable' : 'enable'} "${row.userName}"?`,
      onConfirm: () =>
        statusMutation.mutate(
          { userId: row.userId, status: next },
          {
            onSuccess: () => {
              toast.success('Operation successful');
              // 本地翻转（源 row.status = next），随后 invalidate 触发 load()
              queryClient.setQueryData(
                userKeys.list(PROJECT_ID, listParams),
                (prev: { data?: UserRow[] } | undefined) =>
                  prev
                    ? {
                        ...prev,
                        data: prev.data?.map((r) =>
                          r.userId === row.userId ? { ...r, status: next } : r,
                        ),
                      }
                    : prev,
              );
            },
          },
        ),
    });
  };

  const onResetPwd = (row: UserRow) => {
    setConfirm({
      title: 'Reset Password',
      message: `Reset the password of "${row.userName}"?`,
      onConfirm: () =>
        resetPwdMutation.mutate(row.userId, {
          onSuccess: (resp) => {
            // 后端重置后 first_login=0，用户下次登录强制改密
            setOtp({
              title: 'Reset Successful',
              message: `New one-time password (change required on first login):\n\n${resp.oneTimePassword}\n\nPlease forward it to the user immediately.`,
            });
          },
        }),
    });
  };

  const onForceLogout = (row: UserRow) => {
    setConfirm({
      title: 'Force Logout',
      message: `Force logout "${row.userName}"? All their sessions will be invalidated immediately.`,
      onConfirm: () =>
        forceLogoutMutation.mutate(row.userId, {
          onSuccess: () => toast.success('Forced logout'),
        }),
    });
  };

  const columns = React.useMemo<ColumnDef<UserRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'userId',
        header: 'User ID',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {row.original.userId}
          </span>
        ),
      },
      {
        accessorKey: 'loginName',
        header: 'Username',
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.loginName}</span>
        ),
      },
      { accessorKey: 'userName', header: 'Full Name' },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => <Dash value={row.original.email} />,
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => <Dash value={row.original.phone} />,
      },
      {
        accessorKey: 'createTime',
        header: 'Created on (UTC+8)',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              aria-label={`Toggle status for ${row.original.userName}`}
              checked={row.original.status === 0}
              onCheckedChange={() => toggleStatus(row.original)}
              disabled={
                statusMutation.isPending &&
                statusMutation.variables?.userId === row.original.userId
              }
            />
            <ProtoStatusBadge
              label={
                LP_USER_STATUS_MAP[row.original.status]?.label ??
                String(row.original.status)
              }
              tone={USER_STATUS_TONE[row.original.status] ?? 'muted'}
            />
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push({
                  pathname: `${USER_LIST_PATH}/detail`,
                  query: { userId: row.original.userId },
                })
              }
            >
              Details
            </Button>
            {/* Actions 列唯一合法形态（原型 §3.1）：主操作 Details + 其余动作收 ⋮ 菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Row actions"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    router.push({
                      pathname: `${USER_LIST_PATH}/edit`,
                      query: { userId: row.original.userId },
                    })
                  }
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRolesRow(row.original)}>
                  Assign Roles
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-amber-600 focus:text-amber-600"
                  onClick={() => onResetPwd(row.original)}
                >
                  Reset Password
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onForceLogout(row.original)}
                >
                  Force Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [statusMutation.isPending, statusMutation.variables, params, pageSize],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.userId) })),
    [rows],
  );

  const statItems: {
    label: string;
    value: React.ReactNode;
    help: string;
    tone: ProtoTone;
  }[] = [
    {
      label: 'Total Users',
      value: statsReady ? statsRows.length : '-',
      help: 'All registered accounts',
      tone: 'primary',
    },
    {
      label: 'Active users',
      value: statsReady
        ? statsRows.filter((r) => r.status === 0).length
        : '-',
      help: 'Can sign in now',
      tone: 'success',
    },
    {
      label: 'Inactive users',
      value: statsReady
        ? statsRows.filter((r) => r.status !== 0).length
        : '-',
      help: 'Access suspended',
      tone: 'warning',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            SYSTEM
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            User Management
          </h1>
        </div>
        <PermButton
          menuKey="lp:user"
          onClick={() => router.push(`${USER_LIST_PATH}/create`)}
        >
          New User
        </PermButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statItems.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <form
        onSubmit={handleSubmit((f) => setParams(userFormToParams(f, 1)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="loginName"
            label="Username"
            placeholder="Fuzzy match"
            register={register('loginName')}
          />
          <FormSelect
            name="status"
            control={control}
            label="Status"
            options={USER_STATUS_OPTIONS}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset(EMPTY_USER_FILTER);
              setParams(userFormToParams(EMPTY_USER_FILTER, 1));
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            Users
            <Badge variant="secondary" className="tabular-nums">
              {total}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Updated {formatUtc8(listQuery.dataUpdatedAt)}
          </div>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={listQuery.isLoading}
          emptyMessage={
            hasFilter
              ? 'No records found. Try changing the filters.'
              : 'No users yet. Create your first user.'
          }
          pagination={{
            page: params.pageNum,
            pageSize,
            total,
            onPageChange: (page) =>
              setParams((prev) => ({ ...prev, pageNum: page })),
            onPageSizeChange: (n) => {
              setPageSize(n);
              setParams((prev) => ({ ...prev, pageNum: 1 }));
            },
            pageSizeOptions: [PAGE_SIZE],
          }}
        />
      </div>

      {rolesRow && (
        <AssignRoleDialog
          row={rolesRow}
          roleOptions={roleOptions}
          onClose={() => setRolesRow(null)}
        />
      )}
      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
      <OtpDialog request={otp} onClose={() => setOtp(null)} />
    </div>
  );
}

/* ================================================================== */
/* 用户表单页（原型 UserManagementFormPage；/sys/user/create|edit?userId=）*/
/* ================================================================== */

interface UserFormValues {
  loginName: string;
  userName: string;
  email: string;
  phone: string;
  roleIds: number[];
}

const EMPTY_USER_FORM: UserFormValues = {
  loginName: '',
  userName: '',
  email: '',
  phone: '',
  roleIds: [],
};

const USERNAME_PATTERN = /^[A-Za-z0-9_.]{1,30}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+0-9 ()-]{3,32}$/;

/** 预览卡首字母（fullName 优先回落 username，前两词首字母；空 → NU）。 */
function previewInitials(fullName: string, username: string): string {
  const source = String(fullName || username || '').trim();
  if (!source) return 'NU';
  return source
    .split(/[\s_.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/** 角色选项卡（原型 RoleOptionCard：名称 + 代码次级灰字 + 选中右上角 ✓）。 */
function RoleOptionCard({
  role,
  selected,
  onToggle,
}: {
  role: RoleRow;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`relative flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border/60 hover:bg-muted/50'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-9 shrink-0 place-items-center rounded-md ${
          selected
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">
          {role.roleName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {role.roleCode}
        </span>
      </span>
      {selected && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <Check className="h-3 w-3" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

/** 详情/表单只读字段（label 上 / 值下加粗，同 tx-flow Field）。 */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 min-w-0 break-all text-sm font-semibold">
        {children}
      </dd>
    </div>
  );
}

/** 详情页头（← 返回 + 标题 + 状态徽章 + 元信息行）。 */
function DetailHeader({
  title,
  badge,
  description,
  actions,
}: {
  title: string;
  badge?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex items-start gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="mt-0.5 shrink-0"
        aria-label="Back"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {description ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions}
      </div>
    </div>
  );
}

/** 详情骨架（数据加载中占位）。 */
function DetailSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}

export function UserFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get('userId');
  const isEdit = userIdParam != null && userIdParam !== '';
  const userId = isEdit ? Number(userIdParam) : null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<UserFormValues>({ defaultValues: EMPTY_USER_FORM });

  // STATIC-FILLER(GAP-LP-08)：编辑回显无单查端点——列表大页拉全量按 id 定位
  const lookupQuery = useUserPageQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: isEdit ? USER_LOOKUP_PAGE_SIZE : 1,
  });
  const { data: roleOptionsData } = useRoleOptionsQuery(PROJECT_ID);
  const roleOptions = roleOptionsData?.data ?? [];

  const seed = React.useMemo(
    () =>
      isEdit && userId != null
        ? (lookupQuery.data?.data ?? []).find((r) => r.userId === userId) ??
          null
        : null,
    [isEdit, userId, lookupQuery.data],
  );

  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current || !isEdit || !lookupQuery.data) return;
    seeded.current = true;
    if (seed) {
      reset({
        loginName: seed.loginName,
        userName: seed.userName,
        email: seed.email ?? '',
        phone: seed.phone ?? '',
        roleIds: [...(seed.roleIds ?? [])],
      });
    }
  }, [isEdit, lookupQuery.data, seed, reset]);

  const saveMutation = useUserSaveMutation(PROJECT_ID);
  const updateMutation = useUserUpdateMutation(PROJECT_ID);
  const saving = saveMutation.isPending || updateMutation.isPending;

  const [rolesError, setRolesError] = React.useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [otp, setOtp] = React.useState<OtpRequest | null>(null);

  const roleIds = watch('roleIds');
  const loginName = watch('loginName');
  const userName = watch('userName');
  const email = watch('email');

  const toggleRole = (roleId: number) => {
    setRolesError(null);
    setValue(
      'roleIds',
      roleIds.includes(roleId)
        ? roleIds.filter((id) => id !== roleId)
        : [...roleIds, roleId],
      { shouldDirty: true },
    );
  };

  const pageTitle = isEdit ? 'Edit User' : 'New User Information';
  const pageDescription = isEdit
    ? 'Update account details and roles.'
    : 'Create an account and assign roles.';

  const onSubmit = handleSubmit((v) => {
    if (v.roleIds.length === 0) {
      setRolesError('At least one role must be selected.');
      return;
    }
    setRolesError(null);
    if (isEdit && seed) {
      // loginName 不可改，update 不携带（源同款）
      updateMutation.mutate(
        {
          userId: seed.userId,
          userName: v.userName.trim(),
          email: v.email.trim(),
          phone: v.phone.trim(),
          roleIds: v.roleIds,
        },
        {
          onSuccess: () => {
            toast.success('User updated successfully.');
            router.push(USER_LIST_PATH);
          },
        },
      );
      return;
    }
    saveMutation.mutate(
      {
        loginName: v.loginName.trim(),
        userName: v.userName.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        roleIds: v.roleIds,
      },
      {
        onSuccess: (resp) => {
          // OTP 开户流保留（有意偏差）：后端生成一次性密码，表单不收密码字段
          setOtp({
            title: 'Initial Password',
            message: `User created successfully. Initial password (one-time, change required on first login):\n\n${resp.oneTimePassword}\n\nPlease forward it to the user immediately.`,
            onAcknowledge: () => router.push(USER_LIST_PATH),
          });
        },
      },
    );
  });

  const selectedRoles = React.useMemo(
    () => roleOptions.filter((r) => roleIds.includes(r.roleId)),
    [roleOptions, roleIds],
  );

  if (isEdit && lookupQuery.isPending) {
    return (
      <div className="space-y-4">
        <DetailHeader title={pageTitle} description={pageDescription} />
        <DetailSkeleton />
      </div>
    );
  }

  if (isEdit && lookupQuery.data && !seed) {
    return (
      <div className="space-y-4">
        <DetailHeader title={pageTitle} description={pageDescription} />
        <div className="rounded-lg border-border/60 bg-card p-10 text-center shadow-float">
          <div className="text-sm font-semibold">User not found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This user does not exist or has been removed.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => router.push(USER_LIST_PATH)}
          >
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DetailHeader title={pageTitle} description={pageDescription} />

      {/* 原型 §3.6.4 例外形态：左 320px 实时预览卡（sticky）+ 右侧分区卡表单 */}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-float">
            <div
              aria-hidden="true"
              className="h-0.5 bg-gradient-to-r from-primary via-sky-500 to-primary"
            />
            <div className="space-y-4 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-base font-semibold text-muted-foreground"
                >
                  {previewInitials(userName, loginName)}
                </span>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold">
                      {userName || loginName || 'New User'}
                    </span>
                    {isEdit && seed && (
                      <ProtoStatusBadge
                        label={
                          LP_USER_STATUS_MAP[seed.status]?.label ??
                          String(seed.status)
                        }
                        tone={USER_STATUS_TONE[seed.status] ?? 'muted'}
                      />
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {email || '-'}
                  </div>
                </div>
              </div>

              <div className="border-t border-border/60 pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Roles
                  <Badge variant="secondary" className="tabular-nums">
                    {roleIds.length}
                  </Badge>
                </div>
                {selectedRoles.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedRoles.map((role) => (
                      <Badge key={role.roleId} variant="secondary">
                        {role.roleName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No role assigned yet.
                  </p>
                )}
              </div>

              {!isEdit && (
                <Alert variant="info">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>Setup email</AlertTitle>
                  <p className="text-sm">
                    After saving, the system sends a setup email with sign-in
                    instructions to the user.
                  </p>
                </Alert>
              )}
            </div>
          </div>
        </div>

        <form
          className="min-w-0 space-y-4"
          onSubmit={(e) => void onSubmit(e)}
          noValidate
        >
          <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
            <div className="mb-4 text-sm font-semibold">
              Basic Information
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                name="loginName"
                label="Username"
                required
                disabled={isEdit}
                maxLength={30}
                placeholder="Letters, digits and underscore, up to 30 characters"
                error={errors.loginName?.message}
                register={register('loginName', {
                  required: 'Username is required.',
                  pattern: {
                    value: USERNAME_PATTERN,
                    message:
                      'Username must be up to 30 characters and use only letters, digits, underscore or dot.',
                  },
                })}
              />
              <FormField
                name="email"
                label="Email"
                required
                type="email"
                error={errors.email?.message}
                register={register('email', {
                  required: 'Email is required.',
                  pattern: {
                    value: EMAIL_PATTERN,
                    message: 'Enter a valid email address.',
                  },
                  maxLength: {
                    value: 254,
                    message: 'Enter a valid email address.',
                  },
                })}
              />
              <FormField
                name="userName"
                label="Full Name"
                required
                maxLength={100}
                error={errors.userName?.message}
                register={register('userName', {
                  required: 'Full name is required (100 characters or fewer).',
                  maxLength: {
                    value: 100,
                    message:
                      'Full name is required (100 characters or fewer).',
                  },
                })}
              />
              <FormField
                name="phone"
                label="Phone"
                error={errors.phone?.message}
                register={register('phone', {
                  pattern: {
                    value: PHONE_PATTERN,
                    message: 'Enter a valid phone number.',
                  },
                })}
              />
            </div>
          </section>

          <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
            <div className="mb-1 text-sm font-semibold">Role</div>
            <p className="mb-4 text-sm text-muted-foreground">
              Assign at least one role. Roles control which modules this user
              can access.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {roleOptions.map((role) => (
                <RoleOptionCard
                  key={role.roleId}
                  role={role}
                  selected={roleIds.includes(role.roleId)}
                  onToggle={() => toggleRole(role.roleId)}
                />
              ))}
              {roleOptions.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  No options available
                </span>
              )}
            </div>
            {rolesError && (
              <p className="mt-2 text-xs font-medium text-destructive">
                {rolesError}
              </p>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                if (isDirty) setDiscardOpen(true);
                else router.push(USER_LIST_PATH);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </div>
        </form>
      </div>

      <ActionConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        icon={AlertTriangle}
        iconTone="warning"
        title="Discard changes?"
        body1="Your unsaved changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        confirmTone="destructive"
        onConfirm={() => {
          setDiscardOpen(false);
          router.push(USER_LIST_PATH);
        }}
      />
      <OtpDialog request={otp} onClose={() => setOtp(null)} />
    </div>
  );
}

/* ================================================================== */
/* 用户详情页（原型 UserDetailPage；/sys/user/detail?userId=）           */
/* ================================================================== */

export function UserDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get('userId');
  const userId = userIdParam ? Number(userIdParam) : null;

  // STATIC-FILLER(GAP-LP-08)：无单查端点——列表大页拉全量按 id 定位；
  // roleIds → 角色明细经 role options 本地映射
  const listQuery = useUserPageQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: USER_LOOKUP_PAGE_SIZE,
  });
  const { data: roleOptionsData } = useRoleOptionsQuery(PROJECT_ID);
  const roleOptions = roleOptionsData?.data ?? [];

  const user = React.useMemo(
    () =>
      userId != null
        ? (listQuery.data?.data ?? []).find((r) => r.userId === userId) ?? null
        : null,
    [userId, listQuery.data],
  );

  if (userId == null || Number.isNaN(userId) || (listQuery.data && !user)) {
    return (
      <div className="space-y-4">
        <DetailHeader title="User Details" />
        <div className="rounded-lg border-border/60 bg-card p-10 text-center shadow-float">
          <div className="text-sm font-semibold">User not found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This user does not exist or has been removed.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => router.push(USER_LIST_PATH)}
          >
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  if (listQuery.isPending || !user) {
    return (
      <div className="space-y-4">
        <DetailHeader title="User Details" />
        <DetailSkeleton />
      </div>
    );
  }

  const roles = (user.roleIds ?? [])
    .map((id) => roleOptions.find((r) => r.roleId === id))
    .filter((r): r is RoleRow => r != null);

  return (
    <div className="space-y-4">
      <DetailHeader
        title="User Details"
        badge={
          <ProtoStatusBadge
            label={
              LP_USER_STATUS_MAP[user.status]?.label ?? String(user.status)
            }
            tone={USER_STATUS_TONE[user.status] ?? 'muted'}
          />
        }
        description={
          <>
            <span>
              Username:{' '}
              <span className="text-foreground">{user.loginName || '-'}</span>
            </span>
            <span aria-hidden="true">|</span>
            <span>
              Created on{' '}
              <span className="text-foreground">
                {formatUtc8(user.createTime)}
              </span>
            </span>
          </>
        }
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
          <div className="mb-4 text-sm font-semibold">Basic Information</div>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField label="User ID">
              <span className="tabular-nums">{user.userId}</span>
            </DetailField>
            <DetailField label="Username">{user.loginName || '-'}</DetailField>
            <DetailField label="Full Name">{user.userName || '-'}</DetailField>
            <DetailField label="Email">
              <Dash value={user.email} />
            </DetailField>
            <DetailField label="Phone">
              <Dash value={user.phone} />
            </DetailField>
          </dl>
        </section>

        <section className="min-w-0 rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            Roles
            <Badge variant="secondary" className="tabular-nums">
              {roles.length}
            </Badge>
          </div>
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles assigned.</p>
          ) : (
            <ul className="min-w-0">
              {roles.map((role) => (
                <li
                  key={role.roleId}
                  className="flex min-w-0 flex-col gap-1 border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      {role.roleName}
                    </span>
                    <Badge variant="secondary">
                      {role.roleType === 0 ? 'Built-in' : 'Custom'}
                    </Badge>
                    <ProtoStatusBadge
                      label={
                        LP_USER_STATUS_MAP[role.status]?.label ??
                        String(role.status)
                      }
                      tone={USER_STATUS_TONE[role.status] ?? 'muted'}
                    />
                  </div>
                  {role.remarks ? (
                    <p className="break-all text-xs text-muted-foreground">
                      {role.remarks}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 菜单管理（源 views/system/menu）                                     */
/* ================================================================== */

function findMenuNode(
  nodes: MenuTree[],
  id: number,
): MenuTree | undefined {
  for (const n of nodes) {
    if (n.menuId === id) return n;
    const hit = n.children ? findMenuNode(n.children, id) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/** menuId=0 新建未保存节点的本地 seed（顶级=一级菜单 2，子级=二级菜单 3；openCreate 与脏状态 baseline 共用）。 */
function newMenuSeed(parentId: number): MenuTree {
  return {
    menuId: 0,
    menuName: '',
    menuNameEn: '',
    menuKey: '',
    parentId,
    menuType: parentId === 0 ? 2 : 3,
    orderNum: 0,
    visible: 0,
    menuUrl: '',
    icon: '',
  };
}

/** 脏状态比较覆盖的表单字段（编辑态 menuKey/类型/父级锁定，baseline 与 current 恒相等，不影响结果）。 */
const MENU_FORM_FIELDS = [
  'menuName',
  'menuNameEn',
  'menuKey',
  'parentId',
  'menuType',
  'orderNum',
  'visible',
  'menuUrl',
  'icon',
] as const;

/** 左侧菜单树（el-tree 等价：默认全展开、高亮当前、手风琴省略——源 default-expand-all）。 */
function MenuTreeNodes({
  nodes,
  depth,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
}: {
  nodes: MenuTree[];
  depth: number;
  selectedId: number | null;
  collapsed: Set<number>;
  onToggle: (menuId: number) => void;
  onSelect: (node: MenuTree) => void;
}) {
  return (
    <ul
      className={
        depth === 0
          ? 'select-none'
          : 'ml-3 select-none border-l border-border/60'
      }
    >
      {nodes.map((n) => {
        const hasChildren = (n.children?.length ?? 0) > 0;
        const isCollapsed = collapsed.has(n.menuId);
        return (
          <li key={n.menuId}>
            <div
              className={`flex h-8 items-center gap-1 rounded-md pr-2 text-sm ${
                selectedId === n.menuId
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
              style={{ paddingLeft: depth * 3 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                  onClick={() => onToggle(n.menuId)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span className="w-6 shrink-0" aria-hidden="true" />
              )}
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => onSelect(n)}
              >
                {n.menuName}
              </button>
            </div>
            {hasChildren && !isCollapsed && (
              <MenuTreeNodes
                nodes={n.children ?? []}
                depth={depth + 1}
                selectedId={selectedId}
                collapsed={collapsed}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 类型下拉文案（原型口径）：2/3 → Level-1/Level-2 Menu；0/1/4 保留旧码表文案兜底（既有节点防失配）。 */
const MENU_TYPE_LABEL: Record<number, string> = {
  0: `0 ${MENU_TYPE_TEXT[0]}`,
  1: `1 ${MENU_TYPE_TEXT[1]}`,
  2: 'Level-1 Menu',
  3: 'Level-2 Menu',
  4: `4 ${MENU_TYPE_TEXT[4]}`,
};

const MENU_TYPE_OPTIONS: SelectOption[] = [0, 1, 2, 3, 4].map((t) => ({
  value: String(t),
  label: MENU_TYPE_LABEL[t],
}));

/** 只读层级文案：2/3 按原型 First/Second-Level Menu，其余回旧码表兜底。 */
function menuLevelLabel(menuType?: number): string {
  if (menuType === 2) return 'First-Level Menu';
  if (menuType === 3) return 'Second-Level Menu';
  return MENU_TYPE_TEXT[menuType ?? -1] ?? String(menuType ?? '-');
}

export function MenuListPage() {
  const toast = useToast();
  const treeQuery = useMenuTreeQuery(PROJECT_ID);
  const tree = treeQuery.data ?? [];

  const [current, setCurrent] = React.useState<MenuTree | null>(null);
  const [collapsed, setCollapsed] = React.useState<Set<number>>(new Set());
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [formErrors, setFormErrors] = React.useState<{
    menuName?: string;
    menuNameEn?: string;
    menuKey?: string;
  }>({});

  // 树客户端过滤（原型 Filter menus）：key/中文名/英文名/路由 URL 包含匹配，保留祖先链
  const [treeFilter, setTreeFilter] = React.useState('');
  const filteredTree = React.useMemo(() => {
    const q = treeFilter.trim().toLowerCase();
    if (!q) return tree;
    const walk = (nodes: MenuTree[]): MenuTree[] =>
      nodes.flatMap((n) => {
        const hit = [n.menuKey, n.menuName, n.menuNameEn, n.menuUrl].some(
          (v) => (v ?? '').toLowerCase().includes(q),
        );
        const children = n.children ? walk(n.children) : [];
        return hit || children.length > 0 ? [{ ...n, children }] : [];
      });
    return walk(tree);
  }, [tree, treeFilter]);

  // menuId=0 为本地新建未保存节点；保存后后端才分配 ID
  const isEditing = current != null && current.menuId !== 0;

  const permsQuery = useMenuPermissionListQuery(
    PROJECT_ID,
    current?.menuKey ?? '',
    current != null && current.menuId !== 0,
  );
  // 本地新增未保存权限行（先入表，随「保存接口权限」逐行提交）
  const [localPerms, setLocalPerms] = React.useState<MenuPermissionItem[]>([]);
  const [permSaving, setPermSaving] = React.useState(false);
  const [newPerm, setNewPerm] = React.useState({ url: '', method: '' });

  const saveMutation = useMenuSaveMutation(PROJECT_ID);
  const updateMutation = useMenuUpdateMutation(PROJECT_ID);
  const removeMutation = useMenuRemoveMutation(PROJECT_ID);
  const permSaveMutation = useMenuPermissionSaveMutation(PROJECT_ID);
  const saving = saveMutation.isPending || updateMutation.isPending;

  // 树重载后按 menuId 重新定位当前节点，保持树数据与表单同源（源 loadTree 同款）
  React.useEffect(() => {
    if (current == null) return;
    setCurrent((c) => (c ? (findMenuNode(tree, c.menuId) ?? null) : c));
  }, [tree]);

  // 服务端已保存行 + 本地未保存行（源同一 perms 数组的合并视图）；
  // menuId=0 新建节点时源 openCreate 清空 perms → 这里不展示任何已保存行
  const serverPerms = permsQuery.data ?? [];
  const perms = React.useMemo(
    () => (isEditing ? [...serverPerms, ...localPerms] : []),
    [isEditing, serverPerms, localPerms],
  );

  // 脏状态仅作视觉提示（零交互）：menuId>0 与树内原始节点比，menuId=0 与 openCreate seed 比；
  // 保存成功 → 菜单域失效重载 → 上方 effect 重定位 current，dirty 随之归零
  const baseline = React.useMemo(
    () =>
      current == null
        ? null
        : current.menuId > 0
          ? (findMenuNode(tree, current.menuId) ?? null)
          : newMenuSeed(current.parentId ?? 0),
    [current, tree],
  );
  const dirty = React.useMemo(() => {
    if (current == null || baseline == null) return false;
    return MENU_FORM_FIELDS.some((f) => (current[f] ?? '') !== (baseline[f] ?? ''));
  }, [current, baseline]);

  const patchCurrent = (patch: Partial<MenuTree>) =>
    setCurrent((c) => (c ? { ...c, ...patch } : c));

  const onNodeClick = (node: MenuTree) => {
    setCurrent(node);
    setLocalPerms([]);
    setFormErrors({});
  };

  const openCreate = (parentId: number) => {
    // seed 口径：顶级为一级菜单(2)，子级为二级菜单(3)
    setCurrent(newMenuSeed(parentId));
    setLocalPerms([]);
    setFormErrors({});
  };

  const onSaveMenu = () => {
    if (current == null) return;
    const errs: typeof formErrors = {};
    if (!current.menuName?.trim()) errs.menuName = 'Please enter a menu name';
    if (!current.menuNameEn?.trim()) errs.menuNameEn = 'Please enter the English menu name';
    if (!current.menuKey?.trim()) errs.menuKey = 'Please enter a menu key';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (current.menuId === 0) {
      saveMutation.mutate(
        {
          menuName: current.menuName,
          menuNameEn: current.menuNameEn ?? '',
          menuKey: current.menuKey,
          parentId: current.parentId,
          menuType: current.menuType,
          orderNum: current.orderNum,
          visible: current.visible,
          menuUrl: current.menuUrl,
          icon: current.icon,
        },
        { onSuccess: () => toast.success('Saved. Menus take effect after re-login.') },
      );
      return;
    }
    // menuKey/类型/父级不可改，update 不携带（源同款）
    updateMutation.mutate(
      {
        menuId: current.menuId,
        menuName: current.menuName,
        menuNameEn: current.menuNameEn,
        orderNum: current.orderNum,
        visible: current.visible,
        menuUrl: current.menuUrl,
        icon: current.icon,
      },
      { onSuccess: () => toast.success('Saved. Menus take effect after re-login.') },
    );
  };

  const onDeleteMenu = () => {
    if (current == null || current.menuId === 0) return;
    setConfirm({
      title: 'Delete Menu',
      message: `Delete menu "${current.menuName}"? It will be rejected if child menus exist or the menu is referenced by roles.`,
      onConfirm: () =>
        removeMutation.mutate(current.menuId, {
          onSuccess: () => {
            toast.success('Deleted successfully');
            setCurrent(null);
            setLocalPerms([]);
          },
        }),
    });
  };

  const addPerm = () => {
    if (current == null) return;
    if (current.menuId === 0) {
      toast.warning('Save the menu first before managing API permissions');
      return;
    }
    const url = newPerm.url.trim();
    if (!url) {
      toast.warning('Please enter a URL');
      return;
    }
    // 先入本地表，随「保存接口权限」逐行提交
    setLocalPerms((prev) => [
      ...prev,
      {
        menuKey: current.menuKey,
        url,
        httpMethod: newPerm.method.trim() || undefined,
      },
    ]);
    setNewPerm({ url: '', method: '' });
  };

  const removePerm = (row: MenuPermissionItem, index: number) => {
    if (row.id) {
      // 后端仅提供 list/save(逐行新增)，删除已保存行随整菜单删除实现
      toast.warning('Deleting saved permission rows is not supported; to remove one, delete the whole menu and recreate it');
      return;
    }
    const localIndex = index - serverPerms.length;
    setLocalPerms((prev) => prev.filter((_, i) => i !== localIndex));
  };

  const savePerms = async () => {
    if (current == null || current.menuId === 0 || permSaving) return;
    if (localPerms.length === 0) {
      toast.info('No new permission rows to save');
      return;
    }
    setPermSaving(true);
    try {
      // 后端 save 为逐行写入(menuId + resourceUrl)，依次提交未保存行
      for (const p of localPerms) {
        await permSaveMutation.mutateAsync({
          menuId: current.menuId,
          resourceUrl: p.url,
          httpMethod: p.httpMethod,
        });
      }
      toast.success('API permissions saved — effective on new requests');
    } catch {
      /* 拦截器已提示 */
    } finally {
      setPermSaving(false);
      // 无论成败都按服务端重载，避免已写入行再次被当作新行重复提交
      setLocalPerms([]);
      void permsQuery.refetch();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            SYSTEM
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Menu Management
          </h1>
        </div>
        <PermButton menuKey="lp:menu" onClick={() => openCreate(0)}>
          Add Root Menu
        </PermButton>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* 左：菜单树（源 span 8/16 → lg 1/3） */}
        <div className="rounded-lg border-border/60 bg-card shadow-float">
          <div className="border-b px-4 py-3 text-sm font-semibold">Menu Tree</div>
          <div className="space-y-2 p-2">
            <Input
              aria-label="Filter menus"
              placeholder="Filter menus"
              value={treeFilter}
              onChange={(e) => setTreeFilter(e.target.value)}
            />
            {treeQuery.isLoading ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-7 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : tree.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No data
              </p>
            ) : filteredTree.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No menus match &quot;{treeFilter.trim()}&quot;
              </p>
            ) : (
              <MenuTreeNodes
                nodes={filteredTree}
                depth={0}
                selectedId={current?.menuId ?? null}
                collapsed={collapsed}
                onToggle={(menuId) =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(menuId)) next.delete(menuId);
                    else next.add(menuId);
                    return next;
                  })
                }
                onSelect={onNodeClick}
              />
            )}
          </div>
        </div>

        {/* 右：节点详情 + 接口权限（源 span 16/16 → lg 2/3） */}
        <div>
          {current == null ? (
            <div className="flex h-full min-h-64 items-center justify-center rounded-lg border-border/60 bg-card px-8 text-center text-sm text-muted-foreground shadow-float">
              Select a menu node on the left to view or edit it, or click Add
              Root Menu.
            </div>
          ) : (
            <div className="space-y-6 rounded-lg border-border/60 bg-card p-6 shadow-float">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-sm font-semibold">
                    {current.menuId === 0
                      ? (current.parentId ?? 0) === 0
                        ? 'New root menu'
                        : `New sub-menu of ${
                            findMenuNode(tree, current.parentId ?? 0)
                              ?.menuName ?? '-'
                          }`
                      : 'Menu Details'}
                  </span>
                  {current.menuId !== 0 && current.menuKey ? (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {current.menuKey}
                    </span>
                  ) : null}
                  {current.menuId === 0 && (
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      draft
                    </span>
                  )}
                </div>
                {dirty && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ● Unsaved changes
                  </span>
                )}
              </div>
              <dl className="grid gap-x-6 gap-y-4 border-b border-border/60 pb-4 sm:grid-cols-2">
                <DetailField label="Menu Level">
                  {menuLevelLabel(current.menuType)}
                </DetailField>
                <DetailField label="Parent Menu">
                  {(current.parentId ?? 0) === 0
                    ? 'None (root level)'
                    : (findMenuNode(tree, current.parentId ?? 0)?.menuName ??
                      '-')}
                </DetailField>
              </dl>
              <div className="max-w-xl space-y-4">
                <FormField
                  name="menuName"
                  label="Menu Name (ZH)"
                  required
                  error={formErrors.menuName}
                  value={current.menuName ?? ''}
                  onChange={(e) => patchCurrent({ menuName: e.target.value })}
                />
                <FormField
                  name="menuNameEn"
                  label="Menu Name (EN)"
                  required
                  error={formErrors.menuNameEn}
                  value={current.menuNameEn ?? ''}
                  onChange={(e) =>
                    patchCurrent({ menuNameEn: e.target.value })
                  }
                />
                <FormField
                  name="menuKey"
                  label="Menu Key"
                  required
                  disabled={isEditing}
                  placeholder="e.g. lp:user, unique"
                  error={formErrors.menuKey}
                  value={current.menuKey ?? ''}
                  onChange={(e) => patchCurrent({ menuKey: e.target.value })}
                />
                <div>
                  <Label className="mb-1.5 block">Type</Label>
                  <Select
                    disabled={isEditing}
                    value={String(current.menuType ?? 0)}
                    onValueChange={(v) => patchCurrent({ menuType: Number(v) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <FormField
                  name="orderNum"
                  label="Sort Order"
                  type="number"
                  min={0}
                  value={String(current.orderNum ?? 0)}
                  onChange={(e) =>
                    patchCurrent({
                      orderNum: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
                <div>
                  <Label className="mb-1.5 block">Visibility</Label>
                  <RadioGroup
                    value={String(current.visible ?? 0)}
                    onValueChange={(v) => patchCurrent({ visible: Number(v) })}
                    className="flex gap-6"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="0" /> Visible
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="1" /> Hidden
                    </label>
                  </RadioGroup>
                </div>
                <FormField
                  name="menuUrl"
                  label="Route Path"
                  placeholder="Frontend route, e.g. /system/user"
                  value={current.menuUrl ?? ''}
                  onChange={(e) => patchCurrent({ menuUrl: e.target.value })}
                />
                <FormField
                  name="icon"
                  label="Icon"
                  placeholder="Optional"
                  value={current.icon ?? ''}
                  onChange={(e) => patchCurrent({ icon: e.target.value })}
                />
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={onSaveMenu}
                  >
                    Save
                  </Button>
                  <PermButton
                    menuKey="lp:menu"
                    variant="outline"
                    onClick={() => openCreate(current.menuId)}
                  >
                    Add Sub-Menu
                  </PermButton>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={onDeleteMenu}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="mb-2 text-sm font-semibold">
                  API Permissions (method + URL pattern; wildcards supported)
                </div>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Method
                        </th>
                        <th className="px-3 py-2 text-left font-medium">URL</th>
                        <th className="w-20 px-3 py-2 text-left font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {perms.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-6 text-center text-muted-foreground"
                          >
                            {permsQuery.isLoading ? 'Loading…' : 'No data'}
                          </td>
                        </tr>
                      )}
                      {perms.map((p, i) => (
                        <tr key={p.id ?? `local-${i}`} className="border-t">
                          <td className="px-3 py-2">
                            <code className="text-xs">{p.httpMethod || '*'}</code>
                          </td>
                          <td className="break-all px-3 py-2">{p.url}</td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-destructive hover:underline"
                              onClick={() => removePerm(p, i)}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input
                    aria-label="Permission URL"
                    placeholder="e.g. /lp/user/**"
                    className="w-64"
                    value={newPerm.url}
                    onChange={(e) =>
                      setNewPerm((p) => ({ ...p, url: e.target.value }))
                    }
                  />
                  <Input
                    aria-label="Permission Method"
                    placeholder="POST/GET, empty = any"
                    className="w-40"
                    value={newPerm.method}
                    onChange={(e) =>
                      setNewPerm((p) => ({ ...p, method: e.target.value }))
                    }
                  />
                  <Button type="button" onClick={addPerm}>
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-emerald-600 hover:text-emerald-700"
                    disabled={permSaving}
                    onClick={() => void savePerms()}
                  >
                    Save API Permissions
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

