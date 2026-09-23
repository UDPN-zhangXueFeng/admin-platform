'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  CheckCircle2,
  History,
  XCircle,
} from 'lucide-react';

import {
  Alert,
  AlertTitle,
  Button,
  createActionColumn,
  DataTable,
  Input,
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
import { useRouter } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';

import {
  KISSEN_PROJECT_ID,
  BUSINESS_NAME_MAP,
  BUSINESS_STATUS_MAP,
  COMMON_STATUS_MAP,
  NO_STRATEGY_BUSINESSES,
  businessName,
  useApprovalDetailQuery,
  useApprovalDoneQuery,
  useApprovalProcessMutation,
  useApprovalTodoQuery,
  type ApprovalDoneRow,
  type ApprovalTodoRow,
} from '@myorg/modules/kissen-admin/data-access';

import { formatDuration, formatUtc8 } from './proto-format';
import {
  ActionConfirmDialog,
  CopyableId,
  Dash,
  ProtoStatusBadge,
  type ProtoStatusTone,
} from './proto-ui';
import {
  PROTO_APPROVAL_ACTION_TEXT,
  PROTO_WORKFLOW_TASK_STATUS,
  protoStatusLabel,
} from './proto-enums';
import { ProtoSortHeader, useProtoSort } from './proto-sort';
import { peekRow, stashRow } from './row-stash';

/* ============================================================ */
/* 原型对齐口径（WorkflowTasksPage.jsx / WorkflowTaskDetailsPage.jsx） */
/* ============================================================ */

const PAGE_SIZE_DEFAULT = 10;
const FILTER_ALL = 'all';
const FILTER_DEBOUNCE_MS = 250;

const APPROVAL_LIST_PATH = '/approval';
const APPROVAL_DETAIL_PATH = '/approval/detail';
const APPROVAL_STASH_SCOPE = 'admApproval';

/** 页签（原型 Pending / Actioned）。 */
type ApprovalTab = 'pending' | 'actioned';

/** Status 下拉（原型四态逐字；''=All）。 */
const STATUS_FILTER_OPTIONS = [
  '',
  'Pending Approval',
  'Under Approval',
  'Approved',
  'Rejected',
];

/** Status 列排序口径（原型 §15：Pending → Under → Approved → Rejected，非字母序）。 */
const STATUS_ORDER = [
  'Pending Approval',
  'Under Approval',
  'Approved',
  'Rejected',
];

/** 待办主表状态 → 原型文案（5 待审 / 10 审批中）。 */
const TODO_STATUS_LABEL: Record<number, string> = {
  5: 'Pending Approval',
  10: 'Under Approval',
};

/** 已办节点结果（detailReviewerStatus）→ 原型文案。 */
const DONE_STATUS_LABEL: Record<number, string> = {
  3: 'Approved',
  2: 'Rejected',
};

/** 任务状态文案 → 徽章 tone（带点徽章口径）。 */
function statusTone(label: string): ProtoStatusTone {
  switch (label) {
    case 'Approved':
      return 'success';
    case 'Pending Approval':
      return 'warning';
    case 'Under Approval':
      return 'info';
    case 'Rejected':
      return 'danger';
    default:
      return 'muted';
  }
}

/** 流转节点结果（2 拒 / 3 过 / 9 退）→ 文案 + tone。 */
const NODE_RESULT: Record<number, { label: string; tone: ProtoStatusTone }> = {
  2: { label: 'Rejected', tone: 'danger' },
  3: { label: 'Approved', tone: 'success' },
  9: { label: 'Returned', tone: 'muted' },
};

/** 文本筛选 250ms 防抖（原型 useDebouncedValue 同款）。 */
function useDebouncedValue<T>(value: T, delayMs = FILTER_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/* ============================================================ */
/* 业务内容字段渲染（源 views/approval/{format,field-maps}.ts，沿用） */
/* ============================================================ */

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

/** 字段渲染声明（源 field-maps.ts FieldDef.render + enumMap）。 */
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

/** 分成划转方向（split_transfer.direction）。 */
const DIRECTION_ENUM: Record<number, string> = {
  1: 'Pre-authorized Transfer',
  2: 'LP-initiated Transfer',
};

/**
 * 字段白名单（2026-09-04 6579522 全量重写；源 field-maps.ts）：
 * 仅展示配置字段 → 主键/外键（orderId/transferId 等）与已退役字段不再渲染；
 * 字段顺序即展示顺序。
 */
const FIELD_MAPS: Record<string, FieldDef[]> = {
  kissen_bank_onboard: [
    { key: 'bankName', label: 'Bank Name' },
    { key: 'bankBic', label: 'Bank Code (BIC)' },
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
    { key: 'remindThreshold', label: 'Replenishment Threshold (water-level ratio)' },
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
 * 按显式声明渲染字段值（源 renderFieldValue）：enumMap 命中优先 →
 * render 分支（money 仅纯数字 / percent / rate 原值 / status 业务特有映射优先 /
 * time 10-13 位时间戳）→ 默认原样；空值 '-'。
 */
function renderFieldValue(def: FieldDef, value: unknown, busCode: string): string {
  if (value === null || value === undefined || value === '') return '-';
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
      return /^\d{10,13}$/.test(s) ? formatTimeCell(Number(s)) : s;
    default:
      return s;
  }
}

/** 业务内容 time 字段渲染（列表/详情统一 UTC+8）。 */
function formatTimeCell(ms: number): string {
  return formatUtc8(ms);
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
  if (!trimmed) return '-';

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
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}

/** 详情字段（label 上置；span=长文本单独占行）。 */
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

/** 详情网格（1→2 列响应）。 */
function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</dl>;
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

function toApprovalListRow(row: ApprovalTodoRow | ApprovalDoneRow): ApprovalListRow {
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

/** 行状态文案：已办看节点结果（2 拒 / 3 过），待办看主表状态（5/10）。 */
function taskStatusLabel(row: ApprovalListRow): string {
  if (row.detailReviewerStatus !== undefined) {
    return DONE_STATUS_LABEL[row.detailReviewerStatus] ?? String(row.detailReviewerStatus);
  }
  return (
    TODO_STATUS_LABEL[row.reviewerStatus] ??
    protoStatusLabel(PROTO_WORKFLOW_TASK_STATUS, row.reviewerStatus) ??
    String(row.reviewerStatus)
  );
}

/** 行状态排序键（原型 STATUS_ORDER 口径；未知值 null → 恒排最后）。 */
function taskStatusRank(row: ApprovalListRow): number | null {
  const index = STATUS_ORDER.indexOf(taskStatusLabel(row));
  return index < 0 ? null : index;
}

/* ============================================================ */
/* 审批中心列表（原型 WorkflowTasksPage.jsx）                      */
/* ============================================================ */

export function ApprovalCenterListPage() {
  const router = useRouter();

  const [tab, setTab] = React.useState<ApprovalTab>('pending');
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  // 原型查询区：Approval No. 文本（250ms 防抖即时生效）+ Business Type / Status 下拉即时生效
  const [keyword, setKeyword] = React.useState('');
  const [businessCode, setBusinessCode] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const keywordDebounced = useDebouncedValue(keyword);

  // 筛选变化回到第一页（原型同款）
  React.useEffect(() => {
    setPageNum(1);
  }, [keywordDebounced, businessCode, statusFilter, tab]);

  // 服务端筛选：businessCode / keyword；已办 + Approved|Rejected → filter.status
  // （后端 filter.status 仅支持已办 2/3；其余状态选项无服务端参数 → 列表内客户端过滤，见下）
  const doneStatusParam =
    tab === 'actioned' && (statusFilter === 'Approved' || statusFilter === 'Rejected')
      ? statusFilter === 'Approved'
        ? 3
        : 2
      : undefined;

  const listFilter = {
    businessCode: businessCode || undefined,
    keyword: keywordDebounced.trim() || undefined,
    status: doneStatusParam,
  };

  const todoQ = useApprovalTodoQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize, filter: listFilter },
    tab === 'pending',
  );
  const doneQ = useApprovalDoneQuery(
    KISSEN_PROJECT_ID,
    { pageNum, pageSize, filter: listFilter },
    tab === 'actioned',
  );
  const activeQ = tab === 'pending' ? todoQ : doneQ;

  // 页签计数与查询区条件无关（原型口径）→ 无过滤探针查询（pageSize 1，键稳定只取一次）
  const todoCountQ = useApprovalTodoQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 1,
    filter: {},
  });
  const doneCountQ = useApprovalDoneQuery(KISSEN_PROJECT_ID, {
    pageNum: 1,
    pageSize: 1,
    filter: {},
  });

  const rows = activeQ.data?.data ?? [];
  const paginationMeta = activeQ.data?.pagination;
  const isLoading = activeQ.isLoading;
  const isError = activeQ.isError;

  const tableDataRaw = React.useMemo(() => rows.map(toApprovalListRow), [rows]);

  // Status 下拉中无服务端参数的选项（待办页签全部 / 已办的 Pending/Under）→ 当前页客户端过滤。
  // 选择与页签分组互斥的状态（如待办页签选 Approved）结果自然为空，与原型行为一致。
  const tableData = React.useMemo(
    () =>
      doneStatusParam === undefined && statusFilter
        ? tableDataRaw.filter((row) => taskStatusLabel(row) === statusFilter)
        : tableDataRaw,
    [tableDataRaw, statusFilter, doneStatusParam],
  );

  // 排序：后端分页端点无 sortBy 参数 → 仅当前数据集内本地排序（过渡口径，见 proto-sort.tsx 头注）。
  const sortGetters = React.useMemo(
    () => ({
      approvalNo: { value: (r: ApprovalListRow) => r.applyCode || null },
      businessType: { value: (r: ApprovalListRow) => businessName(r.businessCode) },
      createdBy: { value: (r: ApprovalListRow) => r.createUserName || null },
      createdOn: { value: (r: ApprovalListRow) => r.createTime, defaultDir: 'desc' as const },
      processingTime: { value: (r: ApprovalListRow) => r.reviewerTime ?? null, defaultDir: 'desc' as const },
      status: { value: (r: ApprovalListRow) => taskStatusRank(r), defaultDir: 'asc' as const },
    }),
    [],
  );
  const { sorted, toggle, sortState } = useProtoSort(
    tableData,
    sortGetters,
    'createdOn',
    'desc',
    true,
  );

  const onReset = () => {
    setKeyword('');
    setBusinessCode('');
    setStatusFilter('');
  };

  // 原型 D9：切页签即换状态分组；清空 Status 下拉避免跨页签残留
  const onTabChange = (value: string) => {
    setTab(value === 'actioned' ? 'actioned' : 'pending');
    setStatusFilter('');
  };

  const openDetail = (row: ApprovalListRow) => {
    stashRow(APPROVAL_STASH_SCOPE, row.taskId, row);
    router.push(`${APPROVAL_DETAIL_PATH}?taskId=${row.taskId}`);
  };

  const columns = React.useMemo<ColumnDef<ApprovalListRow>[]>(
    () => [
      {
        id: 'approvalNo',
        header: () => (
          <ProtoSortHeader label="Approval No." columnKey="approvalNo" toggle={toggle} sortState={sortState('approvalNo')} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.applyCode ? (
              <CopyableId value={row.original.applyCode} className="text-xs" />
            ) : (
              <Dash />
            )}
          </span>
        ),
      },
      {
        id: 'businessType',
        header: () => (
          <ProtoSortHeader label="Business Type" columnKey="businessType" toggle={toggle} sortState={sortState('businessType')} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{businessName(row.original.businessCode)}</span>
        ),
      },
      {
        accessorKey: 'busDesc',
        header: 'Business Description',
        meta: { maxWidth: 320, overflow: 'wrap' },
        cell: ({ row }) => (
          <span className="line-clamp-2 whitespace-pre-line">{row.original.busDesc || <Dash />}</span>
        ),
      },
      {
        id: 'createdBy',
        header: () => (
          <ProtoSortHeader label="Created by" columnKey="createdBy" toggle={toggle} sortState={sortState('createdBy')} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.createUserName || <Dash />}</span>
        ),
      },
      {
        id: 'createdOn',
        header: () => (
          <ProtoSortHeader label="Created on (UTC+8)" columnKey="createdOn" toggle={toggle} sortState={sortState('createdOn')} />
        ),
        meta: { maxWidth: 200 },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        id: 'status',
        header: () => (
          <ProtoSortHeader label="Status" columnKey="status" toggle={toggle} sortState={sortState('status')} />
        ),
        cell: ({ row }) => (
          <ProtoStatusBadge tone={statusTone(taskStatusLabel(row))}>
            {taskStatusLabel(row)}
          </ProtoStatusBadge>
        ),
      },
      {
        id: 'processingTime',
        // 2026-09-20 口径：本列展示 processedAt 时间戳（非时长）；未处理 → '-'
        header: () => (
          <ProtoSortHeader label="Processing Time (UTC+8)" columnKey="processingTime" toggle={toggle} sortState={sortState('processingTime')} />
        ),
        meta: { maxWidth: 200 },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.reviewerTime ? formatUtc8(row.original.reviewerTime) : <Dash />}
          </span>
        ),
      },
      createActionColumn<ApprovalListRow>((item) => {
        // 无审批策略的业务详情接口会报错：保留禁用占位（源渲染 disabled 链接按钮）。
        if (NO_STRATEGY_BUSINESSES[item.businessCode]) {
          return [{ label: 'Details', disabled: true, onClick: () => undefined }];
        }
        return [{ label: 'Details', onClick: () => openDetail(item) }];
      }),
    ],
    [toggle, sortState],
  );

  const businessOptions = React.useMemo(
    () =>
      Object.entries(BUSINESS_NAME_MAP).map(([value, label]) => ({ value, label })),
    [],
  );

  const pendingCount = todoCountQ.data?.pagination.total;
  const actionedCount = doneCountQ.data?.pagination.total;

  return (
    <div className="min-w-0 space-y-4">
      {/* 页头（原型 PageHeader：仅标题） */}
      <h1 className="text-xl font-semibold">Workflow Tasks</h1>

      {/* 页签在卡片外（原型门禁：Tabs 独立）；计数与查询区条件无关 */}
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {typeof pendingCount === 'number' && (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="actioned">
            Actioned
            {typeof actionedCount === 'number' && (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {actionedCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <section className="rounded-lg border border-border/60 bg-card">
            {/* 卡片头：左上列表标题（原型 D2：不再带 N results · Updated） */}
            <div className="border-b border-border/50 px-4 py-3">
              <div className="text-base font-semibold leading-6 text-foreground">
                Approvals
              </div>
            </div>

            {/* 查询区：即时生效 + 单 Reset（原型 D3；文本 250ms 防抖、无 placeholder） */}
            <div className="grid grid-cols-1 gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium leading-snug text-foreground">
                  Approval No.
                </label>
                <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium leading-snug text-foreground">
                  Business Type
                </label>
                <Select
                  value={businessCode || FILTER_ALL}
                  onValueChange={(v) => setBusinessCode(v === FILTER_ALL ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All</SelectItem>
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
                  Status
                </label>
                <Select
                  value={statusFilter || FILTER_ALL}
                  onValueChange={(v) =>
                    setStatusFilter(v === FILTER_ALL ? '' : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt || FILTER_ALL} value={opt || FILTER_ALL}>
                        {opt || 'All'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={onReset}>
                  Reset
                </Button>
              </div>
            </div>

            <div className="p-4">
              {isError ? (
                <Alert variant="destructive" role="alert">
                  <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
                </Alert>
              ) : (
                <DataTable
                  columns={columns}
                  data={sorted}
                  isLoading={isLoading}
                  emptyMessage={
                    tab === 'pending'
                      ? 'No pending approvals'
                      : 'No actioned approvals'
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
    </div>
  );
}

/* ============================================================ */
/* 审批详情页（原型 WorkflowTaskDetailsPage.jsx：?taskId=&tab=content|flow） */
/* ============================================================ */

/** 审批决定后的本地状态覆盖（原型 fixture 阶段同款本页内状态语义）。 */
interface DecisionOverride {
  label: 'Approved' | 'Rejected';
  at: number;
  comment: string;
}

export function ApprovalDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const taskIdParam = Number(searchParams.get('taskId'));
  const taskId =
    Number.isFinite(taskIdParam) && taskIdParam > 0 ? taskIdParam : null;

  // 行来源：列表跳转暂存行优先；直链进入回退列表扫描（详情接口需要 busCode，
  // 后端无按 taskId 直接取单的端点 → 扫描为必要路径而非兜底装饰）。
  const stashed = React.useMemo(
    () => (taskId ? peekRow<ApprovalListRow>(APPROVAL_STASH_SCOPE, taskId) : null),
    [taskId],
  );
  const todoScanQ = useApprovalTodoQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    !stashed,
  );
  const doneScanQ = useApprovalDoneQuery(
    KISSEN_PROJECT_ID,
    { pageNum: 1, pageSize: 200, filter: {} },
    !stashed,
  );
  const scanning = !stashed && (todoScanQ.isLoading || doneScanQ.isLoading);
  const scannedRow = React.useMemo(() => {
    if (stashed) return null;
    const pool = [...(todoScanQ.data?.data ?? []), ...(doneScanQ.data?.data ?? [])];
    return taskId
      ? (pool.map(toApprovalListRow).find((row) => row.taskId === taskId) ?? null)
      : null;
  }, [stashed, todoScanQ.data, doneScanQ.data, taskId]);

  const row = stashed ?? scannedRow;

  const detailQ = useApprovalDetailQuery(
    KISSEN_PROJECT_ID,
    row?.businessCode,
    row?.taskId ?? undefined,
  );

  // 页签状态写 URL（?tab=；content 缺省不写），replace 不留历史
  const tabParam = searchParams.get('tab');
  const activeTab =
    tabParam === 'flow' || tabParam === 'content' ? tabParam : 'content';
  const handleTabChange = (next: string) => {
    if (!taskId) return;
    const params = new URLSearchParams();
    params.set('taskId', String(taskId));
    if (next !== 'content') params.set('tab', next);
    router.replace(`${APPROVAL_DETAIL_PATH}?${params.toString()}`, { scroll: false });
  };

  const processMutation = useApprovalProcessMutation(KISSEN_PROJECT_ID);
  const [comment, setComment] = React.useState('');
  const [commentError, setCommentError] = React.useState('');
  const [decision, setDecision] = React.useState<'approve' | 'reject' | null>(null);
  const [override, setOverride] = React.useState<DecisionOverride | null>(null);

  /* ---- 未找到 / 加载态 ---- */

  if (!row) {
    if (scanning) {
      return (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Approval Details</h1>
          <section className="rounded-lg border border-border/60 bg-card p-4">
            <LoadingBlock />
          </section>
        </div>
      );
    }
    // 原型 not-found 逐字
    return (
      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="iconSm"
            aria-label="Back to Workflow Tasks"
            onClick={() => router.push(APPROVAL_LIST_PATH)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <h1 className="text-xl font-semibold">Approval Details</h1>
        </div>
        <section className="rounded-lg border border-border/60 bg-card px-6 py-12 text-center">
          <p className="text-lg font-medium text-foreground">Approval not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The record may have been removed. Go back to the list.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push(APPROVAL_LIST_PATH)}
          >
            Back to Workflow Tasks
          </Button>
        </section>
      </div>
    );
  }

  /* ---- 派生数据 ---- */

  const detail = detailQ.data;
  const isDoneRow = row.detailReviewerStatus !== undefined;

  // 生效状态：审批决定后本页内覆盖（详情缓存不失效，与原型本页状态语义一致）
  const effectiveLabel = override?.label ?? taskStatusLabel(row);
  const effectiveProcessedAt = override?.at ?? (isDoneRow ? row.reviewerTime : undefined);
  const effectiveRemarks = override
    ? override.comment
    : isDoneRow
      ? row.reviewerRemarks
      : undefined;

  const buttons = detail?.approveButtonDTO ?? {};
  const canApprove = (buttons.approveType ?? 0) !== 0;
  // 审批动作区仅待办任务（5/10）且详情能力位允许；决定完成后隐藏
  const decidable =
    !isDoneRow && !override && canApprove && [5, 10].includes(row.reviewerStatus);

  const decisionCopy = decision
    ? PROTO_APPROVAL_ACTION_TEXT[decision](row.applyCode, businessName(row.businessCode))
    : null;

  const openDecision = (kind: 'approve' | 'reject') => {
    // 驳回必须有意见（原型逐字）
    if (kind === 'reject' && !comment.trim()) {
      setCommentError('A comment is required when rejecting.');
      return;
    }
    setCommentError('');
    setDecision(kind);
  };

  const runDecision = () => {
    if (!decision) return;
    processMutation.mutate(
      {
        busCode: row.businessCode,
        taskId: row.taskId,
        approve: decision === 'approve' ? 3 : 2,
        remarks: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            decision === 'approve'
              ? `Approval ${row.applyCode} has been approved.`
              : `Approval ${row.applyCode} has been rejected.`,
          );
          setOverride({
            label: decision === 'approve' ? 'Approved' : 'Rejected',
            at: Date.now(),
            comment: comment.trim(),
          });
          setDecision(null);
          setComment('');
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  /* ---- 业务内容字段（沿用 FIELD_MAPS / CHANGE_MAPS） ---- */

  const fieldDefs = React.useMemo(() => {
    const content = detail?.businessContent ?? null;
    if (!content) return [];
    const map = getFieldMap(row.businessCode);
    return (map ?? fallbackFieldDefs(content)).filter((f) => f.key in content);
  }, [detail, row.businessCode]);

  const changeDefs = CHANGE_MAPS[row.businessCode] ?? [];

  // 流转时间线（stepOrder 升序）；待办任务追加当前节点（无时间，原型 current 口径）
  const flowNodes = React.useMemo(() => {
    const history = detail?.history
      ? [...detail.history].sort((a, b) => a.stepOrder - b.stepOrder)
      : [];
    if (isDoneRow || override) return history;
    return history;
  }, [detail, isDoneRow, override]);
  const showCurrentNode = !isDoneRow && !override;

  /* ---- 渲染 ---- */

  const header = (
    <div className="flex flex-wrap items-start gap-3">
      <Button
        variant="outline"
        size="iconSm"
        aria-label="Back to Workflow Tasks"
        onClick={() => router.push(APPROVAL_LIST_PATH)}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          {/* 原型 D2："{Business Type} Approval - Details"（业务名多数自带 Approval 后缀） */}
          <h1 className="min-w-0 break-words text-xl font-semibold">
            {businessName(row.businessCode)} - Details
          </h1>
          <ProtoStatusBadge tone={statusTone(effectiveLabel)}>
            {effectiveLabel}
          </ProtoStatusBadge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {'Approval No: '}
            {row.applyCode ? (
              <CopyableId value={row.applyCode} className="text-xs" />
            ) : (
              <Dash />
            )}
          </span>
          <span aria-hidden="true">|</span>
          <span>
            {'Created on '}
            <span className="font-semibold text-foreground tabular-nums">
              {formatUtc8(row.createTime)}
            </span>
          </span>
        </p>
      </div>
    </div>
  );

  if (detailQ.isLoading || (detailQ.isPending && !detail)) {
    return (
      <div className="min-w-0 space-y-4">
        {header}
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <LoadingBlock />
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {header}

      {/* 页签条独立于 Card（原型门禁）；Flow 带节点计数 */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="content">Approval Content</TabsTrigger>
          <TabsTrigger value="flow">
            Flow History
            <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
              {flowNodes.length + (showCurrentNode ? 1 : 0)}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1：Approval Content */}
        <TabsContent value="content" className="mt-4 space-y-4">
          {/* 摘要卡（原型 DetailField 栅格 + Business Description 分隔区） */}
          <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-4 py-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Approval No.">
                <span className="break-all font-mono">{row.applyCode || <Dash />}</span>
              </DetailField>
              <DetailField label="Business Type">
                {businessName(row.businessCode)}
              </DetailField>
              <DetailField label="Created by">
                {row.createUserName || <Dash />}
              </DetailField>
              <DetailField label="Created on (UTC+8)">
                <span className="tabular-nums">{formatUtc8(row.createTime)}</span>
              </DetailField>
              <DetailField label="Processing Time">
                {effectiveProcessedAt
                  ? formatDuration(effectiveProcessedAt - row.createTime)
                  : <Dash />}
              </DetailField>
              <DetailField label="Processed (UTC+8)">
                <span className="tabular-nums">
                  {effectiveProcessedAt ? formatUtc8(effectiveProcessedAt) : <Dash />}
                </span>
              </DetailField>
              <DetailField label="My comments">
                {effectiveRemarks || <Dash />}
              </DetailField>
            </dl>
            <div className="border-t border-border px-4 py-5">
              <dt className="text-xs font-medium text-muted-foreground">
                Business Description
              </dt>
              <dd className="mt-1 break-words whitespace-pre-line text-sm text-foreground">
                {row.busDesc ? formatBusinessDescription(row.busDesc) : <Dash />}
              </dd>
            </div>
          </section>

          {/* Business Content：变更对比表（KRC/KLS）+ 字段白名单栅格 */}
          <section className="rounded-lg border border-border/60 bg-card p-4">
            <div className="mb-3 text-base font-semibold leading-6 text-foreground">
              Business Content
            </div>
            {changeDefs.length > 0 && (
              <div className="mb-3 overflow-x-auto rounded-lg border border-border/60 p-4">
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
                      const content = detail?.businessContent ?? {};
                      const rawFrom = content[def.fromKey];
                      const rawTo = content[def.toKey];
                      const fromText =
                        rawFrom === null || rawFrom === undefined || rawFrom === ''
                          ? '-'
                          : def.render === 'percent'
                            ? formatPercent(rawFrom)
                            : String(rawFrom);
                      const toText =
                        rawTo === null || rawTo === undefined || rawTo === ''
                          ? '-'
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
              <DetailGrid>
                {fieldDefs.map((def) => {
                  const text = renderFieldValue(
                    def,
                    detail?.businessContent?.[def.key],
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
            ) : (
              <p className="text-sm text-muted-foreground">No business fields</p>
            )}
          </section>

          {/* Review Decision（仅待办任务且能力位允许；原型逐字文案） */}
          {decidable && (
            <section className="rounded-lg border border-border/60 bg-card p-4">
              <div className="mb-3 text-base font-semibold leading-6 text-foreground">
                Review Decision
              </div>
              <label
                htmlFor="approval-comment"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Approval comment
              </label>
              <Textarea
                id="approval-comment"
                rows={3}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  setCommentError('');
                }}
                placeholder="Add the evidence or the reason for your decision."
                aria-invalid={commentError ? true : undefined}
                aria-describedby={commentError ? 'approval-comment-error' : 'approval-comment-help'}
                className={cn(commentError && 'border-destructive focus-visible:ring-destructive')}
              />
              <div className="mt-1 flex min-h-5 items-start justify-between gap-3">
                <span
                  id="approval-comment-help"
                  className={commentError ? 'sr-only' : 'text-xs text-muted-foreground'}
                >
                  A comment is required when rejecting.
                </span>
                {commentError && (
                  <span id="approval-comment-error" role="alert" className="text-sm text-destructive">
                    {commentError}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  disabled={processMutation.isPending}
                  onClick={() => openDecision('reject')}
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  Reject
                </Button>
                <Button
                  type="button"
                  disabled={processMutation.isPending}
                  onClick={() => openDecision('approve')}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Approve
                </Button>
              </div>
            </section>
          )}

          {detailQ.isError && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load business content.</AlertTitle>
            </Alert>
          )}
        </TabsContent>

        {/* Tab 2：Flow History（节点 + 徽章 + 时间右对齐 + 人员 + 意见框） */}
        <TabsContent value="flow" className="mt-4">
          <section className="rounded-lg border border-border/60 bg-card p-4">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold leading-6 text-foreground">
              <History className="size-4 text-muted-foreground" aria-hidden="true" />
              Flow History
            </div>
            {detailQ.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>Failed to load flow history.</AlertTitle>
              </Alert>
            ) : flowNodes.length === 0 && !showCurrentNode ? (
              <p className="text-sm text-muted-foreground">No flow history yet.</p>
            ) : (
              <ol className="m-0 list-none space-y-5 p-0">
                {flowNodes.map((node) => {
                  const result = NODE_RESULT[node.reviewerStatus];
                  return (
                    <li
                      key={node.detailId}
                      className="relative flex gap-4 [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:left-[7px] [&:not(:last-child)]:after:top-5 [&:not(:last-child)]:after:h-full [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-border"
                    >
                      <span
                        aria-hidden
                        className="relative mt-1 inline-block size-4 shrink-0 rounded-full border-4 border-primary/15 bg-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {node.stepName}
                            </span>
                            {result ? (
                              <ProtoStatusBadge tone={result.tone}>
                                {result.label}
                              </ProtoStatusBadge>
                            ) : null}
                          </div>
                          {node.reviewerTime ? (
                            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                              {formatUtc8(node.reviewerTime)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {node.reviewerName || '-'}
                        </div>
                        {node.reviewerRemarks ? (
                          <p className="mt-2 rounded-md bg-muted p-3 text-sm text-foreground">
                            {node.reviewerRemarks}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
                {/* 待办任务的当前节点（原型 current：警示色点 + 无时间） */}
                {showCurrentNode && (
                  <li className="relative flex gap-4">
                    <span
                      aria-hidden
                      className="relative mt-1 inline-block size-4 shrink-0 rounded-full border-4 border-warning/20 bg-warning"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {row.stepName || 'Current Step'}
                        </span>
                        <ProtoStatusBadge tone={statusTone(effectiveLabel)}>
                          {effectiveLabel}
                        </ProtoStatusBadge>
                      </div>
                    </div>
                  </li>
                )}
              </ol>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* 确认弹窗（双段正文 + 语义图标；文案 PROTO_APPROVAL_ACTION_TEXT） */}
      {decisionCopy && decision && (
        <ActionConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setDecision(null);
          }}
          icon={decision === 'approve' ? CheckCircle2 : XCircle}
          variant={decision === 'approve' ? 'confirm' : 'destructive'}
          title={decisionCopy.title}
          body1={decisionCopy.body1}
          body2={decisionCopy.body2}
          confirmLabel={decisionCopy.confirmLabel}
          loading={processMutation.isPending}
          onConfirm={runDecision}
        />
      )}
    </div>
  );
}
