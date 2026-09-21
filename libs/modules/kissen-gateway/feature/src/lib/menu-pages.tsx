'use client';

/**
 * 菜单管理页（源 `views/system/menu.vue`，路由 /system/menu）。
 *
 * 源语义 1:1：
 *  - 菜单树表格：el-table tree-props 层级展示 + default-expand-all →
 *    展平渲染按深度缩进，默认全展开（collapsed 集合仅记录折叠项），
 *    父节点行首箭头可折叠/展开。shared DataTable 不支持树形行，
 *    用与其同视觉语言的原生 table（log 页展开行同模式）。
 *  - 新增/编辑 Dialog：menuName / menuNameEn / menuKey 必填（源 formRules
 *    三条 blur 校验文案原样）；编辑时父级菜单、菜单Key、类型禁改
 *    （源 :disabled="editing"）。
 *  - 保存分流（源 onSave）：新增 POST /menu/save 全量表单；编辑
 *    POST /menu/update 仅可变字段（menuId + menuName/menuNameEn/orderNum/
 *    visible/menuUrl/icon，不含 parentId/menuKey/menuType）。
 *  - 删除：ElMessageBox.confirm 文案原样 → AlertDialog 确认弹窗；成功 toast
 *    「删除成功」；成功后刷新由 mutation invalidate menuKeys → 树自动重取。
 *  - 新增按钮 v-perm 'bank:menu:manage'（useGatewayPerm，未命中不渲染）；
 *    表格内编辑/删除源未挂 v-perm，保持一致。
 *  - 接口权限面板（源 §2.6 新增「移除」操作）：编辑弹窗内按节点 menuKey
 *    拉 /menu/menu-permission/list 展示 method+URL 行，行内 Remove →
 *    confirm 弹窗 → permissionDelete(menuPermissionId)；成功 toast +
 *    重拉列表即时刷新（invalidate 由 delete hook 承担）。错误 toast 为
 *    client 抛出的英文 message（KissenApiError 内嵌 traceId）。
 *    源同区块的「添加」输入行不在 T12 范围（任务仅覆盖移除操作）。
 */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ChevronRight, Loader2, X } from 'lucide-react';

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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
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

import { orDash } from './kit';
import { PageHead } from './page-head';
import { QueryErrorRetry } from './state-blocks';

/* ================================================================== */
/* 常量与展示辅助（源 menu.vue MENU_TYPE_TEXT / MENU_TYPE_TAG）          */
/* ================================================================== */

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 源 MENU_TYPE_TEXT：菜单类型文案。 */
const MENU_TYPE_TEXT: Record<number, string> = {
  0: 'Module',
  1: 'System',
  2: 'Menu',
  3: 'Sub-menu',
  4: 'Button',
};

/**
 * 源 MENU_TYPE_TAG（el-tag type）→ Badge variant，沿用 kissen 家族分层约定
 * （role/user/log/tx model 同一映射：success→default、primary/warning→secondary、
 * danger→destructive、info→outline）。
 */
const MENU_TYPE_BADGE_VARIANT: Record<number, BadgeVariant> = {
  0: 'outline',
  1: 'outline',
  2: 'secondary',
  3: 'secondary',
  4: 'destructive',
};

/** 源 menuTypeText：未知类型 → `Type N`，undefined → '-'。 */
function menuTypeText(t: number | undefined): string {
  return t === undefined ? '-' : (MENU_TYPE_TEXT[t] ?? `Type ${t}`);
}

/** 源 menuTypeTagType：未知类型兜底 'info'（家族约定 info → outline）。 */
function menuTypeBadgeVariant(t: number | undefined): BadgeVariant {
  return MENU_TYPE_BADGE_VARIANT[t ?? -1] ?? 'outline';
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
/* 树工具（源 el-table tree-props / el-tree-select）                    */
/* ================================================================== */

/** 树表行（展平 + 深度，源层级缩进展示）。 */
interface MenuFlatRow {
  node: MenuTree;
  depth: number;
}

/** 展平菜单树为表格行；折叠集合中的节点跳过其子级（default-expand-all ↔ 初始空集合）。 */
function flattenMenuTree(
  nodes: MenuTree[],
  collapsed: ReadonlySet<number>,
  depth = 0,
  out: MenuFlatRow[] = [],
): MenuFlatRow[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children?.length && !collapsed.has(node.menuId)) {
      flattenMenuTree(node.children, collapsed, depth + 1, out);
    }
  }
  return out;
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

/* ================================================================== */
/* 新增/编辑菜单 Dialog（源 el-dialog + el-form + formRules）           */
/* ================================================================== */

/** 弹窗状态：create（源 openCreate）/ edit（源 openEdit，携带当前行）。 */
type MenuDialogState = { mode: 'create' } | { mode: 'edit'; row: MenuTree };

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

function MenuFormDialog({
  state,
  tree,
  onClose,
}: {
  state: MenuDialogState;
  tree: MenuTree[];
  onClose: () => void;
}) {
  const toast = useToast();
  const saveMutation = useMenuSaveMutation(KISSEN_GATEWAY_PROJECT_ID);
  const updateMutation = useMenuUpdateMutation(KISSEN_GATEWAY_PROJECT_ID);
  const editing = state.mode === 'edit';

  const { register, handleSubmit, reset, control, formState } =
    useForm<MenuFormValues>({
      resolver: createFormResolver(menuFormSchema),
      mode: 'onTouched',
      defaultValues: MENU_FORM_CREATE_DEFAULTS,
    });

  /** 打开时回填（源 openCreate / openEdit 的 Object.assign(form, ...)）。 */
  React.useEffect(() => {
    if (state.mode === 'edit') {
      const row = state.row;
      reset({
        parentId: row.parentId ? String(row.parentId) : '',
        menuName: row.menuName,
        menuNameEn: row.menuNameEn ?? '',
        menuKey: row.menuKey,
        menuType: String(row.menuType ?? 2),
        orderNum: String(row.orderNum ?? 0),
        visible: String(row.visible ?? 0),
        menuUrl: row.menuUrl ?? '',
        icon: row.icon ?? '',
      });
    } else {
      reset(MENU_FORM_CREATE_DEFAULTS);
    }
  }, [state, reset]);

  const onOk = handleSubmit((v) => {
    // 源：ElMessage.success('保存成功') → 关弹窗 → load()（重取由 invalidate 承担）。
    const onDone = {
      onSuccess: () => {
        toast.success('Saved successfully');
        onClose();
      },
      onError: (e: Error) => toast.error(e.message),
    };
    if (state.mode === 'edit') {
      // 源 update 分支：仅可变字段（父级/菜单Key/类型编辑时不可改，不上送）。
      updateMutation.mutate(
        {
          menuId: state.row.menuId,
          menuName: v.menuName,
          menuNameEn: v.menuNameEn,
          orderNum: parseOrderNum(v.orderNum),
          visible: Number(v.visible),
          menuUrl: v.menuUrl,
          icon: v.icon,
        },
        onDone,
      );
    } else {
      // 源 save 分支：{...form} 全量（parentId 空 = 顶级，不上送）。
      saveMutation.mutate(
        {
          menuName: v.menuName,
          menuNameEn: v.menuNameEn,
          menuKey: v.menuKey,
          parentId: v.parentId === '' ? undefined : Number(v.parentId),
          menuType: Number(v.menuType),
          orderNum: parseOrderNum(v.orderNum),
          visible: Number(v.visible),
          menuUrl: v.menuUrl,
          icon: v.icon,
        },
        onDone,
      );
    }
  });

  const saving = saveMutation.isPending || updateMutation.isPending;
  const parentOptions = React.useMemo(() => parentMenuOptions(tree), [tree]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px] lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Menu' : 'Create Menu'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onOk} className="space-y-4">
          {/* 父级菜单（源 el-tree-select：check-strictly + clearable，编辑禁用）。 */}
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
                    disabled={editing}
                  >
                    <SelectTrigger id="menu-parent-select" className="w-full">
                      <SelectValue placeholder="Select parent (empty = top level)" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.value !== '' && !editing && (
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
                  )}
                </div>
                {editing && (
                  <p className="text-xs text-muted-foreground">
                    Parent menu cannot be changed after creation
                  </p>
                )}
              </div>
            )}
          />
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
              disabled={editing}
              placeholder="e.g. bank:user:manage, unique"
              error={formState.errors.menuKey?.message}
              register={register('menuKey')}
            />
            {editing && (
              <p className="text-xs text-muted-foreground">
                Menu key cannot be changed after creation
              </p>
            )}
          </div>
          <div className="space-y-1">
            <FormSelect
              name="menuType"
              control={control}
              label="Type"
              options={MENU_TYPE_OPTIONS}
              disabled={editing}
            />
            {editing && (
              <p className="text-xs text-muted-foreground">
                Type cannot be changed after creation
              </p>
            )}
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
          {/* 可见（源 el-radio-group：0 显示 / 1 隐藏）。 */}
          <Controller
            control={control}
            name="visible"
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label>Visible</Label>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex items-center gap-6"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="0" />
                    Shown
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="1" />
                    Hidden
                  </label>
                </RadioGroup>
              </div>
            )}
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

          {/* 接口权限面板（源 el-divider + isEdit 区块；仅编辑已保存节点展示）。 */}
          {editing && (
            <MenuPermissionPanel
              menuKey={state.row.menuKey}
              menuName={state.row.menuName}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 接口权限面板（源 menu.vue isEdit 区块 + §2.6「移除」操作）           */
/* ================================================================== */

const PERM_TABLE_HEADERS = ['Method', 'URL', 'Actions'] as const;

/**
 * 编辑弹窗内的接口权限表（源 el-table :data="perms" 1:1）。
 * list 为 POST 查询端点 → useMenuPermissionListMutation 命令式建模
 * （data-access 预置 hook）；移除 → confirm 弹窗 → permissionDelete，
 * delete hook onSuccess invalidate permissionList 维度，再 mutateAsync
 * 重拉实现「删除后列表即时刷新」。
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
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">
        API Permissions (method + URL, aligned with the AuthFilter permission table, Ant wildcards supported)
      </p>
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
            {loading && rows.length === 0 ? (
              <tr>
                {PERM_TABLE_HEADERS.map((header) => (
                  <td key={header} className="px-3 py-2.5">
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  </td>
                ))}
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={PERM_TABLE_HEADERS.length}
                  className="px-3 py-5 text-center text-muted-foreground"
                >
                  No data
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
      {listMutation.isError && (
        <p className="text-sm text-destructive">
          {(listMutation.error as Error)?.message}
        </p>
      )}

      {/* 权限行移除确认（T12 要求 confirm 提示；破坏性动作用 destructive）。 */}
      <AlertDialog
        open={permDeleteTarget != null}
        onOpenChange={(o) => !o && setPermDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove API Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Remove permission "{permDeleteTarget?.httpMethod || '*'}{' '}
              {permDeleteTarget?.resourceUrl}" from menu "{menuName}"? The
              gateway will stop matching this method + URL for menu key "
              {menuKey}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onConfirmPermDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ================================================================== */
/* 菜单管理页（registry：/system/menu → MenuListPage，名字不可改）      */
/* ================================================================== */

const MENU_TABLE_HEADERS = [
  'Menu Name',
  'Menu Key',
  'Type',
  'Visible',
  'Sort Order',
  'Route URL',
  'Actions',
] as const;

export function MenuListPage() {
  const toast = useToast();
  const hasPerm = useGatewayPerm();
  const { data: tree, isLoading, isError, error, refetch } =
    useMenuTreeQuery(KISSEN_GATEWAY_PROJECT_ID);
  const removeMutation = useMenuRemoveMutation(KISSEN_GATEWAY_PROJECT_ID);

  /** 折叠集合（源 default-expand-all → 初始空集即全部展开）。 */
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );
  const [dialogState, setDialogState] = React.useState<MenuDialogState | null>(
    null,
  );
  /** 删除确认目标（受控 open；行删除按钮仅选中，不直接触发 mutation）。 */
  const [deleteTarget, setDeleteTarget] = React.useState<MenuTree | null>(
    null,
  );

  const rows = React.useMemo(
    () => flattenMenuTree(tree ?? [], collapsed),
    [tree, collapsed],
  );

  const onToggleCollapse = React.useCallback((menuId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  }, []);

  /** 删除确认（源 onDelete：确认文案 1:1；成功 toast「删除成功」+ 树自动重取）。 */
  const onConfirmDelete = React.useCallback(() => {
    if (!deleteTarget) return;
    removeMutation.mutate(deleteTarget.menuId, {
      onSuccess: () => toast.success('Deleted successfully'),
      onError: (e) => toast.error((e as Error).message),
    });
    setDeleteTarget(null);
  }, [deleteTarget, removeMutation, toast]);

  return (
    <div className="space-y-6">
      <PageHead variant="banner" title="Menu Management">
        {/* 源 v-perm="'bank:menu:manage'"（menuKeys 未命中即不渲染）。 */}
        {hasPerm('bank:menu:manage') && (
          <Button onClick={() => setDialogState({ mode: 'create' })}>
            Create Menu
          </Button>
        )}
      </PageHead>

      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        {isError ? (
          <QueryErrorRetry error={error} onRetry={() => refetch()} withIcon />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full caption-bottom text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {MENU_TABLE_HEADERS.map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="h-10 px-4 text-left align-middle font-medium text-muted-foreground"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      {MENU_TABLE_HEADERS.map((header) => (
                        <td key={header} className="px-4 py-3">
                          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={MENU_TABLE_HEADERS.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No data
                    </td>
                  </tr>
                ) : (
                  rows.map(({ node, depth }) => {
                    const hasChildren = !!node.children?.length;
                    const expanded = !collapsed.has(node.menuId);
                    return (
                      <tr
                        key={node.menuId}
                        className="transition-colors hover:bg-muted/50"
                      >
                        {/* 菜单名称（源 tree-props 层级缩进 + 行首展开箭头）。 */}
                        <td className="px-4 py-3 align-middle">
                          <span
                            className="flex items-center gap-1"
                            style={{ paddingLeft: depth * 20 }}
                          >
                            {hasChildren ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                aria-label={expanded ? 'Collapse' : 'Expand'}
                                aria-expanded={expanded}
                                onClick={() => onToggleCollapse(node.menuId)}
                              >
                                <ChevronRight
                                  className={cn(
                                    'h-4 w-4 transition-transform',
                                    expanded && 'rotate-90',
                                  )}
                                />
                              </Button>
                            ) : (
                              <span className="inline-block h-5 w-5 shrink-0" />
                            )}
                            <span className="font-medium">{node.menuName}</span>
                          </span>
                        </td>
                        <td className="max-w-[16rem] px-4 py-3 align-middle">
                          <span className="block truncate" title={node.menuKey}>
                            {node.menuKey}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <Badge variant={menuTypeBadgeVariant(node.menuType)}>
                            {menuTypeText(node.menuType)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {/* 源：visible 0=显示(success) / 1=隐藏(info) → 家族约定 default/outline。 */}
                          <Badge
                            variant={node.visible === 0 ? 'default' : 'outline'}
                          >
                            {node.visible === 0 ? 'Shown' : 'Hidden'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-middle tabular-nums">
                          {node.orderNum ?? '-'}
                        </td>
                        <td className="max-w-[16rem] px-4 py-3 align-middle">
                          <span className="block truncate" title={orDash(node.menuUrl)}>
                            {orDash(node.menuUrl)}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0"
                              onClick={() =>
                                setDialogState({ mode: 'edit', row: node })
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-destructive"
                              onClick={() => setDeleteTarget(node)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialogState && (
        <MenuFormDialog
          state={dialogState}
          tree={tree ?? []}
          onClose={() => setDialogState(null)}
        />
      )}

      {/* 删除确认弹窗（源 ElMessageBox.confirm 文案 1:1；删除为破坏性动作用 destructive）。 */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu</AlertDialogTitle>
            <AlertDialogDescription>
              Delete menu "{deleteTarget?.menuName}"? Rejected if it has children or is referenced by roles.
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
