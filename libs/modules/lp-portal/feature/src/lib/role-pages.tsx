'use client';

/**
 * 角色管理（C2，源 `views/system/role/{index,role-dialog,assign-menu-dialog}.vue`
 * 1:1 迁移）。
 *
 * 源语义要点：
 * - 查询：角色编码 / 角色名称均模糊匹配；POST /lp/role/page 固定 pageSize 10；
 * - 菜单树页面级一次加载（GET /lp/menu/tree），供分配菜单弹窗回显共用；
 * - 表格列：roleCode/roleName/类型（0 内置 danger / 1 自定义 primary）/
 *   状态（0 正常 success / 1 停用 info）/备注（空 '-'）/操作；
 * - 删除：内置角色（roleType===0）按钮禁用 + tooltip「内置角色不可删除」；
 *   自定义 → confirm「删除角色「xx」?被用户引用的角色无法删除。」→
 *   POST /lp/role/delete/{roleId}；内置 23_0007/被引用 23_0006 由后端拒绝；
 * - 角色弹窗：roleCode 必填（≤30，编辑禁用）/roleName 必填/备注 textarea；
 *   编辑 update 不携带 roleCode；新增 save（roleType 后端固定 1 自定义）；
 * - 分配菜单弹窗（关键边界，见 AssignMenuDialog 头注释）：回显仅勾叶子 +
 *   保存合并半选父；空勾选先二次确认清空；保存成功后父页不重查列表
 *   （授权不改角色行字段）；
 * - 「新增角色」v-perm 'lp:role'（操作列按钮无 v-perm，源同款）。
 *
 * 源系统页无 0024 降级条：错误一律由 lp-client 拦截器统一 toast，旧数据保留。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ListTree, MoreVertical } from 'lucide-react';

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  LP_PROJECT_ID,
  useMenuTreeQuery,
  useRoleAssignMenuMutation,
  useRoleMenuIdsQuery,
  useRolePageQuery,
  useRoleRemoveMutation,
  useRoleSaveMutation,
  useRoleUpdateMutation,
  type MenuTree,
  type RoleRow,
} from '@myorg/modules/lp-portal/data-access';

import { PermButton } from './perm-button';
import { formatUtc8 } from './proto-format';
import { Dash, ProtoStatusBadge, type ProtoTone } from './proto-ui';
import { LP_ROLE_STATUS_MAP } from './proto-enums';
import { ProtoSortHeader, useProtoSort } from './proto-sort';

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;

/** 角色域路由（registry 组前缀 /sys/role；detail 为子 pageKey）。 */
const ROLE_LIST_PATH = '/sys/role';

/**
 * STATIC-FILLER(GAP-LP-08): 无角色单查端点——详情页回显以 /lp/role/page
 * 大页拉全量按 roleCode 定位（后端补 GET /roles/:roleCode 后切换）。
 */
const ROLE_LOOKUP_PAGE_SIZE = 200;

/** 角色状态语义色（原型 StatusBadge：Active=success / Inactive=warning）。 */
const ROLE_STATUS_TONE: Record<number, 'success' | 'warning'> = {
  0: 'success',
  1: 'warning',
};

interface RoleFilterForm {
  roleCode: string;
  roleName: string;
}

const EMPTY_ROLE_FILTER: RoleFilterForm = { roleCode: '', roleName: '' };

interface RoleQueryParams {
  pageNum: number;
  roleCode?: string;
  roleName?: string;
}

function roleFormToParams(f: RoleFilterForm, pageNum = 1): RoleQueryParams {
  return {
    pageNum,
    roleCode: f.roleCode.trim() || undefined,
    roleName: f.roleName.trim() || undefined,
  };
}

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

/* ================================================================== */
/* 菜单分配树（el-tree show-checkbox check-strictly=false 等价）         */
/* ================================================================== */

/**
 * 树勾选状态（源 el-tree check-strictly=false 的 React 等价策略）：
 *
 * 仅以「叶子 menuId 集」作唯一事实源（el-tree setCheckedKeys 只写叶子的
 * 前置约束），父节点全选/半选由树结构推导——规避受控树回写父键导致的级联
 * 误勾：
 * - 回显：服务端全量 ids ∩ 树叶子集（源 filterLeafIds），只写叶子；
 * - 勾选交互：勾任意节点 = 勾其子树全部叶子（check-strictly=false 级联）；
 * - 保存：全选节点（子树叶子全在集内）+ 半选节点（部分在）合并去重，
 *   等价 getCheckedKeys(false) + getHalfCheckedKeys()。
 *
 * 边界（源同款）：仅勾父无叶子的历史授权回显为空属预期，保存时半选父
 * 由推导兜底不丢。
 */

/** 源 filterLeafIds 第一步：收集树中无 children（或空）节点的 menuId。 */
function collectLeafIds(nodes: MenuTree[], into: Set<number>): void {
  for (const n of nodes) {
    if (!n.children || n.children.length === 0) into.add(n.menuId);
    else collectLeafIds(n.children, into);
  }
}

/** 节点子树全部叶子 id（叶节点返回自身）。 */
function subtreeLeafIds(node: MenuTree): number[] {
  if (!node.children || node.children.length === 0) return [node.menuId];
  return node.children.flatMap(subtreeLeafIds);
}

interface MenuCheckNode {
  node: MenuTree;
  /** 全选：子树叶子全部勾选（叶节点即自身勾选）。 */
  fullyChecked: boolean;
  /** 半选：部分（非全部）子树叶子勾选。 */
  indeterminate: boolean;
}

function toCheckNode(node: MenuTree, checked: Set<number>): MenuCheckNode {
  const leaves = subtreeLeafIds(node);
  const hit = leaves.filter((id) => checked.has(id)).length;
  return {
    node,
    fullyChecked: hit === leaves.length,
    indeterminate: hit > 0 && hit < leaves.length,
  };
}

function MenuCheckTreeNodes({
  nodes,
  depth,
  checked,
  disabled,
  onToggle,
}: {
  nodes: MenuTree[];
  depth: number;
  checked: Set<number>;
  disabled: boolean;
  onToggle: (node: MenuTree, next: boolean) => void;
}) {
  return (
    <ul
      className={
        depth === 0
          ? 'select-none'
          : 'ml-2.5 select-none border-l border-border/60'
      }
    >
      {nodes.map((raw) => {
        const { node, fullyChecked, indeterminate } = toCheckNode(
          raw,
          checked,
        );
        return (
          <li key={node.menuId}>
            <label
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-muted/60"
              style={{ paddingLeft: `${depth * 9 + 4}px` }}
            >
              <Checkbox
                aria-label={node.menuName}
                checked={
                  fullyChecked ? true : indeterminate ? 'indeterminate' : false
                }
                disabled={disabled}
                onCheckedChange={(v) => onToggle(node, v === true)}
              />
              <span>{node.menuName}</span>
              {indeterminate && (
                <span
                  className="text-xs text-muted-foreground"
                  aria-hidden="true"
                >
                  partial
                </span>
              )}
            </label>
            {node.children && node.children.length > 0 && (
              <MenuCheckTreeNodes
                nodes={node.children}
                depth={depth + 1}
                checked={checked}
                disabled={disabled}
                onToggle={onToggle}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}


/* ================================================================== */
/* 新增/编辑角色弹窗（源 role-dialog.vue）                                */
/* ================================================================== */

function RoleFormDialog({
  state,
  onClose,
}: {
  state: { mode: 'create' } | { mode: 'edit'; row: RoleRow };
  onClose: (saved: boolean) => void;
}) {
  const toast = useToast();
  const isEdit = state.mode === 'edit';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ roleCode: string; roleName: string; remarks: string }>({
    defaultValues: isEdit
      ? {
          roleCode: state.row.roleCode,
          roleName: state.row.roleName,
          remarks: state.row.remarks ?? '',
        }
      : { roleCode: '', roleName: '', remarks: '' },
  });

  const saveMutation = useRoleSaveMutation(PROJECT_ID);
  const updateMutation = useRoleUpdateMutation(PROJECT_ID);
  const saving = saveMutation.isPending || updateMutation.isPending;

  const onSubmit = handleSubmit((v) => {
    if (isEdit) {
      // roleCode 不可改，update 不携带（源同款）
      updateMutation.mutate(
        {
          roleId: state.row.roleId,
          roleName: v.roleName,
          remarks: v.remarks,
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
      { roleCode: v.roleCode, roleName: v.roleName, remarks: v.remarks },
      {
        onSuccess: () => {
          toast.success('Saved successfully');
          onClose(true);
        },
      },
    );
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Role' : 'New Role'}</DialogTitle>
        </DialogHeader>
        <form
          id="role-form"
          className="space-y-4"
          onSubmit={(e) => void onSubmit(e)}
        >
          <FormField
            name="roleCode"
            label="Role Code"
            required
            disabled={isEdit}
            maxLength={30}
            placeholder="e.g. ROLE_LP_FINANCE, unique"
            error={errors.roleCode?.message}
            register={register('roleCode', { required: 'Please enter a role code' })}
          />
          <FormField
            name="roleName"
            label="Role Name"
            required
            error={errors.roleName?.message}
            register={register('roleName', { required: 'Please enter a role name' })}
          />
          <div>
            <label htmlFor="role-remarks" className="mb-1.5 block text-sm">
              Remarks
            </label>
            <Textarea id="role-remarks" rows={2} {...register('remarks')} />
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
          <Button type="submit" form="role-form" disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 角色管理列表页（原型 RoleManagementPage）                             */
/* ================================================================== */

/** 列表统计卡（同 system-pages 口径：顶部语义色条 + label + 大数值 + 脚注）。 */
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

export function RoleListPage() {
  const toast = useToast();
  const router = useRouter();
  const { register, handleSubmit, reset } =
    useForm<RoleFilterForm>({ defaultValues: EMPTY_ROLE_FILTER });
  const [params, setParams] = React.useState<RoleQueryParams>(() =>
    roleFormToParams(EMPTY_ROLE_FILTER),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const [formDialog, setFormDialog] = React.useState<
    { mode: 'create' } | { mode: 'edit'; row: RoleRow } | null
  >(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  const listQuery = useRolePageQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      roleCode: params.roleCode,
      roleName: params.roleName,
    },
  });
  const removeMutation = useRoleRemoveMutation(PROJECT_ID);

  // STATIC-FILLER(GAP-LP-09)：统计卡无 stats 端点——不筛全量大页本地计数
  const statsQuery = useRolePageQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: ROLE_LOOKUP_PAGE_SIZE,
  });
  const statsRows = statsQuery.data?.data ?? [];
  const statsReady = statsQuery.data != null;

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const hasFilter = params.roleCode != null || params.roleName != null;

  const onDelete = (row: RoleRow) => {
    setConfirm({
      title: 'Delete this role?',
      message: `Once deleted, ${row.roleName} (${row.roleCode}) will no longer be available for assignment. This action cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: () =>
        removeMutation.mutate(row.roleId, {
          onSuccess: () => toast.success('Role deleted successfully.'),
        }),
    });
  };

  // 服务端 /lp/role/page 无排序参数——客户端当前页排序（GAP-LP-05 口径，
  // 后端补排序后切换）
  const sortGetters = React.useMemo(
    () => ({
      roleCode: { value: (r: RoleRow) => r.roleCode },
      roleName: { value: (r: RoleRow) => r.roleName },
      type: { value: (r: RoleRow) => (r.roleType === 0 ? 0 : 1) },
      status: {
        value: (r: RoleRow) => LP_ROLE_STATUS_MAP[r.status]?.rank ?? r.status,
      },
    }),
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.roleId) })),
    [rows],
  );
  const { sorted, toggle, sortState } = useProtoSort(
    tableData,
    sortGetters,
    'roleCode',
    'asc',
  );

  const columns = React.useMemo<ColumnDef<RoleRow & { id: string }>[]>(
    () => [
      {
        accessorKey: 'roleCode',
        header: () => (
          <ProtoSortHeader
            label="Role Code"
            columnKey="roleCode"
            toggle={toggle}
            sortState={sortState('roleCode')}
          />
        ),
      },
      {
        accessorKey: 'roleName',
        header: () => (
          <ProtoSortHeader
            label="Role Name"
            columnKey="roleName"
            toggle={toggle}
            sortState={sortState('roleName')}
          />
        ),
      },
      {
        accessorKey: 'roleType',
        header: () => (
          <ProtoSortHeader
            label="Type"
            columnKey="type"
            toggle={toggle}
            sortState={sortState('type')}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={row.original.roleType === 0 ? 'default' : 'secondary'}>
            {row.original.roleType === 0 ? 'Built-in' : 'Custom'}
          </Badge>
        ),
      },
      {
        accessorKey: 'remarks',
        header: 'Description',
        cell: ({ row }) => <Dash value={row.original.remarks} />,
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
        cell: ({ row }) => (
          <ProtoStatusBadge
            label={
              LP_ROLE_STATUS_MAP[row.original.status]?.label ??
              String(row.original.status)
            }
            tone={ROLE_STATUS_TONE[row.original.status] ?? 'muted'}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                router.push({
                  pathname: `${ROLE_LIST_PATH}/detail`,
                  query: { roleCode: row.original.roleCode },
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
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setFormDialog({ mode: 'edit', row: row.original })}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    router.push({
                      pathname: `${ROLE_LIST_PATH}/detail`,
                      query: {
                        roleCode: row.original.roleCode,
                        assignMenus: '1',
                      },
                    })
                  }
                >
                  Assign Menus
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={row.original.roleType === 0}
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(row.original)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [toggle, sortState],
  );

  const statItems: {
    label: string;
    value: React.ReactNode;
    help: string;
    tone: ProtoTone;
  }[] = [
    {
      label: 'Total roles',
      value: statsReady ? statsRows.length : '-',
      help: 'All roles in this LP',
      tone: 'primary',
    },
    {
      label: 'Built-in',
      value: statsReady
        ? statsRows.filter((r) => r.roleType === 0).length
        : '-',
      help: 'Provided by the system, cannot be deleted',
      tone: 'info',
    },
    {
      label: 'Custom',
      value: statsReady
        ? statsRows.filter((r) => r.roleType !== 0).length
        : '-',
      help: 'Created by LP administrators',
      tone: 'success',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          SYSTEM
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Role Management
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statItems.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <form
        onSubmit={handleSubmit((f) => setParams(roleFormToParams(f, 1)))}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Search Criteria</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="roleCode"
            label="Role Code"
            placeholder="Fuzzy match"
            register={register('roleCode')}
          />
          <FormField
            name="roleName"
            label="Role Name"
            placeholder="Fuzzy match"
            register={register('roleName')}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset(EMPTY_ROLE_FILTER);
              setParams(roleFormToParams(EMPTY_ROLE_FILTER, 1));
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            Roles
            <Badge variant="secondary" className="tabular-nums">
              {total}
            </Badge>
            <span className="text-xs font-normal text-muted-foreground">
              Updated {formatUtc8(listQuery.dataUpdatedAt)}
            </span>
          </div>
          <PermButton
            menuKey="lp:role"
            onClick={() => setFormDialog({ mode: 'create' })}
          >
            New Role
          </PermButton>
        </div>
        <DataTable
          columns={columns}
          data={sorted}
          isLoading={listQuery.isLoading}
          emptyMessage={
            hasFilter
              ? 'No records found. Try changing the filters.'
              : 'No roles yet. Create your first role.'
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

      {formDialog && (
        <RoleFormDialog state={formDialog} onClose={() => setFormDialog(null)} />
      )}
      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

/* ================================================================== */
/* 角色详情页（原型 RoleDetailPage；/sys/role/detail?roleCode=）         */
/* ================================================================== */

/** 详情/表单只读字段（label 上 / 值下加粗）。 */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium capitalize text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 min-w-0 break-all text-sm font-semibold">
        {children}
      </dd>
    </div>
  );
}

/** 详情页头（← 返回 + 标题 + 状态徽章 + 元信息行 + actions 槽）。 */
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

/** 树全节点数（toast「{selected} of {total} menus」分母）。 */
function countTreeNodes(nodes: MenuTree[]): number {
  return nodes.reduce(
    (acc, n) => acc + 1 + (n.children?.length ? countTreeNodes(n.children) : 0),
    0,
  );
}

export function RoleDetailPage() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleCode = searchParams.get('roleCode');
  const assignDirect = searchParams.get('assignMenus') === '1';

  // STATIC-FILLER(GAP-LP-08)：无角色单查端点——列表大页拉全量按 roleCode 定位
  const listQuery = useRolePageQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: ROLE_LOOKUP_PAGE_SIZE,
  });
  const role = React.useMemo(
    () =>
      roleCode
        ? (listQuery.data?.data ?? []).find((r) => r.roleCode === roleCode) ??
          null
        : null,
    [roleCode, listQuery.data],
  );

  const treeQuery = useMenuTreeQuery(PROJECT_ID);
  const menuTree = treeQuery.data ?? [];
  const menuIdsQuery = useRoleMenuIdsQuery(
    PROJECT_ID,
    role?.roleId ?? 0,
    role != null,
  );
  const menuIds = menuIdsQuery.data ?? [];

  // Assign Menus 抽屉草稿（叶子勾选口径，同源 assign-menu-dialog）
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [checked, setChecked] = React.useState<Set<number>>(new Set());
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const echoed = React.useRef(false);

  const treeLeafIds = React.useMemo(() => {
    const s = new Set<number>();
    collectLeafIds(menuTree, s);
    return s;
  }, [menuTree]);

  // 回显：服务端全量 ids ∩ 树叶子集 → 只写叶子（每次开抽屉一次，防重放覆盖用户操作）
  React.useEffect(() => {
    if (!assignOpen) {
      echoed.current = false;
      return;
    }
    if (echoed.current || menuIdsQuery.data == null) return;
    echoed.current = true;
    setChecked(
      new Set(menuIdsQuery.data.filter((id) => treeLeafIds.has(id))),
    );
  }, [assignOpen, menuIdsQuery.data, treeLeafIds]);

  // 列表 ⋮「Assign Menus」经 ?assignMenus=1 直达：开抽屉后 replace 清参（§3.16.2）
  const directHandled = React.useRef(false);
  React.useEffect(() => {
    if (!assignDirect || directHandled.current || role == null) return;
    directHandled.current = true;
    setAssignOpen(true);
    router.replace({
      pathname: `${ROLE_LIST_PATH}/detail`,
      query: { roleCode: role.roleCode },
    });
  }, [assignDirect, role, router]);

  const assignMutation = useRoleAssignMenuMutation(PROJECT_ID);
  const saving = assignMutation.isPending;

  const onToggle = (node: MenuTree, next: boolean) => {
    const leaves = subtreeLeafIds(node);
    setChecked((prev) => {
      const next2 = new Set(prev);
      for (const id of leaves) {
        if (next) next2.add(id);
        else next2.delete(id);
      }
      return next2;
    });
  };

  const onSaveMenus = () => {
    if (role == null) return;
    // 全选节点（子树叶子全勾）+ 半选节点（部分勾）合并去重，保仅父授权不丢
    const ids: number[] = [];
    const walk = (nodes: MenuTree[]) => {
      for (const n of nodes) {
        const { fullyChecked, indeterminate } = toCheckNode(n, checked);
        if (fullyChecked || indeterminate) ids.push(n.menuId);
        if (n.children && n.children.length > 0) walk(n.children);
      }
    };
    walk(menuTree);
    const grantedIds = [...new Set(ids)];
    const submit = () =>
      assignMutation.mutate(
        { roleId: role.roleId, menuIds: grantedIds },
        {
          onSuccess: () => {
            toast.success(
              `Menu access updated for "${role.roleName || role.roleCode}" (${grantedIds.length} of ${countTreeNodes(menuTree)} menus).`,
            );
            setAssignOpen(false);
          },
        },
      );
    if (grantedIds.length === 0) {
      // 源空勾选二次确认：后端空数组 = 事务清空该角色全部菜单
      setConfirm({
        title: 'Clear Menus',
        message: 'Will clear all menus of this role. Continue?',
        confirmText: 'Clear',
        onConfirm: submit,
      });
      return;
    }
    submit();
  };

  // STATIC-FILLER(GAP-LP-13)：授权载体为 menuIds（number[]）——按树序遍历映射
  // 菜单名（原型为 menuKeys；后端补 key 载体后切换）
  const assignedMenus = React.useMemo(() => {
    const ids = new Set(menuIds);
    const out: MenuTree[] = [];
    const walk = (nodes: MenuTree[]) => {
      for (const n of nodes) {
        if (ids.has(n.menuId)) out.push(n);
        if (n.children && n.children.length > 0) walk(n.children);
      }
    };
    walk(menuTree);
    return out;
  }, [menuTree, menuIds]);

  if (roleCode == null || (listQuery.data != null && role == null)) {
    return (
      <div className="space-y-4">
        <DetailHeader title="Role Details" />
        <div className="rounded-lg border-border/60 bg-card p-10 text-center shadow-float">
          <div className="text-sm font-semibold">Role not found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This role does not exist or has been removed.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => router.push(ROLE_LIST_PATH)}
          >
            Back to Roles
          </Button>
        </div>
      </div>
    );
  }

  if (listQuery.isPending || role == null) {
    return (
      <div className="space-y-4">
        <DetailHeader title="Role Details" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-muted/60"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DetailHeader
        title="Role Details"
        badge={
          <ProtoStatusBadge
            label={LP_ROLE_STATUS_MAP[role.status]?.label ?? String(role.status)}
            tone={ROLE_STATUS_TONE[role.status] ?? 'muted'}
          />
        }
        description={
          <>
            <span>
              Role Code:{' '}
              <span className="text-foreground">{role.roleCode}</span>
            </span>
            <span aria-hidden="true">|</span>
            <span>
              Created on{' '}
              <span className="text-foreground">
                {formatUtc8(role.createTime)}
              </span>
            </span>
          </>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => setAssignOpen(true)}
          >
            <ListTree className="h-4 w-4" aria-hidden="true" />
            Assign Menus
          </Button>
        }
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
          <div className="mb-4 text-sm font-semibold">Basic Information</div>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField label="Role Code">{role.roleCode}</DetailField>
            <DetailField label="Role Name">
              <Dash value={role.roleName} />
            </DetailField>
            <DetailField label="Type">
              <Badge variant={role.roleType === 0 ? 'default' : 'secondary'}>
                {role.roleType === 0 ? 'Built-in' : 'Custom'}
              </Badge>
            </DetailField>
          </dl>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
            <div className="mb-4 text-sm font-semibold">Description</div>
            <p className="min-w-0 break-all text-sm">
              <Dash value={role.remarks} />
            </p>
          </section>

          <section className="min-w-0 rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              Assigned Menus
              <Badge variant="secondary" className="tabular-nums">
                {assignedMenus.length}
              </Badge>
            </div>
            {assignedMenus.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No menus assigned.
              </p>
            ) : (
              <ul className="min-w-0">
                {assignedMenus.map((menu) => (
                  <li
                    key={menu.menuId}
                    className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border/60 py-2.5 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {menu.menuName}
                    </span>
                    <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                      {menu.menuKey}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Assign Menus 抽屉（§3.16.2）：树形勾选 + Save 生效，同步刷新 Assigned Menus 卡片 */}
      <Drawer
        open={assignOpen}
        onOpenChange={(open) => {
          if (!saving) setAssignOpen(open);
        }}
      >
        {/* 宽度钉 min(720px,90vw)（chain-drawer D9 同款） */}
        <DrawerContent className="w-[min(720px,90vw)] max-w-none p-0">
          <div className="flex h-full flex-col">
            <DrawerHeader className="border-b px-6 py-4">
              <DrawerTitle>Assign Menus</DrawerTitle>
              <DrawerDescription>
                Assign menu access for {role.roleName || role.roleCode} (
                {role.roleCode}).
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {menuIdsQuery.isLoading ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Loading...
                </p>
              ) : menuTree.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No menus
                </p>
              ) : (
                <div className="rounded-md border p-2">
                  <MenuCheckTreeNodes
                    nodes={menuTree}
                    depth={0}
                    checked={checked}
                    disabled={saving || menuIdsQuery.isLoading}
                    onToggle={onToggle}
                  />
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Checking a parent cascades to children; leaf menus are the
                minimum grant unit.
              </p>
            </div>
            <DrawerFooter className="border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setAssignOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={onSaveMenus}>
                Save
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
