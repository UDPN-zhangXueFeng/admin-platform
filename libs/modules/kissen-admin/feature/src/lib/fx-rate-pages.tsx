'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Controller, useForm } from 'react-hook-form';
import { Info } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  AlertTitle,
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
  CopyableEllipsisText,
  Checkbox,
  createActionColumn,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
  type TableRowAction,
} from '@myorg/shared/ui';

import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { FormField } from '@myorg/shared/ui-forms';

import {
  KISSEN_PROJECT_ID,
  PAIR_STATUS_LABEL,
  PAIR_STATUS_VARIANT,
  tokenList,
  useChangeTokenPairMutation,
  useDisableTokenPairMutation,
  useEnableTokenPairMutation,
  useSaveTokenPairMutation,
  useTokenPairListQuery,
  type TokenPairListFilter,
  type TokenPairRow,
  type TokenRow,
} from '@myorg/modules/kissen-admin/data-access';

const PROJECT_ID = KISSEN_PROJECT_ID;

// ---------------------------------------------------------------------------
// 共享展示工具
// ---------------------------------------------------------------------------

/** 毫秒时间戳 → 统一管理台时间格式；0/空/非法 → '--'（conventions §4）。 */
function formatTime(ms: number | null | undefined): string {
  if (!ms) return '--';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '--' : formatAdminDateTime(d);
}

/** 比率 → 百分比展示（源 fmtPercent：空/非数字 → '-'，其余 (v*100).toFixed(2)+'%'）。 */
function formatPercent(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : `${(n * 100).toFixed(2)}%`;
}

/** 用户汇率 = 基础汇率 ÷ (1 + 加价率)（源 userRate；markup null/NaN 按 0，base 空整格 '-'）。 */
function userRate(row: {
  baseRate?: string | number | null;
  markupRate?: string | number | null;
}): string {
  const base = row.baseRate == null ? Number.NaN : Number(row.baseRate);
  const markup =
    row.markupRate == null ? 0 : Number(row.markupRate) || 0;
  if (Number.isNaN(base)) return '-';
  return (base / (1 + markup)).toFixed(4);
}

/** Token 对状态徽章（co-locate 展示组件，conventions §5）。 */
function PairStatusBadge({ status }: { status: number }) {
  return (
    <Badge variant={PAIR_STATUS_VARIANT[status] ?? 'outline'}>
      {PAIR_STATUS_LABEL[status] ?? String(status)}
    </Badge>
  );
}

/** 只读详情字段：label + 值（照 user-detail DetailField 模式）。 */
function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

/** Token 对紧凑式单元格：SRC/TGT 主行 + 银行副行 + pairCode 等宽副行（源 pairx，symbol 优先）。 */
function TokenPairCell({
  sourceSymbol,
  sourceTokenCode,
  targetSymbol,
  targetTokenCode,
  sourceBankCode,
  targetBankCode,
  pairCode,
}: {
  sourceSymbol: string;
  sourceTokenCode: string;
  targetSymbol: string;
  targetTokenCode: string;
  sourceBankCode: string;
  targetBankCode: string;
  pairCode?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col leading-snug">
      <span className="font-mono text-[13px] font-semibold tabular-nums">
        {sourceSymbol || sourceTokenCode || '-'}/
        {targetSymbol || targetTokenCode || '-'}
      </span>
      <span className="text-xs text-muted-foreground">
        {sourceBankCode || '-'} → {targetBankCode || '-'}
      </span>
      {pairCode !== undefined && (
        <span className="font-mono text-[11px] text-muted-foreground">
          {pairCode || '-'}
        </span>
      )}
    </div>
  );
}

/**
 * 通用确认流：受控 AlertDialog（禁 window.confirm，锁定约束 2）。
 * request 非空即打开；onConfirm 后由调用方负责清空 request。
 */
interface ConfirmRequest {
  title: string;
  message: string;
  confirmText?: string;
  destructive?: boolean;
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
    <AlertDialog open={request != null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              request?.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
            onClick={request?.onConfirm}
          >
            {request?.confirmText ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// TokenPairListPage — Token 对管理（源 fx-rate/pair/index.vue v2.0-tokenization）
// ---------------------------------------------------------------------------

interface PairFilterForm {
  pairCode?: string;
  status?: number;
}

const PAIR_EMPTY_FILTER: PairFilterForm = { pairCode: '', status: undefined };

/** 状态筛选 Select 的「全部」哨兵值（shadcn Select 无原生 clearable）。 */
const STATUS_ALL = 'ALL';

/**
 * Token 对管理列表页（registry key `pair` → TokenPairListPage）。
 *
 * 迁移自源 `views/fx-rate/pair/index.vue`（2023418）：
 * - 筛选：pairCode（Input 模糊，回车触发查询）/ 状态（5 Pending Approval/
 *   15 Rejected/20 Enabled/30 Frozen/50 Disabled，无 10——源同款）。
 * - 列：Token Pair 紧凑式（symbol 优先 + 银行副行 + pairCode）/ Base Rate / Markup Rate
 *   / User Rate（=base/(1+markup)，GW 口径）/ Default Split / Status / Created At。
 * - 行操作（2023418 审批口径）：View；status=20 → Change（pendingChange 时禁用，
 *   KRC 审批）+ Disable；status=15 → Resubmit（KPT 重提）；status=50 → Enable。
 *   Edit 与 Adjust Default Split 退役。
 * - 启停即时生效不走审批；确认流 AlertDialog，提示 sonner。
 * - 滑点阈值列/输入不迁移（源 2026-08-27 已移除，01 文档 §G 裁决13）。
 */
export function TokenPairListPage() {
  const toast = useToast();

  const { register, handleSubmit, reset, control } = useForm<PairFilterForm>({
    defaultValues: PAIR_EMPTY_FILTER,
  });

  const [filter, setFilter] = React.useState<TokenPairListFilter>({});

  const { data: rows, isLoading, isError, dataUpdatedAt } = useTokenPairListQuery(PROJECT_ID, filter);
  const enableMutation = useEnableTokenPairMutation(PROJECT_ID);
  const disableMutation = useDisableTokenPairMutation(PROJECT_ID);

  // 页内弹窗（create/view）+ 确认流 + 变更/重提弹窗（KRC/KPT）。
  const [dialog, setDialog] = React.useState<{
    mode: 'create' | 'view';
    row: TokenPairRow | null;
  } | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [change, setChange] = React.useState<{
    mode: 'change' | 'resubmit';
    row: TokenPairRow;
  } | null>(null);

  const onSubmit = React.useCallback((form: PairFilterForm) => {
    setFilter({ pairCode: form.pairCode || undefined, status: form.status });
  }, []);

  const onReset = React.useCallback(() => {
    reset(PAIR_EMPTY_FILTER);
    setFilter({});
  }, [reset]);

  const onDisable = React.useCallback(
    (row: TokenPairRow) => {
      setConfirm({
        title: 'Disable Token Pair',
        message:
          `Disable token pair "${row.pairCode}"? New quotes will be rejected once disabled ` +
          '(the backend rejects the request if any active LP participation exists — disable those first).',
        confirmText: 'Disable',
        destructive: true,
        onConfirm: () => {
          setConfirm(null);
          disableMutation.mutate(row.pairId, {
            onSuccess: () => toast.success('Disabled'),
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [disableMutation, toast],
  );

  const onEnable = React.useCallback(
    (row: TokenPairRow) => {
      setConfirm({
        title: 'Enable Token Pair',
        message: `Enable token pair "${row.pairCode}"?`,
        confirmText: 'Enable',
        onConfirm: () => {
          setConfirm(null);
          enableMutation.mutate(row.pairId, {
            onSuccess: () => toast.success('Enabled'),
            onError: (e) => toast.error((e as Error).message),
          });
        },
      });
    },
    [enableMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<TokenPairRow & { id: string }>[]
  >(
    () => [
      {
        id: 'pair',
        header: 'Token Pair',
        cell: ({ row }) => (
          <TokenPairCell
            sourceSymbol={row.original.sourceSymbol}
            sourceTokenCode={row.original.sourceTokenCode}
            targetSymbol={row.original.targetSymbol}
            targetTokenCode={row.original.targetTokenCode}
            sourceBankCode={row.original.sourceBankCode}
            targetBankCode={row.original.targetBankCode}
            pairCode={row.original.pairCode}
          />
        ),
      },
      {
        accessorKey: 'baseRate',
        header: 'Base Rate',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.baseRate == null
              ? '-'
              : Number(row.original.baseRate).toFixed(4)}
          </span>
        ),
      },
      {
        accessorKey: 'markupRate',
        header: 'Markup Rate',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatPercent(row.original.markupRate)}
          </span>
        ),
      },
      {
        id: 'userRate',
        header: 'User Rate',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {userRate(row.original)}
          </span>
        ),
      },
      {
        accessorKey: 'defaultSplitRatio',
        header: 'Default Split',
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatPercent(row.original.defaultSplitRatio)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <PairStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: 'Created At',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatTime(row.original.createTime)}</span>
        ),
      },
      createActionColumn<TokenPairRow & { id: string }>((item) => {
        const actions: TableRowAction<TokenPairRow & { id: string }>[] = [
          {
            label: 'View',
            onClick: () => setDialog({ mode: 'view', row: item }),
          },
        ];
        // 2023418 审批口径：生效对改参合并为 Change（KRC）；已驳回重提走 Resubmit（KPT）。
        if (item.status === 20) {
          actions.push({
            label: item.pendingChange ? 'Change In Approval' : 'Change',
            disabled: !!item.pendingChange,
            onClick: () => setChange({ mode: 'change', row: item }),
          });
          actions.push({ label: 'Disable', destructive: true, onClick: () => onDisable(item) });
        }
        if (item.status === 15) {
          actions.push({
            label: 'Resubmit',
            onClick: () => setChange({ mode: 'resubmit', row: item }),
          });
        }
        if (item.status === 50) {
          actions.push({ label: 'Enable', onClick: () => onEnable(item) });
        }
        return actions;
      }),
    ],
    [onDisable, onEnable],
  );

  const tableData = React.useMemo(
    () => (rows ?? []).map((r) => ({ ...r, id: String(r.pairId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Token Pairs
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
            onClick={() => setDialog({ mode: 'create', row: null })}
          >
            New Token Pair
          </Button>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              name="pairCode"
              label="Pair Code"
              placeholder="Fuzzy match, e.g. PR-"
              register={register('pairCode')}
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium leading-snug text-foreground">
                Status
              </label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value != null ? String(field.value) : STATUS_ALL}
                    onValueChange={(v) =>
                      field.onChange(v === STATUS_ALL ? undefined : Number(v))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STATUS_ALL}>All</SelectItem>
                      <SelectItem value="5">Pending Approval</SelectItem>
                      <SelectItem value="15">Rejected</SelectItem>
                      <SelectItem value="20">Enabled</SelectItem>
                      <SelectItem value="30">Frozen</SelectItem>
                      <SelectItem value="50">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
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
              emptyMessage="No token pairs configured yet"
            />
          )}
        </div>
      </section>

      {dialog && (
        <TokenPairDialog
          mode={dialog.mode}
          row={dialog.row}
          onClosed={() => setDialog(null)}
        />
      )}

      {change && (
        <PairChangeDialog
          mode={change.mode}
          row={change.row}
          onClosed={() => setChange(null)}
        />
      )}

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TokenPairDialog — 建对/查看（源 fx-rate/pair/pair-dialog.vue；2023418 起 edit 退役）
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
  /** 每组独立参数（源 2026-08-27 反馈：不做组合统一配置；滑点阈值输入已移除）。 */
  baseRate: string;
  markupRate: string;
  defaultSplitRatio: string;
  /**
   * 勾选态挂在行数据上（源 1841ba1）：与表格内置 selection 完全解耦——
   * 内置 selection 在行内输入触发重渲染时会重置，导致「一输入就掉选中」。
   */
  checked: boolean;
}

function comboKey(c: { sourceTokenId: number; targetTokenId: number }): string {
  return `${c.sourceTokenId}->${c.targetTokenId}`;
}

/**
 * 已生效 token 全组合（有向：i≠j 双层循环，A→B 与 B→A 均为候选，后端 save 有向判重）。
 */
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
      const a = tokens[i]!;
      const b = tokens[j]!;
      list.push({
        sourceTokenId: a.tokenId,
        sourceTokenCode: a.tokenCode,
        sourceSymbol: a.symbol || '',
        sourceBankCode: a.bankCode ?? '',
        targetTokenId: b.tokenId,
        targetTokenCode: b.tokenCode,
        targetSymbol: b.symbol || '',
        targetBankCode: b.bankCode ?? '',
        exists: existsSet.has(comboKey({ sourceTokenId: a.tokenId, targetTokenId: b.tokenId })),
        baseRate: '',
        markupRate: '',
        defaultSplitRatio: '',
        checked: false,
      });
    }
  }
  return list;
}

/** 行内校验（源 rowInvalid）：基础汇率必填>0；加价率填了须数字；默认分成 0~1。未勾选行不校验。 */
function comboInvalidReason(row: ComboRow): string | null {
  if (!row.checked) return null;
  const base = Number(row.baseRate);
  if (row.baseRate === '' || Number.isNaN(base) || base <= 0) {
    return 'Base rate is required and must be greater than 0';
  }
  if (row.markupRate !== '' && Number.isNaN(Number(row.markupRate))) {
    return 'Markup rate must be numeric';
  }
  if (row.defaultSplitRatio !== '') {
    const r = Number(row.defaultSplitRatio);
    if (Number.isNaN(r) || r < 0 || r > 1) {
      return 'Default split must be between 0 and 1';
    }
  }
  return null;
}

/**
 * 建对/查看两态弹窗（源 pair-dialog.vue；原 /currency-pair/create|edit|detail
 * 三路由页收编于此。2023418：edit 退役——SaveReq 无 pairId，生效对改参走
 * PairChangeDialog（KRC）；create 语义=批量提交开通申请（KPT），通过后生效）。
 *
 * - create：按已生效 token（tokenList status=20）预生成有向全组合，排除同 token 与
 *   已有 token 对；勾选态挂行数据，行内逐对填参；逐行串行 save，失败不中断，汇总提示。
 * - view：单对只读详情（§6.3 分层），直读 row。滑点阈值字段不渲染（§G 裁决13）。
 */
function TokenPairDialog({
  mode,
  row,
  onClosed,
}: {
  mode: 'create' | 'view';
  row: TokenPairRow | null;
  onClosed: () => void;
}) {
  const toast = useToast();
  const isCreate = mode === 'create';
  const isView = mode === 'view';

  // ---- 数据源：已生效 token（建对组合来源 + 单对表单下拉）+ 已有对（判重）----
  const tokensQuery = useQuery({
    queryKey: ['project', PROJECT_ID, 'token', 'options', { status: 20 }],
    queryFn: () => tokenList({ status: 20 }),
  });
  const pairsQuery = useTokenPairListQuery(
    PROJECT_ID,
    {},
    isCreate,
  );

  // ---- create：组合状态（含勾选/行内参数，全挂行数据）----
  const [combos, setCombos] = React.useState<ComboRow[]>([]);
  const [comboFilter, setComboFilter] = React.useState('');
  const [hideExisting, setHideExisting] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmBatch, setConfirmBatch] = React.useState(false);

  const combosInitRef = React.useRef(false);
  React.useEffect(() => {
    if (!isCreate || combosInitRef.current) return;
    if (!tokensQuery.isSuccess || !pairsQuery.isSuccess) return;
    combosInitRef.current = true;
    setCombos(
      buildCombos(tokensQuery.data ?? [], pairsQuery.data ?? []),
    );
  }, [isCreate, tokensQuery.isSuccess, pairsQuery.isSuccess, tokensQuery.data, pairsQuery.data]);

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
      return [c.sourceTokenCode, c.targetTokenCode, c.sourceBankCode, c.targetBankCode].some(
        (v) => (v ?? '').toLowerCase().includes(keyword),
      );
    },
    [hideExisting, keyword],
  );
  const visibleCombos = React.useMemo(
    () => combos.filter(isVisible),
    [combos, isVisible],
  );

  // 表头三态全选仅作用于当前可见且可创建的组合（源 toggleAll 语义）。
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
  const tokenOptions = tokensQuery.data ?? [];

  // 批量提交开通申请：逐行取各自参数串行 save（后端单条幂等防重），失败汇总不中断（源 onBatchSave，KPT 审批语义）。
  const onBatchSave = React.useCallback(async () => {
    setConfirmBatch(false);
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
      onClosed();
    } finally {
      setSubmitting(false);
    }
  }, [onClosed, saveMutation, selected, toast]);

  // 批量提交前逐对校验：任一勾选行不合法即中止并列出前 3 条原因（源同款）。
  const requestBatchSave = React.useCallback(() => {
    const invalids = selected
      .map((r) => ({ row: r, reason: comboInvalidReason(r) }))
      .filter((x): x is { row: ComboRow; reason: string } => !!x.reason);
    if (invalids.length) {
      const reasons = invalids
        .slice(0, 3)
        .map((x) => `${x.row.sourceTokenCode}→${x.row.targetTokenCode} (${x.reason})`)
        .join('; ');
      toast.error(
        `${invalids.length} combination(s) failed validation (highlighted rows): ${reasons}` +
          (invalids.length > 3 ? `; and ${invalids.length - 3} more` : ''),
      );
      return;
    }
    setConfirmBatch(true);
  }, [selected, toast]);


  const comboLoading = isCreate && (!tokensQuery.isSuccess || !pairsQuery.isSuccess);
  const comboLoadError = isCreate && (tokensQuery.isError || pairsQuery.isError);

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClosed()}>
        <DialogContent
          className={isCreate ? 'sm:max-w-[1080px]' : 'sm:max-w-[560px]'}
        >
          <DialogHeader>
            <DialogTitle>
              {isView ? 'Token Pair Details' : 'New Token Pair'}
            </DialogTitle>
          </DialogHeader>

          {isCreate ? (
            <div className="space-y-3">
              <Alert>
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <AlertDescription>
                  Pre-generates all combinations from active tokens (excluding
                  same-token pairs and pairs that already exist). Tick rows and
                  configure each token pair inline — each submission enters the
                  KPT opening approval and only takes effect once approved.
                  Base rate is required.
                </AlertDescription>
              </Alert>

              <div className="flex flex-wrap items-center gap-4">
                <Input
                  value={comboFilter}
                  onChange={(e) => setComboFilter(e.target.value)}
                  placeholder="Filter by token code / bank"
                  className="w-[220px]"
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
                <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
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
                <div className="space-y-2 rounded-md border border-border/50 p-4">
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto rounded-md border border-border/50">
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
                        <th className="px-3 py-2 font-medium">Default Split</th>
                        <th className="w-24 px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {visibleCombos.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No data
                          </td>
                        </tr>
                      )}
                      {visibleCombos.map((c) => {
                        const key = comboKey(c);
                        const invalid = comboInvalidReason(c);
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
                            {/* 输入框常驻（未勾选禁用）：避免勾选切换重挂载导致失焦/输入异常（源 2026-08-28） */}
                            <td className="px-3 py-2">
                              <Input
                                value={c.baseRate}
                                onChange={(e) =>
                                  updateCombo(key, { baseRate: e.target.value })
                                }
                                disabled={!c.checked}
                                placeholder="Required, greater than 0"
                                maxLength={14}
                                inputMode="decimal"
                                className={`h-8 w-[130px]${
                                  invalid
                                    ? ' border-destructive focus-visible:ring-destructive'
                                    : ''
                                }`}
                                aria-invalid={!!invalid}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                value={c.markupRate}
                                onChange={(e) =>
                                  updateCombo(key, { markupRate: e.target.value })
                                }
                                disabled={!c.checked}
                                placeholder="e.g. 0.01 = 1%"
                                maxLength={10}
                                inputMode="decimal"
                                className="h-8 w-[120px]"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                value={c.defaultSplitRatio}
                                onChange={(e) =>
                                  updateCombo(key, {
                                    defaultSplitRatio: e.target.value,
                                  })
                                }
                                disabled={!c.checked}
                                placeholder="0–1, e.g. 0.5"
                                maxLength={8}
                                inputMode="decimal"
                                className="h-8 w-[120px]"
                              />
                            </td>
                            <td className="px-3 py-2">
                              {c.exists ? (
                                <Badge variant="outline">Exists</Badge>
                              ) : (
                                <Badge variant="default">Submittable</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            row ? (
              <div className="space-y-4">
                {/* Hero Summary：交易对 SRC/TGT + 状态（§6.3；只读直读 row，禁伪装表单控件） */}
                <section className="rounded-lg border border-border/60 bg-card px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <TokenPairCell
                      sourceSymbol={row.sourceSymbol}
                      sourceTokenCode={row.sourceTokenCode}
                      targetSymbol={row.targetSymbol}
                      targetTokenCode={row.targetTokenCode}
                      sourceBankCode={row.sourceBankCode}
                      targetBankCode={row.targetBankCode}
                    />
                    <PairStatusBadge status={row.status} />
                  </div>
                </section>

                {/* 参数（核心信息）：源/目标 token 定位 + 费率三参 */}
                <div>
                  <div className="mb-2 text-sm font-semibold">Pair Parameters</div>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    <DetailField label="Source Token">
                      <span className="font-mono">
                        {row.sourceTokenCode} ({row.sourceBankCode || '-'} /{' '}
                        {tokenOptions.find((t) => t.tokenId === row.sourceTokenId)
                          ?.chainType || '-'}
                        )
                      </span>
                    </DetailField>
                    <DetailField label="Target Token">
                      <span className="font-mono">
                        {row.targetTokenCode} ({row.targetBankCode || '-'} /{' '}
                        {tokenOptions.find((t) => t.tokenId === row.targetTokenId)
                          ?.chainType || '-'}
                        )
                      </span>
                    </DetailField>
                    <DetailField label="Base Rate">
                      <span className="font-mono tabular-nums">
                        {row.baseRate === null || row.baseRate === ''
                          ? '--'
                          : String(row.baseRate)}
                      </span>
                    </DetailField>
                    <DetailField label="Markup Rate">
                      <span className="font-mono tabular-nums">
                        {row.markupRate === null || row.markupRate === ''
                          ? '--'
                          : String(row.markupRate)}
                      </span>
                    </DetailField>
                    <DetailField label="Default Split">
                      <span className="font-mono tabular-nums">
                        {row.defaultSplitRatio === null || row.defaultSplitRatio === ''
                          ? '--'
                          : String(row.defaultSplitRatio)}
                      </span>
                    </DetailField>
                  </dl>
                </div>

                {/* 审计（§6.3）：pairCode（可复制）+ 创建时间 */}
                <div className="border-t border-border/50 pt-4">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    <DetailField label="Pair Code">
                      <CopyableEllipsisText
                        value={row.pairCode}
                        emptyText="--"
                        maxWidth={200}
                        className="font-mono"
                      />
                    </DetailField>
                    <DetailField label="Created At">
                      <span className="tabular-nums">{formatTime(row.createTime)}</span>
                    </DetailField>
                  </dl>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pair data.</p>
            )
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClosed}>
              {isView ? 'Close' : 'Cancel'}
            </Button>
            {isCreate && (
              <Button
                type="button"
                disabled={!selected.length || submitting}
                onClick={requestBatchSave}
              >
                {submitting
                  ? 'Submitting…'
                  : `Submit ${selected.length} Opening Request${selected.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        request={
          confirmBatch
            ? {
                title: 'Submit Opening Requests',
                message: `Submit ${selected.length} token pair opening request${selected.length === 1 ? '' : 's'} with the per-row parameters above? Each enters the KPT approval flow and takes effect only once approved.`,
                confirmText: 'Submit',
                onConfirm: () => void onBatchSave(),
              }
            : null
        }
        onClose={() => setConfirmBatch(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// PairChangeDialog — 变更参数（KRC）/ 重新提交开通申请（KPT）
// （源 fx-rate/pair/pair-change-dialog.vue，2023418 新增）
// ---------------------------------------------------------------------------

interface PairChangeFormState {
  baseRate: string;
  markupRate: string;
  defaultSplitRatio: string;
}

/**
 * 变更/重提弹窗（源 pair-change-dialog.vue，520px）。
 * - change：生效对参数变更，提交进入 KRC 审批，通过前现值继续生效；
 *   同对待审期间列表按钮已禁用，此处不再重复拦截。
 * - resubmit：已驳回（status=15）组合修改参数后按 source+target 重新提交
 *   开通申请（KPT；SaveReq 无 pairId，服务端按组合识别重提）。
 */
function PairChangeDialog({
  mode,
  row,
  onClosed,
}: {
  mode: 'change' | 'resubmit';
  row: TokenPairRow;
  onClosed: () => void;
}) {
  const toast = useToast();
  const isResubmit = mode === 'resubmit';
  const [form, setForm] = React.useState<PairChangeFormState>({
    baseRate: row.baseRate == null ? '' : String(row.baseRate),
    markupRate: row.markupRate == null ? '' : String(row.markupRate),
    defaultSplitRatio:
      row.defaultSplitRatio == null ? '' : String(row.defaultSplitRatio),
  });
  // §6.4：错误按字段下沉（判定逻辑不变）；改哪个字段清哪个。
  const [errors, setErrors] = React.useState<{
    baseRate?: string;
    markupRate?: string;
    defaultSplitRatio?: string;
  }>({});
  const saveMutation = useSaveTokenPairMutation(PROJECT_ID);
  const changeMutation = useChangeTokenPairMutation(PROJECT_ID);
  const pending = saveMutation.isPending || changeMutation.isPending;

  // 选填项空串转 undefined（源提交口径）；blur 即校验（源 blur 触发同款）。
  const onSubmit = React.useCallback(() => {
    const base = Number(form.baseRate);
    if (form.baseRate === '' || Number.isNaN(base) || base <= 0) {
      setErrors({ baseRate: 'Base rate is required and must be greater than 0' });
      return;
    }
    const markup = form.markupRate === '' ? undefined : Number(form.markupRate);
    if (markup != null && Number.isNaN(markup)) {
      setErrors({ markupRate: 'Markup rate must be numeric' });
      return;
    }
    const split =
      form.defaultSplitRatio === '' ? undefined : Number(form.defaultSplitRatio);
    if (split != null && (Number.isNaN(split) || split < 0 || split > 1)) {
      setErrors({ defaultSplitRatio: 'Default split must be between 0 and 1' });
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
            onClosed();
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
            onClosed();
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    }
  }, [
    changeMutation,
    form,
    isResubmit,
    onClosed,
    row,
    saveMutation,
    toast,
  ]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClosed()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isResubmit ? 'Resubmit Opening Request' : 'Change Token Pair Parameters'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <TokenPairCell
            sourceSymbol={row.sourceSymbol}
            sourceTokenCode={row.sourceTokenCode}
            targetSymbol={row.targetSymbol}
            targetTokenCode={row.targetTokenCode}
            sourceBankCode={row.sourceBankCode}
            targetBankCode={row.targetBankCode}
          />
          <p className="font-mono text-xs text-muted-foreground">{row.pairCode}</p>
          <Alert>
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <AlertDescription>
              {isResubmit
                ? 'The opening request for this token pair combination was rejected. Adjust the parameters and resubmit it for approval.'
                : 'Base rate / markup rate / default split enter the KRC approval once submitted; the current values stay effective until approved. Duplicate submissions are blocked while a request is pending.'}
            </AlertDescription>
          </Alert>
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
            placeholder="Required, greater than 0"
            maxLength={14}
            inputMode="decimal"
            autoFocus
          />
          <FormField
            name="markupRate"
            label="Markup Rate"
            value={form.markupRate}
            onChange={(e) => {
              setForm((f) => ({ ...f, markupRate: e.target.value }));
              setErrors((prev) => ({ ...prev, markupRate: undefined }));
            }}
            error={errors.markupRate}
            placeholder="Optional, e.g. 0.01 = 1%"
            maxLength={10}
            inputMode="decimal"
          />
          <FormField
            name="defaultSplitRatio"
            label="Default Split"
            value={form.defaultSplitRatio}
            onChange={(e) => {
              setForm((f) => ({ ...f, defaultSplitRatio: e.target.value }));
              setErrors((prev) => ({ ...prev, defaultSplitRatio: undefined }));
            }}
            error={errors.defaultSplitRatio}
            placeholder="Optional, 0–1, e.g. 0.5"
            maxLength={8}
            inputMode="decimal"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClosed}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={pending}>
            {pending
              ? 'Submitting…'
              : isResubmit
                ? 'Resubmit'
                : 'Submit Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
