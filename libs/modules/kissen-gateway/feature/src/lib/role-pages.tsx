'use client';

/**
 * 角色管理域页面（源 `views/system/role.vue`）。
 *
 * 源是单页 + 弹窗交互；registry 四键映射（主控契约）：
 * - list   = 列表（/system/role；筛选 + 分页 + 行操作）
 * - create = 新建角色（/system/role/create；源「新增角色」弹窗表单）
 * - edit   = 编辑角色（/system/role/edit?id=；源「编辑角色」弹窗，roleCode 只读）
 * - detail = 角色详情（/system/role/detail?id=；GET /role/detail/:roleId 只读视图）
 * 分配菜单保持源形态（列表行弹窗）：回显 GET /role/menuIds 只勾叶子节点，
 * 保存「全勾 + 半选」并集 POST /role/assign-menu，空集先走「清空菜单」确认。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Loader2 } from 'lucide-react';

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, createFormResolver } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  ROLE_STATUS_OPTIONS,
  ROLE_TYPE_BUILTIN,
  roleStatusText,
  roleStatusVariant,
  roleTypeText,
  roleTypeVariant,
  useAssignRoleMenuMutation,
  useMenuTreeQuery,
  useRemoveRoleMutation,
  useRoleDetailQuery,
  useRoleMenuIdsQuery,
  useRolePageQuery,
  useSaveRoleMutation,
  useUpdateRoleMutation,
  type MenuTree,
  type RoleDetail,
  type RoleListReq,
  type RoleRow,
} from '@myorg/modules/kissen-gateway/data-access';

import { useGatewayPerm } from './use-gateway-perm';

/* ================================================================== */
/* 常量与格式化                                                        */
/* ================================================================== */

/** 系统管理域路由基座（registry：/system/role）。 */
const ROLE_BASE = '/system/role';

/** 源 page-head eyebrow（role.vue 与系统页一致用 PORTAL）。 */
const PAGE_EYEBROW = 'PORTAL';

/** Select 的「全部状态」哨兵值（Radix SelectItem 不宜用空串）。 */
const OPT_ALL = '__all__';

/** 源 pageSize 默认值。 */
const ROLE_PAGE_SIZE_DEFAULT = 10;

/** 路由 query 中的角色 ID → 正整数；非法 → undefined。 */
function parseRoleId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** 毫秒时间戳 → zh-CN 本地时间串（24 小时制）；空值 → '-'。 */
function formatTime(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-';
}

/** 空值统一 '-'（源 `|| '-'` 语义）。 */
function orDash(v: string | null | undefined): string {
  return v === null || v === undefined || v === '' ? '-' : v;
}

/* ================================================================== */
/* 菜单勾选树（源 el-tree show-checkbox / check-strictly=false 等价）   */
/* ================================================================== */

/** 收集树中叶子节点（无 children 或为空）的 menuId（源 filterLeafIds 的 walk）。 */
function menuLeafIds(nodes: MenuTree[]): number[] {
  const out: number[] = [];
  const walk = (list: MenuTree[]) => {
    for (const node of list) {
      if (node.children && node.children.length > 0) walk(node.children);
      else out.push(node.menuId);
    }
  };
  walk(nodes);
  return out;
}

/** 子树全部叶子 id（父节点级联勾选/取消的目标集合）。 */
function subtreeLeafIds(node: MenuTree): number[] {
  return menuLeafIds([node]);
}

/**
 * 节点勾选态派生（el-tree check-strictly=false）：
 * 叶子 = 自身是否勾选；父节点 = 全部后代勾选(full) / 部分勾选(indeterminate) / 无。
 */
function menuNodeState(
  node: MenuTree,
  checked: ReadonlySet<number>,
): { full: boolean; indeterminate: boolean } {
  const children = node.children ?? [];
  if (children.length === 0) {
    return { full: checked.has(node.menuId), indeterminate: false };
  }
  let all = true;
  let any = false;
  for (const child of children) {
    const state = menuNodeState(child, checked);
    if (!state.full) all = false;
    if (state.full || state.indeterminate) any = true;
  }
  return { full: all, indeterminate: any && !all };
}

/**
 * 保存收集：等价源 `getCheckedKeys(false) + getHalfCheckedKeys()` 去重并集，
 * 即「叶子自身勾选，或子树含勾选后代」的全部节点 id（父级随子级权限一并上送）。
 */
function collectAssignedMenuIds(
  nodes: MenuTree[],
  checked: ReadonlySet<number>,
): number[] {
  const out: number[] = [];
  const walk = (node: MenuTree): boolean => {
    const children = node.children ?? [];
    let hit = false;
    if (children.length === 0) hit = checked.has(node.menuId);
    else for (const child of children) hit = walk(child) || hit;
    if (hit) out.push(node.menuId);
    return hit;
  };
  for (const node of nodes) walk(node);
  return out;
}

/** 勾选树节点（源 default-expand-all：整树平铺渲染）。 */
function MenuCheckNode({
  node,
  depth,
  checked,
  readOnly = false,
  onToggle,
}: {
  node: MenuTree;
  depth: number;
  checked: ReadonlySet<number>;
  readOnly?: boolean;
  onToggle?: (node: MenuTree) => void;
}) {
  const { full, indeterminate } = menuNodeState(node, checked);
  const children = node.children ?? [];
  return (
    <div>
      <label
        className={cn(
          'flex items-center gap-2 rounded px-1 py-1',
          !readOnly && 'cursor-pointer hover:bg-muted/50',
        )}
        style={{ paddingLeft: depth * 20 }}
      >
        <Checkbox
          checked={full ? true : indeterminate ? 'indeterminate' : false}
          disabled={readOnly}
          onCheckedChange={() => onToggle?.(node)}
        />
        <span className="text-sm">{node.menuName}</span>
      </label>
      {children.length > 0 &&
        children.map((child) => (
          <MenuCheckNode
            key={child.menuId}
            node={child}
            depth={depth + 1}
            checked={checked}
            readOnly={readOnly}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

/* ================================================================== */
/* 通用展示组件                                                        */
/* ================================================================== */

/** 页头（源 .page-head：eyebrow + 标题）。 */
function PageHead({ title }: { title: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {PAGE_EYEBROW}
      </div>
      <h1 className="mt-1 text-xl font-semibold">{title}</h1>
    </div>
  );
}

/** 详情描述字段（el-descriptions-item 的 React 等价）。 */
function DescField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** 详情描述网格（源 el-descriptions 两列布局的 React 等价）。 */
function DescGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</dl>
  );
}

function LoadingBlock() {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
  );
}

/** 加载失败提示 + 重试（error 状态必须可感知并可恢复）。 */
function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-sm">
      <span className="text-destructive">Failed to load: {message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** 路由缺参/非法提示（edit/detail 无有效 id 时的可感知兜底）。 */
function MissingIdBlock() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-sm">
      <span className="text-destructive">Missing a valid role ID</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.push(ROLE_BASE)}
      >
        Back to List
      </Button>
    </div>
  );
}

/* ================================================================== */
/* 分配菜单弹窗（源 openAssign / onAssign 1:1）                        */
/* ================================================================== */

/**
 * 分配菜单（源 el-dialog「分配菜单:<角色名>」）。
 * 回显：后端 menuIds 仅取叶子集合勾选（父键会级联误勾全部子节点，
 * 父节点勾选/半选态由树自身派生）；保存：全勾 + 半选并集上送。
 */
function AssignMenuDialog({
  role,
  open,
  onOpenChange,
}: {
  role: RoleRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const menuTreeQuery = useMenuTreeQuery(KISSEN_GATEWAY_PROJECT_ID);
  const menuIdsQuery = useRoleMenuIdsQuery(
    KISSEN_GATEWAY_PROJECT_ID,
    role?.roleId,
    open,
  );
  const assignMutation = useAssignRoleMenuMutation(KISSEN_GATEWAY_PROJECT_ID);

  const tree = menuTreeQuery.data ?? [];
  const leafIdSet = React.useMemo(() => new Set(menuLeafIds(tree)), [tree]);

  const [checkedIds, setCheckedIds] = React.useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );
  const [confirmClearOpen, setConfirmClearOpen] = React.useState(false);

  // 回显：源 filterLeafIds —— 仅叶子节点进 setCheckedKeys；父节点勾选/半选态
  // 由树派生。data 随 query key（roleId）切换重置为 undefined，先走 loading 骨架，
  // 不会串显上一角色勾选态（与源 el-tree 保留旧态直至 setCheckedKeys 一致）。
  React.useEffect(() => {
    if (menuIdsQuery.data) {
      setCheckedIds(
        new Set(menuIdsQuery.data.filter((id) => leafIdSet.has(id))),
      );
    }
  }, [menuIdsQuery.data, leafIdSet]);

  /** 勾选/取消节点：叶子切换自身；父节点级联整棵子树（源 check-strictly=false）。 */
  const onToggleNode = React.useCallback((node: MenuTree) => {
    const leaves = subtreeLeafIds(node);
    setCheckedIds((prev) => {
      const allOn = leaves.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of leaves) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  const doAssign = (menuIds: number[]) => {
    if (!role) return;
    assignMutation.mutate(
      { roleId: role.roleId, menuIds },
      {
        onSuccess: () => {
          toast.success('Menus assigned. Effective on next request for users of this role');
          onOpenChange(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  /** 源 onAssign：勾选并集为空时先走「清空菜单」二次确认。 */
  const onAssign = () => {
    const menuIds = collectAssignedMenuIds(tree, checkedIds);
    if (menuIds.length === 0) {
      setConfirmClearOpen(true);
      return;
    }
    doAssign(menuIds);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Assign Menu: {role?.roleName ?? ''}</DialogTitle>
          </DialogHeader>
          {menuIdsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-6 w-3/5" />
            </div>
          ) : menuIdsQuery.isError ? (
            <ErrorBlock
              message={(menuIdsQuery.error as Error).message}
              onRetry={() => menuIdsQuery.refetch()}
            />
          ) : tree.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No menu data
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {tree.map((node) => (
                <MenuCheckNode
                  key={node.menuId}
                  node={node}
                  depth={0}
                  checked={checkedIds}
                  onToggle={onToggleNode}
                />
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Checking a parent node cascades to its children; button-level (menu type 4) permissions are also selected here.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onAssign}
              disabled={assignMutation.isPending || menuIdsQuery.isLoading}
            >
              {assignMutation.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Menu</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all menus for this role. Confirm?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => doAssign([])}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ================================================================== */
/* 列表页（源筛选：角色编码/角色名称 + 状态；操作：编辑/分配菜单/删除）   */
/* ================================================================== */

/** 筛选表单校验（源无格式校验，仅必填于提交按钮语义；空值=不过滤）。 */
const roleFilterSchema = z.object({
  roleCode: z.string(),
  roleName: z.string(),
  status: z.string(),
});
type RoleFilterForm = z.infer<typeof roleFilterSchema>;

const ROLE_FILTER_DEFAULT: RoleFilterForm = {
  roleCode: '',
  roleName: '',
  status: OPT_ALL,
};

/** RHF 筛选表单 → 后端 RoleListReq（空串/哨兵 → 不传该字段=不过滤）。 */
function formToFilter(form: RoleFilterForm): RoleListReq {
  return {
    roleCode: form.roleCode || undefined,
    roleName: form.roleName || undefined,
    status: form.status === OPT_ALL ? undefined : Number(form.status),
  };
}

export function RoleListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useGatewayPerm();

  const { register, handleSubmit, reset, control } = useForm<RoleFilterForm>({
    resolver: createFormResolver(roleFilterSchema),
    defaultValues: ROLE_FILTER_DEFAULT,
  });

  const [filter, setFilter] = React.useState<RoleListReq>(() =>
    formToFilter(ROLE_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(ROLE_PAGE_SIZE_DEFAULT);

  const { data, isLoading, isError, error, refetch } = useRolePageQuery(
    KISSEN_GATEWAY_PROJECT_ID,
    { pageNum, pageSize, filter },
  );

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  // Load failure feedback is surfaced as a toast (retry via action) instead of a banner.
  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load roles', {
        description: error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  const [assignTarget, setAssignTarget] = React.useState<RoleRow | null>(null);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<RoleRow | null>(null);

  const removeMutation = useRemoveRoleMutation(KISSEN_GATEWAY_PROJECT_ID);

  const onSubmit = React.useCallback((form: RoleFilterForm) => {
    setFilter(formToFilter(form));
    setPageNum(1);
  }, []);

  /** 源 resetQuery：清空筛选回第一页重查。 */
  const onReset = React.useCallback(() => {
    reset(ROLE_FILTER_DEFAULT);
    setFilter(formToFilter(ROLE_FILTER_DEFAULT));
    setPageNum(1);
  }, [reset]);

  /** 源 openEdit：编辑弹窗 → /system/role/edit?id=（表单页由 detail 回填）。 */
  const onEdit = React.useCallback(
    (roleId: number) => router.push(`${ROLE_BASE}/edit?id=${roleId}`),
    [router],
  );

  const onDetail = React.useCallback(
    (roleId: number) => router.push(`${ROLE_BASE}/detail?id=${roleId}`),
    [router],
  );

  /** 源 openAssign：打开分配菜单弹窗（回显走 /role/menuIds/:roleId）。 */
  const onAssignRow = React.useCallback((row: RoleRow) => {
    setAssignTarget(row);
    setAssignOpen(true);
  }, []);

  /** 源 onDelete：内置角色（roleType=0）直接拦截，不发请求、不弹确认。 */
  const onDeleteClick = React.useCallback(
    (row: RoleRow) => {
      if (row.roleType === ROLE_TYPE_BUILTIN) {
        toast.error('Built-in roles cannot be deleted');
        return;
      }
      setDeleteTarget(row);
    },
    [toast],
  );

  /** 源 ElMessageBox.confirm 确认后 roleApi.remove → 「删除成功」→ 重载列表。 */
  const onConfirmDelete = React.useCallback(() => {
    if (!deleteTarget) return;
    removeMutation.mutate(deleteTarget.roleId, {
      onSuccess: () => toast.success('Deleted successfully'),
      onError: (e) => toast.error((e as Error).message),
    });
    setDeleteTarget(null);
  }, [deleteTarget, removeMutation, toast]);

  const columns = React.useMemo<ColumnDef<RoleRow & { id: string }>[]>(
    () => [
      {
        id: 'roleCode',
        header: 'Role Code',
        cell: ({ row }) => <span>{row.original.roleCode}</span>,
      },
      {
        id: 'roleName',
        header: 'Role Name',
        cell: ({ row }) => <span>{row.original.roleName}</span>,
      },
      {
        id: 'roleType',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={roleTypeVariant(row.original.roleType)}>
            {roleTypeText(row.original.roleType)}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={roleStatusVariant(row.original.status)}>
            {roleStatusText(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'remarks',
        header: 'Remarks',
        cell: ({ row }) => <span>{orDash(row.original.remarks)}</span>,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onDetail(row.original.roleId)}
            >
              Detail
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onEdit(row.original.roleId)}
            >
              Edit
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onAssignRow(row.original)}
            >
              Assign Menu
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-destructive hover:text-destructive"
              onClick={() => onDeleteClick(row.original)}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [onDetail, onEdit, onAssignRow, onDeleteClick],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.roleId) })),
    [rows],
  );

  const statusSelectOptions = React.useMemo(
    () => [{ value: OPT_ALL, label: 'All Statuses' }, ...ROLE_STATUS_OPTIONS],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHead title="Role Management" />
        {/* 源 v-perm="'bank:role:manage'"：未命中 menuKeys 即不渲染。 */}
        {hasPerm('bank:role:manage') && (
          <Button type="button" onClick={() => router.push(`${ROLE_BASE}/create`)}>
            Create Role
          </Button>
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Filters</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          <FormSelect
            name="status"
            control={control}
            label="Status"
            options={statusSelectOptions}
            placeholder="All Statuses"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
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
                  onPageChange: setPageNum,
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setPageNum(1);
                  },
                }
              : undefined
          }
        />
      </div>

      <AssignMenuDialog
        role={assignTarget}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Delete role &quot;{deleteTarget?.roleName}&quot;? Roles referenced by users
              cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ================================================================== */
/* 新建/编辑页（源新增/编辑弹窗表单）                                   */
/* ================================================================== */

/** 表单校验（源 FormRules：编码/名称必填，trigger=blur）。 */
const roleFormSchema = z.object({
  roleCode: z.string().min(1, { message: 'Please enter a role code' }),
  roleName: z.string().min(1, { message: 'Please enter a role name' }),
  remarks: z.string(),
});
type RoleFormValues = z.infer<typeof roleFormSchema>;

const ROLE_FORM_DEFAULT: RoleFormValues = {
  roleCode: '',
  roleName: '',
  remarks: '',
};

/** 角色表单（源 el-dialog 表单；编辑时 roleCode 禁用，roleName/remarks 可改）。 */
function RoleForm({
  roleId,
  initial,
}: {
  roleId?: number;
  initial?: RoleDetail;
}) {
  const isEdit = roleId != null;
  const toast = useToast();
  const router = useRouter();
  const saveMutation = useSaveRoleMutation(KISSEN_GATEWAY_PROJECT_ID);
  const updateMutation = useUpdateRoleMutation(KISSEN_GATEWAY_PROJECT_ID);
  const pending = saveMutation.isPending || updateMutation.isPending;

  const { register, handleSubmit, formState } = useForm<RoleFormValues>({
    resolver: createFormResolver(roleFormSchema),
    mode: 'onTouched',
    // 源 openEdit 预填：roleCode/roleName/remarks（remarks 空值归一为 ''）。
    defaultValues: initial
      ? {
          roleCode: initial.roleCode,
          roleName: initial.roleName,
          remarks: initial.remarks ?? '',
        }
      : ROLE_FORM_DEFAULT,
  });

  const onSubmit = handleSubmit((v) => {
    if (isEdit) {
      // 源编辑：仅上送 {roleId, roleName, remarks}（roleCode 不可改）。
      updateMutation.mutate(
        { roleId: roleId as number, roleName: v.roleName, remarks: v.remarks },
        {
          onSuccess: () => {
            toast.success('Saved successfully');
            router.push(ROLE_BASE);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else {
      // 源新建：{...form} 三字段全量（空 remarks 原样上送）。
      saveMutation.mutate(
        { roleCode: v.roleCode, roleName: v.roleName, remarks: v.remarks },
        {
          onSuccess: () => {
            toast.success('Saved successfully');
            router.push(ROLE_BASE);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
    >
      <FormField
        name="roleCode"
        label="Role Code"
        required
        disabled={isEdit}
        placeholder="e.g. ROLE_OPS, unique"
        className="max-w-[420px]"
        error={formState.errors.roleCode?.message}
        register={register('roleCode')}
      />
      <FormField
        name="roleName"
        label="Role Name"
        required
        className="max-w-[420px]"
        error={formState.errors.roleName?.message}
        register={register('roleName')}
      />
      <div className="max-w-[420px] space-y-1.5">
        <label
          htmlFor="field-remarks"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          Remarks
        </label>
        <Textarea id="field-remarks" rows={2} {...register('remarks')} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(ROLE_BASE)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** 角色管理 — 新建/编辑（源弹窗 → 独立路由页；编辑按 ?id= 拉详情回填）。 */
export function RoleFormPage() {
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const roleId = parseRoleId(rawId);
  // edit 路由但 id 缺失/非法时必须显式兜底（不能回落成新建）。
  const isEditRoute = rawId != null;

  const detailQuery = useRoleDetailQuery(
    KISSEN_GATEWAY_PROJECT_ID,
    roleId,
    isEditRoute,
  );

  return (
    <div className="space-y-4">
      <PageHead title={isEditRoute ? 'Edit Role' : 'Create Role'} />
      {!isEditRoute ? (
        <RoleForm />
      ) : roleId == null ? (
        <MissingIdBlock />
      ) : detailQuery.isLoading ? (
        <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-[420px]" />
            <Skeleton className="h-10 w-full max-w-[420px]" />
            <Skeleton className="h-16 w-full max-w-[420px]" />
          </div>
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <ErrorBlock
            message={(detailQuery.error as Error).message}
            onRetry={() => detailQuery.refetch()}
          />
        </div>
      ) : (
        <RoleForm key={roleId} roleId={roleId} initial={detailQuery.data} />
      )}
    </div>
  );
}

/* ================================================================== */
/* 详情页（GET /role/detail/:roleId 只读视图）                          */
/* ================================================================== */

/** 角色管理 — 详情（字段 + 已分配菜单只读勾选树，回显口径与分配弹窗一致）。 */
export function RoleDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleId = parseRoleId(searchParams.get('id'));

  const detailQuery = useRoleDetailQuery(KISSEN_GATEWAY_PROJECT_ID, roleId);
  const menuTreeQuery = useMenuTreeQuery(KISSEN_GATEWAY_PROJECT_ID);

  const detail = detailQuery.data;
  const tree = menuTreeQuery.data ?? [];
  const leafIdSet = React.useMemo(() => new Set(menuLeafIds(tree)), [tree]);
  // 回显口径同源 filterLeafIds：父级勾选态由树派生，不直接勾父键。
  const checkedIds = React.useMemo(
    () =>
      new Set((detail?.menuIds ?? []).filter((id) => leafIdSet.has(id))),
    [detail?.menuIds, leafIdSet],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHead title="Role Detail" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push(ROLE_BASE)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to List
        </Button>
      </div>

      {roleId == null ? (
        <MissingIdBlock />
      ) : detailQuery.isLoading ? (
        <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <LoadingBlock />
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <ErrorBlock
            message={(detailQuery.error as Error).message}
            onRetry={() => detailQuery.refetch()}
          />
        </div>
      ) : detail ? (
        <>
          <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
            <DescGrid>
              <DescField label="Role Code">{detail.roleCode}</DescField>
              <DescField label="Role Name">{detail.roleName}</DescField>
              <DescField label="Type">
                <Badge variant={roleTypeVariant(detail.roleType)}>
                  {roleTypeText(detail.roleType)}
                </Badge>
              </DescField>
              <DescField label="Status">
                <Badge variant={roleStatusVariant(detail.status)}>
                  {roleStatusText(detail.status)}
                </Badge>
              </DescField>
              <DescField label="Remarks">{orDash(detail.remarks)}</DescField>
              <DescField label="Created At">{formatTime(detail.createTime)}</DescField>
            </DescGrid>
          </div>

          <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
            <div className="mb-3 text-sm font-semibold">Assigned Menus</div>
            {menuTreeQuery.isLoading ? (
              <LoadingBlock />
            ) : checkedIds.size === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No assigned menus
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {tree.map((node) => (
                  <MenuCheckNode
                    key={node.menuId}
                    node={node}
                    depth={0}
                    checked={checkedIds}
                    readOnly
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
