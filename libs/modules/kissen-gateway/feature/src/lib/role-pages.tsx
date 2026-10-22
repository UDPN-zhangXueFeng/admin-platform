'use client';

/**
 * Role management domain pages (source `views/system/role.vue`).
 *
 * The source is a single page + dialog interactions; the registry maps four
 * keys (master contract):
 * - list   = list (/system/role; filters + pagination + row actions)
 * - create = create role (/system/role/create; source "Add Role" dialog form)
 * - edit   = edit role (/system/role/edit?id=; source "Edit Role" dialog,
 *            roleCode read-only)
 * - detail = role details (/system/role/detail?id=; GET /role/detail/:roleId
 *            read-only view)
 * Assign Menus keeps the source shape (row dialog): echo GET /role/menuIds
 * checks leaf nodes only, save posts the "fully checked + half-checked" union
 * to POST /role/assign-menu, and an empty set goes through a "clear menus"
 * confirmation first.
 *
 * Visual language is aligned with kissen-admin system-pages role pages
 * (list header/stat grid/table card, form sections, detail header/cards).
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { type ColumnDef } from '@tanstack/react-table';
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
import { ArrowLeft, MoreVertical, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  ROLE_TYPE_BUILTIN,
  roleTypeText,
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
import { ActionConfirmDialog, ProtoStatusBadge, StatCard } from './proto-ui';
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

/** System management route base (registry: /system/role). */
const ROLE_BASE = '/system/role';

/** Source pageSize default. */
const ROLE_PAGE_SIZE_DEFAULT = 10;

/** Column preference definitions (prototype COLUMNS; the Users/Menus count
 * columns have no endpoint (GAP-GW-07) and are omitted for now). */
const ROLE_COLUMNS: ProtoColumnDef[] = [
  { id: 'roleName', label: 'Role Name', required: true },
  { id: 'type', label: 'Type' },
  { id: 'description', label: 'Description' },
  /* STATIC-FILLER(GAP-GW-07): the Users / Menus count columns (prototype
   * userCount / menuCount) have no aggregate endpoint; the columns are left
   * out until the endpoint exists. */
  { id: 'createdAt', label: 'Created on' },
  { id: 'status', label: 'Status', required: true },
  { id: 'actions', label: 'Actions', required: true },
];
const ROLE_COLUMN_PREF_KEY = 'gw.role-list.columns';

/** Role status badge tones (PROTO_ROLE_STATUS: 0 Active=success / 1 Inactive=muted). */
const ROLE_STATUS_TONES: Record<number, 'success' | 'muted'> = {
  0: 'success',
  1: 'muted',
};

/** Delete confirmation (prototype ROLE_ACTION_CONFIG.delete copy verbatim;
 * activate/deactivate have no endpoint and are not provided). */
const ROLE_DELETE_CONFIG = {
  title: 'Delete Role',
  body1: (name: string, code: string) => `Delete role "${name}" (${code})?`,
  body2:
    'Once deleted, the role is removed from every user it is assigned to; those users keep only their remaining roles. This action cannot be undone.',
  confirmLabel: 'Delete',
} as const;

/** Built-in marker badge (admin system-pages RoleBuiltInBadge parity). */
function RoleBuiltInBadge() {
  return (
    <Badge variant="mute" size="sm" className="shrink-0 gap-1">
      <ShieldCheck className="size-3" aria-hidden="true" />
      Built-in
    </Badge>
  );
}

/** Detail card shell (admin system-pages DetailCard / menu-pages parity):
 * bordered card with a titled header row and a padded body. */
function DetailCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-border/60 bg-card',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-5">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Role ID in the route query → positive integer; invalid → undefined. */
function parseRoleId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/* ================================================================== */
/* Menu check tree (source el-tree show-checkbox / check-strictly=false) */
/* ================================================================== */

/** Collect leaf menuIds (nodes without children) from the tree (source
 * filterLeafIds walk). */
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

/** All leaf ids of a subtree (targets of a parent's cascading check/uncheck). */
function subtreeLeafIds(node: MenuTree): number[] {
  return menuLeafIds([node]);
}

/**
 * Node check state derivation (el-tree check-strictly=false):
 * leaf = itself checked; parent = all descendants checked (full) /
 * some checked (indeterminate) / none.
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
 * Save collection: equivalent to the source
 * `getCheckedKeys(false) + getHalfCheckedKeys()` deduplicated union, i.e.
 * every node id that is "a checked leaf, or has checked descendants"
 * (parents are submitted along with their children's permissions).
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

/** Checkable tree node (source default-expand-all: whole tree flat-rendered). */
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
        {/* Lightweight marker for half-checked parents (state is purely
         * derived; this is a visual differentiator only). */}
        {!full && indeterminate && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
            Partial
          </span>
        )}
      </label>
      {/* Child-level connector line: hierarchy indentation is carried by the
       * nested container (~20px per level, single color). */}
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
/* Assign menu dialog (source openAssign / onAssign 1:1)               */
/* ================================================================== */

/**
 * Assign menus (source el-dialog "Assign Menu:<roleName>").
 * Echo: the backend menuIds only checks the leaf set (parent keys would
 * cascade-check every child; parent check/indeterminate states are derived
 * by the tree itself); save: the union of fully checked + half-checked is
 * submitted.
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

  // Echo: source filterLeafIds — only leaf nodes enter setCheckedKeys; parent
  // check/indeterminate states are derived by the tree. data resets to
  // undefined when the query key (roleId) switches, so the loading skeleton
  // shows first and the previous role's check state never leaks (same as the
  // source el-tree keeping the old state until setCheckedKeys).
  React.useEffect(() => {
    if (menuIdsQuery.data) {
      setCheckedIds(
        new Set(menuIdsQuery.data.filter((id) => leafIdSet.has(id))),
      );
    }
  }, [menuIdsQuery.data, leafIdSet]);

  /** Check/uncheck a node: leaves toggle themselves; parents cascade the whole
   * subtree (source check-strictly=false). */
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

  /** Source onAssign: an empty selection union goes through the "clear menus"
   * second confirmation first. */
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
/* List page (source filters: role code / role name; actions: edit /    */
/* assign menus / delete)                                               */
/* ================================================================== */

/** Filter form validation (source has none; empty = no filtering).
 *  roleType is not submitted: RoleListReq has no such parameter (GAP-GW-07
 *  family) — the list page filters the current page locally. */
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

/** RHF filter form → backend RoleListReq (empty string → field omitted = no
 * filtering). */
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

  const { register, reset, control, watch, getValues } = useForm<RoleFilterForm>({
    resolver: createFormResolver(roleFilterSchema),
    defaultValues: ROLE_FILTER_DEFAULT,
  });

  const [filter, setFilter] = React.useState<RoleListReq>(() =>
    formToFilter(ROLE_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [appliedRoleType, setAppliedRoleType] = React.useState(OPT_ALL);
  const [pageSize, setPageSize] = React.useState(ROLE_PAGE_SIZE_DEFAULT);

  const { data, isLoading, isError, error, refetch, dataUpdatedAt } =
    useRolePageQuery(KISSEN_GATEWAY_PROJECT_ID, {
      pageNum,
      pageSize,
      filter,
    });

  /* STATIC-FILLER(GAP-GW-07): no role count aggregate endpoint — a pageSize
   * 200 full pull counts locally (Active/Inactive under-estimate beyond 200
   * roles; Total comes from pagination.total). */
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
  const watched = watch();
  const hasFilter =
    Boolean(filter.roleCode || filter.roleName || filter.status != null) ||
    appliedRoleType !== OPT_ALL ||
    watched.roleCode.trim() !== '' ||
    watched.roleName.trim() !== '' ||
    watched.roleType !== OPT_ALL ||
    watched.status !== OPT_ALL;

  const onSearch = React.useCallback(() => {
    const values = getValues();
    setFilter(formToFilter(values));
    setAppliedRoleType(values.roleType);
    setPageNum(1);
  }, [getValues]);

  const onReset = React.useCallback(() => {
    reset(ROLE_FILTER_DEFAULT);
    setFilter(formToFilter(ROLE_FILTER_DEFAULT));
    setAppliedRoleType(OPT_ALL);
    setPageNum(1);
  }, [reset]);
  /** Stat card data (prototype Total Roles / Active / Inactive). */
  const stats = React.useMemo(() => {
    const list = statsPage?.data ?? [];
    return {
      total: statsPage?.pagination?.total ?? list.length,
      active: list.filter((r) => r.status === 0).length,
      inactive: list.filter((r) => r.status === 1).length,
    };
  }, [statsPage]);


  /** Source openAssign: opens the assign menu dialog (echo via /role/menuIds/:roleId). */
  const onAssignRow = React.useCallback((row: RoleRow) => {
    setAssignTarget(row);
    setAssignOpen(true);
  }, []);

  /** Source onDelete: built-in roles (roleType=0) are blocked outright — no
   * request, no confirmation. */
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

  /** After the source ElMessageBox.confirm: roleApi.remove → "deleted" → reload list. */
  const onConfirmDelete = React.useCallback(() => {
    if (!deleteTarget) return;
    removeMutation.mutate(deleteTarget.roleId, {
      onSuccess: () => toast.success('Deleted successfully'),
      onError: (e) => toast.error((e as Error).message),
    });
    setDeleteTarget(null);
  }, [deleteTarget, removeMutation, toast]);

  /* Sorting + Type filter: the server /role/page has neither sorting nor a
   * roleType parameter — handled within the current page. */
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
      appliedRoleType === OPT_ALL
        ? rows
        : rows.filter((r) => String(r.roleType) === appliedRoleType);
    if (!accessor) return base;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...base].sort(
      (a, b) => compareProtoValues(accessor(a), accessor(b)) * dir,
    );
  }, [rows, sort, sortAccessors, appliedRoleType]);

  const tableData = React.useMemo(
    () => sortedRows.map((r) => ({ ...r, id: String(r.roleId) })),
    [sortedRows],
  );

  /** Type / Status filter options. */
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

  /** Column set aligned with the prototype COLUMNS (first cell is two lines:
   * Role Name + Built-in badge / Role Code). */
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
                {builtIn ? <RoleBuiltInBadge /> : null}
              </div>
              <span className="block truncate font-mono text-xs text-muted-foreground">
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
          <span>{roleTypeText(row.original.roleType)}</span>
        ),
      },
      {
        id: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span
            className="block max-w-[320px] truncate"
            title={row.original.remarks ?? undefined}
          >
            {orDash(row.original.remarks)}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created on',
        cell: ({ row }) => (
          <span className="tabular-nums">
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
            <div className="flex items-center gap-2">
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
                    aria-label={`More actions for ${r.roleName}`}
                  >
                    <MoreVertical className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Prototype menuActionsFor: built-in roles only get Assign
                   * Menus; custom roles get Edit/Assign Menus/Delete. The
                   * prototype Activate/Deactivate is not provided because
                   * RoleUpdateReq has no status field (no endpoint). */}
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
                      className="text-destructive focus:text-destructive"
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

  /* Column preferences: required columns are always visible, the rest follow
   * the user's selection. */
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
      {/* Page header (admin ListPageHeader parity: title + description +
       * primary action). */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7">Role Management</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Roles group menus into reusable authorization profiles.
          </p>
        </div>
        {/* Source v-perm 'bank:role:manage': not rendered unless menuKeys match. */}
        {hasPerm('bank:role:manage') ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push(`${ROLE_BASE}/create`)}>
              <Plus className="size-4" aria-hidden="true" />
              Add Role
            </Button>
          </div>
        ) : null}
      </div>

      {/* Stat cards (admin StatGrid parity: Total Roles / Active / Inactive
       * with help footnotes). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Roles"
          value={stats.total}
          tone="primary"
          help="All roles defined in the system."
        />
        <StatCard
          label="Active"
          value={stats.active}
          tone="success"
          help="Effective authorization sources."
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          tone="warning"
          help="Suspended from authorization."
        />
      </div>

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
          </div>
        </div>

        {/* Search submits the server conditions and the local Type filter;
         * Reset clears everything and returns to the first page. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
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
            <Button type="submit">Search</Button>
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

      {/* Delete confirmation (prototype ROLE_ACTION_CONFIG.delete copy
       * verbatim; ActionConfirmDialog). */}
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
/* Create/edit page (source add/edit dialog form)                       */
/* ================================================================== */

/** Form validation (source FormRules: code/name required, trigger=blur). */
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

/** Role form (source el-dialog form; roleCode disabled while editing,
 * roleName/remarks editable). */
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

  const { register, handleSubmit, formState, watch } = useForm<RoleFormValues>({
    resolver: createFormResolver(roleFormSchema),
    mode: 'onTouched',
    // Source openEdit prefill: roleCode/roleName/remarks (remarks empty → '').
    defaultValues: initial
      ? {
          roleCode: initial.roleCode,
          roleName: initial.roleName,
          remarks: initial.remarks ?? '',
        }
      : ROLE_FORM_DEFAULT,
  });
  const roleCodeValue = watch('roleCode');
  const roleNameValue = watch('roleName');
  const remarksValue = watch('remarks');

  const onSubmit = handleSubmit((v) => {
    if (isEdit) {
      // Source edit: only {roleId, roleName, remarks} is submitted (roleCode immutable).
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
      // Source create: all three fields from {...form} (empty remarks as-is).
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
      className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]"
    >
      <div className="min-w-0">
        <DetailCard title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FormField
                name="roleCode"
                label="Role Code"
                required
                disabled={isEdit}
                placeholder="Unique code (immutable after creation)"
                error={formState.errors.roleCode?.message}
                register={register('roleCode')}
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  Role Code is immutable after creation.
                </p>
              )}
            </div>
            <FormField
              name="roleName"
              label="Role Name"
              required
              className="sm:col-span-2"
              placeholder="Shown in role lists and user assignment"
              error={formState.errors.roleName?.message}
              register={register('roleName')}
            />
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="field-remarks"
                className="block text-sm font-medium leading-snug text-foreground"
              >
                Description
              </label>
              <Textarea
                id="field-remarks"
                rows={3}
                placeholder="What this role is for (optional)"
                {...register('remarks')}
              />
            </div>
          </div>
        </DetailCard>
      </div>
      <aside className="space-y-4">
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <h2 className="text-sm font-medium">Preview</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            Role profile.
          </div>
          <div className="mt-3 min-w-0">
            <div className="truncate text-sm font-semibold">
              {roleNameValue.trim() || 'Role Name'}
            </div>
            <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {roleCodeValue.trim() || 'Role Code'}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3 text-sm">
            <span className="font-medium">Type</span>
            <Badge variant="secondary">
              {initial?.roleType === ROLE_TYPE_BUILTIN ? 'Built-in' : 'Custom'}
            </Badge>
          </div>
          <p className="mt-3 border-t border-border/50 pt-3 text-xs leading-5 text-muted-foreground">
            {remarksValue.trim() || 'No description provided.'}
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Menu access can be assigned from the role details page.
          </p>
        </section>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(ROLE_BASE)}
          >
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Save
          </Button>
        </div>
      </aside>
    </form>
  );
}

/** Role management — create/edit (source dialogs → standalone route pages;
 * edit pulls the detail by ?id= to prefill). */
export function RoleFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const roleId = parseRoleId(rawId);
  // An edit route with a missing/invalid id must fall back explicitly (never into create).
  const isEditRoute = rawId != null;

  const detailQuery = useRoleDetailQuery(
    KISSEN_GATEWAY_PROJECT_ID,
    roleId,
    isEditRoute,
  );

  return (
    <div className="space-y-4">
      {/* Form page header (admin FormPageHeader parity: back + title + description). */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to Role List"
            onClick={() => router.push(ROLE_BASE)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7">
              {isEditRoute ? 'Edit Role' : 'Add Role'}
            </h1>
            {isEditRoute ? (
              detailQuery.data ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Update the profile of role {detailQuery.data.roleCode}.
                </p>
              ) : null
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                A new role is created as a custom role and starts without any
                menu access.
              </p>
            )}
          </div>
        </div>
      </div>
      {!isEditRoute ? (
        <RoleForm />
      ) : roleId == null ? (
        <MissingIdBlock message="Missing a valid role ID" backTo={ROLE_BASE} />
      ) : detailQuery.isLoading ? (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <LoadingBlock variant="skeleton" />
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-lg border border-border/60 bg-card p-4">
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
/* Detail page (GET /role/detail/:roleId read-only view)                */
/* ================================================================== */

/** Role management — details (fields + read-only assigned menu check tree;
 * echo semantics match the assign dialog). */
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
  // Echo semantics match source filterLeafIds: parent check states are derived
  // by the tree, parent keys are never checked directly.
  const checkedIds = React.useMemo(
    () =>
      new Set((detail?.menuIds ?? []).filter((id) => leafIdSet.has(id))),
    [detail?.menuIds, leafIdSet],
  );
  const isBuiltIn = detail?.roleType === ROLE_TYPE_BUILTIN;

  return (
    <div className="space-y-4">
      {/* Detail header (admin role detail parity: back + name/status title +
       * code/created metadata + actions). */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to Role List"
            onClick={() => router.push(ROLE_BASE)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold leading-7">
                {detail?.roleName ?? 'Role Details'}
              </h1>
              {detail ? (
                <ProtoStatusBadge
                  label={protoStatusText(PROTO_ROLE_STATUS, detail.status)}
                  tone={ROLE_STATUS_TONES[detail.status] ?? 'muted'}
                />
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Role Code:{' '}
              <b className="font-mono font-semibold text-foreground">
                {detail?.roleCode ?? '-'}
              </b>
              {' | '}Created on{' '}
              <span className="tabular-nums">
                {formatUtc8(detail?.createTime)}
              </span>
            </p>
          </div>
        </div>
        {detail && (
          <div className="flex items-center gap-2">
            {/* The prototype also has Deactivate/Activate/Edit Role/Delete;
             * this repo has no role enable/disable endpoint (RoleUpdateReq has
             * no status), and delete runs from the list row actions. */}
            {!isBuiltIn && (
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`${ROLE_BASE}/edit?id=${detail.roleId}`)
                }
              >
                Edit
              </Button>
            )}
            <Button variant="outline" onClick={() => setAssignOpen(true)}>
              Assign Menus
            </Button>
          </div>
        )}
      </div>

      {roleId == null ? (
        <MissingIdBlock message="Missing a valid role ID" backTo={ROLE_BASE} />
      ) : detailQuery.isLoading ? (
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <LoadingBlock />
        </section>
      ) : detailQuery.isError ? (
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <ErrorBlock
            message={(detailQuery.error as Error).message}
            onRetry={() => detailQuery.refetch()}
          />
        </section>
      ) : detail ? (
        <>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            <DetailCard title="Basic Information">
              <DescGrid cols={1} className="gap-y-4">
                <DescField label="Role Code">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {detail.roleCode}
                  </code>
                </DescField>
                <DescField label="Role Name">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{detail.roleName}</span>
                    {isBuiltIn ? <RoleBuiltInBadge /> : null}
                  </span>
                </DescField>
                <DescField label="Type">
                  {roleTypeText(detail.roleType)}
                </DescField>
                <DescField label="Description">
                  {orDash(detail.remarks)}
                </DescField>
              </DescGrid>
            </DetailCard>

            <DetailCard title="Role Activity">
              <DescGrid cols={1}>
                <DescField label="Created on">
                  <span className="tabular-nums">
                    {formatUtc8(detail.createTime)}
                  </span>
                </DescField>
              </DescGrid>
            </DetailCard>
            <DetailCard
              title="Assigned Menus"
              description="Menu access granted to users with this role."
              className="md:col-span-2"
              action={
                <Badge variant="mute" size="sm">
                  {checkedIds.size} menus
                </Badge>
              }
            >
              {menuTreeQuery.isLoading ? (
                <LoadingBlock />
              ) : checkedIds.size === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No assigned menus
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-md border p-2">
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
            </DetailCard>
          </div>

          {/* Assign menus (keeps the source dialog shape: echo /role/menuIds,
           * save assign-menu). */}
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
