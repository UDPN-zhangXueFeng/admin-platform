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
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
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

import {
  LP_PROJECT_ID,
  MENU_TYPE_TEXT,
  USER_STATUS_TEXT,
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

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;
/** 下拉「全部」哨兵（FormSelect 禁空 value，非 ALL 即转 number 参与查询）。 */
const ALL = 'all';

/** 源 fmtTime：toLocaleString('zh-CN', { hour12: false })；空值（含 0）'-'。 */
function fmtTime(ms?: number): string {
  return ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-';
}

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
          <Button onClick={onClose}>I Have Passed It On</Button>
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

const USER_STATUS_OPTIONS: SelectOption[] = [
  { value: ALL, label: 'All' },
  { value: '0', label: 'Normal' },
  { value: '1', label: 'Disabled' },
];

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

/** 新增/编辑用户弹窗（源 user-dialog.vue；挂载即打开，closed(saved) 回传）。 */
function UserFormDialog({
  state,
  roleOptions,
  onOtp,
  onClose,
}: {
  state: { mode: 'create' } | { mode: 'edit'; row: UserRow };
  roleOptions: RoleRow[];
  onOtp: (req: OtpRequest) => void;
  onClose: (saved: boolean) => void;
}) {
  const toast = useToast();
  const isEdit = state.mode === 'edit';
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<{
    loginName: string;
    userName: string;
    email: string;
    phone: string;
    roleIds: number[];
  }>({
    defaultValues: isEdit
      ? {
          loginName: state.row.loginName,
          userName: state.row.userName,
          email: state.row.email ?? '',
          phone: state.row.phone ?? '',
          roleIds: [...(state.row.roleIds ?? [])],
        }
      : { loginName: '', userName: '', email: '', phone: '', roleIds: [] },
  });

  const saveMutation = useUserSaveMutation(PROJECT_ID);
  const updateMutation = useUserUpdateMutation(PROJECT_ID);
  const saving = saveMutation.isPending || updateMutation.isPending;
  // 新增成功后 OTP 弹窗展示期间禁止关闭本弹窗（源 alert 阻塞语义）。
  const awaitingOtp = React.useRef(false);

  const roleIds = watch('roleIds');
  const toggleRole = (roleId: number, checked: boolean) => {
    setValue(
      'roleIds',
      checked
        ? [...roleIds, roleId]
        : roleIds.filter((id) => id !== roleId),
      { shouldDirty: true },
    );
  };

  const onSubmit = handleSubmit((v) => {
    const roleIdsNums = v.roleIds;
    if (isEdit) {
      // loginName 不可改，update 不携带（源同款）
      updateMutation.mutate(
        {
          userId: state.row.userId,
          userName: v.userName,
          email: v.email,
          phone: v.phone,
          roleIds: roleIdsNums,
        },
        {
          onSuccess: () => {
            toast.success('Saved successfully');
            onClose(true);
          },
        },
      );
      return;
    }
    saveMutation.mutate(
      {
        loginName: v.loginName,
        userName: v.userName,
        email: v.email,
        phone: v.phone,
        roleIds: roleIdsNums,
      },
      {
        onSuccess: (resp) => {
          // 先弹初始密码（一次性，首登强制改密），「我已抄送」后再关闭重载
          awaitingOtp.current = true;
          onOtp({
            title: 'Initial Password',
            message: `User created successfully. Initial password (one-time, change required on first login):\n\n${resp.oneTimePassword}\n\nPlease forward it to the user immediately.`,
            onAcknowledge: () => {
              awaitingOtp.current = false;
              onClose(true);
            },
          });
        },
      },
    );
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving && !awaitingOtp.current) onClose(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'New User'}</DialogTitle>
        </DialogHeader>
        <form
          id="user-form"
          className="space-y-4"
          onSubmit={(e) => void onSubmit(e)}
        >
          <FormField
            name="loginName"
            label="Login Name"
            required
            disabled={isEdit}
            maxLength={30}
            placeholder="Globally unique; letters/digits/underscore, max 30 chars"
            error={errors.loginName?.message}
            register={register('loginName', { required: 'Please enter a login name' })}
          />
          <FormField
            name="userName"
            label="Name"
            required
            error={errors.userName?.message}
            register={register('userName', { required: 'Please enter a name' })}
          />
          <FormField
            name="email"
            label="Email"
            register={register('email')}
          />
          <FormField
            name="phone"
            label="Phone"
            register={register('phone')}
          />
          <div>
            <Label className="mb-1.5 block">Roles</Label>
            <RoleCheckboxList
              roleIds={roleIds}
              roleOptions={roleOptions}
              onToggle={toggleRole}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Assign roles (adjustable after saving)
            </p>
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onClose(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="user-form"
            disabled={saving}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

export function UserListPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, control } =
    useForm<UserFilterForm>({ defaultValues: EMPTY_USER_FILTER });
  const [params, setParams] = React.useState<UserQueryParams>(() =>
    userFormToParams(EMPTY_USER_FILTER),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const [formDialog, setFormDialog] = React.useState<
    { mode: 'create' } | { mode: 'edit'; row: UserRow } | null
  >(null);
  const [rolesRow, setRolesRow] = React.useState<UserRow | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [otp, setOtp] = React.useState<OtpRequest | null>(null);

  // 角色选项一次拉足（pageSize:200，取舍见 role 域 role.queries 头注释），三弹窗共用
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

  const statusMutation = useUserStatusMutation(PROJECT_ID);
  const resetPwdMutation = useUserResetPwdMutation();
  const forceLogoutMutation = useUserForceLogoutMutation();

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;

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
      { accessorKey: 'userId', header: 'User ID' },
      { accessorKey: 'loginName', header: 'Login Name' },
      { accessorKey: 'userName', header: 'Name' },
      { accessorKey: 'status', header: 'Status',
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
          <Badge
            variant={row.original.status === 0 ? 'default' : 'secondary'}
          >
            {USER_STATUS_TEXT[row.original.status] ?? row.original.status}
          </Badge>
        </div>
      ), },
      { accessorKey: 'phone', header: 'Phone',
      cell: ({ row }) => row.original.phone || '-', },
      { accessorKey: 'createTime', header: 'Created At',
      cell: ({ row }) => fmtTime(row.original.createTime), },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() =>
                setFormDialog({ mode: 'edit', row: row.original })
              }
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => setRolesRow(row.original)}
            >
              Assign Roles
            </Button>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-amber-600 hover:underline"
              onClick={() => onResetPwd(row.original)}
            >
              Reset Password
            </Button>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-destructive hover:underline"
              onClick={() => onForceLogout(row.original)}
            >
              Force Logout
            </Button>
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
          onClick={() => setFormDialog({ mode: 'create' })}
        >
          New User
        </PermButton>
      </div>

      <form
        onSubmit={handleSubmit((f) => setParams(userFormToParams(f, 1)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="loginName"
            label="Login Name"
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
          <div className="text-sm font-semibold">User List</div>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={listQuery.isLoading}
          emptyMessage="No data"
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

      {formDialog && (
        <UserFormDialog
          state={formDialog}
          roleOptions={roleOptions}
          onOtp={setOtp}
          onClose={(saved) => setFormDialog(null)}
        />
      )}
      {rolesRow && (
        <AssignRoleDialog
          row={rolesRow}
          roleOptions={roleOptions}
          onClose={(saved) => setRolesRow(null)}
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
    <ul className="select-none">
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
              style={{ paddingLeft: depth * 16 }}
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
                nodes={n.children!}
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

const MENU_TYPE_OPTIONS: SelectOption[] = [0, 1, 2, 3, 4].map((t) => ({
  value: String(t),
  label: `${t} ${MENU_TYPE_TEXT[t]}`,
}));

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

  // 服务端已保存行 + 本地未保存行（源同一 perms 数组的合并视图）
  const serverPerms = permsQuery.data ?? [];
  const perms = React.useMemo(
    () => [...serverPerms, ...localPerms],
    [serverPerms, localPerms],
  );

  const patchCurrent = (patch: Partial<MenuTree>) =>
    setCurrent((c) => (c ? { ...c, ...patch } : c));

  const onNodeClick = (node: MenuTree) => {
    setCurrent(node);
    setLocalPerms([]);
    setFormErrors({});
  };

  const openCreate = (parentId: number) => {
    // seed 口径：顶级为一级菜单(2)，子级为二级菜单(3)
    setCurrent({
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
    });
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
        { onSuccess: () => toast.success('Saved successfully — menus take effect after re-login') },
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
      { onSuccess: () => toast.success('Saved successfully — menus take effect after re-login') },
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
          New Top Level
        </PermButton>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 左：菜单树（源 span 8/16 → lg 1/3） */}
        <div className="rounded-lg border-border/60 bg-card shadow-float">
          <div className="border-b px-4 py-3 text-sm font-semibold">Menu Tree</div>
          <div className="p-2">
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
            ) : (
              <MenuTreeNodes
                nodes={tree}
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
        <div className="lg:col-span-2">
          {current == null ? (
            <div className="flex h-full min-h-64 items-center justify-center rounded-lg border-border/60 bg-card text-sm text-muted-foreground shadow-float">
              Select a menu node on the left to view/edit
            </div>
          ) : (
            <div className="space-y-6 rounded-lg border-border/60 bg-card p-6 shadow-float">
              <div className="text-sm font-semibold">
                Node Details: {current.menuName || 'New Menu'}
              </div>
              <div className="max-w-xl space-y-4">
                <FormField
                  name="menuName"
                  label="Menu Name"
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
                    New Child Node
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
                  API Permissions (method + URL, aligned with the AuthFilter permission table, Ant wildcards supported)
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

