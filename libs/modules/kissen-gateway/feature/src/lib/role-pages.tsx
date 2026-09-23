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
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, createFormResolver } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@myorg/shared/ui';
import { PageHead } from './page-head';
import {
  ChevronLeft,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  ROLE_TYPE_BUILTIN,
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

import { DescField, DescGrid } from './desc-grid';
import { OPT_ALL, orDash } from './kit';
import {
  ErrorBlock,
  LoadingBlock,
  MissingIdBlock,
} from './state-blocks';
import { ActionConfirmDialog, ProtoStatusBadge } from './proto-ui';
import { formatUtc8 } from './proto-format';
import { PROTO_ROLE_STATUS, protoStatusText } from './proto-enums';
import {
  ColumnPicker,
  SortHeader,
  compareProtoValues,
  filterVisibleColumns,
  useColumnPreferences,
  useTableSort,
  type ProtoColumnDef,
} from './proto-table';
import { StatCard } from './user-pages';

/** 系统管理域路由基座（registry：/system/role）。 */
const ROLE_BASE = '/system/role';

/** 源 pageSize 默认值。 */
const ROLE_PAGE_SIZE_DEFAULT = 10;

/** 列偏好定义（原型 COLUMNS；Users/Menus 计数列无端点（GAP-GW-07），暂不提供）。 */
const ROLE_COLUMNS: ProtoColumnDef[] = [
  { id: 'roleName', label: 'Role Name', required: true },
  { id: 'type', label: 'Type' },
  { id: 'description', label: 'Description' },
  /* STATIC-FILLER(GAP-GW-07): Users / Menus 计数列（原型 userCount / menuCount）
   * 无聚合端点，先整列省略，端点就绪后补列。 */
  { id: 'createdAt', label: 'Created on (UTC+8)' },
  { id: 'status', label: 'Status', required: true },
  { id: 'actions', label: 'Actions', required: true },
];
const ROLE_COLUMN_PREF_KEY = 'gw.role-list.columns';

/** 角色状态徽章色调（PROTO_ROLE_STATUS：0 Active=success / 1 Inactive=warning）。 */
const ROLE_STATUS_TONES: Record<number, 'success' | 'warning'> = {
  0: 'success',
  1: 'warning',
};

/** 删除确认（原型 ROLE_ACTION_CONFIG.delete 文案逐字；启停无端点未提供）。 */
const ROLE_DELETE_CONFIG = {
  title: 'Delete Role',
  body1: (name: string, code: string) => `Delete role "${name}" (${code})?`,
  body2:
    'Once deleted, the role is removed from every user it is assigned to; those users keep only their remaining roles. This action cannot be undone.',
  confirmLabel: 'Delete',
} as const;

/** 路由 query 中的角色 ID → 正整数；非法 → undefined。 */

function parseRoleId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
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
  checked,
  readOnly = false,
  onToggle,
}: {
  node: MenuTree;
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
      >
        <Checkbox
          checked={full ? true : indeterminate ? 'indeterminate' : false}
          disabled={readOnly}
          onCheckedChange={() => onToggle?.(node)}
        />
        <span className="text-sm">{node.menuName}</span>
        {/* 半选父节点轻量标记（勾选态纯派生，只做视觉差异）。 */}
        {!full && indeterminate && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
            Partial
          </span>
        )}
      </label>
      {/* 子层级连接引导线：层级缩进由嵌套容器承载（每级约 20px，单色）。 */}
      {children.length > 0 && (
        <div className="ml-[10px] border-l border-border/60 pl-[10px]">
          {children.map((child) => (
            <MenuCheckNode
              key={child.menuId}
              node={child}
              checked={checked}
              readOnly={readOnly}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
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
            <Button type="button" onClick={onAssign}>
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
/* 列表页（源筛选：角色编码/角色名称；操作：编辑/分配菜单/删除）      */
/* ================================================================== */

/** 筛选表单校验（源无格式校验；空值=不过滤）。
 *  roleType 不上送：RoleListReq 无该参数（GAP-GW-07 族）——列表页本地过滤当前页。 */
const roleFilterSchema = z.object({
  roleCode: z.string(),
  roleName: z.string(),
  roleType: z.string(),
  status: z.string(),
});
type RoleFilterForm = z.infer<typeof roleFilterSchema>;

const ROLE_FILTER_DEFAULT: RoleFilterForm = {
  roleCode: '',
  roleName: '',
  roleType: OPT_ALL,
  status: OPT_ALL,
};

/** RHF 筛选表单 → 后端 RoleListReq（空串 → 不传该字段=不过滤）。 */
function formToFilter(form: RoleFilterForm): RoleListReq {
  return {
    roleCode: form.roleCode || undefined,
    roleName: form.roleName || undefined,
    status:
      form.status === OPT_ALL ? undefined : Number(form.status) || undefined,
  };
}

export function RoleListPage() {
  const router = useRouter();
  const toast = useToast();
  const hasPerm = useGatewayPerm();

  const { register, reset, control, watch } = useForm<RoleFilterForm>({
    resolver: createFormResolver(roleFilterSchema),
    defaultValues: ROLE_FILTER_DEFAULT,
  });

  const [filter, setFilter] = React.useState<RoleListReq>(() =>
    formToFilter(ROLE_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(ROLE_PAGE_SIZE_DEFAULT);

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useRolePageQuery(KISSEN_GATEWAY_PROJECT_ID, {
      pageNum,
      pageSize,
      filter,
    });

  /* STATIC-FILLER(GAP-GW-07): 角色计数无聚合端点——pageSize 200 全量拉取本地计数
   * （>200 角色时 Active/Inactive 低估，Total 取 pagination.total）。 */
  const { data: statsPage } = useRolePageQuery(KISSEN_GATEWAY_PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;
  const { sort, toggle } = useTableSort('roleName', 'asc');
  const columnPreferences = useColumnPreferences(
    ROLE_COLUMN_PREF_KEY,
    ROLE_COLUMNS,
  );


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
  /* 原型 Filters embedded：Role Code/Role Name/Status 服务端即时检索（300ms 防抖
   * 回页 1）；Type 本地过滤当前页（RoleListReq 无该参数）。 */
  const filterTimer = React.useRef<number | null>(null);
  React.useEffect(() => {
    const subscription = watch((values) => {
      if (filterTimer.current != null) window.clearTimeout(filterTimer.current);
      filterTimer.current = window.setTimeout(() => {
        setFilter(formToFilter(values as RoleFilterForm));
        setPageNum(1);
      }, 300);
    });
    return () => {
      subscription.unsubscribe();
      if (filterTimer.current != null)
        window.clearTimeout(filterTimer.current);
    };
  }, [watch]);

  const watched = watch();
  const hasFilter =
    watched.roleCode.trim() !== '' ||
    watched.roleName.trim() !== '' ||
    watched.roleType !== OPT_ALL ||
    watched.status !== OPT_ALL;

  /** 源 resetQuery：清空筛选回第一页重查。 */
  const onReset = React.useCallback(() => {
    reset(ROLE_FILTER_DEFAULT);
    setFilter(formToFilter(ROLE_FILTER_DEFAULT));
    setPageNum(1);
  }, [reset]);

  /** 统计卡数据（原型 Total Roles / Active / Inactive）。 */
  const stats = React.useMemo(() => {
    const list = statsPage?.data ?? [];
    return {
      total: statsPage?.pagination?.total ?? list.length,
      active: list.filter((r) => r.status === 0).length,
      inactive: list.filter((r) => r.status === 1).length,
    };
  }, [statsPage]);


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

  /* 排序 + Type 过滤：服务端 /role/page 无排序与 roleType 参数——当前页内处理。 */
  const sortAccessors = React.useMemo<
    Record<string, (r: RoleRow) => string | number | null | undefined>
  >(
    () => ({
      roleName: (r) => r.roleName,
      type: (r) => r.roleType,
      status: (r) => r.status,
    }),
    [],
  );
  const sortedRows = React.useMemo(() => {
    const accessor = sort.key ? sortAccessors[sort.key] : undefined;
    const base =
      watched.roleType === OPT_ALL
        ? rows
        : rows.filter((r) => String(r.roleType) === watched.roleType);
    if (!accessor) return base;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...base].sort(
      (a, b) => compareProtoValues(accessor(a), accessor(b)) * dir,
    );
  }, [rows, sort, sortAccessors, watched.roleType]);

  const tableData = React.useMemo(
    () => sortedRows.map((r) => ({ ...r, id: String(r.roleId) })),
    [sortedRows],
  );

  /** Type / Status 筛选 options。 */
  const typeSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      { value: String(ROLE_TYPE_BUILTIN), label: roleTypeText(ROLE_TYPE_BUILTIN) },
      { value: '1', label: roleTypeText(1) },
    ],
    [],
  );
  const statusSelectOptions = React.useMemo(
    () => [
      { value: OPT_ALL, label: 'All' },
      ...Object.entries(PROTO_ROLE_STATUS)
        .sort(([, a], [, b]) => a.rank - b.rank)
        .map(([code, meta]) => ({ value: code, label: meta.text })),
    ],
    [],
  );

  /** 列集对齐 BP 原型 COLUMNS（首列两行：Role Name + Built-in 徽章 / Role Code）。 */
  const columns = React.useMemo<ColumnDef<RoleRow & { id: string }>[]>(() => {
    return [
      {
        id: 'roleName',
        header: () => (
          <SortHeader
            label="Role Name"
            direction={sort.key === 'roleName' ? sort.direction : null}
            onToggle={() => toggle('roleName')}
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          const builtIn = r.roleType === ROLE_TYPE_BUILTIN;
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-semibold">{r.roleName}</span>
                {builtIn && (
                  <Badge variant="outline" className="shrink-0 gap-1">
                    <ShieldCheck className="size-3" aria-hidden="true" />
                    Built-in
                  </Badge>
                )}
              </div>
              <span className="block truncate text-xs text-muted-foreground">
                {r.roleCode || '-'}
              </span>
            </div>
          );
        },
      },
      {
        id: 'type',
        header: () => (
          <SortHeader
            label="Type"
            direction={sort.key === 'type' ? sort.direction : null}
            onToggle={() => toggle('type')}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={roleTypeVariant(row.original.roleType)}>
            {roleTypeText(row.original.roleType)}
          </Badge>
        ),
      },
      {
        id: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[280px]">
            {orDash(row.original.remarks)}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created on (UTC+8)',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'status',
        header: () => (
          <SortHeader
            label="Status"
            direction={sort.key === 'status' ? sort.direction : null}
            onToggle={() => toggle('status')}
          />
        ),
        cell: ({ row }) => (
          <ProtoStatusBadge
            label={protoStatusText(PROTO_ROLE_STATUS, row.original.status)}
            tone={ROLE_STATUS_TONES[row.original.status] ?? 'muted'}
          />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original;
          const builtIn = r.roleType === ROLE_TYPE_BUILTIN;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`${ROLE_BASE}/detail?id=${r.roleId}`)
                }
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
                  {/* 原型 menuActionsFor：内置角色仅 Assign Menus；自定义角色
                      Edit/Assign Menus/Delete。原型 Activate/Deactivate 因
                      RoleUpdateReq 无 status 字段（无端点）不提供。 */}
                  {!builtIn && (
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`${ROLE_BASE}/edit?id=${r.roleId}`)
                      }
                    >
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onAssignRow(r)}>
                    Assign Menus
                  </DropdownMenuItem>
                  {!builtIn && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDeleteClick(r)}
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [onDeleteClick, onAssignRow, router, sort, toggle]);

  /* 列偏好：required 列恒显，其余按用户选择过滤。 */
  const visibleColumns = React.useMemo(
    () =>
      filterVisibleColumns(
        columns,
        ROLE_COLUMNS,
        columnPreferences.isColumnVisible,
      ),
    [columns, columnPreferences],
  );

  return (
    <div className="space-y-4">
      {/* 页头（原型 PageHeader：标题 + 描述）。 */}
      <div>
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          System
        </div>
        <h1 className="text-xl font-semibold">Role Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage roles, their status, and the menus they grant to users.
        </p>
      </div>

      {/* 统计卡（原型 StatGrid：Total Roles / Active / Inactive）。 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Roles" value={stats.total} tone="success" />
        <StatCard label="Active" value={stats.active} tone="success" />
        <StatCard label="Inactive" value={stats.inactive} tone="warning" />
      </div>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Roles
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
              columns={ROLE_COLUMNS}
              isColumnVisible={columnPreferences.isColumnVisible}
              onColumnVisibilityChange={columnPreferences.setColumnVisible}
              onReset={columnPreferences.resetColumns}
            />
            {/* 源 v-perm="'bank:role:manage'"：未命中 menuKeys 即不渲染。 */}
            {hasPerm('bank:role:manage') && (
              <Button onClick={() => router.push(`${ROLE_BASE}/create`)}>
                Create Role
              </Button>
            )}
          </div>
        </div>

        {/* 原型 Filters embedded：Role Code/Role Name/Status 服务端即时检索；
            Type 本地过滤当前页（RoleListReq 无该参数）。 */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="roleCode"
              label="Role Code"
              register={register('roleCode')}
            />
            <FormField
              name="roleName"
              label="Role Name"
              register={register('roleName')}
            />
            <FormSelect
              name="roleType"
              control={control}
              label="Type"
              options={typeSelectOptions}
              placeholder="All"
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
              onClick={onReset}
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
            emptyMessage="No roles found. Try adjusting the filters, or create the first custom role."
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
      </section>

      <AssignMenuDialog
        role={assignTarget}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />

      {/* 删除确认（原型 ROLE_ACTION_CONFIG.delete 文案逐字；ActionConfirmDialog）。 */}
      <ActionConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        icon={Trash2}
        tone="danger"
        title={ROLE_DELETE_CONFIG.title}
        body1={
          deleteTarget
            ? ROLE_DELETE_CONFIG.body1(
                deleteTarget.roleName,
                deleteTarget.roleCode,
              )
            : null
        }
        body2={ROLE_DELETE_CONFIG.body2}
        confirmLabel={ROLE_DELETE_CONFIG.confirmLabel}
        variant="destructive"
        loading={removeMutation.isPending}
        onConfirm={onConfirmDelete}
      />
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
      <div className="max-w-[420px] space-y-1">
        <FormField
          name="roleCode"
          label="Role Code"
          required
          disabled={isEdit}
          placeholder="e.g. ROLE_OPS, unique"
          error={formState.errors.roleCode?.message}
          register={register('roleCode')}
        />
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Role code cannot be changed after creation
          </p>
        )}
      </div>
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
      <PageHead variant="toolbar" title={isEditRoute ? 'Edit Role' : 'Create Role'} />
      {!isEditRoute ? (
        <RoleForm />
      ) : roleId == null ? (
        <MissingIdBlock message="Missing a valid role ID" backTo={ROLE_BASE} />
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

  const [assignOpen, setAssignOpen] = React.useState(false);

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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Back to list"
            onClick={() => router.push(ROLE_BASE)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-7 text-foreground">
                Role Details
              </h1>
              {detail ? (
                <ProtoStatusBadge
                  label={protoStatusText(PROTO_ROLE_STATUS, detail.status)}
                  tone={ROLE_STATUS_TONES[detail.status] ?? 'muted'}
                />
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                Role Code:{' '}
                <span className="font-medium text-foreground">
                  {detail?.roleCode ?? '-'}
                </span>
              </span>
              <span aria-hidden="true">|</span>
              <span>
                Created on{' '}
                <span className="font-medium tabular-nums text-foreground">
                  {formatUtc8(detail?.createTime)}
                </span>
              </span>
            </div>
          </div>
        </div>
        {detail && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/* 原型还有 Deactivate/Activate/Edit Role/Delete；本仓角色启停无端点
                （RoleUpdateReq 无 status），编辑走列表 ⋮，删除回列表操作。 */}
            <Button variant="outline" onClick={() => setAssignOpen(true)}>
              Assign Menus
            </Button>
          </div>
        )}
      </div>

      {roleId == null ? (
        <MissingIdBlock message="Missing a valid role ID" backTo={ROLE_BASE} />
      ) : detailQuery.isLoading ? (
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <LoadingBlock />
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <ErrorBlock
            message={(detailQuery.error as Error).message}
            onRetry={() => detailQuery.refetch()}
          />
        </div>
      ) : detail ? (
        <>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                Basic Information
              </h2>
              <DescGrid>
                <DescField label="Role Name">{detail.roleName}</DescField>
                <DescField label="Type">
                  <Badge variant={roleTypeVariant(detail.roleType)}>
                    {roleTypeText(detail.roleType)}
                  </Badge>
                </DescField>
                <DescField label="Description">
                  {orDash(detail.remarks)}
                </DescField>
              </DescGrid>
            </section>

            {/* STATIC-FILLER(GAP-GW-07): 原型 Role Activity（Assigned Users 头像
                chip 列）依赖「角色→用户」反查接口，本仓无该端点，卡片整体省略。 */}

            <section className="rounded-lg border border-border/60 bg-card p-5 lg:col-span-2">
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Assigned Menus
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {checkedIds.size} menus
                </span>
              </div>
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
                      checked={checkedIds}
                      readOnly
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* 分配菜单（保留源弹窗形态：回显 /role/menuIds，保存 assign-menu）。 */}
          <AssignMenuDialog
            role={detail}
            open={assignOpen}
            onOpenChange={setAssignOpen}
          />
        </>
      ) : null}
    </div>
  );
}
