'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
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
import { useRouter } from '@myorg/shared/util-i18n';

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

/** 路由 search param → 正整数（无效/缺失返回 undefined）。 */
function parsePositiveInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 毫秒时间戳 → 本地 YYYY-MM-DD HH:mm:ss；0/空 → '--'（目标约定 §4；源 formatTime 用 '-'）。 */
function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return '--';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
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
  if (typeof value === 'boolean') return value ? '是' : '否';
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
  bankId: '银行ID',
  changeId: '限额变更ID',
  bankName: '银行名称',
  bankCode: '银行编码',
  bic: 'SWIFT BIC',
  singleLimit: '单笔限额',
  dailyLimit: '日累计限额',
  accountConfig: '账户配置',
  status: '状态',
  kycInfo: 'KYC 信息',
  createTime: '创建时间',
  lpName: 'LP 名称',
  lpCode: 'LP 编码',
  pairName: '货币对',
  baseCurrency: '基础币种',
  quoteCurrency: '报价币种',
  baseRate: '基础汇率',
  markupRate: '加价率',
  effectiveRate: '生效汇率',
  orderNo: '结算单号',
  settleAmount: '结算金额',
  orderStatus: '单状态',
  transferAmount: '划转金额',
  targetAccount: '目标账户',
  reason: '原因',
  remarks: '备注',
};

/** 8 类详配：字段顺序即展示顺序（按后端 VO 声明/业务重要性排）；源 FIELD_MAPS。 */
const FIELD_MAPS: Record<string, FieldDef[]> = {
  kissen_bank_onboard: [
    { key: 'bankName', label: '银行名称' },
    { key: 'bankCode', label: '银行编码' },
    { key: 'bic', label: 'SWIFT BIC' },
    { key: 'currencies', label: '支持币种' },
    { key: 'singleLimit', label: '单笔限额' },
    { key: 'dailyLimit', label: '日累计限额' },
    { key: 'accountConfig', label: '账户配置' },
    { key: 'kycInfo', label: 'KYC 信息' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' },
  ],
  kissen_lp_onboard: [
    { key: 'lpName', label: 'LP 名称' },
    { key: 'lpCode', label: 'LP 编码' },
    { key: 'splitRatio', label: '分成比例' },
    { key: 'minLiquidity', label: '最低流动性' },
    { key: 'riskAssessment', label: '风险评估' },
    { key: 'initialPairIds', label: '参与货币对' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' },
  ],
  kissen_lp_pair: [
    { key: 'lpName', label: 'LP 名称' },
    { key: 'sourceCurrency', label: '源币种' },
    { key: 'targetCurrency', label: '目标币种' },
    { key: 'remark', label: '备注' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' },
  ],
  kissen_rate_change: [
    { key: 'sourceCurrency', label: '源币种' },
    { key: 'targetCurrency', label: '目标币种' },
    { key: 'pendingAction', label: '待执行动作' },
    { key: 'markupRate', label: '加价率' },
    { key: 'slippageThreshold', label: '滑点阈值' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' },
    { key: 'pairId', label: '货币对ID' },
  ],
  kissen_pair_toggle: [
    { key: 'sourceCurrency', label: '源币种' },
    { key: 'targetCurrency', label: '目标币种' },
    { key: 'baseRate', label: '基础汇率' },
    { key: 'markupRate', label: '加价率' },
    { key: 'slippageThreshold', label: '滑点阈值' },
    { key: 'pendingAction', label: '待执行动作' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' },
  ],
  kissen_settle_confirm: [
    { key: 'orderId', label: '结算单ID' },
    { key: 'lpName', label: 'LP 名称' },
    { key: 'periodType', label: '结算周期(1 日 / 2 周 / 3 月)' },
    { key: 'periodStart', label: '周期开始' },
    { key: 'periodEnd', label: '周期结束' },
    { key: 'txCount', label: '交易笔数' },
    { key: 'principalTotal', label: '本金合计' },
    { key: 'markupTotal', label: '加价合计' },
    { key: 'adminSplitTotal', label: '管理方分成' },
    { key: 'lpSplitTotal', label: 'LP 分成' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' },
  ],
  kissen_split_transfer: [
    { key: 'transferId', label: '划转ID' },
    { key: 'orderId', label: '结算单ID' },
    { key: 'lpName', label: 'LP 名称' },
    { key: 'direction', label: '划转方向(1 凭预授权 / 2 LP 主动)' },
    { key: 'currency', label: '币种' },
    { key: 'amount', label: '划转金额' },
    { key: 'csTxId', label: '通道交易号' },
    { key: 'status', label: '状态' },
    { key: 'createTime', label: '创建时间' },
  ],
  kissen_limit_change: [
    { key: 'bankName', label: '银行名称' },
    { key: 'oldSingleLimit', label: '原单笔限额' },
    { key: 'oldDailyLimit', label: '原日累计限额' },
    { key: 'newSingleLimit', label: '新单笔限额' },
    { key: 'newDailyLimit', label: '新日累计限额' },
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

/** 描述行（模仿 el-descriptions column=1 border：左标签右值）。 */
function DescRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex border-b last:border-b-0">
      <div className="w-40 shrink-0 bg-muted/40 px-3 py-2 text-sm font-medium text-muted-foreground">
        {label}
      </div>
      <div className="flex-1 px-3 py-2 text-sm">{children}</div>
    </div>
  );
}

function DescBlock({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-lg border">{children}</div>;
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

/* ============================================================ */
/* 审批详情正文（drawer 与路由详情页共用；源 detail-drawer.vue）    */
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
      toast.warning('请填写拒绝原因');
      return;
    }
    if (!window.confirm(approve === 3 ? '确认通过该审批?' : '确认拒绝该审批?'))
      return;
    processMutation.mutate(
      {
        busCode: row.businessCode,
        taskId: row.taskId,
        approve,
        remarks: remarks.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(approve === 3 ? '已通过' : '已拒绝');
          onDone();
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  const onPreviousStep = () => {
    if (!remarks.trim()) {
      toast.warning('退回上一步必须填写退回原因');
      return;
    }
    if (!window.confirm('确认退回上一步?该节点审批意见将作废。')) return;
    prevMutation.mutate(
      { busCode: row.businessCode, taskId: row.taskId, remarks: remarks.trim() },
      {
        onSuccess: () => {
          toast.success('已退回上一步');
          onDone();
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  const onWithdraw = () => {
    if (!window.confirm('撤回后该申请退回重新发起状态,确认撤回?')) return;
    withdrawMutation.mutate(
      {
        busCode: row.businessCode,
        taskId: row.taskId,
        remarks: remarks.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('已撤回');
          onDone();
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  if (isLoading || !detail) {
    return <LoadingBlock />;
  }

  const isDoneRow = row.detailReviewerStatus !== undefined;

  return (
    <div className="space-y-4">
      {/* 头部信息块 */}
      <DescBlock>
        <DescRow label="审批编号">{row.applyCode || '--'}</DescRow>
        <DescRow label="业务类型">{businessName(row.businessCode)}</DescRow>
        <DescRow label="业务描述">{row.busDesc || '--'}</DescRow>
        <DescRow label="当前节点">{row.stepName || '--'}</DescRow>
        <DescRow label="状态">
          <Badge variant={approvalStatusVariant(row.reviewerStatus)}>
            {COMMON_STATUS_MAP[row.reviewerStatus] ?? row.reviewerStatus}
          </Badge>
        </DescRow>
        <DescRow label="申请时间">{formatTime(row.createTime)}</DescRow>
        {isDoneRow && (
          <>
            <DescRow label="处理时间">{formatTime(row.reviewerTime)}</DescRow>
            <DescRow label="我的意见">{row.reviewerRemarks || '--'}</DescRow>
          </>
        )}
      </DescBlock>

      {/* 业务内容（扁平字段） */}
      <div>
        <div className="mb-2 text-sm font-semibold">业务内容</div>
        {flatEntries.length > 0 ? (
          <DescBlock>
            {flatEntries.map(([key, text]) => (
              <DescRow key={key} label={fieldLabelFor(row.businessCode, key)}>
                <span className={isNumericValue(text) ? 'tabular-nums' : undefined}>
                  {text}
                </span>
              </DescRow>
            ))}
          </DescBlock>
        ) : (
          <p className="text-sm text-muted-foreground">暂无业务内容</p>
        )}
      </div>

      {/* 嵌套子块 */}
      {nestedEntries.map(([key, nested]) => (
        <div key={key}>
          <div className="mb-2 text-sm font-semibold text-primary">
            {fieldLabelFor(row.businessCode, key)}
          </div>
          <DescBlock>
            {nested.entries.map(([nk, nv]) => (
              <DescRow key={nk} label={fieldLabelFor(row.businessCode, nk)}>
                <span className={isNumericValue(nv) ? 'tabular-nums' : undefined}>
                  {displayNested(row.businessCode, nk, nv)}
                </span>
              </DescRow>
            ))}
          </DescBlock>
        </div>
      ))}

      {/* 审批操作（仅待办且有可用能力位） */}
      {canOperate && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">审批操作</div>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="请输入审批意见（拒绝 / 退回上一步必填）"
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={submitting} onClick={() => onApprove(3)}>
              通过
            </Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={() => onApprove(2)}
            >
              拒绝
            </Button>
            {canBack && (
              <Button variant="outline" disabled={submitting} onClick={onPreviousStep}>
                退回上一步
              </Button>
            )}
            {canWithdraw && (
              <Button variant="outline" disabled={submitting} onClick={onWithdraw}>
                撤回
              </Button>
            )}
          </div>
        </div>
      )}
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
        header: '审批编号',
        cell: ({ row }) => <span>{row.original.applyCode || '--'}</span>,
      },
      {
        id: 'businessName',
        header: '业务类型',
        cell: ({ row }) => (
          <span>{businessName(row.original.businessCode)}</span>
        ),
      },
      {
        accessorKey: 'busDesc',
        header: '业务描述',
        cell: ({ row }) => (
          <span className="line-clamp-2">{row.original.busDesc || '--'}</span>
        ),
      },
      {
        accessorKey: 'stepName',
        header: '当前节点',
        cell: ({ row }) => <span>{row.original.stepName || '--'}</span>,
      },
      {
        accessorKey: 'createUserName',
        header: '申请人',
        cell: ({ row }) => <span>{row.original.createUserName || '--'}</span>,
      },
      {
        accessorKey: 'createTime',
        header: '申请时间',
        cell: ({ row }) => <span>{formatTime(row.original.createTime)}</span>,
      },
      {
        id: 'status',
        header: '状态',
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
        header: '处理时间',
        cell: ({ row }) => (
          <span>
            {row.original.detailReviewerStatus !== undefined
              ? formatTime(row.original.reviewerTime)
              : '--'}
          </span>
        ),
      },
      {
        id: 'reviewerRemarks',
        header: '我的意见',
        cell: ({ row }) => (
          <span className="line-clamp-2">
            {row.original.detailReviewerStatus !== undefined
              ? row.original.reviewerRemarks || '--'
              : '--'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => {
          const item = row.original;
          if (NO_STRATEGY_BUSINESSES[item.businessCode]) {
            return (
              <Button variant="link" size="sm" className="h-auto p-0" disabled>
                该业务详情待接入
              </Button>
            );
          }
          return (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => openDetail(item)}
            >
              {tab === 'todo' ? '处理' : '查看'}
            </Button>
          );
        },
      },
    ],
    [tab],
  );

  const businessOptions = React.useMemo(
    () => Object.entries(BUSINESS_NAME_MAP).map(([value, label]) => ({ value, label })),
    [],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">查询</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">业务类型</label>
            <Select
              value={businessCode || STATUS_ALL}
              onValueChange={(v) => setBusinessCode(v === STATUS_ALL ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>全部</SelectItem>
                {businessOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">关键字</label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="审批编号 / 业务描述"
            />
          </div>
          {tab === 'done' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">结果</label>
              <Select
                value={doneStatus === undefined ? STATUS_ALL : String(doneStatus)}
                onValueChange={(v) =>
                  setDoneStatus(v === STATUS_ALL ? undefined : Number(v))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>全部</SelectItem>
                  <SelectItem value="3">通过</SelectItem>
                  <SelectItem value="2">拒绝</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">查询</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            重置
          </Button>
        </div>
      </form>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="todo">待办</TabsTrigger>
          <TabsTrigger value="done">已办</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-4">
          <div className="rounded-lg border bg-card shadow-sm">
            <DataTable
              columns={columns}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="暂无数据"
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
        </TabsContent>
      </Tabs>

      <Drawer open={drawerOpen} onOpenChange={(v) => !v && closeDetail()}>
        <DrawerContent className="max-h-[90vh] sm:max-w-[640px]">
          <DrawerHeader>
            <DrawerTitle>
              {activeRow ? `${businessName(activeRow.businessCode)} - 详情` : '详情'}
            </DrawerTitle>
            <DrawerDescription>审批详情</DrawerDescription>
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

/* ============================================================ */
/* 审批详情路由页（源无路由详情，drawer 内联；路由版读 taskId/busCode） */
/* ============================================================ */

export function ApprovalCenterDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = parsePositiveInt(searchParams.get('taskId'));
  const busCode = searchParams.get('busCode') ?? undefined;
  // tab=done → 只读；缺省按待办可操作（与列表 drawer 行为一致）。
  const readonly = searchParams.get('tab') === 'done';

  const row: ApprovalListRow | null =
    taskId && busCode
      ? {
          id: String(taskId),
          taskId,
          businessCode: busCode,
          applyCode: '',
          busDesc: '',
          stepName: '',
          reviewerStatus: 0,
          createUserName: '',
          createTime: 0,
        }
      : null;

  if (!row) {
    return (
      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm text-muted-foreground">缺少审批任务参数（taskId / busCode）。</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/approval-center')}
        >
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-base font-semibold">
          {businessName(row.businessCode)} - 详情
        </div>
        <ApprovalDetailBody
          row={row}
          readonly={readonly}
          onDone={() => router.push('/approval-center')}
        />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/approval-center')}>
          返回
        </Button>
      </div>
    </div>
  );
}
