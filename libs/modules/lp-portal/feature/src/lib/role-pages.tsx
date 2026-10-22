'use client';

/**
 * 角色管理（C2，源 `views/system/role/{index,role-dialog,assign-menu-dialog}.vue`）。
 *
 * 页面结构对齐 kissen-admin System Management 视觉基线（页头标题/描述/右侧
 * 操作 + 紧凑统计卡 + 数据卡内标题/结果数/更新时间/过滤区/DataTable +
 * DetailCard 分区表单与详情），行为保持 LP 源语义：
 * - 查询：角色编码 / 角色名称均模糊匹配；POST /lp/role/page 固定 pageSize 10；
 * - 菜单树页面级一次加载（GET /lp/menu/tree），表单 Assigned Menus 分区与
 *   详情授权抽屉共用同一套勾选口径；
 * - 表格列：roleCode/roleName/类型（0 内置 danger / 1 自定义 primary）/
 *   状态（0 正常 success / 1 停用 warning）/备注（空 '-'）/操作；
 * - 删除：内置角色（roleType===0）按钮禁用；自定义 → 确认 →
 *   POST /lp/role/delete/{roleId}；内置 23_0007/被引用 23_0006 由后端拒绝；
 * - 表单页（/sys/role/create、/sys/role/edit?roleCode=X）：roleCode 必填
 *   （≤30，编辑禁用）/roleName 必填/备注 textarea；编辑 update 不携带
 *   roleCode；新增 save（roleType 后端固定 1 自定义）。Assigned Menus 分区
 *   保存口径 = 勾叶子 + 半选父合并去重，经 POST /lp/role/assign-menu 提交
 *   （LP save/update 请求体无 menuIds 载体；新增先 save 再按唯一 roleCode
 *   反查 roleId）；编辑且勾选结果为空先二次确认清空；
 * - 分配菜单抽屉（关键边界，见 RoleDetailPage 头注释）：回显仅勾叶子 +
 *   保存合并半选父；空勾选先二次确认清空；保存成功后父页不重查列表
 *   （授权不改角色行字段）；
 * - 「新增角色」v-perm 'lp:role'（操作列按钮无 v-perm，源同款）。
 *
 * STATIC-FILLER(GAP-LP-08/09)：无角色单查端点——详情/编辑回显以 /lp/role/page
 * 大页拉全量按 roleCode 定位（后端补 GET /roles/:roleCode 后切换）；统计卡与
 * 新增后 roleId 反查同口径。
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
  ListTree,
  MoreVertical,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  LP_PROJECT_ID,
  getRoleOptionsPage,
  roleKeys,
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
import {
  ActionConfirmDialog,
  Dash,
  ProtoStatusBadge,
  type ProtoTone,
} from './proto-ui';
import { LP_ROLE_STATUS_MAP } from './proto-enums';
import { ProtoSortHeader, useProtoSort } from './proto-sort';

const PROJECT_ID = LP_PROJECT_ID;
/** 源 el-pagination 固定 page-size 10（layout 'total, prev, pager, next'）。 */
const PAGE_SIZE = 10;

/** 角色域路由（registry 组前缀 /sys/role；create/edit/detail 为子 pageKey）。 */
const ROLE_LIST_PATH = '/sys/role';
const ROLE_CREATE_PATH = `${ROLE_LIST_PATH}/create`;
const ROLE_EDIT_PATH = `${ROLE_LIST_PATH}/edit`;

/**
 * STATIC-FILLER(GAP-LP-08): 无角色单查端点——详情/编辑回显以 /lp/role/page
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

/* ================================================================== */
/* 菜单授权树（el-tree show-checkbox check-strictly=false 等价）          */
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
 *
 * 表单 Assigned Menus 分区与详情授权抽屉共用上述口径与 collectGrantedIds
 * 产出（提交载体均为 POST /lp/role/assign-menu 的 menuIds）。
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

/**
 * 授权提交集：全选节点（子树叶子全勾）+ 半选节点（部分勾）按树序合并去重，
 * 等价源 getCheckedKeys(false) + getHalfCheckedKeys()。
 */
function collectGrantedIds(nodes: MenuTree[], checked: Set<number>): number[] {
  const ids: number[] = [];
  const walk = (list: MenuTree[]) => {
    for (const n of list) {
      const { fullyChecked, indeterminate } = toCheckNode(n, checked);
      if (fullyChecked || indeterminate) ids.push(n.menuId);
      if (n.children && n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return [...new Set(ids)];
}

/** 集合相等（表单菜单勾选脏检查：与回显叶子基准比较）。 */
function setEquals(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
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

/** 只读授权树行（详情 Assigned Menus 卡：勾选=已授权，未授权置灰）。 */
function MenuGrantedTreeNode({
  node,
  depth,
  grantedIds,
}: {
  node: MenuTree;
  depth: number;
  grantedIds: Set<number>;
}) {
  const children = node.children ?? [];
  const granted = grantedIds.has(node.menuId);
  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded px-2 py-1.5 ${
          granted ? 'text-foreground' : 'text-muted-foreground'
        }`}
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
        <span className={`truncate text-sm ${granted ? 'font-medium' : undefined}`}>
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

/** 树全节点数（toast「{selected} of {total} menus」分母）。 */
function countTreeNodes(nodes: MenuTree[]): number {
  return nodes.reduce(
    (acc, n) => acc + 1 + (n.children?.length ? countTreeNodes(n.children) : 0),
    0,
  );
}

/* ================================================================== */
/* 共享页面小件（Kissen 视觉基线同款：紧凑统计卡 / DetailCard / 页头）      */
/* ================================================================== */

/** 列表统计卡（Kissen 紧凑密度：label + 语义色大数值 + 脚注）。 */
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
    <section className="min-w-0 rounded-lg border border-border/60 bg-card p-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div
        className={`mt-1.5 text-2xl font-semibold leading-none tabular-nums ${STAT_TEXT_TONE[tone]}`}
      >
        {value}
      </div>
      <div className="mt-2 text-xs leading-4 text-muted-foreground">{help}</div>
    </section>
  );
}

/** 统计卡数值语义色（软底徽章同口径的正文前景映射）。 */
const STAT_TEXT_TONE: Record<ProtoTone, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
  info: 'text-sky-600 dark:text-sky-400',
  primary: 'text-primary',
  muted: 'text-muted-foreground',
};

/** 分区信息卡（Kissen DetailCard：标题行 + 底边框 + p-4 正文）。 */
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
      className={`min-w-0 rounded-lg border border-border/60 bg-card ${className ?? ''}`}
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
function RoleBuiltInBadge() {
  return (
    <Badge variant="mute" size="sm" className="shrink-0 gap-1">
      <ShieldCheck className="size-3" aria-hidden="true" />
      Built-in
    </Badge>
  );
}

/** Detail/form page header matching the system-management page pattern. */
function DetailHeader({
  backTo = ROLE_LIST_PATH,
  title,
  badge,
  description,
  actions,
}: {
  backTo?: string;
  title: string;
  badge?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Button
        type="button"
        variant="outline"
        size="iconSm"
        className="shrink-0"
        aria-label="Back to Role List"
        onClick={() => router.push(backTo)}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold leading-7">{title}</h1>
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

/* ================================================================== */
/* 角色 Create/Edit 全页表单（原 role-dialog.vue；/sys/role/create、        */
/* /sys/role/edit?roleCode=X）                                             */
/* ================================================================== */

interface RoleFormValues {
  roleCode: string;
  roleName: string;
  remarks: string;
}

export function RoleFormPage() {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const roleCodeParam = searchParams.get('roleCode');
  const isEdit = roleCodeParam != null && roleCodeParam !== '';

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<RoleFormValues>({
    defaultValues: { roleCode: '', roleName: '', remarks: '' },
  });
  const roleCodeValue = watch('roleCode');
  const roleNameValue = watch('roleName');
  // STATIC-FILLER(GAP-LP-08)：编辑回显无单查端点——大页按 roleCode 定位
  const lookupQuery = useRolePageQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: isEdit ? ROLE_LOOKUP_PAGE_SIZE : 1,
  });
  const seed = React.useMemo(
    () =>
      isEdit && roleCodeParam
        ? (lookupQuery.data?.data ?? []).find(
            (r) => r.roleCode === roleCodeParam,
          ) ?? null
        : null,
    [isEdit, roleCodeParam, lookupQuery.data],
  );
  React.useEffect(() => {
    if (!isEdit || !seed) return;
    reset({
      roleCode: seed.roleCode,
      roleName: seed.roleName,
      remarks: seed.remarks ?? '',
    });
  }, [isEdit, seed, reset]);

  const treeQuery = useMenuTreeQuery(PROJECT_ID);
  const menuTree = treeQuery.data ?? [];

  const treeLeafIds = React.useMemo(() => {
    const s = new Set<number>();
    collectLeafIds(menuTree, s);
    return s;
  }, [menuTree]);

  // Assigned Menus 回显（源 filterLeafIds 口径）：服务端全量 ids ∩ 树叶子集
  const menuIdsQuery = useRoleMenuIdsQuery(
    PROJECT_ID,
    seed?.roleId ?? 0,
    isEdit && seed != null,
  );
  const baseLeafIds = React.useMemo(
    () =>
      new Set((menuIdsQuery.data ?? []).filter((id) => treeLeafIds.has(id))),
    [menuIdsQuery.data, treeLeafIds],
  );

  // 勾选事实源 = 叶子集（父全选/半选由树结构推导，同授权抽屉口径）
  const [checked, setChecked] = React.useState<Set<number>>(new Set());
  const treeHydrated = React.useRef(false);
  React.useEffect(() => {
    // 树与授权 ids 均就绪才回显，避免任一先到导致空叶子集误存基准
    if (
      !isEdit ||
      treeHydrated.current ||
      treeQuery.data == null ||
      menuIdsQuery.data == null
    ) {
      return;
    }
    treeHydrated.current = true;
    setChecked(new Set(baseLeafIds));
  }, [isEdit, treeQuery.data, menuIdsQuery.data, baseLeafIds]);
  const saveMutation = useRoleSaveMutation(PROJECT_ID);
  const updateMutation = useRoleUpdateMutation(PROJECT_ID);
  const assignMutation = useRoleAssignMenuMutation(PROJECT_ID);
  const saving =
    saveMutation.isPending || updateMutation.isPending || assignMutation.isPending;

  // 菜单勾选脏检查：编辑与回显叶子基准比较；新增以「勾了叶子」为脏
  const menusDirty = isEdit
    ? treeHydrated.current && !setEquals(checked, baseLeafIds)
    : checked.size > 0;
  const formDirty = isDirty || menusDirty;

  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [pendingClear, setPendingClear] = React.useState<(() => void) | null>(
    null,
  );

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

  const finish = () => {
    toast.success('Saved successfully');
    router.push(ROLE_LIST_PATH);
  };

  const doSubmit = (v: RoleFormValues, menuIds: number[]) => {
    if (isEdit && seed) {
      // roleCode 不可改，update 不携带（源同款）
      updateMutation.mutate(
        {
          roleId: seed.roleId,
          roleName: v.roleName,
          remarks: v.remarks,
        },
        {
          onSuccess: () => {
            if (menusDirty) {
              // 授权载体 menuIds（GAP-LP-13）：勾选变化才走 assign-menu
              assignMutation.mutate(
                { roleId: seed.roleId, menuIds },
                { onSuccess: finish },
              );
              return;
            }
            finish();
          },
        },
      );
      return;
    }
    saveMutation.mutate(
      { roleCode: v.roleCode, roleName: v.roleName, remarks: v.remarks },
      {
        onSuccess: () => {
          if (menuIds.length === 0) {
            finish();
            return;
          }
          // STATIC-FILLER(GAP-LP-08)：save 无返回体——roleCode 全局唯一
          // （23_0005），按唯一编码反查新建 roleId 后提交授权
          queryClient
            .fetchQuery({
              queryKey: roleKeys.options(PROJECT_ID),
              queryFn: () => getRoleOptionsPage(),
            })
            .then(
              (page) =>
                page.data.find((r) => r.roleCode === v.roleCode) ?? null,
            )
            .then((created) => {
              if (!created) {
                finish();
                return;
              }
              assignMutation.mutate(
                { roleId: created.roleId, menuIds },
                { onSuccess: finish },
              );
            })
            .catch(() => {
              // 反查失败不阻塞建角色：角色已创建，菜单可在详情页补授
              finish();
            });
        },
      },
    );
  };

  const onSubmit = handleSubmit((v) => {
    const menuIds = collectGrantedIds(menuTree, checked);
    if (isEdit && menusDirty && menuIds.length === 0) {
      // 源空勾选二次确认：后端空数组 = 事务清空该角色全部菜单
      setPendingClear(() => () => doSubmit(v, menuIds));
      setClearOpen(true);
      return;
    }
    doSubmit(v, menuIds);
  });

  if (isEdit && lookupQuery.isPending) {
    return (
      <div className="space-y-4">
        <DetailHeader title="Edit Role" />
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <div className="space-y-4">
            <div className="h-5 w-40 animate-pulse rounded bg-muted/60" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded bg-muted/60"
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (isEdit && lookupQuery.data != null && !seed) {
    return (
      <div className="space-y-4">
        <DetailHeader title="Edit Role" />
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
            <p className="text-sm font-medium">Role not found</p>
            <p className="text-sm text-muted-foreground">
              This role does not exist or has been removed.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(ROLE_LIST_PATH)}
              >
                Back to Roles
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DetailHeader
        title={isEdit ? 'Edit Role' : 'Add Role'}
        description={
          isEdit
            ? `Update role ${roleCodeParam} and its assigned menu access.`
            : 'Create a role profile and assign its menu access.'
        }
      />

      <form
        className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]"
        onSubmit={(e) => void onSubmit(e)}
        noValidate
      >
        <div className="min-w-0 space-y-4">
          <DetailCard
            title="Basic Information"
            description="Role identity and description."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FormField
                  name="roleCode"
                  label="Role Code"
                  required
                  disabled={isEdit}
                  maxLength={30}
                  placeholder="e.g. ROLE_LP_FINANCE, unique"
                  error={errors.roleCode?.message}
                  register={register('roleCode', {
                    required: 'Please enter a role code',
                  })}
                />
                {isEdit ? (
                  <p className="text-xs text-muted-foreground">
                    Role Code cannot be changed after creation.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="role-type"
                  className="block text-sm font-medium text-foreground"
                >
                  Type
                </label>
                <Input
                  id="role-type"
                  disabled
                  readOnly
                  value={
                    isEdit && seed?.roleType === 0 ? 'Built-in' : 'Custom'
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Assigned by the system.
                </p>
              </div>
              <FormField
                name="roleName"
                label="Role Name"
                required
                className="sm:col-span-2"
                error={errors.roleName?.message}
                register={register('roleName', {
                  required: 'Please enter a role name',
                })}
              />
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="role-remarks"
                  className="block text-sm font-medium text-foreground"
                >
                  Description
                </label>
                <Textarea
                  id="role-remarks"
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
            {treeQuery.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-6 animate-pulse rounded bg-muted/60"
                  />
                ))}
              </div>
            ) : menuTree.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No menus
              </p>
            ) : (
              <>
                <div className="max-h-80 overflow-y-auto rounded-md border p-2">
                  <MenuCheckTreeNodes
                    nodes={menuTree}
                    depth={0}
                    checked={checked}
                    disabled={saving}
                    onToggle={onToggle}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Checking a parent cascades to children; leaf menus are the
                  minimum grant unit.
                </p>
              </>
            )}
          </DetailCard>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border/60 bg-card p-4">
            <h2 className="text-sm font-medium">Preview</h2>
            <div className="mt-1 text-xs text-muted-foreground">
              Role profile and menu access.
            </div>
            <div className="mt-3 min-w-0">
              <div className="truncate text-sm font-semibold">
                {roleNameValue.trim() || 'Role Name'}
              </div>
              <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {roleCodeValue.trim() || 'Role Code'}
              </div>
            </div>
            <div className="mt-3 border-t border-border/50 pt-3">
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                <span>Assigned Menus</span>
                <Badge variant="secondary" className="tabular-nums">
                  {checked.size}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Leaf menus are the minimum grant unit.
              </p>
            </div>
          </section>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                if (formDirty) setDiscardOpen(true);
                else router.push(ROLE_LIST_PATH);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </aside>
      </form>
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
          router.push(ROLE_LIST_PATH);
        }}
      />
      <ActionConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        icon={ListTree}
        iconTone="warning"
        title="Clear Menus"
        body1="Will clear all menus of this role. Continue?"
        confirmLabel="Clear"
        confirmTone="destructive"
        loading={saving}
        onConfirm={() => {
          setClearOpen(false);
          pendingClear?.();
          setPendingClear(null);
        }}
      />
    </div>
  );
}

/* ================================================================== */
/* 角色管理列表页（原型 RoleManagementPage）                             */
/* ================================================================== */

export function RoleListPage() {
  const toast = useToast();
  const router = useRouter();
  const { register, handleSubmit, reset } =
    useForm<RoleFilterForm>({ defaultValues: EMPTY_ROLE_FILTER });
  const [params, setParams] = React.useState<RoleQueryParams>(() =>
    roleFormToParams(EMPTY_ROLE_FILTER),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE);

  const [deleteTarget, setDeleteTarget] = React.useState<RoleRow | null>(null);

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

  // 服务端 /lp/role/page 无排序参数——客户端当前页排序（GAP-LP-05 口径，
  // 后端补排序后切换）
  const sortGetters = React.useMemo(
    () => ({
      roleName: { value: (r: RoleRow) => r.roleName },
      type: { value: (r: RoleRow) => (r.roleType === 0 ? 0 : 1) },
      description: { value: (r: RoleRow) => r.remarks ?? '' },
      createdOn: { value: (r: RoleRow) => r.createTime },
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
    'roleName',
    'asc',
  );

  const columns = React.useMemo<ColumnDef<RoleRow & { id: string }>[]>(
    () => [
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
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-semibold">
                {row.original.roleName}
              </span>
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
          <ProtoSortHeader
            label="Type"
            columnKey="type"
            toggle={toggle}
            sortState={sortState('type')}
          />
        ),
        cell: ({ row }) =>
          row.original.roleType === 0 ? 'Built-in' : 'Custom',
      },
      {
        accessorKey: 'remarks',
        header: () => (
          <ProtoSortHeader
            label="Description"
            columnKey="description"
            toggle={toggle}
            sortState={sortState('description')}
          />
        ),
        cell: ({ row }) => (
          <span
            className="block max-w-[320px] truncate"
            title={row.original.remarks ?? undefined}
          >
            {row.original.remarks || <Dash />}
          </span>
        ),
      },
      {
        accessorKey: 'createTime',
        header: () => (
          <ProtoSortHeader
            label="Created on"
            columnKey="createdOn"
            toggle={toggle}
            sortState={sortState('createdOn')}
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`More actions for ${row.original.roleName}`}
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    router.push({
                      pathname: ROLE_EDIT_PATH,
                      query: { roleCode: row.original.roleCode },
                    })
                  }
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
                  onClick={() => setDeleteTarget(row.original)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [toggle, sortState, router],
  );

  const statItems: {
    label: string;
    value: React.ReactNode;
    help: string;
    tone: ProtoTone;
  }[] = [
    {
      label: 'Total Roles',
      value: statsReady
        ? (statsQuery.data?.pagination.total ?? statsRows.length)
        : '-',
      help: 'All roles defined in the system.',
      tone: 'primary',
    },
    {
      label: 'Active',
      value: statsReady
        ? statsRows.filter((r) => r.status === 0).length
        : '-',
      help: 'Effective authorization sources.',
      tone: 'success',
    },
    {
      label: 'Inactive',
      value: statsReady
        ? statsRows.filter((r) => r.status !== 0).length
        : '-',
      help: 'Suspended from authorization.',
      tone: 'warning',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7">Role Management</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Roles group menus into reusable authorization profiles.
          </p>
        </div>
        <PermButton
          menuKey="lp:role"
          onClick={() => router.push(ROLE_CREATE_PATH)}
        >
          Add Role
        </PermButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statItems.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <section className="min-w-0 rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-1 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold leading-6">Roles</h2>
            <span className="text-sm tabular-nums text-muted-foreground">
              {total} results
            </span>
          </div>
          {listQuery.dataUpdatedAt > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              Updated {formatUtc8(listQuery.dataUpdatedAt)}
            </span>
          ) : null}
        </div>
        <form
          onSubmit={handleSubmit((f) => setParams(roleFormToParams(f, 1)))}
          className="grid grid-cols-1 gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4"
        >
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
          <div className="flex items-end gap-2">
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
        <div className="p-4">
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
      </section>

      <ActionConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        icon={Trash2}
        iconTone="danger"
        title="Delete this role?"
        body1={
          deleteTarget
            ? `Once deleted, ${deleteTarget.roleName} (${deleteTarget.roleCode}) will no longer be available for assignment.`
            : ''
        }
        body2="This action cannot be undone."
        confirmLabel="Delete"
        confirmTone="destructive"
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          removeMutation.mutate(deleteTarget.roleId, {
            onSuccess: () => {
              toast.success('Role deleted successfully.');
              setDeleteTarget(null);
            },
          });
        }}
      />
    </div>
  );
}

/* ================================================================== */
/* 角色详情页（原型 RoleDetailPage；/sys/role/detail?roleCode=）         */
/* ================================================================== */

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
  const [clearOpen, setClearOpen] = React.useState(false);
  const [pendingClear, setPendingClear] = React.useState<(() => void) | null>(
    null,
  );
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
    const grantedIds = collectGrantedIds(menuTree, checked);
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
      setPendingClear(() => submit);
      setClearOpen(true);
      return;
    }
    submit();
  };

  // 详情 Assigned Menus 卡计数 = 服务端 ids ∩ 树节点（树序、去重）
  const assignedCount = React.useMemo(() => {
    const ids = new Set(menuIds);
    let count = 0;
    const walk = (nodes: MenuTree[]) => {
      for (const n of nodes) {
        if (ids.has(n.menuId)) count += 1;
        if (n.children && n.children.length > 0) walk(n.children);
      }
    };
    walk(menuTree);
    return count;
  }, [menuTree, menuIds]);

  const grantedIdSet = React.useMemo(() => new Set(menuIds), [menuIds]);

  if (roleCode == null || (listQuery.data != null && role == null)) {
    return (
      <div className="space-y-4">
        <DetailHeader title="Role Details" />
        <section className="rounded-lg border border-border/60 bg-card">
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
            <p className="text-sm font-medium">Role not found</p>
            <p className="text-sm text-muted-foreground">
              This role does not exist or has been removed.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(ROLE_LIST_PATH)}
              >
                Back to Roles
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (listQuery.isPending || role == null) {
    return (
      <div className="space-y-4">
        <DetailHeader title="Role Details" />
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-muted/60"
              />
            ))}
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <DetailHeader
        title={role.roleName || 'Role Details'}
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
              <span className="font-mono font-semibold text-foreground">
                {role.roleCode}
              </span>
            </span>
            <span aria-hidden="true">|</span>
            <span>
              Created on{' '}
              <span className="tabular-nums text-foreground">
                {formatUtc8(role.createTime)}
              </span>
            </span>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push({
                  pathname: ROLE_EDIT_PATH,
                  query: { roleCode: role.roleCode },
                })
              }
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignOpen(true)}
            >
              <ListTree className="h-4 w-4" aria-hidden="true" />
              Assign Menus
            </Button>
          </>
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <DetailCard title="Basic Information">
          <div className="space-y-4">
            <DetailField label="Role Code">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {role.roleCode}
              </code>
            </DetailField>
            <DetailField label="Role Name">
              <span className="flex items-center gap-2">
                <span className="font-medium">{role.roleName}</span>
                {role.roleType === 0 ? <RoleBuiltInBadge /> : null}
              </span>
            </DetailField>
            <DetailField label="Type">
              {role.roleType === 0 ? 'Built-in' : 'Custom'}
            </DetailField>
            <DetailField label="Description">
              <Dash value={role.remarks} />
            </DetailField>
          </div>
        </DetailCard>

        <DetailCard title="Role Activity">
          <DetailField label="Created on">
            <span className="tabular-nums">
              {formatUtc8(role.createTime)}
            </span>
          </DetailField>
        </DetailCard>

        <DetailCard
          title="Assigned Menus"
          description="Menu access granted to users with this role."
          className="md:col-span-2"
          action={
            <Badge variant="secondary" className="tabular-nums">
              {assignedCount}
            </Badge>
          }
        >
          {menuIdsQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-4 animate-pulse rounded bg-muted/60"
                />
              ))}
            </div>
          ) : menuIdsQuery.data == null ? null : menuTree.length === 0 ? (
            <p className="text-sm text-muted-foreground">No menus</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border p-2">
              {menuTree.map((node) => (
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

      <ActionConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        icon={ListTree}
        iconTone="warning"
        title="Clear Menus"
        body1="Will clear all menus of this role. Continue?"
        confirmLabel="Clear"
        confirmTone="destructive"
        loading={saving}
        onConfirm={() => {
          setClearOpen(false);
          pendingClear?.();
          setPendingClear(null);
        }}
      />
    </div>
  );
}
