'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Alert,
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
  createActionColumn,
  DataTable,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Input,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { cn } from '@myorg/shared/util-classnames';

import {
  KISSEN_PROJECT_ID,
  BUSINESS_NAME_MAP,
  BUSINESS_STATUS_MAP,
  COMMON_STATUS_MAP,
  DETAIL_STATUS_MAP,
  NO_STRATEGY_BUSINESSES,
  approvalDetailStatusVariant,
  approvalStatusVariant,
  businessName,
  useApprovalDetailQuery,
  useApprovalDoneQuery,
  useApprovalPreviousStepMutation,
  useApprovalProcessMutation,
  useApprovalTodoQuery,
  useApprovalWithdrawMutation,
  type ApprovalDoneRow,
  type ApprovalTodoRow,
} from '@myorg/modules/kissen-admin/data-access';

/* ============================================================ */
/* 共享格式化 / 展示辅助（源 views/approval/{format,field-maps}.ts） */
/* ============================================================ */

const PAGE_SIZE_DEFAULT = 10;
const STATUS_ALL = 'all';

/** 毫秒时间戳 → 统一管理台时间格式；0/空/非法 → '--'（目标约定 §4；765eb51 起 0 也视为未发生）。 */
function formatTime(ms: number | null | undefined): string {
  if (!ms || Number.isNaN(Number(ms))) return '--';
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? '--' : formatAdminDateTime(d);
}

/** 数字千分位（保留原小数位）；源 approval/format.ts formatMoney。 */
function formatMoney(v: number | string): string {
  const s = String(v);
  const [int, dec] = s.split('.');
  const sign = int.startsWith('-') ? '-' : '';
  const digits = sign ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? `${sign}${grouped}` : `${sign}${grouped}.${dec}`;
}

/** 比率（0~1）→ 百分比 2 位小数；无效值原样返回（源 formatPercent）。 */
function formatPercent(v: unknown): string {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || Number.isNaN(n)) return String(v ?? '');
  return `${(n * 100).toFixed(2)}%`;
}

/** 字段渲染声明（源 field-maps.ts FieldDef.render + enumMap；启发式 formatFieldValue 废弃）。 */
type FieldRender = 'money' | 'percent' | 'rate' | 'status' | 'time';

interface FieldDef {
  key: string;
  label: string;
  render?: FieldRender;
  /** 数值枚举翻译（键为数字）。 */
  enumMap?: Record<number, string>;
}

/** 结算周期（1 日结 / 2 周结 / 3 月结）。 */
const PERIOD_ENUM: Record<number, string> = {
  1: 'Daily',
  2: 'Weekly',
  3: 'Monthly',
};

/** 货币系统形态（lp_pool.currencySystemType）。 */
const CURRENCY_SYSTEM_ENUM: Record<number, string> = {
  1: 'EVM On-chain',
  2: 'Aptos',
  3: 'Internal System',
};

/** 分成划转方向（split_transfer.direction）。 */
const DIRECTION_ENUM: Record<number, string> = {
  1: 'Pre-authorized Transfer',
  2: 'LP-initiated Transfer',
};

/**
 * 字段白名单（2026-09-04 6579522 全量重写；源 field-maps.ts）：
 * 仅展示配置字段 → 主键/外键（orderId/transferId 等）与已退役字段不再渲染；
 * kissen_limit_change 业务已退役未配置。字段顺序即展示顺序。
 */
const FIELD_MAPS: Record<string, FieldDef[]> = {
  kissen_bank_onboard: [
    { key: 'bankName', label: 'Bank Name' },
    { key: 'bankCode', label: 'Bank Code' },
    { key: 'bic', label: 'SWIFT BIC' },
    { key: 'accountConfig', label: 'Account Configuration' },
    { key: 'status', label: 'Status', render: 'status' },
    { key: 'createTime', label: 'Requested At', render: 'time' },
  ],
  kissen_lp_onboard: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'lpCode', label: 'LP Code' },
    { key: 'settleCycle', label: 'Settlement Cycle', enumMap: PERIOD_ENUM },
    { key: 'riskAssessment', label: 'Risk Assessment' },
    { key: 'status', label: 'Status', render: 'status' },
    { key: 'createTime', label: 'Requested At', render: 'time' },
  ],
  kissen_lp_pool: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'tokenCode', label: 'Token' },
    { key: 'accountAddress', label: 'Pool Address' },
    {
      key: 'currencySystemType',
      label: 'Currency System',
      enumMap: CURRENCY_SYSTEM_ENUM,
    },
    {
      key: 'remindThreshold',
      label: 'Replenishment Threshold (water-level ratio)',
    },
    { key: 'pendingAction', label: 'Pending Action' },
    { key: 'status', label: 'Status', render: 'status' },
    { key: 'createTime', label: 'Requested At', render: 'time' },
  ],
  kissen_lp_pair: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'pairCode', label: 'Token Pair Code' },
    { key: 'sourceCurrency', label: 'Source Token' },
    { key: 'targetCurrency', label: 'Target Token' },
    { key: 'baseRate', label: 'Base Rate', render: 'rate' },
    { key: 'markupRate', label: 'Markup Rate', render: 'percent' },
    { key: 'splitRatio', label: 'Override Split (0 = not set)', render: 'percent' },
    { key: 'remark', label: 'Remarks' },
    { key: 'status', label: 'Status', render: 'status' },
    { key: 'createTime', label: 'Requested At', render: 'time' },
  ],
  kissen_rate_change: [
    { key: 'pairCode', label: 'Token Pair Code' },
    { key: 'sourceCurrency', label: 'Source Token' },
    { key: 'targetCurrency', label: 'Target Token' },
    { key: 'pendingAction', label: 'Pending Action' },
    { key: 'status', label: 'Current Status', render: 'status' },
    { key: 'createTime', label: 'Requested At', render: 'time' },
  ],
  kissen_pair_toggle: [
    { key: 'pairCode', label: 'Token Pair Code' },
    { key: 'sourceCurrency', label: 'Source Token' },
    { key: 'targetCurrency', label: 'Target Token' },
    { key: 'baseRate', label: 'Base Rate', render: 'rate' },
    { key: 'markupRate', label: 'Markup Rate', render: 'percent' },
    { key: 'defaultSplitRatio', label: 'Default Split', render: 'percent' },
    { key: 'pendingAction', label: 'Pending Action' },
    { key: 'status', label: 'Status', render: 'status' },
    { key: 'createTime', label: 'Creation Time', render: 'time' },
  ],
  kissen_lp_split: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'sourceCurrency', label: 'Source Token' },
    { key: 'targetCurrency', label: 'Target Token' },
    { key: 'pendingAction', label: 'Pending Action' },
    { key: 'status', label: 'Participation Status', render: 'status' },
    { key: 'createTime', label: 'Requested At', render: 'time' },
  ],
  kissen_settle_confirm: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'periodType', label: 'Settlement Cycle', enumMap: PERIOD_ENUM },
    { key: 'periodStart', label: 'Period Start', render: 'time' },
    { key: 'periodEnd', label: 'Period End', render: 'time' },
    { key: 'txCount', label: 'Transaction Count' },
    { key: 'principalTotal', label: 'Principal Total', render: 'money' },
    { key: 'markupTotal', label: 'Markup Total', render: 'money' },
    { key: 'adminSplitTotal', label: 'Admin Split', render: 'money' },
    { key: 'lpSplitTotal', label: 'LP Split', render: 'money' },
    { key: 'status', label: 'Order Status', render: 'status' },
    { key: 'createTime', label: 'Requested At', render: 'time' },
  ],
  kissen_split_transfer: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'direction', label: 'Transfer Direction', enumMap: DIRECTION_ENUM },
    { key: 'currency', label: 'Currency' },
    { key: 'amount', label: 'Transfer Amount', render: 'money' },
    { key: 'csTxId', label: 'Channel Transaction ID' },
    { key: 'status', label: 'Status', render: 'status' },
    { key: 'createTime', label: 'Requested At', render: 'time' },
  ],
};

/** 变更对比表定义（源 CHANGE_MAPS）：变更前快照键 → 申请值键。 */
interface ChangeDef {
  label: string;
  fromKey: string;
  toKey: string;
  render: 'rate' | 'percent';
}

const CHANGE_MAPS: Record<string, ChangeDef[]> = {
  kissen_rate_change: [
    { label: 'Base Rate', fromKey: 'oldBaseRate', toKey: 'baseRate', render: 'rate' },
    {
      label: 'Markup Rate',
      fromKey: 'oldMarkupRate',
      toKey: 'markupRate',
      render: 'percent',
    },
    {
      label: 'Default Split',
      fromKey: 'oldDefaultSplitRatio',
      toKey: 'defaultSplitRatio',
      render: 'percent',
    },
  ],
  kissen_lp_split: [
    { label: 'Override Split', fromKey: 'oldRatio', toKey: 'newRatio', render: 'percent' },
  ],
};

/** 流转时间线节点结论（源 APPROVAL_RESULT_MAP；9 = 退回约定码，765eb51）。 */
const APPROVAL_RESULT_MAP: Record<
  number,
  { label: string; variant: 'default' | 'destructive' | 'secondary' }
> = {
  2: { label: 'Rejected', variant: 'destructive' },
  3: { label: 'Approved', variant: 'default' },
  9: { label: 'Returned', variant: 'secondary' },
};

function getFieldMap(busCode: string): FieldDef[] | null {
  return FIELD_MAPS[busCode] ?? null;
}

/** 未配置 busCode 的兜底白名单：全字段但过滤主键/审计键（源 /(Id|UserId|CreateTime|UpdateTime)$/i）。 */
function fallbackFieldDefs(content: Record<string, unknown>): FieldDef[] {
  return Object.keys(content)
    .filter((k) => !/(Id|UserId|CreateTime|UpdateTime)$/i.test(k))
    .map((k) => ({ key: k, label: k }));
}

/**
 * 按显式声明渲染字段值（源 renderFieldValue；替代旧 formatFieldValue 启发式）：
 * enumMap 命中优先 → render 分支（money 仅纯数字 / percent / rate 原值 /
 * status 业务特有映射优先 / time 10-13 位时间戳）→ 默认原样；空值 '--'。
 */
function renderFieldValue(def: FieldDef, value: unknown, busCode: string): string {
  if (value === null || value === undefined || value === '') return '--';
  const s = String(value);
  if (def.enumMap && /^\d+$/.test(s) && def.enumMap[Number(s)] !== undefined) {
    return def.enumMap[Number(s)];
  }
  switch (def.render) {
    case 'money':
      return /^-?\d+(\.\d+)?$/.test(s) ? formatMoney(s) : s;
    case 'percent':
      return formatPercent(value);
    case 'rate':
      return s;
    case 'status': {
      if (/^\d+$/.test(s)) {
        const busMap = BUSINESS_STATUS_MAP[busCode];
        const mapped = busMap?.[Number(s)] ?? COMMON_STATUS_MAP[Number(s)];
        if (mapped !== undefined) return mapped;
      }
      return s;
    }
    case 'time':
      return /^\d{10,13}$/.test(s) ? formatTime(Number(s)) : s;
    default:
      return s;
  }
}

/** 数字/千分位串 → 等宽显示（源 isNumericValue）。 */
function isNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return true;
  if (typeof v !== 'string') return false;
  return /^-?[\d,]+(\.\d+)?$/.test(v);
}

/** 业务描述若为 JSON，格式化为可读的多行文本，避免长字符串撑破详情布局。 */
function formatBusinessDescription(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '--';

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return value;
  }
}

/* ============================================================ */
/* 共享小组件                                                     */
/* ============================================================ */

function LoadingBlock() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** 详情字段（§6.3 DetailGrid：label 上置；span=长文本单独占行）。 */
function DetailField({
  label,
  span = false,
  children,
}: {
  label: string;
  /** 自 sm 断点起跨满两列（描述/备注类长文本）。 */
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

/** 详情网格（640px 抽屉内 1→2 列响应，§6.3）。 */
function DetailGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</dl>
  );
}

/* ============================================================ */
/* 列表行归一（待办/已办统一行类型，已办专属字段可选）              */
/* ============================================================ */

interface ApprovalListRow {
  id: string;
  taskId: number;
  applyCode: string;
  businessCode: string;
  busDesc: string;
  stepName: string;
  reviewerStatus: number;
  createUserName: string;
  createTime: number;
  /** 已办专属：节点结果 / 处理时间 / 我的意见。 */
  detailReviewerStatus?: number;
  reviewerTime?: number;
  reviewerRemarks?: string;
}

function toApprovalListRow(
  row: ApprovalTodoRow | ApprovalDoneRow,
): ApprovalListRow {
  return {
    id: String(row.taskId),
    taskId: row.taskId,
    applyCode: row.applyCode,
    businessCode: row.businessCode,
    busDesc: row.busDesc,
    stepName: row.stepName,
    reviewerStatus: row.reviewerStatus,
    createUserName: row.createUserName,
    createTime: row.createTime,
    detailReviewerStatus:
      'detailReviewerStatus' in row ? row.detailReviewerStatus : undefined,
    reviewerTime: 'reviewerTime' in row ? row.reviewerTime : undefined,
    reviewerRemarks: 'reviewerRemarks' in row ? row.reviewerRemarks : undefined,
  };
}

/**
 * 二次确认动作（唯一确认流：shared AlertDialog 取代源 ElMessageBox /
 * 下游 v1.x 的 window.confirm）。process=通过/驳回共用，文案随 approve 切换。
 */
type ConfirmAction =
  | { kind: 'process'; approve: number }
  | { kind: 'previousStep' }
  | { kind: 'withdraw' };

/** 确认弹窗文案（语义保真自源确认流，英文定稿）。 */
function confirmCopy(action: ConfirmAction): { title: string; body: string } {
  switch (action.kind) {
    case 'process':
      return action.approve === 3
        ? { title: 'Confirm Approval', body: 'Confirm approval of this request?' }
        : { title: 'Confirm Rejection', body: 'Confirm rejection of this request?' };
    case 'previousStep':
      return {
        title: 'Confirm Send Back',
        body: 'Send back to the previous step? Review comments for this node will be discarded.',
      };
    case 'withdraw':
      return {
        title: 'Confirm Withdrawal',
        body: 'After withdrawal, this request returns to the re-initiated state. Confirm withdrawal?',
      };
  }
}

/* ============================================================ */
/* 审批详情正文（列表抽屉内联渲染；源 detail-drawer.vue。上游无路由详情页，此处仅 drawer）。 */
/* ============================================================ */

function ApprovalDetailBody({
  row,
  readonly,
  onDone,
}: {
  row: ApprovalListRow;
  readonly: boolean;
  onDone: () => void;
}) {
  const toast = useToast();
  const { data: detail, isLoading } = useApprovalDetailQuery(
    KISSEN_PROJECT_ID,
    row.businessCode,
    row.taskId,
  );

  const processMutation = useApprovalProcessMutation(KISSEN_PROJECT_ID);
  const prevMutation = useApprovalPreviousStepMutation(KISSEN_PROJECT_ID);
  const withdrawMutation = useApprovalWithdrawMutation(KISSEN_PROJECT_ID);
  const [remarks, setRemarks] = React.useState('');
  // §6.4：guard 判定不变，错误同步下沉到 Textarea 旁（输入即清）。
  const [remarksError, setRemarksError] = React.useState<string | null>(null);
  // 待确认动作（非空即弹确认框；文案见 confirmCopy）。
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(
    null,
  );

  const submitting =
    processMutation.isPending ||
    prevMutation.isPending ||
    withdrawMutation.isPending;

  const buttons = detail?.approveButtonDTO ?? {};
  const canApprove = (buttons.approveType ?? 0) !== 0;
  const canBack = (buttons.previousStepType ?? 0) !== 0;
  const canWithdraw = (buttons.withdrawType ?? 0) !== 0;
  const canOperate = !readonly && (canApprove || canBack || canWithdraw);

  // 业务字段白名单：FIELD_MAPS 命中按配置渲染；未配置 busCode 兜底全字段过滤主键/审计键。
  const fieldDefs = React.useMemo(() => {
    const content = detail?.businessContent ?? null;
    if (!content) return [];
    const map = getFieldMap(row.businessCode);
    return (map ?? fallbackFieldDefs(content)).filter((f) => f.key in content);
  }, [detail, row.businessCode]);

  // 变更对比表（KRC/KLS）：变更前快照 → 申请值。
  const changeDefs = CHANGE_MAPS[row.businessCode] ?? [];

  // 流转时间线（stepOrder 升序）。
  const history = React.useMemo(() => {
    if (!detail?.history) return [];
    return [...detail.history].sort((a, b) => a.stepOrder - b.stepOrder);
  }, [detail]);
  const onApprove = (approve: number) => {
    if (approve === 2 && !remarks.trim()) {
      setRemarksError('Please provide a rejection reason');
      toast.warning('Please provide a rejection reason');
      return;
    }
    setConfirmAction({ kind: 'process', approve });
  };

  const onPreviousStep = () => {
    if (!remarks.trim()) {
      setRemarksError('A reason is required to send back to the previous step');
      toast.warning('A reason is required to send back to the previous step');
      return;
    }
    setConfirmAction({ kind: 'previousStep' });
  };

  const onWithdraw = () => {
    setConfirmAction({ kind: 'withdraw' });
  };

  /** 确认后分发；成功 toast + 关抽屉语义与源一致。 */
  const runConfirmed = (action: ConfirmAction) => {
    setConfirmAction(null);
    if (action.kind === 'process') {
      processMutation.mutate(
        {
          busCode: row.businessCode,
          taskId: row.taskId,
          approve: action.approve,
          remarks: remarks.trim() || undefined,
        },
        {
          onSuccess: () => {
            toast.success(action.approve === 3 ? 'Approved' : 'Rejected');
            onDone();
          },
          onError: (err) => toast.error((err as Error).message),
        },
      );
    } else if (action.kind === 'previousStep') {
      prevMutation.mutate(
        { busCode: row.businessCode, taskId: row.taskId, remarks: remarks.trim() },
        {
          onSuccess: () => {
            toast.success('Sent back to previous step');
            onDone();
          },
          onError: (err) => toast.error((err as Error).message),
        },
      );
    } else {
      withdrawMutation.mutate(
        {
          busCode: row.businessCode,
          taskId: row.taskId,
          remarks: remarks.trim() || undefined,
        },
        {
          onSuccess: () => {
            toast.success('Withdrawn');
            onDone();
          },
          onError: (err) => toast.error((err as Error).message),
        },
      );
    }
  };

  if (isLoading || !detail) {
    return <LoadingBlock />;
  }

  const isDoneRow = row.detailReviewerStatus !== undefined;

  return (
    <div className="space-y-4 pt-4">
      {/* 摘要头卡（源 head-card）：业务类型 + 状态 + 单号；当前节点/申请时间/业务描述；已办加处理时间/我的意见 */}
      <section className="rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-base font-semibold leading-6 text-foreground">
              {businessName(row.businessCode)}
            </span>
            <Badge variant={approvalStatusVariant(row.reviewerStatus)}>
              {COMMON_STATUS_MAP[row.reviewerStatus] ?? row.reviewerStatus}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <CopyableEllipsisText
              value={row.applyCode}
              emptyText="--"
              maxWidth={280}
              className="font-mono"
            />
            <span>{row.stepName || '--'}</span>
            <span className="tabular-nums">Applied {formatTime(row.createTime)}</span>
          </div>
          {row.busDesc ? (
            <p className="m-0 break-words text-sm text-muted-foreground">
              {formatBusinessDescription(row.busDesc)}
            </p>
          ) : null}
          {isDoneRow ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">
                Processed {formatTime(row.reviewerTime)}
              </span>
              <span className="min-w-0 break-words">
                My comments: {row.reviewerRemarks || '--'}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {/* 流转记录时间线（源 history timeline；3bfe319） */}
      {history.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold">Flow History</div>
          <ol className="m-0 list-none space-y-0 p-0">
            {history.map((node) => {
              const result = APPROVAL_RESULT_MAP[node.reviewerStatus];
              return (
                <li
                  key={node.detailId}
                  className="relative border-l border-border pl-4 pb-4 last:pb-0"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card',
                      result?.variant === 'destructive' && 'bg-destructive',
                      result?.variant === 'default' && 'bg-primary',
                      (!result || result.variant === 'secondary') && 'bg-muted-foreground/60',
                    )}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-medium">{node.stepName}</span>
                      {result ? (
                        <Badge variant={result.variant}>{result.label}</Badge>
                      ) : (
                        <Badge variant="outline">{node.reviewerStatus}</Badge>
                      )}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatTime(node.reviewerTime)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {node.reviewerName || '--'}
                  </div>
                  {node.reviewerRemarks ? (
                    <blockquote className="mt-1 border-l-2 border-border pl-2 text-sm italic text-muted-foreground">
                      {node.reviewerRemarks}
                    </blockquote>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* 业务内容：变更对比表（KRC/KLS）+ 字段白名单卡 */}
      <div>
        <div className="mb-2 text-sm font-semibold">Business Content</div>
        {changeDefs.length > 0 && (
          <div className="mb-3 overflow-x-auto rounded-lg border border-border/60 bg-card p-4">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Item</th>
                  <th className="py-1.5 pr-3 font-medium">Current</th>
                  <th className="py-1.5 pr-3 font-medium" aria-label="Change direction" />
                  <th className="py-1.5 font-medium">Requested</th>
                </tr>
              </thead>
              <tbody>
                {changeDefs.map((def) => {
                  const content = detail.businessContent ?? {};
                  const rawFrom = content[def.fromKey];
                  const rawTo = content[def.toKey];
                  const fromText =
                    rawFrom === null || rawFrom === undefined || rawFrom === ''
                      ? '--'
                      : def.render === 'percent'
                        ? formatPercent(rawFrom)
                        : String(rawFrom);
                  const toText =
                    rawTo === null || rawTo === undefined || rawTo === ''
                      ? '--'
                      : def.render === 'percent'
                        ? formatPercent(rawTo)
                        : String(rawTo);
                  const nFrom = Number(rawFrom);
                  const nTo = Number(rawTo);
                  const comparable =
                    rawFrom !== null &&
                    rawFrom !== undefined &&
                    rawFrom !== '' &&
                    rawTo !== null &&
                    rawTo !== undefined &&
                    rawTo !== '' &&
                    !Number.isNaN(nFrom) &&
                    !Number.isNaN(nTo) &&
                    nFrom !== nTo;
                  return (
                    <tr key={def.fromKey} className="border-b border-border/60 last:border-b-0">
                      <td className="py-2 pr-3">{def.label}</td>
                      <td className="py-2 pr-3 tabular-nums">{fromText}</td>
                      <td
                        className={cn(
                          'py-2 pr-3',
                          comparable
                            ? nTo > nFrom
                              ? 'text-primary'
                              : 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        {comparable ? (nTo > nFrom ? '↑' : '↓') : '→'}
                      </td>
                      <td className="py-2 font-medium tabular-nums">{toText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {fieldDefs.length > 0 ? (
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <DetailGrid>
              {fieldDefs.map((def) => {
                const text = renderFieldValue(
                  def,
                  detail.businessContent?.[def.key],
                  row.businessCode,
                );
                return (
                  <DetailField key={def.key} label={def.label}>
                    <span className={isNumericValue(text) ? 'tabular-nums' : undefined}>
                      {text}
                    </span>
                  </DetailField>
                );
              })}
            </DetailGrid>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No business fields</p>
        )}
      </div>

      {/* 审批操作（仅待办且有可用能力位） */}
      {canOperate && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">Approval Actions</div>
          <div className="space-y-1.5">
            <label htmlFor="approval-remarks" className="text-sm font-medium">
              Review Comments
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                (required for Reject / Send Back)
              </span>
            </label>
            <Textarea
              id="approval-remarks"
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setRemarksError(null);
              }}
              rows={3}
              maxLength={200}
              placeholder="Enter review comments"
              aria-invalid={remarksError ? true : undefined}
              aria-describedby={remarksError ? 'approval-remarks-error' : undefined}
            />
            {remarksError && (
              <p id="approval-remarks-error" role="alert" className="text-sm text-destructive">
                {remarksError}
              </p>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {remarks.length}/200
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={submitting} onClick={() => onApprove(3)}>
              Approve
            </Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={() => onApprove(2)}
            >
              Reject
            </Button>
            {canBack && (
              <Button variant="outline" disabled={submitting} onClick={onPreviousStep}>
                Send Back
              </Button>
            )}
            {canWithdraw && (
              <Button variant="outline" disabled={submitting} onClick={onWithdraw}>
                Withdraw
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 二次确认弹窗（唯一确认流；取代源 ElMessageBox / v1.x window.confirm） */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? confirmCopy(confirmAction).title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? confirmCopy(confirmAction).body : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // 保持受控：分发后统一关闭
                if (confirmAction) runConfirmed(confirmAction);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ============================================================ */
/* 审批中心列表（源 views/approval/index.vue：Tabs 待办/已办）     */
/* ============================================================ */

export function ApprovalCenterListPage() {
  const [tab, setTab] = React.useState<'todo' | 'done'>('todo');
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const [businessCode, setBusinessCode] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [doneStatus, setDoneStatus] = React.useState<number | undefined>();
  const [applied, setApplied] = React.useState({
    businessCode: '',
    keyword: '',
    doneStatus: undefined as number | undefined,
  });

  const todoFilter = {
    businessCode: applied.businessCode || undefined,
    keyword: applied.keyword || undefined,
  };
  const doneFilter = {
    businessCode: applied.businessCode || undefined,
    keyword: applied.keyword || undefined,
    status: applied.doneStatus,
  };

  const todoQ = useApprovalTodoQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize, filter: todoFilter },
    tab === 'todo',
  );
  const doneQ = useApprovalDoneQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize, filter: doneFilter },
    tab === 'done',
  );
  const activeQ = tab === 'todo' ? todoQ : doneQ;

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeRow, setActiveRow] = React.useState<ApprovalListRow | null>(null);

  const rows = activeQ.data?.data ?? [];
  const paginationMeta = activeQ.data?.pagination;
  const isLoading = activeQ.isLoading;
  const isError = activeQ.isError;

  const tableData = React.useMemo(
    () => rows.map(toApprovalListRow),
    [rows],
  );

  const onSearch = () => {
    setApplied({ businessCode, keyword, doneStatus });
    setPageNum(1);
  };

  const onReset = () => {
    setBusinessCode('');
    setKeyword('');
    setDoneStatus(undefined);
    setApplied({ businessCode: '', keyword: '', doneStatus: undefined });
    setPageNum(1);
  };

  const onTabChange = (value: string) => {
    setTab(value === 'done' ? 'done' : 'todo');
    setPageNum(1);
  };

  const openDetail = (row: ApprovalListRow) => {
    setActiveRow(row);
    setDrawerOpen(true);
  };

  const closeDetail = () => {
    setDrawerOpen(false);
    setActiveRow(null);
  };

  const columns = React.useMemo<ColumnDef<ApprovalListRow>[]>(
    () => [
      {
        accessorKey: 'applyCode',
        header: 'Approval No.',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.applyCode || '--'}</span>
        ),
      },
      {
        id: 'businessName',
        header: 'Business Type',
        cell: ({ row }) => (
          <span>{businessName(row.original.businessCode)}</span>
        ),
      },
      {
        accessorKey: 'busDesc',
        header: 'Business Description',
        cell: ({ row }) => <span>{row.original.busDesc || '--'}</span>,
      },
      {
        accessorKey: 'stepName',
        header: 'Current Node',
        cell: ({ row }) => <span>{row.original.stepName || '--'}</span>,
      },
      {
        accessorKey: 'createUserName',
        header: 'Applicant',
        cell: ({ row }) => <span>{row.original.createUserName || '--'}</span>,
      },
      {
        accessorKey: 'createTime',
        header: 'Application Time',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const isDone = row.original.detailReviewerStatus !== undefined;
          if (isDone) {
            const st = row.original.detailReviewerStatus as number;
            return (
              <Badge variant={approvalDetailStatusVariant(st)}>
                {DETAIL_STATUS_MAP[st] ?? st}
              </Badge>
            );
          }
          return (
            <Badge variant={approvalStatusVariant(row.original.reviewerStatus)}>
              {COMMON_STATUS_MAP[row.original.reviewerStatus] ??
                row.original.reviewerStatus}
            </Badge>
          );
        },
      },
      {
        id: 'reviewerTime',
        header: 'Processing Time',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.detailReviewerStatus !== undefined
              ? formatTime(row.original.reviewerTime)
              : '--'}
          </span>
        ),
      },
      {
        id: 'reviewerRemarks',
        header: 'My Comments',
        cell: ({ row }) => (
          <span>
            {row.original.detailReviewerStatus !== undefined
              ? row.original.reviewerRemarks || '--'
              : '--'}
          </span>
        ),
      },
      createActionColumn<ApprovalListRow>((item) => {
        // 无审批策略的业务暂无详情页：保留禁用入口占位（源渲染 disabled 链接按钮）。
        if (NO_STRATEGY_BUSINESSES[item.businessCode]) {
          return [
            {
              label: 'Detail pending integration',
              disabled: true,
              onClick: () => undefined,
            },
          ];
        }
        return [
          {
            label: tab === 'todo' ? 'Process' : 'View',
            onClick: () => openDetail(item),
          },
        ];
      }),
    ],
    [tab],
  );

  const businessOptions = React.useMemo(
    () => Object.entries(BUSINESS_NAME_MAP).map(([value, label]) => ({ value, label })),
    [],
  );

  return (
    <div className="space-y-4">
      {/* 页头（源 approval/index.vue page-head：eyebrow + 标题） */}
      <div>
        <div className="text-xs text-muted-foreground">APPROVAL</div>
        <h1 className="text-xl font-semibold">Approval Center</h1>
      </div>
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="todo">To Do</TabsTrigger>
          <TabsTrigger value="done">Done</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <section className="rounded-lg border border-border/60 bg-card">
            <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <div className="text-base font-semibold leading-6 text-foreground">
                  Approvals
                </div>
                {!isLoading && paginationMeta ? (
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {paginationMeta.total} results
                  </span>
                ) : null}
                {activeQ.dataUpdatedAt ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Updated {formatAdminDateTime(activeQ.dataUpdatedAt)}
                  </span>
                ) : null}
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearch();
              }}
              className="border-b border-border/50 px-4 py-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium leading-snug text-foreground">
                    Business Type
                  </label>
                  <Select
                    value={businessCode || STATUS_ALL}
                    onValueChange={(v) => setBusinessCode(v === STATUS_ALL ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STATUS_ALL}>All</SelectItem>
                      {businessOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium leading-snug text-foreground">
                    Keyword
                  </label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Approval No. / Business Description"
                  />
                </div>
                {tab === 'done' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium leading-snug text-foreground">
                      Result
                    </label>
                    <Select
                      value={doneStatus === undefined ? STATUS_ALL : String(doneStatus)}
                      onValueChange={(v) =>
                        setDoneStatus(v === STATUS_ALL ? undefined : Number(v))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={STATUS_ALL}>All</SelectItem>
                        <SelectItem value="3">Approved</SelectItem>
                        <SelectItem value="2">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                  emptyMessage={
                    tab === 'todo'
                      ? 'No pending approvals'
                      : 'No completed approvals'
                  }
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
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <Drawer open={drawerOpen} onOpenChange={(v) => !v && closeDetail()}>
        <DrawerContent className="h-screen max-h-screen w-full max-w-full sm:w-[800px] sm:max-w-[calc(100vw-1rem)]">
          <DrawerHeader>
            <DrawerTitle>
              {activeRow ? `${businessName(activeRow.businessCode)} - Details` : 'Details'}
            </DrawerTitle>
            <DrawerDescription>Approval Details</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {activeRow && (
              <ApprovalDetailBody
                row={activeRow}
                readonly={tab === 'done'}
                onDone={closeDetail}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
