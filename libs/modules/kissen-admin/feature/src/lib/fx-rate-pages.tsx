'use client';

/**
 * fx-rate — Token 对管理（原型 FxRateManagementPage / FxPairCreatePage /
 * FxPairDetailsPage / FxPairEditPage；上游 v2.0-tokenization）。
 *
 * - TokenPairListPage：registry key `pair`（/fx-rate/pair）。列表 + New Pair +
 *   Details/Edit/Disable/Activate 行操作（审批口径：15 重提、20 改参/停用、30/50 启用）。
 * - TokenPairCreatePage：/fx-rate/pair/create，组合表单 + 串行开通申请（KPT）。
 * - TokenPairDetailPage：/fx-rate/pair/detail?id=，basic/participation/operations 三 Tab。
 * - TokenPairEditPage：/fx-rate/pair/edit?id=，参数变更申请（KRC）/ 驳回重提（KPT）。
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  CircleCheck,
  CirclePause,
  Info,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@myorg/shared/ui';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';
import { FormField } from '@myorg/shared/ui-forms';

import {
  KISSEN_PROJECT_ID,
  tokenList,
  useChangeTokenPairMutation,
  useDisableTokenPairMutation,
  useEnableTokenPairMutation,
  useLpPairListQuery,
  useSaveTokenPairMutation,
  useTokenPairListQuery,
  type LpPairRow,
  type TokenPairListFilter,
  type TokenPairRow,
  type TokenRow,
} from '@myorg/modules/kissen-admin/data-access';

import { formatPercent, formatRate, formatUtc8 } from './proto-format';
import {
  ActionConfirmDialog,
  CopyableId,
  Dash,
  ProtoStatusBadge,
  type ProtoStatusTone,
} from './proto-ui';
import {
  PROTO_LP_PAIR_STATUS,
  PROTO_PAIR_STATUS,
  protoStatusLabel,
  protoStatusRank,
} from './proto-enums';
import { ProtoSortHeader, useProtoSort } from './proto-sort';

const PROJECT_ID = KISSEN_PROJECT_ID;

/** 列表路由（registry：fx-rate 组 → pair 页；deep slug = create/detail/edit）。 */
const PAIR_LIST_PATH = '/fx-rate/pair';
const PAIR_CREATE_PATH = `${PAIR_LIST_PATH}/create`;
const pairDetailPath = (pairId: number) => `${PAIR_LIST_PATH}/detail?id=${pairId}`;
const pairEditPath = (pairId: number) => `${PAIR_LIST_PATH}/edit?id=${pairId}`;

/** 状态筛选 Select 的「全部」哨兵值（shadcn Select 无原生 clearable）。 */
const STATUS_ALL = 'ALL';

/** Token 对状态色（原型 §10：Enabled success / Frozen info / Pending warning / Rejected danger / Disabled muted）。 */
const PAIR_STATUS_TONE: Record<number, ProtoStatusTone> = {
  5: 'warning',
  15: 'danger',
  20: 'success',
  30: 'info',
  50: 'muted',
};

/** LP 参与状态色（原型 SupportedTokenPairsPage：Active success / Processing warning / Rejected danger / Inactive muted）。 */
const LP_PAIR_STATUS_TONE: Record<number, ProtoStatusTone> = {
  20: 'success',
  5: 'warning',
  10: 'warning',
  15: 'danger',
  50: 'muted',
};

/** 状态筛选项（按 PROTO_PAIR_STATUS key 顺序 5/15/20/30/50）。 */
const PAIR_STATUS_OPTIONS = Object.entries(PROTO_PAIR_STATUS).map(
  ([value, meta]) => ({ value, label: meta.label }),
);

// ---------------------------------------------------------------------------
// 共享展示工具
// ---------------------------------------------------------------------------

/** 对标识文本 `SRC/TGT`（symbol 优先回退 tokenCode；原型 formatTokenPair）。 */
function pairLabel(row: {
  sourceSymbol?: string;
  sourceTokenCode?: string;
  targetSymbol?: string;
  targetTokenCode?: string;
}): string {
  return `${row.sourceSymbol || row.sourceTokenCode || '-'}/${
    row.targetSymbol || row.targetTokenCode || '-'
  }`;
}

/** 小数比例 → 百分比文本（原型 asPercent：(v*100) 去尾零；空/非法 → '-'）。 */
function asPercent(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return '-';
  return formatPercent(Number((n * 100).toFixed(6)));
}

/** Client Rate = Base ÷ (1 + Markup)（markup null/空/NaN 按 0；base 无效 → null）。 */
function clientRateOf(
  baseRate: string | number | null | undefined,
  markupRate: string | number | null | undefined,
): number | null {
  if (baseRate === null || baseRate === undefined || baseRate === '') return null;
  const base = Number(baseRate);
  if (Number.isNaN(base)) return null;
  const markup =
    markupRate == null || markupRate === '' ? 0 : Number(markupRate) || 0;
  return base / (1 + markup);
}

/** Token 对紧凑式单元格：SRC/TGT 主行 + 银行名称副行（银行 name 优先回退 code）。 */
function TokenPairCell({
  sourceSymbol,
  sourceTokenCode,
  targetSymbol,
  targetTokenCode,
  sourceBankName,
  sourceBankCode,
  targetBankName,
  targetBankCode,
}: {
  sourceSymbol: string;
  sourceTokenCode: string;
  targetSymbol: string;
  targetTokenCode: string;
  sourceBankName?: string;
  sourceBankCode: string;
  targetBankName?: string;
  targetBankCode: string;
}) {
  return (
    <div className="flex min-w-0 flex-col leading-snug">
      <span className="font-mono text-[13px] font-semibold tabular-nums">
        {sourceSymbol || sourceTokenCode || '-'}/
        {targetSymbol || targetTokenCode || '-'}
      </span>
      <span className="text-xs text-muted-foreground">
        {sourceBankName || sourceBankCode || '-'} →{' '}
        {targetBankName || targetBankCode || '-'}
      </span>
    </div>
  );
}

/** 子页页头：Back + 标题 + 右侧插槽（原型 Back 图标钮 + 页标题）。 */
function PairSubpageHeader({
  title,
  aside,
}: {
  title: string;
  aside?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="iconSm"
        aria-label="Back to FX Rate Management"
        onClick={() => router.push(PAIR_LIST_PATH)}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Button>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {aside}
    </div>
  );
}

/** 详情字段（label 上小写间距灰 + value；空值 Dash）。 */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** 列表/详情查无记录卡（详情/编辑页共用）。 */
function PairNotFoundCard() {
  const router = useRouter();
  return (
    <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
      <p className="text-sm font-semibold text-foreground">
        Token pair not found.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        The record may have been removed.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => router.push(PAIR_LIST_PATH)}
      >
        Back to FX Rate Management
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 字段级校验（原型 FxPairCreatePage/FxPairEditPage 同款判定与文案）
// ---------------------------------------------------------------------------

/** Base Rate：必填、数字、> 0。 */
function baseRateError(value: string): string | undefined {
  if (value === '') return 'Base Rate is required.';
  if (!/^\d+(\.\d+)?$/.test(value.trim()) || Number(value) <= 0) {
    return 'Enter a value greater than 0.';
  }
  return undefined;
}

/** Markup / Rev. Share：选填；填了须数字且 ≤ 1（原型 ratioError 同款）。 */
function ratioError(value: string): string | undefined {
  if (value === '') return undefined;
  if (!/^\d+(\.\d+)?$/.test(value.trim()) || Number(value) > 1) {
    return 'Enter a value between 0 and 1.';
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// TokenPairListPage — FX Rate Management（原型 FxRateManagementPage）
// ---------------------------------------------------------------------------

interface ListFilterForm {
  pairCode: string;
  status: string;
}

/**
 * Token 对列表（registry key `pair` → /fx-rate/pair）。
 *
 * - 筛选：Pair Code（Input，后端 pairCode 匹配语义由服务端定）/ Status。
 * - 列：Token Pair / Base Rate / Markup Rate / Client Rate（=base/(1+markup)）/
 *   Standard Rev. Share / Status / Created on (UTC+8) / Actions；数值列右对齐
 *   tabular-nums，全列可排序（useProtoSort triState）。
 * - 行操作：Details 常显；⋮ 菜单按状态（20 → Edit + Disable；15 → Edit；
 *   30/50 → Activate；5 待审无操作）。
 */
export function TokenPairListPage() {
  const toast = useToast();
  const router = useRouter();

  const [input, setInput] = React.useState<ListFilterForm>({
    pairCode: '',
    status: STATUS_ALL,
  });
  const [filter, setFilter] = React.useState<TokenPairListFilter>({});

  const { data: rows, isLoading, isError, dataUpdatedAt } =
    useTokenPairListQuery(PROJECT_ID, filter);
  const enableMutation = useEnableTokenPairMutation(PROJECT_ID);
  const disableMutation = useDisableTokenPairMutation(PROJECT_ID);

  // 启停确认流（原型 disablePair/activatePair confirm 文案）。
  const [confirmRow, setConfirmRow] = React.useState<{
    action: 'disable' | 'activate';
    row: TokenPairRow;
  } | null>(null);

  const onSearch = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setFilter({
        pairCode: input.pairCode.trim() || undefined,
        status:
          input.status === STATUS_ALL ? undefined : Number(input.status),
      });
    },
    [input],
  );

  const onReset = React.useCallback(() => {
    setInput({ pairCode: '', status: STATUS_ALL });
    setFilter({});
  }, []);

  const queryRows = rows ?? [];
  const { sorted, toggle, sortState } = useProtoSort(
    queryRows,
    {
      tokenPair: { value: (r) => pairLabel(r) },
      baseRate: {
        value: (r) => (r.baseRate == null ? null : Number(r.baseRate)),
      },
      markupRate: {
        value: (r) =>
          r.markupRate == null || r.markupRate === ''
            ? null
            : Number(r.markupRate),
      },
      clientRate: { value: (r) => clientRateOf(r.baseRate, r.markupRate) },
      revShare: {
        value: (r) =>
          r.defaultSplitRatio == null || r.defaultSplitRatio === ''
            ? null
            : Number(r.defaultSplitRatio),
      },
      status: { value: (r) => protoStatusRank(PROTO_PAIR_STATUS, r.status) },
      createdOn: { value: (r) => r.createTime },
    },
    'createdOn',
    'desc',
  );

  const tableData = React.useMemo(
    () => sorted.map((r) => ({ ...r, id: String(r.pairId) })),
    [sorted],
  );

  const columns = React.useMemo<
    ColumnDef<TokenPairRow & { id: string }>[]
  >(
    () => [
      {
        id: 'tokenPair',
        header: () => (
          <ProtoSortHeader
            label="Token Pair"
            columnKey="tokenPair"
            toggle={toggle}
            sortState={sortState('tokenPair')}
          />
        ),
        cell: ({ row }) => (
          <TokenPairCell
            sourceSymbol={row.original.sourceSymbol}
            sourceTokenCode={row.original.sourceTokenCode}
            targetSymbol={row.original.targetSymbol}
            targetTokenCode={row.original.targetTokenCode}
            sourceBankName={row.original.sourceBankName}
            sourceBankCode={row.original.sourceBankCode}
            targetBankName={row.original.targetBankName}
            targetBankCode={row.original.targetBankCode}
          />
        ),
      },
      {
        id: 'baseRate',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Base Rate"
              columnKey="baseRate"
              toggle={toggle}
              sortState={sortState('baseRate')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.baseRate == null ? (
              <Dash />
            ) : (
              formatRate(row.original.baseRate)
            )}
          </span>
        ),
      },
      {
        id: 'markupRate',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Markup Rate"
              columnKey="markupRate"
              toggle={toggle}
              sortState={sortState('markupRate')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.markupRate == null ? (
              <Dash />
            ) : (
              asPercent(row.original.markupRate)
            )}
          </span>
        ),
      },
      {
        id: 'clientRate',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Client Rate"
              columnKey="clientRate"
              toggle={toggle}
              sortState={sortState('clientRate')}
            />
          </div>
        ),
        cell: ({ row }) => {
          const v = clientRateOf(row.original.baseRate, row.original.markupRate);
          return (
            <span className="block text-right tabular-nums">
              {v == null ? <Dash /> : formatRate(v)}
            </span>
          );
        },
      },
      {
        id: 'revShare',
        header: () => (
          <div className="flex justify-end">
            <ProtoSortHeader
              label="Standard Rev. Share"
              columnKey="revShare"
              toggle={toggle}
              sortState={sortState('revShare')}
            />
          </div>
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.defaultSplitRatio == null ? (
              <Dash />
            ) : (
              asPercent(row.original.defaultSplitRatio)
            )}
          </span>
        ),
      },
      {
        id: 'status',
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
            tone={PAIR_STATUS_TONE[row.original.status] ?? 'muted'}
          >
            {protoStatusLabel(PROTO_PAIR_STATUS, row.original.status)}
          </ProtoStatusBadge>
        ),
      },
      {
        id: 'createdOn',
        header: () => (
          <ProtoSortHeader
            label="Created on (UTC+8)"
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
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const item = row.original;
          // 原型行操作矩阵：15 → Edit（重提）；20 → Edit + Disable；
          // 30/50 → Activate；5 待审无可操作项。
          const menuItems: React.ReactNode[] = [];
          if (item.status === 15 || item.status === 20) {
            menuItems.push(
              <DropdownMenuItem
                key="edit"
                onSelect={() => router.push(pairEditPath(item.pairId))}
              >
                Edit
              </DropdownMenuItem>,
            );
          }
          if (item.status === 20) {
            menuItems.push(
              <DropdownMenuItem
                key="disable"
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmRow({ action: 'disable', row: item })}
              >
                Disable
              </DropdownMenuItem>,
            );
          }
          if (item.status === 30 || item.status === 50) {
            menuItems.push(
              <DropdownMenuItem
                key="activate"
                onSelect={() => setConfirmRow({ action: 'activate', row: item })}
              >
                Activate
              </DropdownMenuItem>,
            );
          }
          return (
            <div className="flex items-center">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => router.push(pairDetailPath(item.pairId))}
              >
                Details
              </Button>
              {menuItems.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Actions for token pair ${item.pairCode}`}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">{menuItems}</DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [toggle, sortState, router],
  );

  const disableTarget =
    confirmRow?.action === 'disable' ? confirmRow.row : null;
  const activateTarget =
    confirmRow?.action === 'activate' ? confirmRow.row : null;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              FX Rate Management
            </div>
            {!isLoading ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {tableData.length} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push(PAIR_CREATE_PATH)}
          >
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            New Pair
          </Button>
        </div>
        <form
          onSubmit={onSearch}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="pair-code-filter"
                className="text-sm font-medium leading-snug text-foreground"
              >
                Pair Code
              </label>
              <Input
                id="pair-code-filter"
                value={input.pairCode}
                onChange={(e) =>
                  setInput((f) => ({ ...f, pairCode: e.target.value }))
                }
                placeholder="Token pair code, e.g. PR-001"
                maxLength={32}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="pair-status-filter"
                className="text-sm font-medium leading-snug text-foreground"
              >
                Status
              </label>
              <Select
                value={input.status}
                onValueChange={(v) => setInput((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger id="pair-status-filter" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All</SelectItem>
                  {PAIR_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </div>
          </div>
        </form>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No token pairs found."
            />
          )}
        </div>
      </section>

      {/* 停用（原型 confirmPairDialog.disable：CirclePause + 双段正文）。 */}
      <ActionConfirmDialog
        open={disableTarget != null}
        onOpenChange={(open) => {
          if (!open) setConfirmRow(null);
        }}
        icon={CirclePause}
        variant="destructive"
        title="Disable Token Pair"
        body1={`Disable token pair "${pairLabel(disableTarget ?? {})}"?`}
        body2="Once disabled, new quotes will be rejected (the backend rejects the request if any active LP participation exists — disable those first)."
        confirmLabel="Disable"
        loading={disableMutation.isPending}
        onConfirm={() => {
          const target = disableTarget;
          if (!target) return;
          disableMutation.mutate(target.pairId, {
            onSuccess: () => {
              toast.success('Disabled');
              setConfirmRow(null);
            },
            onError: (e) => toast.error((e as Error).message),
          });
        }}
      />

      {/* 启用（原型 confirmPairDialog.activate：CircleCheck + 双段正文）。 */}
      <ActionConfirmDialog
        open={activateTarget != null}
        onOpenChange={(open) => {
          if (!open) setConfirmRow(null);
        }}
        icon={CircleCheck}
        variant="confirm"
        title="Activate Token Pair"
        body1={`Activate token pair "${pairLabel(activateTarget ?? {})}"?`}
        body2="Once activated, the token pair is available for new quotes again."
        confirmLabel="Activate"
        loading={enableMutation.isPending}
        onConfirm={() => {
          const target = activateTarget;
          if (!target) return;
          enableMutation.mutate(target.pairId, {
            onSuccess: () => {
              toast.success('Enabled');
              setConfirmRow(null);
            },
            onError: (e) => toast.error((e as Error).message),
          });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TokenPairCreatePage — New Pair（原型 FxPairCreatePage；源 pair-dialog.vue 迁出为页）
// ---------------------------------------------------------------------------

interface ComboRow {
  sourceTokenId: number;
  sourceTokenCode: string;
  sourceSymbol: string;
  sourceBankCode: string;
  targetTokenId: number;
  targetTokenCode: string;
  targetSymbol: string;
  targetBankCode: string;
  /** 该组合是否已存在 token 对（判重键 sourceTokenId->targetTokenId，后端有向）。 */
  exists: boolean;
  /** 每组独立参数（不做组合统一配置；滑点阈值字段不渲染，§G 裁决13）。 */
  baseRate: string;
  markupRate: string;
  defaultSplitRatio: string;
  /**
   * 勾选态挂在行数据上：与表格内置 selection 完全解耦——内置 selection 在
   * 行内输入触发重渲染时会重置，导致「一输入就掉选中」。
   */
  checked: boolean;
}

function comboKey(c: { sourceTokenId: number; targetTokenId: number }): string {
  return `${c.sourceTokenId}->${c.targetTokenId}`;
}

/** 已生效 token 全组合（有向：i≠j 双层循环，A→B 与 B→A 均为候选，后端 save 有向判重）。 */
function buildCombos(
  tokens: TokenRow[],
  existingPairs: TokenPairRow[],
): ComboRow[] {
  const existsSet = new Set(
    existingPairs.map((p) => `${p.sourceTokenId}->${p.targetTokenId}`),
  );
  const list: ComboRow[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let j = 0; j < tokens.length; j++) {
      if (i === j) continue;
      const a = tokens[i];
      const b = tokens[j];
      list.push({
        sourceTokenId: a.tokenId,
        sourceTokenCode: a.tokenCode,
        sourceSymbol: a.symbol || '',
        sourceBankCode: a.bankCode ?? '',
        targetTokenId: b.tokenId,
        targetTokenCode: b.tokenCode,
        targetSymbol: b.symbol || '',
        targetBankCode: b.bankCode ?? '',
        exists: existsSet.has(
          comboKey({ sourceTokenId: a.tokenId, targetTokenId: b.tokenId }),
        ),
        baseRate: '',
        markupRate: '',
        defaultSplitRatio: '',
        checked: false,
      });
    }
  }
  return list;
}

/** 勾选行字段级错误（原型 validateRow：仅勾选行校验，提交尝试后渲染）。 */
function comboFieldErrors(row: ComboRow): {
  baseRate?: string;
  markupRate?: string;
  defaultSplitRatio?: string;
} {
  if (!row.checked) return {};
  return {
    baseRate: baseRateError(row.baseRate),
    markupRate: ratioError(row.markupRate),
    defaultSplitRatio: ratioError(row.defaultSplitRatio),
  };
}

/**
 * New Pair 页（/fx-rate/pair/create）。
 *
 * 按已生效 token（tokenList status=20）预生成有向全组合，排除同 token 与已有
 * token 对；勾选态挂行数据，行内逐对填参；逐行串行 save，失败不中断，汇总提示
 * 后回列表（KPT 审批语义：提交即进入开通审批，通过后才生效）。
 */
export function TokenPairCreatePage() {
  const toast = useToast();
  const router = useRouter();

  // ---- 数据源：已生效 token（建对组合来源）+ 已有对（判重）----
  const tokensQuery = useQuery({
    queryKey: ['project', PROJECT_ID, 'token', 'options', { status: 20 }],
    queryFn: () => tokenList({ status: 20 }),
  });
  const pairsQuery = useTokenPairListQuery(PROJECT_ID, {});

  // ---- 组合状态（含勾选/行内参数，全挂行数据）----
  const [combos, setCombos] = React.useState<ComboRow[]>([]);
  const [comboFilter, setComboFilter] = React.useState('');
  const [hideExisting, setHideExisting] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  // 提交尝试后才渲染行内校验文案（原型 showErrors 同款；输入即重算）。
  const [showErrors, setShowErrors] = React.useState(false);

  const combosInitRef = React.useRef(false);
  React.useEffect(() => {
    if (combosInitRef.current) return;
    if (!tokensQuery.isSuccess || !pairsQuery.isSuccess) return;
    combosInitRef.current = true;
    setCombos(
      buildCombos(tokensQuery.data ?? [], pairsQuery.data ?? []),
    );
  }, [tokensQuery.isSuccess, pairsQuery.isSuccess, tokensQuery.data, pairsQuery.data]);

  /** 已勾选组合 = 行上 checked 标记（派生，不依赖表格 selection）。 */
  const selected = React.useMemo(
    () => combos.filter((c) => c.checked && !c.exists),
    [combos],
  );

  const keyword = comboFilter.trim().toLowerCase();
  const isVisible = React.useCallback(
    (c: ComboRow) => {
      if (hideExisting && c.exists) return false;
      if (!keyword) return true;
      return [
        c.sourceTokenCode,
        c.targetTokenCode,
        c.sourceBankCode,
        c.targetBankCode,
      ].some((v) => (v ?? '').toLowerCase().includes(keyword));
    },
    [hideExisting, keyword],
  );
  const visibleCombos = React.useMemo(
    () => combos.filter(isVisible),
    [combos, isVisible],
  );

  // 表头三态全选仅作用于当前可见且可创建的组合。
  const allChecked =
    visibleCombos.length > 0 && visibleCombos.every((c) => c.checked);
  const someChecked =
    visibleCombos.some((c) => c.checked) && !allChecked;

  const updateCombo = React.useCallback(
    (key: string, patch: Partial<ComboRow>) => {
      setCombos((prev) =>
        prev.map((c) => (comboKey(c) === key ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const toggleAll = React.useCallback(
    (on: boolean) => {
      setCombos((prev) =>
        prev.map((c) =>
          !c.exists && isVisible(c) ? { ...c, checked: on } : c,
        ),
      );
    },
    [isVisible],
  );

  const saveMutation = useSaveTokenPairMutation(PROJECT_ID);

  // STATIC-FILLER(GAP-ADM-07): 后端无批量开通端点，前端逐对串行提交（失败不中断，汇总提示）。
  const onBatchSave = React.useCallback(async () => {
    setSubmitting(true);
    let created = 0;
    const failed: string[] = [];
    try {
      for (const c of selected) {
        try {
          await saveMutation.mutateAsync({
            sourceTokenId: c.sourceTokenId,
            targetTokenId: c.targetTokenId,
            baseRate: c.baseRate,
            markupRate: c.markupRate === '' ? undefined : c.markupRate,
            defaultSplitRatio:
              c.defaultSplitRatio === '' ? undefined : c.defaultSplitRatio,
          });
          created++;
        } catch {
          failed.push(`${c.sourceTokenCode}→${c.targetTokenCode}`);
        }
      }
      if (failed.length) {
        toast.warning(
          `Submitted ${created}, failed ${failed.length}: ${failed.join(', ')} ` +
            '(already exists, in approval, or backend validation failed)',
        );
      } else {
        toast.success(
          `Submitted ${created} opening request(s); pending KPT approval — pairs become effective once approved`,
        );
      }
      router.push(PAIR_LIST_PATH);
    } finally {
      setSubmitting(false);
    }
  }, [router, saveMutation, selected, toast]);

  // 提交：任一勾选行有字段错误 → 渲染行内文案并中止（原型无弹窗确认、无 toast）。
  const onSubmit = React.useCallback(() => {
    setShowErrors(true);
    const invalid = selected.some(
      (c) => Object.values(comboFieldErrors(c)).some(Boolean),
    );
    if (invalid) return;
    void onBatchSave();
  }, [onBatchSave, selected]);

  const comboLoading = !tokensQuery.isSuccess || !pairsQuery.isSuccess;
  const comboLoadError = tokensQuery.isError || pairsQuery.isError;

  return (
    <div className="space-y-4">
      <PairSubpageHeader title="New Pair" />

      <Alert>
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <AlertDescription>
          Select pairs generated from available tokens and configure parameters.
          Approved pairs take effect after LP liquidity is provided.
        </AlertDescription>
      </Alert>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-wrap items-center gap-4 border-b border-border/50 px-4 py-3">
          <Input
            value={comboFilter}
            onChange={(e) => setComboFilter(e.target.value)}
            placeholder="Search by token code or bank"
            aria-label="Search token combinations"
            className="w-[240px]"
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={hideExisting}
              onCheckedChange={(v) => setHideExisting(v === true)}
            />
            Hide existing pairs
          </label>
          <span className="ml-auto text-sm text-muted-foreground">
            {visibleCombos.length} available ·{' '}
            <span className="font-medium text-foreground">
              {selected.length} selected
            </span>
          </span>
        </div>

        {comboLoadError ? (
          <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 m-4 text-sm text-destructive">
            <span>Failed to load active tokens or existing pairs.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                tokensQuery.refetch();
                pairsQuery.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : comboLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-12 px-3 py-2">
                    <Checkbox
                      checked={
                        allChecked
                          ? true
                          : someChecked
                            ? 'indeterminate'
                            : false
                      }
                      disabled={!visibleCombos.length}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label="Select all visible combinations"
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Token Pair</th>
                  <th className="px-3 py-2 font-medium">
                    Base Rate <span className="text-destructive">*</span>
                  </th>
                  <th className="px-3 py-2 font-medium">Markup Rate</th>
                  <th className="px-3 py-2 font-medium">
                    Standard Rev. Share
                  </th>
                  <th className="w-28 px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {visibleCombos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <p className="text-sm font-medium text-foreground">
                        No token pairs available.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try adjusting the search or clearing Hide existing
                        pairs.
                      </p>
                    </td>
                  </tr>
                )}
                {visibleCombos.map((c) => {
                  const key = comboKey(c);
                  const errors = showErrors ? comboFieldErrors(c) : {};
                  const invalid = Object.values(errors).some(Boolean);
                  return (
                    <tr
                      key={key}
                      className={invalid ? 'bg-destructive/5' : undefined}
                    >
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={c.checked}
                          disabled={c.exists}
                          onCheckedChange={(v) =>
                            updateCombo(key, { checked: v === true })
                          }
                          aria-label={`Select ${c.sourceTokenCode}-${c.targetTokenCode}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <TokenPairCell
                          sourceSymbol={c.sourceSymbol}
                          sourceTokenCode={c.sourceTokenCode}
                          targetSymbol={c.targetSymbol}
                          targetTokenCode={c.targetTokenCode}
                          sourceBankCode={c.sourceBankCode}
                          targetBankCode={c.targetBankCode}
                        />
                      </td>
                      {/* 输入框常驻可编辑（原型：未勾选也可预填参数）；错误仅提交尝试后渲染。 */}
                      <td className="px-3 py-2">
                        <Input
                          value={c.baseRate}
                          onChange={(e) =>
                            updateCombo(key, { baseRate: e.target.value })
                          }
                          placeholder="Required, greater than 0"
                          maxLength={14}
                          inputMode="decimal"
                          aria-invalid={!!errors.baseRate}
                          className={`h-8 w-[130px]${
                            errors.baseRate
                              ? ' border-destructive focus-visible:ring-destructive'
                              : ''
                          }`}
                        />
                        {errors.baseRate ? (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.baseRate}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={c.markupRate}
                          onChange={(e) =>
                            updateCombo(key, { markupRate: e.target.value })
                          }
                          placeholder="e.g. 0.01 (1%)"
                          maxLength={10}
                          inputMode="decimal"
                          aria-invalid={!!errors.markupRate}
                          className={`h-8 w-[120px]${
                            errors.markupRate
                              ? ' border-destructive focus-visible:ring-destructive'
                              : ''
                          }`}
                        />
                        {errors.markupRate ? (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.markupRate}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={c.defaultSplitRatio}
                          onChange={(e) =>
                            updateCombo(key, {
                              defaultSplitRatio: e.target.value,
                            })
                          }
                          placeholder="0–1, e.g. 0.5"
                          maxLength={8}
                          inputMode="decimal"
                          aria-invalid={!!errors.defaultSplitRatio}
                          className={`h-8 w-[120px]${
                            errors.defaultSplitRatio
                              ? ' border-destructive focus-visible:ring-destructive'
                              : ''
                          }`}
                        />
                        {errors.defaultSplitRatio ? (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.defaultSplitRatio}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {c.exists ? (
                          <Badge variant="outline">Exists</Badge>
                        ) : (
                          <Badge variant="default">Ready to Submit</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selected.length === 0
              ? 'Select at least one token pair to submit.'
              : `${selected.length} token pair${selected.length === 1 ? '' : 's'} will enter the opening approval.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(PAIR_LIST_PATH)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selected.length || submitting}
              onClick={onSubmit}
            >
              {submitting
                ? 'Submitting…'
                : `Submit Opening Requests (${selected.length})`}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** 操作记录列（原型 OperationRecordsTable 5 列；数据源见 GAP-ADM-02）。 */
const operationsColumns: ColumnDef<{ id: string } & Record<string, string>>[] = [
  {
    id: 'timestamp',
    header: 'Timestamp (UTC+8)',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.timestamp}</span>
    ),
  },
  { id: 'operator', header: 'Operator', cell: ({ row }) => row.original.operator },
  { id: 'module', header: 'Module', cell: ({ row }) => row.original.module },
  { id: 'status', header: 'Status', cell: ({ row }) => row.original.status },
  {
    id: 'traceId',
    header: 'Trace ID',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.traceId}</span>,
  },
];
// ---------------------------------------------------------------------------
// TokenPairDetailPage — Token Pair Details（原型 FxPairDetailsPage）
// ---------------------------------------------------------------------------

const PAIR_TABS = [
  { key: 'basic', label: 'Basic Info' },
  { key: 'participation', label: 'LP Participation' },
  { key: 'operations', label: 'Operation Records' },
] as const;

type PairTab = (typeof PAIR_TABS)[number]['key'];

/**
 * LP 参与列表列（原型 participation 同名列；Client Rate = base/(1+markup)，
 * LP Rev. Share 优先覆盖值 splitRatio，未覆盖回退 defaultSplitRatio）。
 */
const participationColumns: ColumnDef<Omit<LpPairRow, 'id'> & { id: string }>[] = [
  {
    id: 'lpName',
    header: 'LP Name',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.lpName || '-'}</span>
    ),
  },
  {
    id: 'baseRate',
    header: 'Base Rate',
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {row.original.baseRate == null ? <Dash /> : formatRate(row.original.baseRate)}
      </span>
    ),
  },
  {
    id: 'markupRate',
    header: 'Markup Rate',
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">
        {row.original.markupRate == null ? (
          <Dash />
        ) : (
          asPercent(row.original.markupRate)
        )}
      </span>
    ),
  },
  {
    id: 'clientRate',
    header: 'Client Rate',
    cell: ({ row }) => {
      const v = clientRateOf(row.original.baseRate, row.original.markupRate);
      return (
        <span className="block text-right tabular-nums">
          {v == null ? <Dash /> : formatRate(v)}
        </span>
      );
    },
  },
  {
    id: 'lpRevShare',
    header: 'LP Rev. Share',
    cell: ({ row }) => {
      const override = Number(row.original.splitRatio);
      const ratio =
        row.original.splitRatio != null &&
        !Number.isNaN(override) &&
        override > 0
          ? override
          : row.original.defaultSplitRatio;
      return (
        <span className="block text-right tabular-nums">
          {ratio == null ? <Dash /> : asPercent(ratio)}
        </span>
      );
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <ProtoStatusBadge
        tone={LP_PAIR_STATUS_TONE[row.original.status] ?? 'muted'}
      >
        {protoStatusLabel(PROTO_LP_PAIR_STATUS, row.original.status)}
      </ProtoStatusBadge>
    ),
  },
  {
    id: 'createdOn',
    header: 'Created on (UTC+8)',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatUtc8(row.original.createTime)}
      </span>
    ),
  },
];

/**
 * Token Pair 详情（/fx-rate/pair/detail?id=）。
 *
 * Tab：basic（默认，不写 ?tab=）/ participation（LP 参与）/ operations（操作记录）。
 * STATIC-FILLER(GAP-ADM-05): 后端无单条 token-pair 详情端点，以列表行数据渲染。
 */
export function TokenPairDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pairId = Number(searchParams.get('id'));
  const validId = Number.isInteger(pairId) && pairId > 0 ? pairId : null;

  const { data: pairRows, isLoading, isError } =
    useTokenPairListQuery(PROJECT_ID, {});

  // STATIC-FILLER(GAP-ADM-05): 无单条详情端点，从列表行定位（见文件头注释）。
  const record = React.useMemo(
    () =>
      validId == null
        ? undefined
        : (pairRows ?? []).find((p) => p.pairId === validId),
    [pairRows, validId],
  );

  const tabParam = searchParams.get('tab');
  const activeTab: PairTab = PAIR_TABS.some((t) => t.key === tabParam)
    ? (tabParam as PairTab)
    : 'basic';

  const lpQuery = useLpPairListQuery(
    PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: { pairId: validId ?? 0 } },
    activeTab === 'participation' && record != null,
  );
  const lpRows = lpQuery.data?.data ?? [];
  const lpTotal = lpQuery.data?.pagination?.total ?? 0;

  const tabCounts: Record<PairTab, number> = {
    basic: 0,
    participation: lpTotal,
    operations: 0,
  };

  // Tab 切换写 ?tab=（默认 basic 不带参数；replace 不新增历史）。
  const onTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'basic') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `${PAIR_LIST_PATH}/detail?${qs}` : `${PAIR_LIST_PATH}/detail`);
  };

  const statusLabel = record
    ? protoStatusLabel(PROTO_PAIR_STATUS, record.status)
    : '';
  const clientRate =
    record == null ? null : clientRateOf(record.baseRate, record.markupRate);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Failed to load token pair.</AlertTitle>
      </Alert>
    );
  }

  if (!record) {
    return <PairNotFoundCard />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to FX Rate Management"
            onClick={() => router.push(PAIR_LIST_PATH)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            Token Pair Details
          </h1>
          <ProtoStatusBadge tone={PAIR_STATUS_TONE[record.status] ?? 'muted'}>
            {statusLabel}
          </ProtoStatusBadge>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:justify-end">
          <span>Pair Code:</span>
          <CopyableId value={record.pairCode} />
          <span aria-hidden="true">|</span>
          <span>Created on {formatUtc8(record.createTime)}</span>
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList>
          {PAIR_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              {tabCounts[t.key] > 0 ? (
                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                  {tabCounts[t.key]}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="basic" className="mt-0">
          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 md:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Token Pair">
                <span className="font-mono text-[13px] font-semibold">
                  {pairLabel(record)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {record.sourceBankName || record.sourceBankCode || '-'} →{' '}
                  {record.targetBankName || record.targetBankCode || '-'}
                </span>
              </DetailField>
              <DetailField label="Source Bank">
                {record.sourceBankName || record.sourceBankCode || <Dash />}
              </DetailField>
              <DetailField label="Target Bank">
                {record.targetBankName || record.targetBankCode || <Dash />}
              </DetailField>
              <DetailField label="Base Rate">
                <span className="font-mono tabular-nums">
                  {formatRate(record.baseRate)}
                </span>
              </DetailField>
              <DetailField label="Markup Rate">
                <span className="font-mono tabular-nums">
                  {record.markupRate == null ? <Dash /> : asPercent(record.markupRate)}
                </span>
              </DetailField>
              <DetailField label="Client Rate">
                <span className="font-mono tabular-nums">
                  {clientRate == null ? <Dash /> : formatRate(clientRate, 8)}
                </span>
              </DetailField>
              <DetailField label="Standard Rev. Share">
                <span className="font-mono tabular-nums">
                  {record.defaultSplitRatio == null ? (
                    <Dash />
                  ) : (
                    asPercent(record.defaultSplitRatio)
                  )}
                </span>
              </DetailField>
              <DetailField label="Created on (UTC+8)">
                <span className="tabular-nums">
                  {formatUtc8(record.createTime)}
                </span>
              </DetailField>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="participation" className="mt-0">
          <section className="rounded-lg border border-border/60 bg-card p-4">
            <DataTable
              columns={participationColumns}
              data={lpRows.map((r) => ({ ...r, id: String(r.id) }))}
              isLoading={lpQuery.isLoading}
              emptyMessage="No LP participation for this token pair."
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Participations are created when an LP adds this token pair.
            </p>
          </section>
        </TabsContent>

        <TabsContent value="operations" className="mt-0">
          {/* STATIC-FILLER(GAP-ADM-02): 后端无逐对象操作历史端点，操作记录暂空。 */}
          <section className="rounded-lg border border-border/60 bg-card p-4">
            <DataTable
              columns={operationsColumns}
              data={[] as ({ id: string } & Record<string, string>)[]}
              isLoading={false}
              emptyMessage="No operations recorded yet."
            />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TokenPairEditPage — Update Token Pair Parameters（原型 FxPairEditPage）
// ---------------------------------------------------------------------------

interface PairEditFormState {
  baseRate: string;
  markupRate: string;
  defaultSplitRatio: string;
}

/** 参数区表单（行确定后挂载，useState 可安全以行值初始化）。 */
function PairEditForm({ row }: { row: TokenPairRow }) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = React.useState<PairEditFormState>({
    baseRate: row.baseRate == null ? '' : String(row.baseRate),
    markupRate: row.markupRate == null ? '' : String(row.markupRate),
    defaultSplitRatio:
      row.defaultSplitRatio == null ? '' : String(row.defaultSplitRatio),
  });
  // 错误按字段下沉；改哪个字段清哪个（blur/提交时计算，输入即清）。
  const [errors, setErrors] = React.useState<{
    baseRate?: string;
    markupRate?: string;
    defaultSplitRatio?: string;
  }>({});

  const saveMutation = useSaveTokenPairMutation(PROJECT_ID);
  const changeMutation = useChangeTokenPairMutation(PROJECT_ID);
  const mutating = saveMutation.isPending || changeMutation.isPending;

  const clientRate = clientRateOf(form.baseRate, form.markupRate);
  // 已驳回（15）= KPT 重提：SaveReq 无 pairId，按 source+target 组合识别；
  // 其余可编辑状态 = KRC 参数变更（现值生效至审批通过）。
  const isResubmit = row.status === 15;
  const pending = row.pendingChange || row.status === 5;

  const onSubmit = React.useCallback(() => {
    const nextErrors = {
      baseRate: baseRateError(form.baseRate),
      markupRate: ratioError(form.markupRate),
      defaultSplitRatio: ratioError(form.defaultSplitRatio),
    };
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    const payload = {
      baseRate: form.baseRate,
      markupRate: form.markupRate === '' ? undefined : form.markupRate,
      defaultSplitRatio:
        form.defaultSplitRatio === '' ? undefined : form.defaultSplitRatio,
    };
    if (isResubmit) {
      saveMutation.mutate(
        {
          sourceTokenId: row.sourceTokenId,
          targetTokenId: row.targetTokenId,
          ...payload,
        },
        {
          onSuccess: () => {
            toast.success(
              'Opening request resubmitted (KPT approval); effective once approved',
            );
            router.push(PAIR_LIST_PATH);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    } else {
      changeMutation.mutate(
        { pairId: row.pairId, ...payload },
        {
          onSuccess: () => {
            toast.success(
              'Change request submitted (KRC approval); current values stay effective until approved',
            );
            router.push(PAIR_LIST_PATH);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    }
  }, [
    changeMutation,
    form,
    isResubmit,
    router,
    row,
    saveMutation,
    toast,
  ]);

  return (
    <>
      <Alert>
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <AlertDescription>
          Updates require approval. Current values remain effective until
          approval. New changes cannot be submitted while a request is pending.
        </AlertDescription>
      </Alert>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base font-semibold leading-6 text-foreground">
              {pairLabel(row)}
            </span>
            <ProtoStatusBadge tone={PAIR_STATUS_TONE[row.status] ?? 'muted'}>
              {protoStatusLabel(PROTO_PAIR_STATUS, row.status)}
            </ProtoStatusBadge>
            <span className="text-sm text-muted-foreground">
              {row.sourceBankName || row.sourceBankCode || '-'} →{' '}
              {row.targetBankName || row.targetBankCode || '-'}
            </span>
          </div>
          <CopyableId value={row.pairCode} />
        </div>

        <div className="p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
              <SlidersHorizontal
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Parameters</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Submitted values enter the approval workflow; the current
                values stay effective until the request is approved.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <FormField
              name="baseRate"
              label="Base Rate"
              required
              value={form.baseRate}
              onChange={(e) => {
                setForm((f) => ({ ...f, baseRate: e.target.value }));
                setErrors((prev) => ({ ...prev, baseRate: undefined }));
              }}
              error={errors.baseRate}
              placeholder="1.0000"
              maxLength={14}
              inputMode="decimal"
            />
            <FormField
              name="markupRate"
              label="Markup Rate (%)"
              value={form.markupRate}
              onChange={(e) => {
                setForm((f) => ({ ...f, markupRate: e.target.value }));
                setErrors((prev) => ({ ...prev, markupRate: undefined }));
              }}
              error={errors.markupRate}
              placeholder="1.00"
              maxLength={10}
              inputMode="decimal"
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium leading-snug text-foreground">
                Client Rate
              </label>
              <Input
                value={clientRate == null ? '' : clientRate.toFixed(8)}
                disabled
                readOnly
                aria-readonly="true"
              />
              <p className="text-xs text-muted-foreground">
                Calculated as Base Rate ÷ (1 + Markup Rate).
              </p>
            </div>
            <FormField
              name="defaultSplitRatio"
              label="Standard Rev. Share (%)"
              value={form.defaultSplitRatio}
              onChange={(e) => {
                setForm((f) => ({
                  ...f,
                  defaultSplitRatio: e.target.value,
                }));
                setErrors((prev) => ({
                  ...prev,
                  defaultSplitRatio: undefined,
                }));
              }}
              error={errors.defaultSplitRatio}
              placeholder="50.00"
              maxLength={8}
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-muted-foreground">
            {pending
              ? 'A request is pending for this token pair; new changes cannot be submitted until it is approved.'
              : `Submitted by approval workflow — current status: ${protoStatusLabel(
                  PROTO_PAIR_STATUS,
                  row.status,
                )}.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(PAIR_LIST_PATH)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || mutating}
              onClick={onSubmit}
            >
              {mutating ? 'Submitting…' : 'Submit for Approval'}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Update Token Pair Parameters（/fx-rate/pair/edit?id=）。
 * STATIC-FILLER(GAP-ADM-05): 无单条详情端点，以列表行数据回填表单。
 */
export function TokenPairEditPage() {
  const searchParams = useSearchParams();

  const pairId = Number(searchParams.get('id'));
  const validId = Number.isInteger(pairId) && pairId > 0 ? pairId : null;

  const { data: pairRows, isLoading, isError } =
    useTokenPairListQuery(PROJECT_ID, {});

  // STATIC-FILLER(GAP-ADM-05): 无单条详情端点，从列表行定位（见文件头注释）。
  const record = React.useMemo(
    () =>
      validId == null
        ? undefined
        : (pairRows ?? []).find((p) => p.pairId === validId),
    [pairRows, validId],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Failed to load token pair.</AlertTitle>
      </Alert>
    );
  }

  if (!record) {
    return <PairNotFoundCard />;
  }

  return (
    <div className="space-y-4">
      <PairSubpageHeader title="Update Token Pair Parameters" />
      <PairEditForm row={record} />
    </div>
  );
}
