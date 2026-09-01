'use client';

import * as React from 'react';
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

/** 毫秒时间戳 → 统一管理台时间格式；0/空/非法 → '--'（目标约定 §4；源 formatTime 用 '-'）。 */
function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
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

/** 嵌套子块（源 NestedValue）。 */
interface NestedValue {
  kind: 'nested';
  title: string;
  entries: Array<[string, unknown]>;
}

/**
 * 通用值格式化（启发式，按序）；源 approval/format.ts formatFieldValue。
 * null→'--' | 时间戳 | 布尔 | 状态码(status→业务特有优先) | 金额 | JSON 串递归 | 其余原样。
 */
function formatFieldValue(
  key: string,
  value: unknown,
  busCode?: string,
): string | NestedValue {
  if (value === null || value === undefined || value === '') return '--';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object' && !Array.isArray(value)) {
    return {
      kind: 'nested',
      title: key,
      entries: Object.entries(value as Record<string, unknown>),
    };
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const s = String(value);
    if (key === 'status' && /^\d+$/.test(s)) {
      const busMap = busCode ? BUSINESS_STATUS_MAP[busCode] : undefined;
      const mapped = busMap?.[Number(s)] ?? COMMON_STATUS_MAP[Number(s)];
      if (mapped !== undefined) return mapped;
    }
    if (
      (/(time|date)/i.test(key) || /^period/i.test(key) || /(Start|End)$/.test(key)) &&
      /^\d{10,13}$/.test(s)
    ) {
      return formatTime(Number(s));
    }
    if (/(amount|limit|rate|total)/i.test(key) && /^-?\d+(\.\d+)?$/.test(s)) {
      return formatMoney(s);
    }
    const trimmed = s.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === 'object') {
          return {
            kind: 'nested',
            title: key,
            entries: Object.entries(parsed as Record<string, unknown>),
          };
        }
      } catch {
        /* 解析失败 → 原样显示 */
      }
    }
    return s;
  }
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

interface FieldDef {
  key: string;
  label: string;
}

/** 字段名 → 中文标签（通用词典，未命中用原字段名兜底）；源 field-maps.ts LABEL_DICT。 */
const LABEL_DICT: Record<string, string> = {
  bankId: 'Bank ID',
  changeId: 'Limit Change ID',
  bankName: 'Bank Name',
  bankCode: 'Bank Code',
  bic: 'SWIFT BIC',
  singleLimit: 'Per-Transaction Limit',
  dailyLimit: 'Daily Limit',
  accountConfig: 'Account Configuration',
  status: 'Status',
  kycInfo: 'KYC Info',
  createTime: 'Creation Time',
  lpName: 'LP Name',
  lpCode: 'LP Code',
  pairName: 'Currency Pair',
  baseCurrency: 'Base Currency',
  quoteCurrency: 'Quote Currency',
  baseRate: 'Base Rate',
  markupRate: 'Markup Rate',
  effectiveRate: 'Effective Rate',
  orderNo: 'Settlement Order No.',
  settleAmount: 'Settlement Amount',
  orderStatus: 'Order Status',
  transferAmount: 'Transfer Amount',
  targetAccount: 'Target Account',
  reason: 'Reason',
  remarks: 'Remarks',
};

/** 8 类详配：字段顺序即展示顺序（按后端 VO 声明/业务重要性排）；源 FIELD_MAPS。 */
const FIELD_MAPS: Record<string, FieldDef[]> = {
  kissen_bank_onboard: [
    { key: 'bankName', label: 'Bank Name' },
    { key: 'bankCode', label: 'Bank Code' },
    { key: 'bic', label: 'SWIFT BIC' },
    { key: 'currencies', label: 'Supported Currencies' },
    { key: 'singleLimit', label: 'Per-Transaction Limit' },
    { key: 'dailyLimit', label: 'Daily Limit' },
    { key: 'accountConfig', label: 'Account Configuration' },
    { key: 'kycInfo', label: 'KYC Info' },
    { key: 'status', label: 'Status' },
    { key: 'createTime', label: 'Creation Time' },
  ],
  kissen_lp_onboard: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'lpCode', label: 'LP Code' },
    { key: 'splitRatio', label: 'Split Ratio' },
    { key: 'minLiquidity', label: 'Minimum Liquidity' },
    { key: 'riskAssessment', label: 'Risk Assessment' },
    { key: 'initialPairIds', label: 'Participating Currency Pairs' },
    { key: 'status', label: 'Status' },
    { key: 'createTime', label: 'Creation Time' },
  ],
  kissen_lp_pair: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'sourceCurrency', label: 'Source Currency' },
    { key: 'targetCurrency', label: 'Target Currency' },
    { key: 'remark', label: 'Remarks' },
    { key: 'status', label: 'Status' },
    { key: 'createTime', label: 'Creation Time' },
  ],
  // 2023418：rate_change=Token 对参数变更（KRC）；pair_toggle 承接开通申请（KPT）与启停。
  kissen_rate_change: [
    { key: 'pairCode', label: 'Pair Code' },
    { key: 'sourceCurrency', label: 'Source Token' },
    { key: 'targetCurrency', label: 'Target Token' },
    { key: 'baseRate', label: 'Base Rate (Requested)' },
    { key: 'markupRate', label: 'Markup Rate (Requested)' },
    { key: 'defaultSplitRatio', label: 'Default Split (Requested)' },
    { key: 'pendingAction', label: 'Pending Action' },
    { key: 'status', label: 'Pair Status' },
    { key: 'createTime', label: 'Requested At' },
  ],
  kissen_pair_toggle: [
    { key: 'pairCode', label: 'Pair Code' },
    { key: 'sourceCurrency', label: 'Source Token' },
    { key: 'targetCurrency', label: 'Target Token' },
    { key: 'baseRate', label: 'Base Rate' },
    { key: 'markupRate', label: 'Markup Rate' },
    { key: 'defaultSplitRatio', label: 'Default Split' },
    { key: 'pendingAction', label: 'Pending Action' },
    { key: 'status', label: 'Status' },
    { key: 'createTime', label: 'Creation Time' },
  ],
  // 2023418 新增：LP 覆盖分成变更（KLS）；上游 BUSINESS_NAME_MAP 未加该 busCode，
  // 下游对齐不加（key 兜底显示 busCode）。
  kissen_lp_split: [
    { key: 'lpName', label: 'LP Name' },
    { key: 'sourceCurrency', label: 'Source Token' },
    { key: 'targetCurrency', label: 'Target Token' },
    { key: 'oldRatio', label: 'Current Split' },
    { key: 'newRatio', label: 'Requested Split (0 = Clear)' },
    { key: 'pendingAction', label: 'Pending Action' },
    { key: 'status', label: 'Participation Status' },
    { key: 'createTime', label: 'Requested At' },
  ],
  kissen_settle_confirm: [
    { key: 'orderId', label: 'Settlement Order ID' },
    { key: 'lpName', label: 'LP Name' },
    { key: 'periodType', label: 'Settlement Period (1 Daily / 2 Weekly / 3 Monthly)' },
    { key: 'periodStart', label: 'Period Start' },
    { key: 'periodEnd', label: 'Period End' },
    { key: 'txCount', label: 'Transaction Count' },
    { key: 'principalTotal', label: 'Principal Total' },
    { key: 'markupTotal', label: 'Markup Total' },
    { key: 'adminSplitTotal', label: 'Admin Split' },
    { key: 'lpSplitTotal', label: 'LP Split' },
    { key: 'status', label: 'Status' },
    { key: 'createTime', label: 'Creation Time' },
  ],
  kissen_split_transfer: [
    { key: 'transferId', label: 'Transfer ID' },
    { key: 'orderId', label: 'Settlement Order ID' },
    { key: 'lpName', label: 'LP Name' },
    { key: 'direction', label: 'Transfer Direction (1 Pre-Authorized / 2 LP Initiated)' },
    { key: 'currency', label: 'Currency' },
    { key: 'amount', label: 'Transfer Amount' },
    { key: 'csTxId', label: 'Channel Transaction ID' },
    { key: 'status', label: 'Status' },
    { key: 'createTime', label: 'Creation Time' },
  ],
  kissen_limit_change: [
    { key: 'bankName', label: 'Bank Name' },
    { key: 'oldSingleLimit', label: 'Original Per-Transaction Limit' },
    { key: 'oldDailyLimit', label: 'Original Daily Limit' },
    { key: 'newSingleLimit', label: 'New Per-Transaction Limit' },
    { key: 'newDailyLimit', label: 'New Daily Limit' },
  ],
};

function getFieldMap(busCode: string): FieldDef[] | null {
  return FIELD_MAPS[busCode] ?? null;
}

function fieldLabel(key: string): string {
  return LABEL_DICT[key] ?? key;
}

function fieldLabelFor(busCode: string, key: string): string {
  const map = getFieldMap(busCode);
  if (map) {
    const found = map.find((item) => item.key === key);
    if (found) return found.label;
  }
  return fieldLabel(key);
}

function displayNested(busCode: string, key: string, value: unknown): string {
  const formatted = formatFieldValue(key, value, busCode);
  return typeof formatted === 'string' ? formatted : JSON.stringify(value);
}

/** 数字/千分位串 → 等宽显示（源 isNumericValue）。 */
function isNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return true;
  if (typeof v !== 'string') return false;
  return /^-?[\d,]+(\.\d+)?$/.test(v);
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
    <div className={span ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
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

  // 业务内容条目：字段顺序由详配 FIELD_MAPS 决定（无策略则用 content 原序），
  // 多余字段追加在后（源 detail-drawer contentEntries）。
  const { flatEntries, nestedEntries } = React.useMemo(() => {
    if (!detail) return { flatEntries: [], nestedEntries: [] };
    const map = getFieldMap(row.businessCode);
    const content = detail.businessContent ?? {};
    const keys = map ? map.map((f) => f.key) : Object.keys(content);
    const allKeys = [...keys, ...Object.keys(content).filter((k) => !keys.includes(k))];
    const entries = allKeys.map(
      (k) =>
        [k, formatFieldValue(k, content[k], row.businessCode)] as [
          string,
          string | NestedValue,
        ],
    );
    return {
      flatEntries: entries.filter(
        ([, f]) => typeof f === 'string',
      ) as Array<[string, string]>,
      nestedEntries: entries.filter(
        ([, f]) => typeof f !== 'string',
      ) as Array<[string, NestedValue]>,
    };
  }, [detail, row.businessCode]);
  const onApprove = (approve: number) => {
    if (approve === 2 && !remarks.trim()) {
      toast.warning('Please provide a rejection reason');
      return;
    }
    setConfirmAction({ kind: 'process', approve });
  };

  const onPreviousStep = () => {
    if (!remarks.trim()) {
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
    <div className="space-y-4">
      {/* Hero Summary：业务类型 + 申请单号（可复制）+ 状态 + 当前节点（§6.3） */}
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
        </div>
      </section>

      {/* 业务内容（扁平字段；Business Description 长文本单独占行） */}
      <div>
        <div className="mb-2 text-sm font-semibold">Business Content</div>
        {flatEntries.length > 0 || row.busDesc ? (
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <DetailGrid>
              <DetailField label="Business Description" span>
                {row.busDesc || '--'}
              </DetailField>
              {flatEntries.map(([key, text]) => (
                <DetailField key={key} label={fieldLabelFor(row.businessCode, key)}>
                  <span className={isNumericValue(text) ? 'tabular-nums' : undefined}>
                    {text}
                  </span>
                </DetailField>
              ))}
            </DetailGrid>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No business content</p>
        )}
      </div>

      {/* 嵌套子块 */}
      {nestedEntries.map(([key, nested]) => (
        <div key={key}>
          <div className="mb-2 text-sm font-semibold">
            {fieldLabelFor(row.businessCode, key)}
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <DetailGrid>
              {nested.entries.map(([nk, nv]) => (
                <DetailField key={nk} label={fieldLabelFor(row.businessCode, nk)}>
                  <span className={isNumericValue(nv) ? 'tabular-nums' : undefined}>
                    {displayNested(row.businessCode, nk, nv)}
                  </span>
                </DetailField>
              ))}
            </DetailGrid>
          </div>
        </div>
      ))}

      {/* 审计信息（已办专属：处理时间 + 我的意见；长文本单独占行） */}
      {isDoneRow && (
        <div>
          <div className="mb-2 text-sm font-semibold">Review Record</div>
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <DetailGrid>
              <DetailField label="Processing Time">
                <span className="tabular-nums">{formatTime(row.reviewerTime)}</span>
              </DetailField>
              <DetailField label="My Comments" span>
                {row.reviewerRemarks || '--'}
              </DetailField>
            </DetailGrid>
          </div>
        </div>
      )}

      {/* 审批操作（仅待办且有可用能力位） */}
      {canOperate && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">Approval Actions</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="Enter review comments (required for rejection / send back)"
          />
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
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <Drawer open={drawerOpen} onOpenChange={(v) => !v && closeDetail()}>
        <DrawerContent className="max-h-[90vh] sm:max-w-[640px]">
          <DrawerHeader>
            <DrawerTitle>
              {activeRow ? `${businessName(activeRow.businessCode)} - Details` : 'Details'}
            </DrawerTitle>
            <DrawerDescription>Approval Details</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
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

