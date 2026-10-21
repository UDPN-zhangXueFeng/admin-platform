'use client';

/**
 * Menu management page with the same two-pane tree/details layout as kissen-admin.
 * Selecting a node opens its editable details and API permissions; root/child
 * creation, updates, deletion, filtering, and Gateway-specific validation remain
 * backed by the existing menu APIs.
 */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Search, Trash2, X } from 'lucide-react';

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, createFormResolver } from '@myorg/shared/ui-forms';
import { cn } from '@myorg/shared/util-classnames';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  useMenuPermissionDeleteMutation,
  useMenuPermissionListMutation,
  useMenuRemoveMutation,
  useMenuSaveMutation,
  useMenuTreeQuery,
  useMenuUpdateMutation,
  type MenuPermissionRow,
  type MenuTree,
} from '@myorg/modules/kissen-gateway/data-access';
import { useGatewayPerm } from './use-gateway-perm';

import { PageHead } from './page-head';
import { LoadingBlock, QueryErrorRetry } from './state-blocks';
import { ActionConfirmDialog } from './proto-ui';

/* ================================================================== */
/* 菜单类型文案与表单展示辅助。                                      */
/* ================================================================== */

/** 源 MENU_TYPE_TEXT：菜单类型文案。 */
const MENU_TYPE_TEXT: Record<number, string> = {
  0: 'Module',
  1: 'System',
  2: 'Menu',
  3: 'Sub-menu',
  4: 'Button',
};


/** 源 menuTypeText：未知类型 → `Type N`，undefined → '-'。 */
function menuTypeText(t: number | undefined): string {
  return t === undefined ? '-' : (MENU_TYPE_TEXT[t] ?? `Type ${t}`);
}


/** 类型下拉选项（源 el-option：label `${val} ${text}`，value 为数值字符串）。 */
const MENU_TYPE_OPTIONS = Object.entries(MENU_TYPE_TEXT).map(([val, text]) => ({
  value: val,
  label: `${val} ${text}`,
}));

/** 排序数字解析：空串/非法 → 0（源默认 orderNum 0；负数已由 schema 拦截）。 */
function parseOrderNum(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/* ================================================================== */
/* 菜单树工具（菜单结构展示、过滤与父级菜单选择）。                    */

/** Count every menu node, regardless of the active filter. */
function countMenuNodes(nodes: MenuTree[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countMenuNodes(node.children ?? []);
  }
  return count;
}

/** 菜单层级文案（原型 Menu Level：2 一级 / 3 二级；其余类型无层级概念回退类型文案）。 */
const MENU_LEVEL_TEXT: Record<number, string> = {
  2: 'First-Level Menu',
  3: 'Second-Level Menu',
};

/** Menu Level 文案（原型）：2/3 固定层级文案，其余/未知类型回退类型文案。 */
function menuLevelText(t: number | undefined): string {
  return t === undefined ? menuTypeText(t) : (MENU_LEVEL_TEXT[t] ?? menuTypeText(t));
}

/** 树内搜索（原型 visibleTree）：节点自身命中（menuName/menuNameEn/menuKey 不区分
 * 大小写）或子孙命中则保留；未命中的子孙剔除，命中的祖先链保留整条路径。 */
function filterMenuTree(nodes: MenuTree[], keyword: string): MenuTree[] {
  const out: MenuTree[] = [];
  for (const node of nodes) {
    const self =
      (node.menuName ?? '').toLowerCase().includes(keyword) ||
      (node.menuNameEn ?? '').toLowerCase().includes(keyword) ||
      (node.menuKey ?? '').toLowerCase().includes(keyword);
    const children = node.children?.length
      ? filterMenuTree(node.children, keyword)
      : [];
    if (self || children.length > 0) {
      out.push({ ...node, children });
    }
  }
  return out;
}
function MenuTreeNode({
  node,
  selectedKey,
  onSelect,
}: {
  node: MenuTree;
  selectedKey: number | null;
  onSelect: (node: MenuTree) => void;
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
          {menuLevelText(node.menuType)}
        </Badge>
      </button>
      {node.children?.length ? (
        <div className="ml-4 border-l border-border/60">
          {node.children.map((child) => (
            <MenuTreeNode
              key={child.menuId}
              node={child}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}


/** 树内按 menuId 查节点（编辑态只读 Parent Menu 行取父名）。 */
function findMenuNode(nodes: MenuTree[], menuId: number): MenuTree | undefined {
  for (const node of nodes) {
    if (node.menuId === menuId) return node;
    const hit = node.children?.length
      ? findMenuNode(node.children, menuId)
      : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/** 父级菜单下拉选项（源 el-tree-select check-strictly：任意节点可选；全角空格缩进示层级）。 */
function parentMenuOptions(
  nodes: MenuTree[],
  depth = 0,
  out: Array<{ value: string; label: string }> = [],
): Array<{ value: string; label: string }> {
  for (const node of nodes) {
    out.push({
      value: String(node.menuId),
      label: `${'\u3000'.repeat(depth)}${node.menuName}`,
    });
    if (node.children?.length) {
      parentMenuOptions(node.children, depth + 1, out);
    }
  }
  return out;
}

/** 详情只读字段（label 上 / 值下；编辑态 Menu Level / Parent Menu 行，LP 详情同款）。 */
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

/** Detail card shell (admin system-pages Menu parity): bordered card with a
 * title header row and a padded body. */
function DetailCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <div className="border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-semibold leading-5">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ================================================================== */
/* 内联菜单详情（新增、编辑与删除状态）。                              */
/* ================================================================== */

type MenuDetailsMode = 'view' | 'create-root' | 'create-child';
/** 表单值（下拉/数字/单选以字符串承载，提交时转换；源 reactive form 字段 1:1）。 */
interface MenuFormValues {
  parentId: string;
  menuName: string;
  menuNameEn: string;
  menuKey: string;
  menuType: string;
  orderNum: string;
  visible: string;
  menuUrl: string;
  icon: string;
}

/** 源 openCreate 的表单默认值（menuType 2 一级菜单 / orderNum 0 / visible 0）。 */
const MENU_FORM_CREATE_DEFAULTS: MenuFormValues = {
  parentId: '',
  menuName: '',
  menuNameEn: '',
  menuKey: '',
  menuType: '2',
  orderNum: '0',
  visible: '0',
  menuUrl: '',
  icon: '',
};

function menuNodeToFormValues(node: MenuTree): MenuFormValues {
  const values: MenuFormValues = {
    parentId: node.parentId ? String(node.parentId) : '',
    menuName: node.menuName,
    menuNameEn: node.menuNameEn ?? '',
    menuKey: node.menuKey,
    menuType: String(node.menuType ?? 2),
    orderNum: String(node.orderNum ?? 0),
    visible: String(node.visible ?? 0),
    menuUrl: node.menuUrl ?? '',
    icon: node.icon ?? '',
  };
  return values;
}

/**
 * 表单校验：源 formRules 三条必填文案原样；orderNum 为源 el-input-number
 * :min="0" 的机械约束（负数/非法数字不可提交）。
 */
const menuFormSchema = z.object({
  parentId: z.string(),
  menuName: z.string().min(1, { message: 'Please enter a menu name' }),
  menuNameEn: z.string().min(1, { message: 'Please enter an English menu name' }),
  menuKey: z.string().min(1, { message: 'Please enter a menu key' }),
  menuType: z.string(),
  orderNum: z
    .string()
    .refine((v) => Number(v) >= 0, { message: 'Sort order must be a number no less than 0' }),
  visible: z.string(),
  menuUrl: z.string(),
  icon: z.string(),
});


/* ================================================================== */
/* 接口权限面板（源 menu.vue isEdit 区块 + §2.6「移除」操作）           */
/* ================================================================== */

const PERM_TABLE_HEADERS = ['Method', 'URL', 'Actions'] as const;

/**
 * API permission table for the selected saved menu. It retains the existing
 * Gateway list/delete flow and is rendered below the menu details card.
 */
function MenuPermissionPanel({
  menuKey,
  menuName,
}: {
  menuKey: string;
  menuName: string;
}) {
  const toast = useToast();
  const listMutation = useMenuPermissionListMutation(KISSEN_GATEWAY_PROJECT_ID);
  // v5 的 mutate 是稳定引用，可安全作为 effect 依赖；整体对象不是。
  const { mutate: loadPerms } = listMutation;
  const deleteMutation = useMenuPermissionDeleteMutation(
    KISSEN_GATEWAY_PROJECT_ID,
  );
  const [permDeleteTarget, setPermDeleteTarget] =
    React.useState<MenuPermissionRow | null>(null);

  // 挂载即按当前节点 menuKey 拉取（源 onNodeClick → loadPerms）。
  // 仅随节点切换重拉；依赖用稳定的 mutate 而非整体 listMutation
  // （后者每次渲染均为新字面量，入依赖会引发无限重拉）。
  React.useEffect(() => {
    loadPerms({ menuKey });
  }, [menuKey, loadPerms]);

  const rows = listMutation.data ?? [];
  const loading = listMutation.isPending;

  /** 源 removePerm：确认后 permissionDelete → 重拉列表（invalidate + 显式 refetch）。 */
  const onConfirmPermDelete = () => {
    if (!permDeleteTarget) return;
    const target = permDeleteTarget;
    setPermDeleteTarget(null);
    deleteMutation.mutate(target.menuPermissionId, {
      onSuccess: () => {
        toast.success('Permission removed');
        void listMutation.mutateAsync({ menuKey });
      },
      // KissenApiError message 为英文且内嵌 (traceId)；非 Kissen 错误为英文兜底文案。
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="space-y-2">
      {loading && rows.length === 0 ? (
        <LoadingBlock variant="skeleton" />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {PERM_TABLE_HEADERS.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className={
                      header === 'Actions'
                        ? 'h-9 w-20 px-3 text-left align-middle font-medium text-muted-foreground'
                        : 'h-9 px-3 text-left align-middle font-medium text-muted-foreground'
                    }
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={PERM_TABLE_HEADERS.length}
                    className="px-3 py-5 text-center text-sm text-muted-foreground"
                  >
                    No API permissions.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.menuPermissionId} className="hover:bg-muted/50">
                    <td className="px-3 py-2 align-middle">
                      <code className="text-xs">{row.httpMethod || '*'}</code>
                    </td>
                    <td className="break-all px-3 py-2 align-middle">
                      {row.resourceUrl}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-destructive"
                        onClick={() => setPermDeleteTarget(row)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {listMutation.isError && (
        <p className="text-sm text-destructive">
          {(listMutation.error as Error)?.message}
        </p>
      )}

      {/* 权限行移除确认（T12 要求 confirm 提示；破坏性动作用 destructive）。 */}
      <ActionConfirmDialog
        open={permDeleteTarget != null}
        onOpenChange={(o) => !o && setPermDeleteTarget(null)}
        icon={Trash2}
        tone="danger"
        title="Remove API Permission"
        body1={`Remove permission "${permDeleteTarget?.httpMethod || '*'} ${
          permDeleteTarget?.resourceUrl
        }" from menu "${menuName}"?`}
        body2={`The gateway will stop matching this method + URL for menu key "${menuKey}".`}
        confirmLabel="Remove"
        onConfirm={onConfirmPermDelete}
      />
    </div>
  );
}

/* ================================================================== */
/* 菜单管理页（registry：/system/menu → MenuListPage，名字不可改）      */
/* ================================================================== */

export function MenuListPage() {
  const toast = useToast();
  const hasPerm = useGatewayPerm();
  const { data: tree, isLoading, isError, error, refetch } =
    useMenuTreeQuery(KISSEN_GATEWAY_PROJECT_ID);
  const saveMutation = useMenuSaveMutation(KISSEN_GATEWAY_PROJECT_ID);
  const updateMutation = useMenuUpdateMutation(KISSEN_GATEWAY_PROJECT_ID);
  const removeMutation = useMenuRemoveMutation(KISSEN_GATEWAY_PROJECT_ID);

  const [keyword, setKeyword] = React.useState('');
  const [appliedKeyword, setAppliedKeyword] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<MenuDetailsMode>('view');
  const [deleteTarget, setDeleteTarget] = React.useState<MenuTree | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState,
  } = useForm<MenuFormValues>({
    resolver: createFormResolver(menuFormSchema),
    mode: 'onTouched',
    defaultValues: MENU_FORM_CREATE_DEFAULTS,
  });

  const selectedNode = React.useMemo(
    () => (selectedKey == null ? undefined : findMenuNode(tree ?? [], selectedKey)),
    [selectedKey, tree],
  );
  const parentOptions = React.useMemo(
    () => parentMenuOptions(tree ?? []),
    [tree],
  );
  const effectiveKeyword = appliedKeyword.trim().toLowerCase();
  const visibleTree = React.useMemo(
    () =>
      effectiveKeyword
        ? filterMenuTree(tree ?? [], effectiveKeyword)
        : (tree ?? []),
    [tree, effectiveKeyword],
  );
  const totalNodes = React.useMemo(
    () => countMenuNodes(tree ?? []),
    [tree],
  );
  const hasDraft = mode !== 'view' || selectedNode != null;
  const isSaving = saveMutation.isPending || updateMutation.isPending;
  const formMenuKey = watch('menuKey');

  const selectNode = (node: MenuTree) => {
    setSelectedKey(node.menuId);
    setMode('view');
    reset(menuNodeToFormValues(node));
  };

  const startNewRoot = () => {
    setSelectedKey(null);
    setMode('create-root');
    reset(MENU_FORM_CREATE_DEFAULTS);
  };

  const startNewChild = () => {
    if (!selectedNode) return;
    setMode('create-child');
    reset({
      ...MENU_FORM_CREATE_DEFAULTS,
      parentId: String(selectedNode.menuId),
      menuType: '3',
    });
  };

  const cancelCreate = () => {
    if (mode === 'create-child' && selectedNode) {
      setMode('view');
      reset(menuNodeToFormValues(selectedNode));
      return;
    }
    setSelectedKey(null);
    setMode('view');
    reset(MENU_FORM_CREATE_DEFAULTS);
  };

  const onSave = handleSubmit((values) => {
    if (mode === 'view' && selectedNode) {
      updateMutation.mutate(
        {
          menuId: selectedNode.menuId,
          menuName: values.menuName,
          menuNameEn: values.menuNameEn,
          orderNum: parseOrderNum(values.orderNum),
          visible: Number(values.visible),
          menuUrl: values.menuUrl,
          icon: values.icon,
        },
        {
          onSuccess: () => {
            toast.success('Saved successfully');
            reset(values);
          },
          onError: (e) => toast.error(e.message),
        },
      );
      return;
    }

    saveMutation.mutate(
      {
        menuName: values.menuName,
        menuNameEn: values.menuNameEn,
        menuKey: values.menuKey,
        parentId: values.parentId === '' ? undefined : Number(values.parentId),
        menuType: Number(values.menuType),
        orderNum: parseOrderNum(values.orderNum),
        visible: Number(values.visible),
        menuUrl: values.menuUrl,
        icon: values.icon,
      },
      {
        onSuccess: () => {
          toast.success('Saved successfully');
          setMode('view');
          setSelectedKey(null);
          reset(MENU_FORM_CREATE_DEFAULTS);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  });

  const onConfirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    removeMutation.mutate(target.menuId, {
      onSuccess: () => {
        toast.success('Deleted successfully');
        if (target.menuId === selectedKey) {
          setSelectedKey(null);
          setMode('view');
          reset(MENU_FORM_CREATE_DEFAULTS);
        }
      },
      onError: (e) => toast.error((e as Error).message),
    });
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <PageHead variant="toolbar" title="Menu Management" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <section className="h-fit overflow-hidden rounded-lg border border-border/60 bg-card">
          <div className="border-b border-border/50 px-4 pb-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold leading-6">Menu Structure</h2>
                <Badge variant="mute" size="sm" className="tabular-nums">
                  {totalNodes} nodes
                </Badge>
              </div>
              {hasPerm('bank:menu:manage') ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={startNewRoot}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add Root Menu
                </Button>
              ) : null}
            </div>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                setAppliedKeyword(keyword);
              }}
            >
              <div className="relative">
                <Search
                  size={14}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label="Filter menus"
                  placeholder="Filter menus…"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Search</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setKeyword('');
                    setAppliedKeyword('');
                  }}
                >
                  Reset
                </Button>
              </div>
            </form>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {isLoading ? (
              <LoadingBlock variant="skeleton" />
            ) : isError ? (
              <div className="p-4">
                <QueryErrorRetry error={error} onRetry={() => refetch()} withIcon />
              </div>
            ) : (tree ?? []).length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No menus
              </p>
            ) : visibleTree.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No menus match this filter.
              </p>
            ) : (
              visibleTree.map((node) => (
                <MenuTreeNode
                  key={node.menuId}
                  node={node}
                  selectedKey={selectedKey}
                  onSelect={selectNode}
                />
              ))
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-6">Menu Details</h2>
                {hasDraft ? (
                  <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0">Node Key:</span>
                    <code className="truncate rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">
                      {formMenuKey || '—'}
                    </code>
                  </div>
                ) : null}
              </div>
              {mode === 'view' && selectedNode && formState.isDirty ? (
                <span className="text-xs font-medium text-warning">
                  ● Unsaved changes
                </span>
              ) : null}
            </div>
            <div className="p-4">
              {!hasDraft ? (
                <p className="text-sm text-muted-foreground">
                  Select a menu node on the left to view/edit, or click Add Root Menu.
                </p>
              ) : (
                <>
                  {mode === 'view' && selectedNode ? (
                    <div className="mb-4 space-y-3">
                      <dl className="grid gap-x-6 gap-y-4 border-b border-border/60 pb-4 sm:grid-cols-2">
                        <DetailField label="Menu Level">
                          {menuLevelText(selectedNode.menuType)}
                        </DetailField>
                        <DetailField label="Parent Menu">
                          {selectedNode.parentId
                            ? findMenuNode(tree ?? [], selectedNode.parentId)?.menuName ?? '-'
                            : 'None (root level)'}
                        </DetailField>
                      </dl>
                      <p className="text-xs text-muted-foreground">
                        The parent menu is set when the menu is created and cannot be
                        changed afterwards.
                      </p>
                    </div>
                  ) : null}

                  <form onSubmit={onSave} className="space-y-4">
                    {mode !== 'view' ? (
                      <Controller
                        control={control}
                        name="parentId"
                        render={({ field }) => (
                          <div className="space-y-1.5">
                            <Label htmlFor="menu-parent-select">Parent Menu</Label>
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger id="menu-parent-select" className="w-full">
                                  <SelectValue placeholder="Select parent (empty = top level)" />
                                </SelectTrigger>
                                <SelectContent>
                                  {parentOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {field.value !== '' ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 shrink-0"
                                  aria-label="Clear parent menu"
                                  onClick={() => field.onChange('')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        )}
                      />
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        name="menuName"
                        label="Menu Name"
                        required
                        error={formState.errors.menuName?.message}
                        register={register('menuName')}
                      />
                      <FormField
                        name="menuNameEn"
                        label="English Name"
                        required
                        placeholder="e.g. User"
                        error={formState.errors.menuNameEn?.message}
                        register={register('menuNameEn')}
                      />
                      <div className="space-y-1">
                        <FormField
                          name="menuKey"
                          label="Menu Key"
                          required
                          disabled={mode === 'view'}
                          placeholder="e.g. bank:user:manage, unique"
                          error={formState.errors.menuKey?.message}
                          register={register('menuKey')}
                        />
                        {mode === 'view' ? (
                          <p className="text-xs text-muted-foreground">
                            The menu key is the stable identifier used by roles and
                            permissions and cannot be changed after creation.
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <FormSelect
                          name="menuType"
                          control={control}
                          label="Type"
                          options={MENU_TYPE_OPTIONS}
                          disabled={mode === 'view'}
                        />
                        {mode === 'view' ? (
                          <p className="text-xs text-muted-foreground">
                            The menu type is set when the menu is created and cannot be
                            changed afterwards.
                          </p>
                        ) : null}
                      </div>
                      <FormField
                        name="orderNum"
                        label="Sort Order"
                        type="number"
                        min={0}
                        step={1}
                        error={formState.errors.orderNum?.message}
                        register={register('orderNum')}
                      />
                      <FormSelect
                        name="visible"
                        control={control}
                        label="Visible"
                        options={[
                          { value: '0', label: 'Visible' },
                          { value: '1', label: 'Hidden' },
                        ]}
                      />
                      <FormField
                        name="menuUrl"
                        label="Route URL"
                        placeholder="e.g. /system/user"
                        register={register('menuUrl')}
                      />
                      <FormField
                        name="icon"
                        label="Icon"
                        placeholder="Optional"
                        register={register('icon')}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                      {mode === 'view' && selectedNode ? (
                        <>
                          {hasPerm('bank:menu:manage') ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={startNewChild}
                            >
                              Add Submenu
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            className="text-destructive"
                            disabled={removeMutation.isPending}
                            onClick={() => setDeleteTarget(selectedNode)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelCreate}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </>
              )}
            </div>
          </section>

          {mode === 'view' && selectedNode?.menuKey ? (
            <DetailCard
              title="API Permissions"
              description="Method + URL, aligned with the AuthFilter permission table; Ant wildcards supported."
            >
              <MenuPermissionPanel
                menuKey={selectedNode.menuKey}
                menuName={selectedNode.menuName}
              />
            </DetailCard>
          ) : null}
        </div>
      </div>

      <ActionConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        icon={Trash2}
        tone="danger"
        title="Delete Menu"
        body1={`Delete menu "${deleteTarget?.menuName}"?`}
        body2="Rejected if it has children or is referenced by roles."
        confirmLabel="Delete"
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}
