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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DataTable,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';

import {
  LP_PROJECT_ID,
  ROLE_STATUS_TEXT,
  ROLE_TYPE_TEXT,
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

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;

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
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={request?.onConfirm}>
            {request?.confirmText ?? '确定'}
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
    <ul className="select-none">
      {nodes.map((raw) => {
        const { node, fullyChecked, indeterminate } = toCheckNode(
          raw,
          checked,
        );
        return (
          <li key={node.menuId}>
            <label
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-muted/60"
              style={{ paddingLeft: `${depth * 20 + 4}px` }}
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

/** 分配菜单弹窗（源 assign-menu-dialog.vue；挂载即打开，closed 回传）。 */
function AssignMenuDialog({
  row,
  menuTree,
  onClose,
}: {
  row: RoleRow;
  /** 父页页面级一次加载的树（源 :menu-tree 透传）。 */
  menuTree: MenuTree[];
  onClose: (saved: boolean) => void;
}) {
  const toast = useToast();
  const treeLeafIds = React.useMemo(
    () => {
      const s = new Set<number>();
      collectLeafIds(menuTree, s);
      return s;
    },
    [menuTree],
  );

  const menuIdsQuery = useRoleMenuIdsQuery(PROJECT_ID, row.roleId);
  const [checked, setChecked] = React.useState<Set<number>>(new Set());
  // 回显：服务端全量 ids ∩ 树叶子集 → 只写叶子（一次，防重放覆盖用户操作）
  const echoed = React.useRef(false);
  React.useEffect(() => {
    if (echoed.current || menuIdsQuery.data == null) return;
    echoed.current = true;
    setChecked(
      new Set(menuIdsQuery.data.filter((id) => treeLeafIds.has(id))),
    );
  }, [menuIdsQuery.data, treeLeafIds]);

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
  const echoLoading = menuIdsQuery.isLoading;
  const onSave = () => {
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
    const menuIds = [...new Set(ids)];
    const submit = () =>
      assignMutation.mutate(
        { roleId: row.roleId, menuIds },
        {
          onSuccess: () => {
            toast.success('分配成功,该角色用户下次请求即生效');
            onClose(true);
          },
        },
      );
    if (menuIds.length === 0) {
      // 源空勾选二次确认：后端空数组 = 事务清空该角色全部菜单
      setConfirm({
        title: '清空菜单',
        message: '将清空该角色的全部菜单,确认?',
        onConfirm: submit,
      });
      return;
    }
    submit();
  };

  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分配菜单:{row.roleName}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto rounded-md border p-2">
          {menuIdsQuery.isLoading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              加载中...
            </p>
          ) : menuTree.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              暂无菜单
            </p>
          ) : (
            <MenuCheckTreeNodes
              nodes={menuTree}
              depth={0}
              checked={checked}
              disabled={saving || echoLoading}
              onToggle={onToggle}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          勾选父节点会级联子节点;叶子菜单为最小授权单位。
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onClose(false)}
          >
            取消
          </Button>
          <Button type="button" disabled={saving} onClick={onSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </Dialog>
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
            toast.success('保存成功');
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
          toast.success('保存成功');
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
          <DialogTitle>{isEdit ? '编辑角色' : '新增角色'}</DialogTitle>
        </DialogHeader>
        <form
          id="role-form"
          className="space-y-4"
          onSubmit={(e) => void onSubmit(e)}
        >
          <FormField
            name="roleCode"
            label="角色编码"
            required
            disabled={isEdit}
            maxLength={30}
            placeholder="如 ROLE_LP_FINANCE,唯一"
            error={errors.roleCode?.message}
            register={register('roleCode', { required: '请输入角色编码' })}
          />
          <FormField
            name="roleName"
            label="角色名称"
            required
            error={errors.roleName?.message}
            register={register('roleName', { required: '请输入角色名称' })}
          />
          <div>
            <label htmlFor="role-remarks" className="mb-1.5 block text-sm">
              备注
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
            取消
          </Button>
          <Button type="submit" form="role-form" disabled={saving}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 角色管理列表页（源 index.vue）                                         */
/* ================================================================== */

export function RoleListPage() {
  const toast = useToast();
  const { register, handleSubmit, reset } =
    useForm<RoleFilterForm>({ defaultValues: EMPTY_ROLE_FILTER });
  const [params, setParams] = React.useState<RoleQueryParams>(() =>
    roleFormToParams(EMPTY_ROLE_FILTER),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const [formDialog, setFormDialog] = React.useState<
    { mode: 'create' } | { mode: 'edit'; row: RoleRow } | null
  >(null);
  const [assignRow, setAssignRow] = React.useState<RoleRow | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  // 菜单树页面级一次加载（源 loadMenuTree），供分配菜单弹窗叶子过滤与树渲染共用
  const { data: menuTree } = useMenuTreeQuery(PROJECT_ID);

  const listQuery = useRolePageQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      roleCode: params.roleCode,
      roleName: params.roleName,
    },
  });
  const removeMutation = useRoleRemoveMutation(PROJECT_ID);

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.pagination.total ?? 0;

  const onDelete = (row: RoleRow) => {
    setConfirm({
      title: '删除角色',
      message: `删除角色「${row.roleName}」?被用户引用的角色无法删除。`,
      onConfirm: () =>
        removeMutation.mutate(row.roleId, {
          onSuccess: () => toast.success('删除成功'),
        }),
    });
  };

  const columns = React.useMemo<ColumnDef<RoleRow & { id: string }>[]>(
    () => [
      { accessorKey: 'roleCode', header: '角色编码' },
      { accessorKey: 'roleName', header: '角色名称' },
      { accessorKey: 'roleType', header: '类型',
      cell: ({ row }) => (
        <Badge
          variant={row.original.roleType === 0 ? 'destructive' : 'default'}
        >
          {ROLE_TYPE_TEXT[row.original.roleType ?? 1] ??
            row.original.roleType}
        </Badge>
      ), },
      { accessorKey: 'status', header: '状态',
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === 0 ? 'default' : 'secondary'}
        >
          {ROLE_STATUS_TEXT[row.original.status] ?? row.original.status}
        </Badge>
      ), },
      { accessorKey: 'remarks', header: '备注',
      cell: ({ row }) => row.original.remarks || '-', },
      {
        id: 'actions',
        header: '操作',
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
              编辑
            </Button>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => setAssignRow(row.original)}
            >
              分配菜单
            </Button>
            {row.original.roleType === 0 ? (
              // 源 span 包裹使 tooltip 在 disabled 按钮上生效
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-destructive"
                        disabled
                      >
                        删除
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>内置角色不可删除</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-destructive hover:underline"
                onClick={() => onDelete(row.original)}
              >
                删除
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [removeMutation.isPending, params, pageSize],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.roleId) })),
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
            角色管理
          </h1>
        </div>
        <PermButton
          menuKey="lp:role"
          onClick={() => setFormDialog({ mode: 'create' })}
        >
          新增角色
        </PermButton>
      </div>

      <form
        onSubmit={handleSubmit((f) => setParams(roleFormToParams(f, 1)))}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询条件</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            name="roleCode"
            label="角色编码"
            placeholder="模糊匹配"
            register={register('roleCode')}
          />
          <FormField
            name="roleName"
            label="角色名称"
            placeholder="模糊匹配"
            register={register('roleName')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">查询</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset(EMPTY_ROLE_FILTER);
              setParams(roleFormToParams(EMPTY_ROLE_FILTER, 1));
            }}
          >
            重置
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-semibold">角色列表</div>
        </div>
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={listQuery.isLoading}
          emptyMessage="暂无数据"
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
      {assignRow && (
        <AssignMenuDialog
          row={assignRow}
          menuTree={menuTree ?? []}
          onClose={() => setAssignRow(null)}
        />
      )}
      <ConfirmDialog
        request={confirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
