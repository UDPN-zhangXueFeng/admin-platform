'use client';

/**
 * LP / 流动性业务组页面（源 `kissen-admin-frontend/src/views/onboard/{lp,lp-pair}` +
 * `views/liquidity/pool`；v2.0 token 化全量同步）。
 *
 * 注册页（module-page-registry 契约）：
 *  - lp-info: LpInfoListPage / LpInfoFormPage / LpInfoDetailPage
 *  - lp-pair: LpTokenPairListPage
 *  - pool:    LpPoolListPage
 * v2.0 变更（对照上游 tokenization）：
 *  - LP 模型：splitRatio/minLiquidity/initialPairIds 移除（分成挂 lp-pair、最低
 *    流动性挂 token 级），新增 contact 三件套 + settleCycle。
 *  - lp-pair 端点切换 /manage/lp-token-pair/*；页面展示真实参与状态并提供维护入口。
 *  - pool 页为纯监控视图（水位条 + 预授权快照），零行操作。
 *  - lp-preauth / lp-topup / lp-currency-pair 页面已删除（域内 API 层保留）。
 * v2.1 增量（对照上游 bb9c607d..3c4cfbb，2026-09-08/09）：
 *  - lp 列表：登记 LP 按钮 / Draft 筛选项 / View 退役；门户账号弹窗重发邀请
 *    （新一次性链接 72h 有效，旧链接作废）。
 *  - lp-pair：查看弹窗退役；notApproved Tab 改 Status 筛选（单一列表）；池地址
 *    行默认首6…尾4、点击展开/复制；分成列无覆盖时回落 defaultSplitRatio 展示。
 *  - pool：池页不再展示出款池标识；金额列追加 tokenSymbol；水位分子 =
 *    min(可用授权, 可用余额) + 授权瓶颈可视化。
 * 0c 批次增量（对照上游 4685063..37010e0，2026-09-11）：
 *  - lp form：登记/编辑改独立页（37010e0），新增配池卡（PairPoolEditor +
 *    余额校验 precheck）；详情页改 /manage/lp/full 聚合（参与对改参/停用/
 *    恢复 + Σ 门槛池快照），Freeze/Unfreeze 收敛到列表页。
 *  - pool/dashboard：水位分母换 requiredMinSum（引用地址的生效参与对累计
 *    门槛）；出款池概念退役提示。
 * P3 原型对齐（2026-09-23，行为规格 /tmp/kissen_prototype/udpn-kissen-network-mgt）：
 *  - lp-info 列表/详情（LpOnboardingPage / LpDetailsPage）：Onboard LP 按钮、
 *    Creation Date 筛选（GAP-ADM-08 本地）、Details+⋮ 动作列、Submit/Deactivate/
 *    Activate 三确认弹窗走 proto-ui ActionConfirmDialog；详情改四 Tab（basic/pools/
 *    pairs/operations，?tab= 写 URL 带计数）。
 *  - pool 列表（LiquidityPoolManagementPage 画板⑨）：LP Name/Pool Address/Token
 *    Name/Wallet Balance/Authorized Amount（Avail: 副行）/Liq. Coverage 水位条/
 *    Created on (UTC+8)/Updated on (UTC+8)，无动作列。
 *  - lp-pair 列表（SupportedTokenPairsPage 画板⑩/⑪）：Client Rate / LP Rev. Share
 *    列名、Change LP Revenue Share 表单弹窗、Deactivate/Activate Participation
 *    确认弹窗；新增 LpParticipationDetailPage（lp-pair/detail，GAP-ADM-05 列表行
 *    渲染 + GAP-ADM-02 操作历史静态空表）。
 * 迁移决策（CONVENTIONS）：
 *  - 确认流一律 shared AlertDialog（禁 window.confirm）；错误 toast 唯一出口
 *    sonner（useToast），onError 透出后端 message（对齐源拦截器统一提示）。
 *  - 一次性口令等 secret 仅在 Dialog 内一次性展示 + Copy 按钮。
 *  - LP 选项直接消费 lp 域 hooks（同包内跨域复用）；token 对选项走 lp-pair 域薄调用。
 */
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  CircleCheck,
  CirclePause,
  Copy,
  Info,
  LockKeyhole,
  MoreVertical,
  Percent,
  Plus,
  Send,
  TriangleAlert,
} from 'lucide-react';

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
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  SearchableSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { cn } from '@myorg/shared/util-classnames';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { locales, useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  PRECHECK_REASON_LABEL,
  LP_PAIR_TARGET_STATUS,
  SETTLE_CYCLE_MAP,
  type LpOnboardPair,
  type LpOption,
  type LpPairTokenPairOption,
  type LpPairRow,
  type LpPoolPrecheckResp,
  type LpPoolRow,
  type LpRow,
  type LpSaveReq,
  useChangeLpPairMutation,
  useLpDetailQuery,
  useLpFreezeToggleMutation,
  useLpFullDetailQuery,
  useLpListQuery,
  useLpPairListQuery,
  useLpPairTokenPairOptionsQuery,
  useLpPoolListQuery,
  useLpPoolPrecheckMutation,
  usePortalAccountQuery,
  usePortalAccountResendInviteMutation,
  usePortalAccountResetMutation,
  useSaveLpMutation,
  useSaveLpPairMutation,
  useSetLpPairSplitMutation,
  useSubmitLpOnboardMutation,
  useSubmitLpPairMutation,
  useUpdateLpPairStatusMutation,
} from '@myorg/modules/kissen-admin/data-access';

import {
  ActionConfirmDialog,
  CopyableId,
  Dash,
  ProtoStatusBadge,
  type ProtoStatusTone,
} from './proto-ui';
import {
  formatUtc8DateKey,
  formatPercent,
  formatRate,
  formatTokenAmount as formatProtoTokenAmount,
  formatUtc8,
} from './proto-format';
import {
  PROTO_LP_PAIR_STATUS,
  PROTO_LP_STATUS,
  PROTO_POOL_STATUS,
  protoStatusLabel,
} from './proto-enums';

/* ================================================================== */
/* 共享常量与工具                                                       */
/* ================================================================== */
const PROJECT_ID = KISSEN_PROJECT_ID;

/** 表格行：后端 id（number）被 DataTable 行键覆盖为 string。 */
type LpPairTableRow = Omit<LpPairRow, 'id'> & { id: string };
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const LP_BASE = '/lp-liquidity';

const LBL = {
  query: 'Search',
  reset: 'Reset',
  loading: 'Loading...',
  edit: 'Edit',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving...',
  all: 'All',
} as const;

/** 路由拼装：module + 可选 action(create/edit) + 可选 id。 */
function lpRoute(module: string, action?: string, id?: number): string {
  if (!action) return `${LP_BASE}/${module}`;
  const qs = id != null ? `?id=${id}` : '';
  return `${LP_BASE}/${module}/${action}${qs}`;
}

/** 解析 searchParams.id（>0 的有限数；否则 undefined）。 */
function parseId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}


/**
 * 金额/比例展示：去掉无效尾零（最多 8 位小数）并加千分位分组
 * （对齐源 `views/approval/format.ts` formatMoney）。
 */
function formatAmount(value: number | string | null | undefined): string {
  if (value == null || value === '') return '--';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  const [int, dec] = String(parseFloat(n.toFixed(8))).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}

/** 金额存在 token 上下文时追加 symbol；缺少 symbol 时不猜测币种。 */
function formatTokenAmount(
  value: number | string | null | undefined,
  symbol?: string,
): string {
  const amount = formatAmount(value);
  return symbol && amount !== '--' ? `${amount} ${symbol}` : amount;
}

function InlineInfoTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            title={label}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


/** LP 选项 → 下拉选项（对齐源 `lpName(lpCode)` 展示）。 */
function lpToOptions(list: LpOption[] | undefined): SelectOption[] {
  return (list ?? []).map((o) => ({
    value: String(o.lpId),
    label: `${o.lpName}(${o.lpCode})`,
  }));
}

/* ------------------------------------------------------------------ */
/* 原型口径公共件（P3 对齐：proto-enums + proto-ui 徽章/文案）           */
/* ------------------------------------------------------------------ */

/** LP 入网状态徽章（原型 LpStatus：六态语义色，文案走 PROTO_LP_STATUS）。 */
const LP_STATUS_TONES: Record<number, ProtoStatusTone> = {
  1: 'muted',
  5: 'warning',
  10: 'warning',
  15: 'danger',
  20: 'success',
  50: 'muted',
};

function LpStatusBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={LP_STATUS_TONES[status] ?? 'muted'}>
      {protoStatusLabel(PROTO_LP_STATUS, status)}
    </ProtoStatusBadge>
  );
}

/** 流动性池状态徽章（原型 PoolStatus：四态）。 */
const LP_POOL_STATUS_TONES: Record<number, ProtoStatusTone> = {
  5: 'warning',
  15: 'danger',
  20: 'success',
  50: 'muted',
};

function PoolStatusBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={LP_POOL_STATUS_TONES[status] ?? 'muted'}>
      {protoStatusLabel(PROTO_POOL_STATUS, status)}
    </ProtoStatusBadge>
  );
}

/**
 * LP 参与对状态徽章（原型 PairStatus：四态）。后端草稿态 1（恢复后待重提）
 * 不在原型四态内，按语义显 Draft。
 */
const LP_PAIR_STATUS_TONES: Record<number, ProtoStatusTone> = {
  1: 'muted',
  5: 'warning',
  10: 'warning',
  15: 'danger',
  20: 'success',
  50: 'muted',
};

function LpPairStatusBadge({ status }: { status: number }) {
  return (
    <ProtoStatusBadge tone={LP_PAIR_STATUS_TONES[status] ?? 'muted'}>
      {status === 1 ? 'Draft' : protoStatusLabel(PROTO_LP_PAIR_STATUS, status)}
    </ProtoStatusBadge>
  );
}

/**
 * Operation History 静态列契约（原型 Timestamp (UTC+8)/Operator/Module/Status/
 * Trace ID）。
 * STATIC-FILLER(GAP-ADM-02): operate-log 无按对象（lpId/参与对 id）过滤端点——
 * 先落列契约 + 空表，后端补端点后接真数据。
 */
const LP_OPERATION_COLUMNS: ColumnDef<{ id: string }>[] = [
  { id: 'timestamp', header: 'Timestamp' },
  { id: 'operator', header: 'Operator' },
  { id: 'module', header: 'Module' },
  { id: 'status', header: 'Status' },
  { id: 'traceId', header: 'Trace ID' },
];

/** 只读字段（label + 值；弹窗回显用）。 */
function ReadonlyField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">
        {value == null || value === '' ? '--' : value}
      </div>
    </div>
  );
}

function LoadingBlock() {
  return <div className="py-10 text-center text-sm text-muted-foreground">{LBL.loading}</div>;
}

/** 确认请求（源 window.confirm 语义的 AlertDialog 化）。 */
interface ConfirmRequest {
  title: string;
  description: string;
  actionLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * 受控确认弹窗：AlertDialogCancel 关闭；Action preventDefault 后交由
 * onConfirm 执行异步 mutation（弹窗关闭时机由调用方控制）。
 */
function ConfirmDialog({
  request,
  onDismiss,
}: {
  request: ConfirmRequest | null;
  onDismiss: () => void;
}) {
  return (
    <AlertDialog open={request != null} onOpenChange={(open) => !open && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{request?.cancelLabel ?? LBL.cancel}</AlertDialogCancel>
          <AlertDialogAction
            className={
              request?.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              request?.onConfirm();
            }}
          >
            {request?.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** 单选下拉筛选（change 即查，无查询按钮——对齐源各 index.vue 的 change 自动 reload）。 */
function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium leading-snug">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ================================================================== */
/* lp-info — LP 主数据                                                  */
/* ================================================================== */

interface LpInfoFilter {
  lpName: string;
  lpCode: string;
  status: string;
  /** 创建日期（YYYY-MM-DD，<input type="date"> 值）；仅本地过滤，不下发服务端。 */
  createdFrom: string;
  createdTo: string;
}
const LP_INFO_EMPTY: LpInfoFilter = {
  lpName: '',
  lpCode: '',
  status: '',
  createdFrom: '',
  createdTo: '',
};
interface LpInfoParams {
  lpName?: string;
  lpCode?: string;
  status?: number;
  /** 创建日期区间：不下发服务端（GAP-ADM-08），仅驱动当前页本地过滤。 */
  createdFrom?: string;
  createdTo?: string;
}

function lpInfoFormToParams(f: LpInfoFilter): LpInfoParams {
  const p: LpInfoParams = {};
  if (f.lpName.trim()) p.lpName = f.lpName.trim();
  if (f.lpCode.trim()) p.lpCode = f.lpCode.trim();
  if (f.status) p.status = Number(f.status);
  if (f.createdFrom) p.createdFrom = f.createdFrom;
  if (f.createdTo) p.createdTo = f.createdTo;
  return p;
}

/** 门户账号弹窗目标（status=20 行触发）。 */
interface PortalAccountTarget {
  lpId: number;
  lpCode: string;
  lpName: string;
  /** 重发邀请确认文案回显用（源 props.row.contactEmail）。 */
  contactEmail?: string;
}

/**
 * LP 门户账号弹窗（源 onboard/lp/portal-account-dialog.vue）。
 * 打开即查状态；未开通（KLO 审批未通过）时禁用重置/重发；
 * 重发邀请（确认后新链接 72h 有效、旧链接作废）；重置返回的
 * 一次性口令仅本次展示，提供 Copy。
 */
function PortalAccountDialog({
  target,
  onClose,
}: {
  target: PortalAccountTarget;
  onClose: () => void;
}) {
  const toast = useToast();
  const [resendConfirmOpen, setResendConfirmOpen] = React.useState(false);
  const { data: account, isLoading } = usePortalAccountQuery(
    PROJECT_ID,
    target.lpId,
    true,
  );
  const resetMutation = usePortalAccountResetMutation(PROJECT_ID);
  const resendMutation = usePortalAccountResendInviteMutation(PROJECT_ID);
  const resetResult = resetMutation.data;

  const onReset = React.useCallback(() => {
    resetMutation.mutate(target.lpId, {
      onError: (e) => toast.error((e as Error).message),
    });
  }, [resetMutation, target.lpId, toast]);

  /** 重发邀请（源 onResend：确认后新链接签发，旧待用链接立即作废）。 */
  const confirmResendInvite = React.useCallback(() => {
    resendMutation.mutate(target.lpId, {
      onSuccess: (r) => {
        toast.success(`Invitation email sent to ${r.email}`);
        setResendConfirmOpen(false);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  }, [resendMutation, target.lpId, toast]);

  const onCopy = React.useCallback(() => {
    if (!resetResult) return;
    navigator.clipboard
      .writeText(resetResult.oneTimePassword)
      .then(() => toast.success('Copied'))
      .catch(() => toast.warning('Copy failed; select and copy manually'));
  }, [resetResult, toast]);

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Portal Account — {target.lpName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <Alert>
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <AlertTitle>First portal admin</AlertTitle>
              <AlertDescription>
                Provisioned automatically once the KLO onboarding approval
                passes; an invitation email with a one-time link (valid for
                72 hours to set the password) is sent to the LP contact
                email. Use this dialog to check the status, resend the
                invitation, or reset the initial password.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadonlyField
                label="Status"
                value={
                  account?.provisioned ? (
                    <Badge variant="default">Provisioned</Badge>
                  ) : (
                    <Badge variant="outline">
                      Not Provisioned (KLO approval required)
                    </Badge>
                  )
                }
              />
              <ReadonlyField
                label="Admin Login Name"
                value={
                  account?.loginName ? (
                    <span className="font-mono">{account.loginName}</span>
                  ) : (
                    '--'
                  )
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              LP code for sign-in: <span className="font-mono">{target.lpCode}</span>
            </p>

            {resetResult ? (
              <div className="space-y-2">
                <Alert>
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <AlertTitle>One-time password</AlertTitle>
                  <AlertDescription>
                    Shown only once — copy it now and hand it to the LP. The
                    password must be changed on first sign-in.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
                  <span className="font-mono text-base font-semibold tracking-widest">
                    {resetResult.oneTimePassword}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={onCopy}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sign in with LP code{' '}
                  <span className="font-mono">{resetResult.lpCode}</span> and
                  login name{' '}
                  <span className="font-mono">{resetResult.loginName}</span>.
                </p>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResendConfirmOpen(true)}
                  disabled={!account?.provisioned || resendMutation.isPending}
                >
                  {resendMutation.isPending ? 'Resending…' : 'Resend Invite'}
                </Button>
                <Button
                  type="button"
                  onClick={onReset}
                  disabled={!account?.provisioned || resetMutation.isPending}
                >
                  {resetMutation.isPending ? 'Resetting…' : 'Reset Initial Password'}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
      <ConfirmDialog
        request={
          resendConfirmOpen
            ? {
                title: 'Resend Invite',
                description: `Generate a new invitation link and resend the email to ${
                  target.contactEmail || 'the LP contact email'
                }? The previous link becomes invalid immediately; the new link is valid for 72 hours.`,
                actionLabel: 'Resend',
                onConfirm: confirmResendInvite,
              }
            : null
        }
        onDismiss={() => setResendConfirmOpen(false)}
      />
    </>
  );
}

export function LpInfoListPage() {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, reset, control } = useForm<LpInfoFilter>({
    defaultValues: LP_INFO_EMPTY,
  });
  const [params, setParams] = React.useState<LpInfoParams>(() =>
    lpInfoFormToParams(LP_INFO_EMPTY),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [pageNum, setPageNum] = React.useState(1);
  /** Submit / Deactivate / Activate 确认弹窗态（原型 LP_ACTION_CONFIG 文案）。 */
  const [statusAction, setStatusAction] = React.useState<{
    row: LpRow;
    kind: 'submit' | 'deactivate' | 'activate';
  } | null>(null);
  const [portalTarget, setPortalTarget] = React.useState<PortalAccountTarget | null>(
    null,
  );

  const { data, isLoading, isError, dataUpdatedAt } = useLpListQuery(PROJECT_ID, {
    pageNum,
    pageSize,
    filter: {
      lpName: params.lpName,
      lpCode: params.lpCode,
      status: params.status,
    },
  });
  const submitMutation = useSubmitLpOnboardMutation(PROJECT_ID);
  const freezeMutation = useLpFreezeToggleMutation(PROJECT_ID);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  // STATIC-FILLER(GAP-ADM-08): 后端 LpListFilter 无 createTime 参数——创建日期
  // 筛选仅对当前页行本地过滤（分页 total 不受影响），后端补参后回写服务端。
  const visibleRows = React.useMemo(() => {
    const { createdFrom, createdTo } = params;
    if (!createdFrom && !createdTo) return rows;
    return rows.filter((r) => {
      const day = formatUtc8DateKey(r.createTime);
      if (createdFrom && day < createdFrom) return false;
      if (createdTo && day > createdTo) return false;
      return true;
    });
  }, [rows, params.createdFrom, params.createdTo]);

  const onSearch = React.useCallback((f: LpInfoFilter) => {
    setParams(lpInfoFormToParams(f));
    setPageNum(1);
  }, []);
  const onReset = React.useCallback(() => {
    reset(LP_INFO_EMPTY);
    setParams(lpInfoFormToParams(LP_INFO_EMPTY));
    setPageNum(1);
  }, [reset]);

  /** Submit / Deactivate / Activate 共用确认提交（原型双段文案的执行端）。 */
  const onStatusConfirm = () => {
    if (!statusAction) return;
    const { row, kind } = statusAction;
    if (kind === 'submit') {
      submitMutation.mutate(row.lpId, {
        onSuccess: () => {
          toast.success('Onboarding application submitted');
          setStatusAction(null);
        },
        onError: (e) => toast.error((e as Error).message),
      });
      return;
    }
    // Deactivate/Activate 映射冻结开关（20↔50，立即生效不走审批，规格 R-4）。
    freezeMutation.mutate(
      { targetId: row.lpId, freeze: kind === 'deactivate' },
      {
        onSuccess: () => {
          toast.success(kind === 'deactivate' ? 'Deactivated' : 'Activated');
          setStatusAction(null);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const columns = React.useMemo<
    ColumnDef<LpRow & { id: string }>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      { accessorKey: 'lpCode', header: 'LP Code' },
      {
        accessorKey: 'settleCycle',
        header: 'Settlement Cycle',
        cell: ({ row }) => (
          <span>{SETTLE_CYCLE_MAP[row.original.settleCycle] ?? '--'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <LpStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: 'Created on',
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
          // 原型 LpOnboardingPage：Details 文本按钮 + ⋮ 菜单。菜单按状态：
          // Draft→Edit+Submit；Rejected→Edit；Pending/Under Approval→只读无菜单；
          // Active→Portal Account+Deactivate；Inactive→Activate。
          const menuItems: {
            label: string;
            danger?: boolean;
            disabled?: boolean;
            onSelect: () => void;
          }[] = [];
          if (item.status === 1 || item.status === 15) {
            menuItems.push({
              label: 'Edit',
              onSelect: () => router.push(lpRoute('lp-info', 'edit', item.lpId)),
            });
          }
          if (item.status === 1) {
            menuItems.push({
              label: 'Submit',
              disabled: submitMutation.isPending,
              onSelect: () => setStatusAction({ row: item, kind: 'submit' }),
            });
          }
          if (item.status === 20) {
            menuItems.push({
              label: 'Portal Account',
              onSelect: () =>
                setPortalTarget({
                  lpId: item.lpId,
                  lpCode: item.lpCode,
                  lpName: item.lpName,
                  contactEmail: item.contactEmail,
                }),
            });
            menuItems.push({
              label: 'Deactivate',
              danger: true,
              disabled: freezeMutation.isPending,
              onSelect: () => setStatusAction({ row: item, kind: 'deactivate' }),
            });
          }
          if (item.status === 50) {
            menuItems.push({
              label: 'Activate',
              disabled: freezeMutation.isPending,
              onSelect: () => setStatusAction({ row: item, kind: 'activate' }),
            });
          }
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(lpRoute('lp-info', 'detail', item.lpId))
                }
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
                      aria-label={`Actions for ${item.lpName}`}
                    >
                      <MoreVertical
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {menuItems.map((menuItem) => (
                      <DropdownMenuItem
                        key={menuItem.label}
                        disabled={menuItem.disabled}
                        className={
                          menuItem.danger
                            ? 'text-destructive focus:text-destructive'
                            : undefined
                        }
                        onClick={menuItem.onSelect}
                      >
                        {menuItem.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [router, submitMutation.isPending, freezeMutation.isPending],
  );

  const tableData = React.useMemo(
    () => visibleRows.map((r) => ({ ...r, id: String(r.lpId) })),
    [visibleRows],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              Liquidity Providers
            </div>
            {!isLoading && pagination ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {pagination.total} results
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
            onClick={() => router.push(lpRoute('lp-info', 'create'))}
          >
            Onboard LP
          </Button>
        </div>
        <form
          onSubmit={handleSubmit(onSearch)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              name="lpName"
              label="LP Name"
              placeholder="Fuzzy match"
              register={register('lpName')}
            />
            <FormField
              name="lpCode"
              label="LP Code"
              placeholder="Fuzzy match"
              register={register('lpCode')}
            />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              placeholder={LBL.all}
              options={[1, 5, 10, 15, 20, 50].map((code) => ({
                value: String(code),
                label: protoStatusLabel(PROTO_LP_STATUS, code),
              }))}
            />
            <div className="flex flex-col gap-2">
              <label
                htmlFor="lp-created-from"
                className="text-sm font-medium leading-snug"
              >
                Creation Date
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="lp-created-from"
                  type="date"
                  {...register('createdFrom')}
                />
                <span aria-hidden="true" className="text-muted-foreground">
                  –
                </span>
                <Input type="date" {...register('createdTo')} />
              </div>
              {/* STATIC-FILLER(GAP-ADM-08): 创建日期为当前页本地过滤（见上方 visibleRows）。 */}
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">{LBL.query}</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                {LBL.reset}
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
              emptyMessage="No liquidity providers found."
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      pageSize,
                      total: pagination.total,
                      onPageChange: (page) => setPageNum(page),
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setPageNum(1);
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      {portalTarget && (
        <PortalAccountDialog
          target={portalTarget}
          onClose={() => setPortalTarget(null)}
        />
      )}
      {/* Submit / Deactivate / Activate 确认弹窗（原型 LP_ACTION_CONFIG 文案逐字）。 */}
      <ActionConfirmDialog
        open={statusAction !== null}
        onOpenChange={(open) => {
          if (
            !open &&
            !submitMutation.isPending &&
            !freezeMutation.isPending
          ) {
            setStatusAction(null);
          }
        }}
        icon={
          statusAction?.kind === 'activate'
            ? CircleCheck
            : statusAction?.kind === 'deactivate'
              ? CirclePause
              : Send
        }
        variant={
          statusAction?.kind === 'deactivate' ? 'destructive' : 'confirm'
        }
        title={
          statusAction?.kind === 'activate'
            ? 'Activate Liquidity Provider'
            : statusAction?.kind === 'deactivate'
              ? 'Deactivate Liquidity Provider'
              : 'Submit Onboarding Application'
        }
        body1={
          statusAction
            ? statusAction.kind === 'activate'
              ? `Are you sure you want to activate Liquidity Provider "${statusAction.row.lpName}"?`
              : statusAction.kind === 'deactivate'
                ? `Are you sure you want to deactivate Liquidity Provider "${statusAction.row.lpName}"?`
                : `Are you sure you want to submit the onboarding application for "${statusAction.row.lpName}"?`
            : ''
        }
        body2={
          statusAction?.kind === 'activate'
            ? 'Once activated, this liquidity provider will resume as Active and be included in matching again.'
            : statusAction?.kind === 'deactivate'
              ? 'Once deactivated, this liquidity provider will be immediately disenrolled from matching, new payout requests will be rejected, and matched but unsettled in-flight transactions will be reversed.'
              : 'Once submitted, it will be sent to the Workflow Tasks for review.'
        }
        confirmLabel={
          statusAction?.kind === 'activate'
            ? 'Activate'
            : statusAction?.kind === 'deactivate'
              ? 'Deactivate'
              : 'Submit'
        }
        loading={submitMutation.isPending || freezeMutation.isPending}
        onConfirm={onStatusConfirm}
      />
    </div>
  );
}

/* ================================================================== */
/* PairPoolEditor / PrecheckDialog（源 pair-pool-editor.vue / precheck-dialog.vue，16a3b8f） */
/* ================================================================== */

/** 配池编辑器条目本地态（受控组件值；pairId 用 string 适配 Select）。 */
interface PairPoolEntry {
  rowId: string;
  pairId: string;
  sourceAddress: string;
  sourceMin: string;
  sourceAuth: string;
  targetAddress: string;
  targetMin: string;
  targetAuth: string;
}

const PAIR_POOL_ENTRY_EMPTY: Omit<PairPoolEntry, 'rowId'> = {
  pairId: '',
  sourceAddress: '',
  sourceMin: '',
  sourceAuth: '',
  targetAddress: '',
  targetMin: '',
  targetAuth: '',
};

/** 已保存配池草稿（detail.pairs）→ 编辑器条目回填。 */
function onboardPairToEntry(pair: LpOnboardPair, rowId: string): PairPoolEntry {
  return {
    rowId,
    pairId: String(pair.pairId ?? ''),
    sourceAddress: pair.source?.address ?? '',
    sourceMin: pair.source?.minLiquidity != null ? String(pair.source.minLiquidity) : '',
    sourceAuth: pair.source?.authRequired != null ? String(pair.source.authRequired) : '',
    targetAddress: pair.target?.address ?? '',
    targetMin: pair.target?.minLiquidity != null ? String(pair.target.minLiquidity) : '',
    targetAuth: pair.target?.authRequired != null ? String(pair.target.authRequired) : '',
  };
}

/**
 * 编辑器条目 → 请求体（LpOnboardPair/LpPoolSide）：
 * Min/授权留空即不传（空 = token 对默认 / 不校验，源语义）；不完整返回 null。
 */
function pairPoolEntryToReq(entry: PairPoolEntry): LpOnboardPair | null {
  const pairId = Number(entry.pairId);
  const sourceAddress = entry.sourceAddress.trim();
  const targetAddress = entry.targetAddress.trim();
  if (!Number.isFinite(pairId) || pairId <= 0 || !sourceAddress || !targetAddress) {
    return null;
  }
  const side = (address: string, min: string, auth: string) => ({
    address,
    ...(min.trim() !== '' ? { minLiquidity: min.trim() } : {}),
    ...(auth.trim() !== '' ? { authRequired: auth.trim() } : {}),
  });
  return {
    pairId,
    source: side(sourceAddress, entry.sourceMin, entry.sourceAuth),
    target: side(targetAddress, entry.targetMin, entry.targetAuth),
  };
}

/**
 * 配池编辑器（源 pair-pool-editor.vue）：Token Pair 选择（仅启用对）+ 源/目标
 * 两张 side 卡（池地址必填 / Min 留空按 token 默认 / 授权门槛选填）。
 * 换对保留已填地址并清空自定义 Min；留空时由 token 默认值生效。
 */
function PairPoolEditor({
  entry,
  options,
  onChange,
  onRemove,
  pairLocked = false,
}: {
  entry: PairPoolEntry;
  options: LpPairTokenPairOption[];
  onChange: (next: PairPoolEntry) => void;
  onRemove?: () => void;
  /** 改参场景：token 对不可更换，仅调两侧池参数。 */
  pairLocked?: boolean;
}) {
  const selected = options.find((o) => String(o.pairId) === entry.pairId);
  const pairSelectId = React.useId();
  const pairOptions: SelectOption[] = options.map((o) => ({
    value: String(o.pairId),
    label: `${o.sourceSymbol || o.sourceTokenCode}/${o.targetSymbol || o.targetTokenCode} (${o.sourceBankName || '--'} → ${o.targetBankName || '--'})`,
  }));
  const onPairChange = (pairId: string) => {
    onChange({
      ...entry,
      pairId,
      sourceMin: '',
      targetMin: '',
    });
  };

  const renderSide = (
    sideLabel: 'Source' | 'Target',
    symbol: string | undefined,
    addressKey: 'sourceAddress' | 'targetAddress',
    minKey: 'sourceMin' | 'targetMin',
    authKey: 'sourceAuth' | 'targetAuth',
    minDefault: string | number | null | undefined,
  ) => (
    <div className="flex-1 space-y-3 rounded-md border border-border/50 p-3">
      <div className="text-sm font-medium">
        {sideLabel}
        {symbol ? ` · ${symbol}` : ''}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          Pool Address<span className="ml-0.5 text-destructive">*</span>
        </label>
        <Input
          maxLength={128}
          value={entry[addressKey]}
          onChange={(e) => onChange({ ...entry, [addressKey]: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Min. Liquidity</label>
        <Input
          type="number"
          min={0}
          value={entry[minKey]}
          placeholder={
            minDefault != null && minDefault !== '' ? `Default: ${minDefault}` : 'Token default'
          }
          onChange={(e) => onChange({ ...entry, [minKey]: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Auth Threshold</label>
        <Input
          type="number"
          min={0}
          value={entry[authKey]}
          placeholder="Not checked if empty"
          onChange={(e) => onChange({ ...entry, [authKey]: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={pairSelectId}
            className="mb-1 block text-xs text-muted-foreground"
          >
            Token Pair
          </label>
          {pairLocked && selected ? (
            <div className="text-sm font-medium">
              {selected.sourceSymbol || selected.sourceTokenCode}/
              {selected.targetSymbol || selected.targetTokenCode} (
              {selected.sourceBankName || '--'} → {selected.targetBankName || '--'})
            </div>
          ) : (
            <SearchableSelect
              id={pairSelectId}
              options={pairOptions}
              value={entry.pairId || undefined}
              onValueChange={onPairChange}
              placeholder="Select a token pair"
              searchPlaceholder="Search token pairs"
              emptyMessage="No matching token pairs."
            />
          )}
        </div>
        {onRemove ? (
          <Button type="button" variant="ghost" size="sm" className="mt-5" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {renderSide(
          'Source',
          selected ? selected.sourceSymbol || selected.sourceTokenCode : undefined,
          'sourceAddress',
          'sourceMin',
          'sourceAuth',
          selected?.sourceMinLiquidity,
        )}
        {renderSide(
          'Target',
          selected ? selected.targetSymbol || selected.targetTokenCode : undefined,
          'targetAddress',
          'targetMin',
          'targetAuth',
          selected?.targetMinLiquidity,
        )}
      </div>
    </div>
  );
}

/**
 * 余额预检结果弹窗（源 precheck-dialog.vue）：allPass 结论 alert + 逐地址
 * 实查明细（不可查余额显 Unreachable；结论 = 通过或 reason 映射文案）。
 */
function PrecheckDialog({
  result,
  onClose,
}: {
  result: LpPoolPrecheckResp;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {result.allPass ? 'Balance Check Passed' : 'Balance Check Failed'}
          </DialogTitle>
        </DialogHeader>
        <Alert variant={result.allPass ? 'default' : 'destructive'}>
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <AlertTitle>
            {result.allPass
              ? 'All pool addresses meet the aggregated requirements.'
              : 'Some addresses do not meet the requirements.'}
          </AlertTitle>
          {!result.allPass ? (
            <AlertDescription>
              Ask the LP to top up the pools or increase authorization, then retry.
            </AlertDescription>
          ) : null}
        </Alert>
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-2 py-2">Token</th>
                <th className="px-2 py-2">Pool Address</th>
                <th className="px-2 py-2 text-right">Live Balance</th>
                <th className="px-2 py-2 text-right">Σ Min. Liquidity</th>
                <th className="px-2 py-2 text-right">Σ Auth Threshold</th>
                <th className="px-2 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={`${item.tokenId}-${item.address}`} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">
                    {item.tokenSymbol || item.tokenCode || '--'}
                  </td>
                  <td className="break-all px-2 py-2 font-mono text-xs">{item.address}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {item.balance == null ? (
                      <Badge variant="destructive">Unreachable</Badge>
                    ) : (
                      formatTokenAmount(item.balance, item.tokenSymbol)
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {formatTokenAmount(item.minRequired, item.tokenSymbol)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {item.authRequired == null
                      ? '-'
                      : formatTokenAmount(item.authRequired, item.tokenSymbol)}
                  </td>
                  <td className="px-2 py-2">
                    {item.pass ? (
                      <Badge variant="default">Passed</Badge>
                    ) : (
                      <Badge variant="destructive">
                        {(item.reason && PRECHECK_REASON_LABEL[item.reason]) ||
                          item.reason ||
                          'Failed'}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LpInfoFormValues {
  lpName: string;
  lpCode: string;
  contactName: string;
  contactEmail: string;
  address: string;
  riskAssessment: string;
}

const LP_INFO_SECTIONS = [
  { id: 'lp-info-basic', label: 'Basic Information' },
  { id: 'lp-info-contact', label: 'Contact' },
  { id: 'lp-info-settlement', label: 'Settlement' },
  { id: 'lp-info-risk', label: 'Risk Assessment' },
  { id: 'lp-info-pairs', label: 'Token Pairs & Pools' },
] as const;

type PendingLpInfoNavigation =
  | { type: 'route'; href: string }
  | { type: 'back' };

/**
 * LP 登记/编辑独立页（源 37010e0 form.vue）：基本信息 + 配池卡
 * （PairPoolEditor 列表 + 余额校验 precheck）；编辑态回填已保存配池草稿。
 */
export function LpInfoFormPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const lpId = parseId(searchParams.get('id'));
  const isEdit = lpId != null;

  const { data: detail } = useLpDetailQuery(PROJECT_ID, lpId);
  const saveMutation = useSaveLpMutation(PROJECT_ID);
  const precheckMutation = useLpPoolPrecheckMutation();
  const { data: pairOptionsRaw } = useLpPairTokenPairOptionsQuery(PROJECT_ID, {
    status: 20,
  });
  const pairOptions = pairOptionsRaw ?? [];
  /** 配池草稿（源 37010e0 form.vue pairs；草稿/驳回重提回填）。 */
  const [pairs, setPairs] = React.useState<PairPoolEntry[]>([]);
  const initialPairsRef = React.useRef('[]');
  const nextPairIdRef = React.useRef(0);
  const pageRef = React.useRef<HTMLDivElement>(null);
  const dirtyRef = React.useRef(false);
  const allowPopNavigationRef = React.useRef(false);
  const historyGuardId = React.useId();
  const [activeSection, setActiveSection] = React.useState<string>(
    LP_INFO_SECTIONS[0].id,
  );
  const [pendingNavigation, setPendingNavigation] =
    React.useState<PendingLpInfoNavigation | null>(null);
  const [precheckResult, setPrecheckResult] =
    React.useState<LpPoolPrecheckResp | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isDirty } } =
    useForm<LpInfoFormValues>({
      defaultValues: {
        lpName: '',
        lpCode: '',
        contactName: '',
        contactEmail: '',
        address: '',
        riskAssessment: '',
      },
    });
  const hasUnsavedChanges =
    isDirty || JSON.stringify(pairs) !== initialPairsRef.current;
  dirtyRef.current = hasUnsavedChanges;

  React.useEffect(() => {
    if (!isEdit || !detail) return;
    reset({
      lpName: detail.lpName ?? '',
      lpCode: detail.lpCode ?? '',
      contactName: detail.contactName ?? '',
      contactEmail: detail.contactEmail ?? '',
      address: detail.address ?? '',
      riskAssessment: detail.riskAssessment ?? '',
    });
    const restoredPairs = (detail.pairs ?? []).map((pair, index) =>
      onboardPairToEntry(pair, `saved-${pair.pairId}-${index}`),
    );
    initialPairsRef.current = JSON.stringify(restoredPairs);
    setPairs(restoredPairs);
  }, [detail, isEdit, reset]);

  React.useEffect(() => {
    const scrollRoot = pageRef.current?.parentElement;
    if (!scrollRoot) return;

    const updateActiveSection = () => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const sections = pageRef.current?.querySelectorAll<HTMLElement>(
        '[data-lp-info-section]',
      );
      if (!sections?.length) return;

      let currentId: string = LP_INFO_SECTIONS[0].id;
      const isAtScrollEnd =
        scrollRoot.scrollTop > 0 &&
        scrollRoot.scrollTop + scrollRoot.clientHeight >=
          scrollRoot.scrollHeight - 1;
      if (isAtScrollEnd) {
        currentId = LP_INFO_SECTIONS[LP_INFO_SECTIONS.length - 1].id;
      } else {
        sections.forEach((section) => {
          if (section.getBoundingClientRect().top - rootTop < 120) {
            currentId = section.id;
          }
        });
      }
      setActiveSection((current) =>
        current === currentId ? current : currentId,
      );
    };

    scrollRoot.addEventListener('scroll', updateActiveSection, {
      passive: true,
    });
    updateActiveSection();
    return () => scrollRoot.removeEventListener('scroll', updateActiveSection);
  }, []);

  /** Protect unsaved form values when leaving through the sidebar or browser history. */
  React.useEffect(() => {
    const historyState = window.history.state;
    if (historyState?.lpInfoFormGuard !== historyGuardId) {
      window.history.pushState(
        {
          ...(historyState && typeof historyState === 'object'
            ? historyState
            : {}),
          lpInfoFormGuard: historyGuardId,
        },
        '',
        window.location.href,
      );
    }

    const onDocumentClick = (event: MouseEvent) => {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;

      const targetUrl = new URL(link.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;
      if (
        targetUrl.pathname === window.location.pathname &&
        targetUrl.search === window.location.search
      ) {
        return;
      }

      const pathname = locales.reduce((path, locale) => {
        const prefix = `/${locale}`;
        if (path === prefix) return '/';
        return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
      }, targetUrl.pathname);

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({
        type: 'route',
        href: `${pathname}${targetUrl.search}${targetUrl.hash}`,
      });
    };

    const onPopState = (event: PopStateEvent) => {
      if (allowPopNavigationRef.current) {
        allowPopNavigationRef.current = false;
        return;
      }
      if (
        event.state?.lpInfoFormGuard === historyGuardId ||
        !dirtyRef.current
      ) {
        return;
      }

      event.stopImmediatePropagation();
      setPendingNavigation({ type: 'back' });
      window.history.forward();
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener('popstate', onPopState, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('click', onDocumentClick, true);
      window.removeEventListener('popstate', onPopState, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [historyGuardId]);

  /** 已添加的对必须完整（token 对 + 两端池地址）才能保存/校验（源校验语义）。 */
  const buildPairs = (): LpOnboardPair[] | null => {
    const built = pairs.map(pairPoolEntryToReq);
    if (built.some((p) => p == null)) return null;
    return built as LpOnboardPair[];
  };

  /** 余额校验（源「余额校验」按钮）：编辑态并入该 LP 已生效参与对累计门槛。 */
  const onPrecheck = () => {
    const built = buildPairs();
    if (built == null) {
      toast.warning('Complete every added token pair before checking balances');
      return;
    }
    precheckMutation.mutate(
      { lpId: isEdit ? lpId : undefined, pairs: built },
      {
        onSuccess: setPrecheckResult,
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const onSubmit = handleSubmit((values) => {
    const built = buildPairs();
    if (built == null) {
      toast.warning(
        'Complete every added token pair (pair + both pool addresses) before saving',
      );
      return;
    }
    const req: LpSaveReq = {
      lpName: values.lpName.trim(),
      lpCode: values.lpCode.trim(),
      contactName: values.contactName.trim() || undefined,
      contactEmail: values.contactEmail.trim() || undefined,
      address: values.address.trim() || undefined,
      riskAssessment: values.riskAssessment.trim() || undefined,
      pairs: built,
    };
    if (isEdit && lpId) req.lpId = lpId;
    saveMutation.mutate(req, {
      onSuccess: () => {
        toast.success(isEdit ? 'Saved' : 'Created (Draft)');
        router.push(lpRoute('lp-info'));
      },
      onError: (e) => toast.error((e as Error).message),
    });
  });

  const confirmDiscardChanges = () => {
    const navigation = pendingNavigation;
    setPendingNavigation(null);
    if (!navigation) return;

    if (navigation.type === 'back') {
      allowPopNavigationRef.current = true;
      window.history.back();
      return;
    }

    router.push(navigation.href);
  };

  const discardRequest: ConfirmRequest | null = pendingNavigation
    ? {
        title: 'Discard Changes',
        description:
          'Are you sure you want to discard your changes? Once discarded, the changes you made on this page will be lost.',
        actionLabel: 'Discard Changes',
        cancelLabel: 'Keep Editing',
        destructive: true,
        onConfirm: confirmDiscardChanges,
      }
    : null;

  return (
    <div ref={pageRef} className="w-full space-y-4">
      <header>
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          {isEdit ? 'Edit Liquidity Provider' : 'Onboard Liquidity Provider'}
          {!isEdit ? (
            <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
              Draft Mode
            </Badge>
          ) : null}
        </h1>
        <p className="mt-1.5 max-w-[640px] text-sm text-muted-foreground">
          Register the identity, operational contact and settlement profile of a
          liquidity provider. Saved records enter the list as Draft.
        </p>
      </header>

      <nav
        aria-label="LP onboarding sections"
        className="sticky top-2 z-20 flex w-full flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-background/90 p-1.5 shadow-sm backdrop-blur"
      >
        {LP_INFO_SECTIONS.map((section, index) => {
          const isActive = activeSection === section.id;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                setActiveSection(section.id);
                const page = pageRef.current;
                const scrollRoot = page?.parentElement;
                const target = page?.querySelector(`#${section.id}`);
                if (!scrollRoot || !target) return;

                const scrollMarginTop =
                  Number.parseFloat(
                    window.getComputedStyle(target).scrollMarginTop,
                  ) || 0;
                const top =
                  scrollRoot.scrollTop +
                  target.getBoundingClientRect().top -
                  scrollRoot.getBoundingClientRect().top -
                  scrollMarginTop;
                scrollRoot.scrollTo({
                  top,
                  behavior: window.matchMedia(
                    '(prefers-reduced-motion: reduce)',
                  ).matches
                    ? 'auto'
                    : 'smooth',
                });
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-[18px] items-center justify-center rounded-md bg-muted text-[10px] font-bold',
                  isActive && 'bg-primary text-primary-foreground',
                )}
              >
                {index + 1}
              </span>
              {section.label}
            </a>
          );
        })}
      </nav>

      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <section
          id={LP_INFO_SECTIONS[0].id}
          data-lp-info-section
          className="scroll-mt-16 overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm"
        >
          <div className="flex items-start gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-xs font-bold text-primary">
              1
            </span>
            <div>
              <h2 className="text-sm font-semibold">Basic Information</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Identity of the LP; name and code are required.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div className="space-y-1.5">
              <label htmlFor="lpName" className="text-sm font-medium">
                LP Name<span className="ml-0.5 text-destructive">*</span>
              </label>
              <Input
                id="lpName"
                placeholder="Legal or trade name of the liquidity provider"
                maxLength={64}
                {...register('lpName', {
                  required: 'Please enter the LP name',
                  validate: (value) =>
                    value.trim().length > 0 || 'Please enter the LP name',
                })}
              />
              {errors.lpName && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.lpName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lpCode" className="text-sm font-medium">
                LP Code<span className="ml-0.5 text-destructive">*</span>
              </label>
              <Input
                id="lpCode"
                placeholder="LP code"
                maxLength={32}
                {...register('lpCode', {
                  required: 'Please enter the LP code',
                  validate: (value) =>
                    value.trim().length > 0 || 'Please enter the LP code',
                })}
              />
              {errors.lpCode && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.lpCode.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <section
          id={LP_INFO_SECTIONS[1].id}
          data-lp-info-section
          className="scroll-mt-16 overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm"
        >
          <div className="flex items-start gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-xs font-bold text-primary">
              2
            </span>
            <div>
              <h2 className="text-sm font-semibold">Contact</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Operational contact and mailing address; email is required for
                portal setup and notifications.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div className="space-y-1.5">
              <label htmlFor="contactName" className="text-sm font-medium">
                Contact Name
              </label>
              <Input
                id="contactName"
                placeholder="Full name"
                maxLength={50}
                {...register('contactName')}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="contactEmail" className="text-sm font-medium">
                Contact Email<span className="ml-0.5 text-destructive">*</span>
              </label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="name@company.com"
                maxLength={100}
                {...register('contactEmail', {
                  required: 'Please enter the contact email',
                  validate: (value) =>
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
                    'Invalid email format',
                })}
              />
              {errors.contactEmail && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.contactEmail.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="address" className="text-sm font-medium">
                Address
              </label>
              <Input
                id="address"
                placeholder="Registered address"
                maxLength={300}
                {...register('address')}
              />
            </div>
          </div>
        </section>

        <section
          id={LP_INFO_SECTIONS[2].id}
          data-lp-info-section
          className="scroll-mt-16 overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm"
        >
          <div className="flex items-start gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-xs font-bold text-primary">
              3
            </span>
            <div>
              <h2 className="text-sm font-semibold">Settlement</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Settlement cycle of this LP.
              </p>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="max-w-md space-y-2">
              <label className="text-sm font-medium">Settlement Cycle</label>
              <div className="flex min-h-10 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                <span>
                  {SETTLE_CYCLE_MAP[detail?.settleCycle ?? 3] ?? 'Monthly'}
                </span>
                <LockKeyhole className="size-3.5" aria-hidden="true" />
              </div>
              <p className="text-xs text-muted-foreground">
                To change it later, go to Settlement Cycle Setup.
              </p>
            </div>
          </div>
        </section>

        <section
          id={LP_INFO_SECTIONS[3].id}
          data-lp-info-section
          className="scroll-mt-16 overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-xs font-bold text-primary">
                4
              </span>
              <div>
                <h2 className="text-sm font-semibold">Risk Assessment</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Internal risk evaluation notes (optional).
                </p>
              </div>
            </div>
            <span className="pt-1 text-xs font-medium text-muted-foreground">
              Optional
            </span>
          </div>
          <div className="p-4 sm:p-5">
            <label htmlFor="riskAssessment" className="sr-only">
              Risk Assessment
            </label>
            <Textarea
              id="riskAssessment"
              rows={4}
              {...register('riskAssessment')}
            />
          </div>
        </section>

        <section
          id={LP_INFO_SECTIONS[4].id}
          data-lp-info-section
          className="scroll-mt-16 overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm"
        >
          <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-xs font-bold text-primary">
                5
              </span>
              <div>
                <h2 className="text-sm font-semibold">
                  Supported Token Pairs &amp; Pools
                </h2>
                <p className="mt-1 max-w-[680px] text-xs text-muted-foreground">
                  Register one pool address for each side of every token pair.
                  Leave Min. Liquidity blank to use the token default; leave the
                  auth threshold blank to skip the check. An address shared
                  across pairs is validated against the aggregated requirements.
                  Draft LPs may be saved with no pairs.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pairs.length === 0 || precheckMutation.isPending}
                onClick={onPrecheck}
              >
                {precheckMutation.isPending ? 'Checking...' : 'Balance Check'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const rowId = `new-${nextPairIdRef.current++}`;
                  setPairs((current) => [
                    ...current,
                    { ...PAIR_POOL_ENTRY_EMPTY, rowId },
                  ]);
                }}
              >
                + Add Token Pair
              </Button>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {pairs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                No token pairs added yet
              </div>
            ) : (
              pairs.map((entry) => (
                <PairPoolEditor
                  key={entry.rowId}
                  entry={entry}
                  options={pairOptions}
                  onChange={(next) =>
                    setPairs((current) =>
                      current.map((pair) =>
                        pair.rowId === entry.rowId ? next : pair,
                      ),
                    )
                  }
                  onRemove={() =>
                    setPairs((current) =>
                      current.filter((pair) => pair.rowId !== entry.rowId),
                    )
                  }
                />
              ))
            )}
          </div>
        </section>

        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 text-card-foreground shadow-sm sm:p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const href = lpRoute('lp-info');
              if (dirtyRef.current) {
                setPendingNavigation({ type: 'route', href });
              } else {
                router.push(href);
              }
            }}
            disabled={saveMutation.isPending}
          >
            {LBL.cancel}
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? LBL.saving : LBL.save}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        request={discardRequest}
        onDismiss={() => setPendingNavigation(null)}
      />
      {precheckResult ? (
        <PrecheckDialog
          result={precheckResult}
          onClose={() => setPrecheckResult(null)}
        />
      ) : null}
    </div>
  );
}

type LpInfoDetailTab = 'basic' | 'pools' | 'pairs' | 'operations';

/**
 * LP 详情页（原型 LpDetailsPage：四 Tab basic/pools/pairs/operations，Tab 写
 * ?tab= URL）。base 走 /manage/lp/full 聚合；pools/pairs 列换域列表查询
 * （LpPoolRow/LpPairRow 含授权/费率列，聚合模型缺列，无需 GAP-ADM-08 补齐）。
 * pairs Tab 保留 KLP 维护动作（Change Params/Deactivate/Activate Participation，
 * 原型无此列——本仓能力超集，确认文案逐字用原型 Participation 口径）。
 */
export function LpInfoDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lpId = parseId(searchParams.get('id'));
  const toast = useToast();

  // Tab 状态写 URL（原型同款：basic 缺省不占 query，刷新/分享/后退保持）。
  const tabParam = searchParams.get('tab');
  const activeTab: LpInfoDetailTab =
    tabParam === 'pools' || tabParam === 'pairs' || tabParam === 'operations'
      ? tabParam
      : 'basic';
  const handleTabChange = (next: string) => {
    const qs = new URLSearchParams();
    if (lpId != null) qs.set('id', String(lpId));
    if (next !== 'basic') qs.set('tab', next);
    router.replace(`${lpRoute('lp-info', 'detail')}?${qs.toString()}`, {
      scroll: false,
    });
  };

  const [pairDialog, setPairDialog] = React.useState<PairDialogState | null>(
    null,
  );
  /** Deactivate/Activate Participation 确认弹窗态（原型文案逐字）。 */
  const [statusAction, setStatusAction] = React.useState<{
    row: LpPairTableRow;
    kind: 'deactivate' | 'activate';
  } | null>(null);

  const detailQuery = useLpFullDetailQuery(PROJECT_ID, lpId);
  const poolsQuery = useLpPoolListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: { lpId: lpId ?? 0 },
  });
  const pairsQuery = useLpPairListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: { lpId: lpId ?? 0 },
  });
  const statusMutation = useUpdateLpPairStatusMutation(PROJECT_ID);
  const submitMutation = useSubmitLpPairMutation(PROJECT_ID);

  const refresh = React.useCallback(() => {
    void detailQuery.refetch();
    void pairsQuery.refetch();
    void poolsQuery.refetch();
  }, [detailQuery, pairsQuery, poolsQuery]);

  /** Deactivate/Activate Participation 确认提交（原型：Deactivate=50 立即退出匹配；
   *  Activate=restore(1)+自动重提 KLP，后端无直接激活路径）。 */
  const onStatusConfirm = () => {
    if (!statusAction) return;
    const { row, kind } = statusAction;
    const finish = () => {
      setStatusAction(null);
      refresh();
    };
    if (kind === 'deactivate') {
      statusMutation.mutate(
        { id: Number(row.id), targetStatus: LP_PAIR_TARGET_STATUS.disable },
        {
          onSuccess: () => {
            toast.success('Deactivated');
            finish();
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
      return;
    }
    statusMutation.mutate(
      { id: Number(row.id), targetStatus: LP_PAIR_TARGET_STATUS.restore },
      {
        onSuccess: () => {
          submitMutation.mutate(Number(row.id), {
            onSuccess: () => {
              toast.success('Activated and resubmitted for KLP approval');
              finish();
            },
            onError: (e) => toast.error((e as Error).message),
          });
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  if (!lpId) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <p className="text-sm text-muted-foreground">Missing LP ID</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(lpRoute('lp-info'))}
        >
          Back
        </Button>
      </div>
    );
  }

  const detail = detailQuery.data;
  const base = detail?.base;
  const poolRows = React.useMemo(
    () =>
      (poolsQuery.data?.data ?? []).map((r: LpPoolRow) => ({
        ...r,
        id: String(r.poolId),
      })),
    [poolsQuery.data],
  );
  const pairRows = React.useMemo(
    () =>
      (pairsQuery.data?.data ?? []).map((r: LpPairRow) => ({
        ...r,
        id: String(r.id),
      })),
    [pairsQuery.data],
  );
  const poolTotal =
    poolsQuery.data?.pagination?.total ?? poolRows.length;
  const pairTotal = pairsQuery.data?.pagination?.total ?? pairRows.length;

  /** pools Tab 列 = 列表页去掉 LP Name / Updated on（原型 LpDetailsPage 口径）。 */
  const poolColumns = React.useMemo(
    () =>
      LP_POOL_TABLE_COLUMNS.filter(
        (c) => c.id !== 'lpName' && c.id !== 'snapshotAt',
      ),
    [],
  );

  /** pairs Tab 列（原型列集 + 保留 KLP 维护动作列——本仓超集）。 */
  const pairColumns = React.useMemo<ColumnDef<LpPairTableRow>[]>(
    () => [
      {
        id: 'tokenPair',
        header: 'Token Pair',
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) => <LpPairSummaryCell row={row.original} />,
      },
      {
        accessorKey: 'baseRate',
        header: 'Base Rate',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {formatRate(row.original.baseRate)}
          </span>
        ),
      },
      {
        accessorKey: 'markupRate',
        header: 'Markup Rate',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {formatPercent(Number(row.original.markupRate ?? 0) * 100)}
          </span>
        ),
      },
      {
        id: 'clientRate',
        header: 'Client Rate',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {lpPairUserRateText(row.original)}
          </span>
        ),
      },
      {
        id: 'lpRevShare',
        header: 'LP Rev. Share',
        cell: ({ row }) => {
          const own = Number(row.original.splitRatio);
          return own > 0 ? (
            <span className="block text-right font-mono tabular-nums">
              {formatPercent(own * 100)}
            </span>
          ) : (
            <span className="block text-right">
              <Dash />
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <LpPairStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'createTime',
        header: 'Created on',
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
          // KLP 维护动作（本仓超集，原型 pairs Tab 无此列）：生效对改参/停用，
          // 停用对恢复并自动重提 KLP；改参在途禁用。
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {item.status === 20 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={item.pendingChange || pairDialog != null}
                  onClick={() =>
                    setPairDialog({ mode: 'change', row: item })
                  }
                >
                  Change Params
                </Button>
              ) : null}
              {item.status === 20 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    setStatusAction({ row: item, kind: 'deactivate' })
                  }
                >
                  Deactivate
                </Button>
              ) : null}
              {item.status === 50 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    setStatusAction({ row: item, kind: 'activate' })
                  }
                >
                  Activate
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [statusMutation.isPending, pairDialog],
  );

  const tabCount = (tab: LpInfoDetailTab) => {
    if (tab === 'pools') return poolTotal;
    if (tab === 'pairs') return pairTotal;
    return 0; // operations：GAP-ADM-02 静态空表，恒 0。
  };


  return (
    <div className="space-y-4">
      {/* 单层页头（原型）：Back + 静态标题 + 状态徽章 + 元信息行。 */}
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Back to liquidity providers"
          onClick={() => router.push(lpRoute('lp-info'))}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">Liquidity Provider Details</h1>
            {base ? <LpStatusBadge status={base.status} /> : null}
          </div>
          {base ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                LP Name:{' '}
                <span className="font-semibold text-foreground">
                  {base.lpName}
                </span>
              </span>
              <span aria-hidden="true">|</span>
              <span className="flex items-center gap-1">
                LP Code:{' '}
                <span className="font-semibold text-foreground">
                  {base.lpCode}
                </span>
              </span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Created on {formatUtc8(base.createTime)}
              </span>
            </p>
          ) : null}
        </div>
        {/* pairs 入口（本仓超集：走 KLP 审批的参与对登记）。 */}
        <Button type="button" size="sm" onClick={() => setPairDialog({ mode: 'add' })}>
          <Plus className="size-4" aria-hidden="true" />
          Add Token Pair
        </Button>
      </div>

      {detailQuery.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Failed to load LP details.</AlertTitle>
        </Alert>
      ) : null}
      {!detailQuery.isLoading && !detailQuery.isError && (!detail || !base) ? (
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <p className="text-sm font-medium text-foreground">
            Liquidity provider not found
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The record may have been removed.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(lpRoute('lp-info'))}
          >
            Back
          </Button>
        </div>
      ) : null}

      {base ? (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          {/* 页签条独立于 Card（原型门禁），集合页签带计数（空时原型不显计数）。 */}
          <TabsList>
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            {(
              [
                ['pools', 'Liquidity Pools'],
                ['pairs', 'Token Pairs'],
                ['operations', 'Operation History'],
              ] as const
            ).map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
                {tabCount(value) > 0 ? (
                  <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                    {tabCount(value)}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab 1：basic —— 原型两分区：无标题区（Settlement Cycle/Risk Assessment）
              + Contact Information。 */}
          <TabsContent value="basic" className="mt-0">
            <div className="space-y-4">
              <section className="rounded-xl border border-border bg-card shadow-sm">
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField
                    label="Settlement Cycle"
                    value={SETTLE_CYCLE_MAP[base.settleCycle] ?? <Dash />}
                  />
                  <ReadonlyField
                    label="Risk Assessment"
                    value={base.riskAssessment || <Dash />}
                  />
                </div>
              </section>
              <section className="rounded-xl border border-border bg-card shadow-sm">
                <h2 className="border-b border-border/60 px-6 py-4 text-base font-semibold">
                  Contact Information
                </h2>
                <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
                  <ReadonlyField
                    label="Contact Name"
                    value={base.contactName || <Dash />}
                  />
                  <ReadonlyField
                    label="Contact Email"
                    value={base.contactEmail || <Dash />}
                  />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <ReadonlyField
                      label="Address"
                      value={base.address || <Dash />}
                    />
                  </div>
                </div>
              </section>
            </div>
          </TabsContent>

          {/* Tab 2：pools —— 列集同 Liquidity Pools 列表页（省 LP Name/Updated on）。 */}
          <TabsContent value="pools" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              {poolsQuery.isError ? (
                <div className="p-6">
                  <Alert variant="destructive">
                    <AlertTitle>Failed to load liquidity pools.</AlertTitle>
                  </Alert>
                </div>
              ) : (
                <DataTable
                  columns={poolColumns}
                  data={poolRows}
                  isLoading={poolsQuery.isLoading}
                  emptyMessage="No liquidity pools for this liquidity provider."
                />
              )}
            </section>
          </TabsContent>

          {/* Tab 3：pairs —— 原型列集 + 保留 KLP 维护动作（本仓超集）。 */}
          <TabsContent value="pairs" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              {pairsQuery.isError ? (
                <div className="p-6">
                  <Alert variant="destructive">
                    <AlertTitle>Failed to load token pairs.</AlertTitle>
                  </Alert>
                </div>
              ) : (
                <DataTable
                  columns={pairColumns}
                  data={pairRows}
                  isLoading={pairsQuery.isLoading}
                  emptyMessage="No token pairs for this liquidity provider."
                />
              )}
            </section>
          </TabsContent>

          {/* Tab 4：operations —— 静态空表（GAP-ADM-02）。 */}
          <TabsContent value="operations" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              {/* STATIC-FILLER(GAP-ADM-02): operate-log 无按对象（lpId）过滤端点，
                  静态空表 + 列契约（Timestamp/Operator/Module/Status/Trace ID）。 */}
              <DataTable
                columns={LP_OPERATION_COLUMNS}
                data={[] as { id: string }[]}
                emptyMessage="No operations recorded yet."
              />
            </section>
          </TabsContent>
        </Tabs>
      ) : detailQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : null}

      {pairDialog != null ? (
        <LpPairConfigDialog
          lpId={lpId}
          state={pairDialog}
          onDone={() => {
            setPairDialog(null);
            refresh();
          }}
          onClose={() => setPairDialog(null)}
        />
      ) : null}
      {/* Deactivate/Activate Participation 确认弹窗（原型文案逐字）。 */}
      <ActionConfirmDialog
        open={statusAction !== null}
        onOpenChange={(open) => {
          if (!open && !statusMutation.isPending && !submitMutation.isPending) {
            setStatusAction(null);
          }
        }}
        icon={statusAction?.kind === 'activate' ? CircleCheck : CirclePause}
        variant={
          statusAction?.kind === 'activate' ? 'confirm' : 'destructive'
        }
        title={
          statusAction?.kind === 'activate'
            ? 'Activate Participation'
            : 'Deactivate Participation'
        }
        body1={
          statusAction
            ? `Are you sure you want to ${statusAction.kind} ${statusAction.row.lpName}'s participation in ${lpPairLabel(statusAction.row)}?`
            : ''
        }
        body2={
          statusAction?.kind === 'activate'
            ? "Once activated, the LP's pools will be included in matching candidates for this pair."
            : "Once deactivated, the LP's pools will be immediately excluded from matching candidates for this pair."
        }
        confirmLabel={
          statusAction?.kind === 'activate' ? 'Activate' : 'Deactivate'
        }
        loading={statusMutation.isPending || submitMutation.isPending}
        onConfirm={onStatusConfirm}
      />
    </div>
  );
}

/** 详情页新增/改参与对弹窗状态（change = 生效对改参，token 对锁定）。
 *  row 为结构子集：LpFullPairRow（full 聚合）与 LpPairRow（域列表）均可赋值。 */
type PairChangeRow = {
  id: number | string;
  pairId: number;
  sourcePoolAddress?: string;
  sourceMinLiquidity: string | number | null;
  sourceAuthRequired: string | number | null;
  targetPoolAddress?: string;
  targetMinLiquidity: string | number | null;
  targetAuthRequired: string | number | null;
};
type PairDialogState = { mode: 'add' } | { mode: 'change'; row: PairChangeRow };

/**
 * 新增/改参与对共用弹窗（源 detail.vue add/change Dialog）：
 * Validate & Submit 先走 precheck（不通过弹结果并阻断），add = save + submit
 * （KLP 审批），change = change 申请（通过前现值继续服务）。
 */
function LpPairConfigDialog({
  lpId,
  state,
  onDone,
  onClose,
}: {
  lpId: number;
  state: PairDialogState;
  onDone: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: pairOptionsRaw } = useLpPairTokenPairOptionsQuery(PROJECT_ID, {
    status: 20,
  });
  const pairOptions = pairOptionsRaw ?? [];
  const precheckMutation = useLpPoolPrecheckMutation();
  const saveMutation = useSaveLpPairMutation(PROJECT_ID);
  const submitMutation = useSubmitLpPairMutation(PROJECT_ID);
  const changeMutation = useChangeLpPairMutation(PROJECT_ID);
  const [precheckResult, setPrecheckResult] =
    React.useState<LpPoolPrecheckResp | null>(null);

  const isChange = state.mode === 'change';
  const [entry, setEntry] = React.useState<PairPoolEntry>(() =>
    state.mode === 'change'
      ? {
          rowId: 'pair-change',
          pairId: String(state.row.pairId),
          sourceAddress: state.row.sourcePoolAddress ?? '',
          sourceMin:
            state.row.sourceMinLiquidity != null
              ? String(state.row.sourceMinLiquidity)
              : '',
          sourceAuth:
            state.row.sourceAuthRequired != null
              ? String(state.row.sourceAuthRequired)
              : '',
          targetAddress: state.row.targetPoolAddress ?? '',
          targetMin:
            state.row.targetMinLiquidity != null
              ? String(state.row.targetMinLiquidity)
              : '',
          targetAuth:
            state.row.targetAuthRequired != null
              ? String(state.row.targetAuthRequired)
              : '',
        }
      : { ...PAIR_POOL_ENTRY_EMPTY, rowId: 'pair-add' },
  );

  const pending =
    precheckMutation.isPending ||
    saveMutation.isPending ||
    submitMutation.isPending ||
    changeMutation.isPending;

  const onValidateAndSubmit = () => {
    const req = pairPoolEntryToReq(entry);
    if (!req) {
      toast.warning('Select a token pair and fill in both pool addresses');
      return;
    }
    precheckMutation.mutate(
      { lpId, pairs: [req] },
      {
        onSuccess: (result) => {
          if (!result.allPass) {
            setPrecheckResult(result);
            return;
          }
          if (state.mode === 'change') {
            changeMutation.mutate(
              { id: Number(state.row.id), lpId, source: req.source, target: req.target },
              {
                onSuccess: () => {
                  toast.success('Change request submitted');
                  onDone();
                },
                onError: (e) => toast.error((e as Error).message),
              },
            );
          } else {
            saveMutation.mutate(
              { lpId, pairId: req.pairId, source: req.source, target: req.target },
              {
                onSuccess: (saved) => {
                  submitMutation.mutate(saved.id, {
                    onSuccess: () => {
                      toast.success('Submitted for KLP approval');
                      onDone();
                    },
                    onError: (e) => toast.error((e as Error).message),
                  });
                },
                onError: (e) => toast.error((e as Error).message),
              },
            );
          }
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isChange ? 'Change Pair Params' : 'Add Token Pair'}
            </DialogTitle>
          </DialogHeader>
          <Alert>
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <AlertDescription>
              {isChange
                ? 'The change request goes through KLP approval; current values keep serving until it is approved, and the pool is then updated automatically.'
                : 'The new pair goes through KLP approval and does not take effect until it is approved.'}
            </AlertDescription>
          </Alert>
          <PairPoolEditor
            entry={entry}
            options={pairOptions}
            onChange={setEntry}
            pairLocked={isChange}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {LBL.cancel}
            </Button>
            <Button type="button" onClick={onValidateAndSubmit} disabled={pending}>
              {pending ? 'Submitting...' : 'Validate & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {precheckResult ? (
        <PrecheckDialog result={precheckResult} onClose={() => setPrecheckResult(null)} />
      ) : null}
    </>
  );
}

/* ================================================================== */
/* lp-pair — LP×Token 对参与关系                                        */
/* ================================================================== */

/** 分成百分比输入：1-3 位整数 + 至多 4 位小数；允许空（清除覆盖）。 */
const LP_PAIR_SPLIT_PCT_PATTERN = /^(\d{1,3}(\.\d{1,4})?)?$/;

interface LpPairFilter {
  lpId: string;
  pairId: string;
  /** v2.1：取代 notApproved Tab 的状态下拉（源 el-select，变更即查）。 */
  status: string;
}
const LP_PAIR_FILTER_EMPTY: LpPairFilter = { lpId: '', pairId: '', status: '' };

/**
 * 用户汇率 = 基础汇率 ÷ (1 + 加价率)（与 FX Rate Management 页/GW 口径一致，前端派生；
 * base 缺失/非数 → '-'；markup null/非数按 0）。空串 base 需显式排除——Number('') 会静默转 0。
 */
function lpPairUserRateText(row: Pick<LpPairRow, 'baseRate' | 'markupRate'>): string {
  const raw = row.baseRate;
  const base = raw == null || raw === '' ? Number.NaN : Number(raw);
  if (Number.isNaN(base)) return '-';
  const markupRaw = row.markupRate == null ? 0 : Number(row.markupRate);
  const markup = Number.isNaN(markupRaw) ? 0 : markupRaw;
  return (base / (1 + markup)).toFixed(4);
}


/**
 * Token Pair 单元格（原型 SupportedTokenPairsPage 口径）：主行 `SRC → TGT`，
 * 副行 `Pools: <recv> (Recv) | <pay> (Pay).`（收付两侧池地址 CopyableId
 * 中段省略，点击复制完整地址）。
 */
function LpPairSummaryCell({ row }: { row: LpPairTableRow }) {
  return (
    <div className="space-y-0.5">
      <div className="font-mono text-sm font-semibold">
        {row.sourceCurrency} → {row.targetCurrency}
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        Pools: <CopyableId value={row.sourcePoolAddress} head={6} tail={4} /> (Recv) |{' '}
        <CopyableId value={row.targetPoolAddress} head={6} tail={4} /> (Pay).
      </div>
    </div>
  );
}

/** 参与对标签（弹窗文案用）：`SRC → TGT`（箭头两侧空格，原型口径）。 */
function lpPairLabel(row: Pick<LpPairRow, 'sourceCurrency' | 'targetCurrency'>): string {
  return `${row.sourceCurrency} → ${row.targetCurrency}`;
}

/**
 * Change LP Revenue Share 弹窗（原型 SupportedTokenPairsPage ChangeShareModal
 * 形态逐字）：kv 虚线回显（LP Name/Token Pair/Current Revenue Share）+ 新值
 * 输入（空/0 = 清除覆盖回落标准分成）+ 审批提示横幅。提交走 set-lp-split
 * （KLS 审批，现值继续生效直至新值通过）。
 */
function LpChangeShareDialog({
  row,
  onClosed,
}: {
  row: LpPairTableRow;
  onClosed: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const splitMutation = useSetLpPairSplitMutation(PROJECT_ID);
  // Current 回显：覆盖 splitRatio>0 优先，否则回落 token 对标准分成 defaultSplitRatio。
  const currentPct =
    Number(row.splitRatio) > 0
      ? Number(row.splitRatio) * 100
      : Number(row.defaultSplitRatio) * 100;
  const currentText =
    Number.isFinite(currentPct) && currentPct > 0
      ? formatPercent(currentPct)
      : '-';

  const onSave = React.useCallback(() => {
    const v = value.trim();
    if (!LP_PAIR_SPLIT_PCT_PATTERN.test(v) || Number(v) > 100) {
      setError('Enter a value between 0 and 100.');
      return;
    }
    setError(null);
    const ratio = v === '' || Number(v) === 0 ? 0 : Number(v) / 100;
    splitMutation.mutate(
      { id: Number(row.id), splitRatio: ratio },
      {
        onSuccess: () => {
          toast.success(
            'Revenue share change submitted for approval (KLS); the current value stays effective until approved',
          );
          onClosed();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }, [onClosed, row.id, splitMutation, toast, value]);

  const kvRow = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-border py-2.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClosed()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Percent className="size-4" aria-hidden="true" />
            </span>
            Change LP Revenue Share
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm">
            {kvRow('LP Name', row.lpName)}
            {kvRow('Token Pair', lpPairLabel(row))}
            {kvRow('Current Revenue Share', currentText)}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label
                htmlFor="lp-new-rev-share"
                className="text-sm font-medium leading-snug"
              >
                New Revenue Share
              </label>
              <Input
                id="lp-new-rev-share"
                inputMode="decimal"
                placeholder="Enter a value"
                value={value}
                autoFocus
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
              />
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Enter a value between 0 and 100. Leave empty to fall back to
                  the Standard Revenue Share.
                </p>
              )}
            </div>
            <span
              aria-hidden="true"
              className="pb-2.5 text-sm text-muted-foreground"
            >
              %
            </span>
          </div>
          <Alert>
            <AlertDescription>
              This change requires approval. The current revenue share will
              remain effective until the new value is approved.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClosed}
            disabled={splitMutation.isPending}
          >
            {LBL.cancel}
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={splitMutation.isPending}
          >
            {splitMutation.isPending ? LBL.saving : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Supported Token Pairs 列表（原型 SupportedTokenPairsPage 画板⑩/⑪）：
 * 门户登记口径（参与对由 LP Portal 发起），本页管理状态与 LP 分成。
 * 列：LP Name/Token Pair/Base Rate/Markup Rate/Client Rate/LP Rev. Share/
 * Created on (UTC+8)/Status/Actions（Details + ⋮：Change LP Share/Deactivate/Activate）。
 */
export function LpTokenPairListPage() {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = React.useState<LpPairFilter>(LP_PAIR_FILTER_EMPTY);
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [shareRow, setShareRow] = React.useState<LpPairTableRow | null>(null);
  /** Deactivate/Activate Participation 确认弹窗态（原型文案逐字）。 */
  const [statusAction, setStatusAction] = React.useState<{
    row: LpPairTableRow;
    kind: 'deactivate' | 'activate';
  } | null>(null);

  const { data: lpList } = useLpListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });
  const { data: tokenPairOptions } = useLpPairTokenPairOptionsQuery(PROJECT_ID);

  const { data, isLoading, isError, dataUpdatedAt } = useLpPairListQuery(
    PROJECT_ID,
    {
      pageNum,
      pageSize,
      filter: {
        lpId: filter.lpId ? Number(filter.lpId) : undefined,
        pairId: filter.pairId ? Number(filter.pairId) : undefined,
        status: filter.status ? Number(filter.status) : undefined,
      },
    },
  );
  const statusMutation = useUpdateLpPairStatusMutation(PROJECT_ID);
  const submitMutation = useSubmitLpPairMutation(PROJECT_ID);

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const patchFilter = React.useCallback(
    (patch: Partial<LpPairFilter>) => {
      setFilter((prev) => ({ ...prev, ...patch }));
      setPageNum(1);
    },
    [],
  );

  /** Deactivate/Activate Participation 确认提交（原型：Deactivate=50 立即退出匹配；
   *  Activate=restore(1)+自动重提 KLP，后端无直接激活路径）。 */
  const onStatusConfirm = () => {
    if (!statusAction) return;
    const { row, kind } = statusAction;
    if (kind === 'deactivate') {
      statusMutation.mutate(
        { id: Number(row.id), targetStatus: LP_PAIR_TARGET_STATUS.disable },
        {
          onSuccess: () => {
            toast.success('Deactivated');
            setStatusAction(null);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
      return;
    }
    statusMutation.mutate(
      { id: Number(row.id), targetStatus: LP_PAIR_TARGET_STATUS.restore },
      {
        onSuccess: () => {
          submitMutation.mutate(Number(row.id), {
            onSuccess: () => {
              toast.success('Activated and resubmitted for KLP approval');
              setStatusAction(null);
            },
            onError: (e) => toast.error((e as Error).message),
          });
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const columns = React.useMemo<ColumnDef<LpPairTableRow>[]>(
    () => [
      {
        accessorKey: 'lpName',
        header: 'LP Name',
        meta: { maxWidth: 180 },
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.lpName}</span>
        ),
      },
      {
        id: 'tokenPair',
        header: 'Token Pair',
        meta: { overflow: 'wrap', maxWidth: 220 },
        cell: ({ row }) => <LpPairSummaryCell row={row.original} />,
      },
      {
        accessorKey: 'baseRate',
        header: () => <div className="text-right">Base Rate</div>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {formatRate(row.original.baseRate)}
          </span>
        ),
      },
      {
        accessorKey: 'markupRate',
        header: () => <div className="text-right">Markup Rate</div>,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {formatPercent(Number(row.original.markupRate ?? 0) * 100)}
          </span>
        ),
      },
      {
        id: 'clientRate',
        header: () => <div className="text-right">Client Rate</div>,
        enableSorting: false,
        meta: { overflow: 'none' },
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {lpPairUserRateText(row.original)}
          </span>
        ),
      },
      {
        id: 'lpRevShare',
        header: () => <div className="text-right">LP Rev. Share</div>,
        enableSorting: false,
        meta: { overflow: 'none' },
        cell: ({ row }) => {
          const own = Number(row.original.splitRatio);
          return own > 0 ? (
            <span className="block text-right font-mono tabular-nums">
              {formatPercent(own * 100)}
            </span>
          ) : (
            <span className="block text-right">
              <Dash />
            </span>
          );
        },
      },
      {
        accessorKey: 'createTime',
        header: 'Created on',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatUtc8(row.original.createTime)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <LpPairStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const item = row.original;
          // 原型：Details 文本按钮 + ⋮ 菜单。Active→Change LP Share（分成变更
          // 在途禁用）+Deactivate；Inactive→Activate；其余只读状态无菜单。
          const menuItems: {
            label: string;
            danger?: boolean;
            disabled?: boolean;
            onSelect: () => void;
          }[] = [];
          if (item.status === 20) {
            menuItems.push({
              label: 'Change LP Share',
              disabled: Number(item.pendingSplit) > 0,
              onSelect: () => setShareRow(item),
            });
            menuItems.push({
              label: 'Deactivate',
              danger: true,
              disabled: statusMutation.isPending,
              onSelect: () => setStatusAction({ row: item, kind: 'deactivate' }),
            });
          }
          if (item.status === 50) {
            menuItems.push({
              label: 'Activate',
              disabled: statusMutation.isPending,
              onSelect: () => setStatusAction({ row: item, kind: 'activate' }),
            });
          }
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`${lpRoute('lp-pair', 'detail')}?id=${item.id}`)
                }
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
                      aria-label={`Actions for ${item.lpName} ${lpPairLabel(item)}`}
                    >
                      <MoreVertical
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {menuItems.map((menuItem) => (
                      <DropdownMenuItem
                        key={menuItem.label}
                        disabled={menuItem.disabled}
                        className={
                          menuItem.danger
                            ? 'text-destructive focus:text-destructive'
                            : undefined
                        }
                        onClick={menuItem.onSelect}
                      >
                        {menuItem.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        },
      },
    ],
    [router, statusMutation.isPending],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.id) })),
    [rows],
  );

  const pairOptions: SelectOption[] = (tokenPairOptions ?? []).map((o) => ({
    value: String(o.pairId),
    label: `${o.sourceTokenCode}/${o.targetTokenCode}`,
  }));

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-base font-semibold leading-6 text-foreground">
              <span>Supported Token Pairs</span>
              <InlineInfoTooltip label="Portal-driven enrollment">
                Portal-Driven Enrollment: LP pair enrollments are initiated via
                the LP Portal. This page is for viewing status, pair
                activation/deactivation, and LP revenue share adjustment.
              </InlineInfoTooltip>
            </div>
            {!isLoading && pagination ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {pagination.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="border-b border-border/50 px-4 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="LP Name"
              value={filter.lpId}
              placeholder={LBL.all}
              options={lpToOptions(lpList?.data)}
              onChange={(v) => patchFilter({ lpId: v })}
            />
            <FilterSelect
              label="Token Pair"
              value={filter.pairId}
              placeholder={LBL.all}
              options={pairOptions}
              onChange={(v) => patchFilter({ pairId: v })}
            />
            <FilterSelect
              label="Status"
              value={filter.status}
              placeholder={LBL.all}
              options={[5, 15, 20, 50].map((code) => ({
                value: String(code),
                label: protoStatusLabel(PROTO_LP_PAIR_STATUS, code),
              }))}
              onChange={(v) => patchFilter({ status: v })}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilter(LP_PAIR_FILTER_EMPTY);
                  setPageNum(1);
                }}
              >
                {LBL.reset}
              </Button>
            </div>
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
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No supported token pairs found."
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      pageSize,
                      total: pagination.total,
                      onPageChange: (page) => setPageNum(page),
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setPageNum(1);
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      {shareRow && (
        <LpChangeShareDialog
          row={shareRow}
          onClosed={() => setShareRow(null)}
        />
      )}
      {/* Deactivate/Activate Participation 确认弹窗（原型文案逐字）。 */}
      <ActionConfirmDialog
        open={statusAction !== null}
        onOpenChange={(open) => {
          if (!open && !statusMutation.isPending && !submitMutation.isPending) {
            setStatusAction(null);
          }
        }}
        icon={statusAction?.kind === 'activate' ? CircleCheck : CirclePause}
        variant={statusAction?.kind === 'activate' ? 'confirm' : 'destructive'}
        title={
          statusAction?.kind === 'activate'
            ? 'Activate Participation'
            : 'Deactivate Participation'
        }
        body1={
          statusAction
            ? `Are you sure you want to ${statusAction.kind} ${statusAction.row.lpName}'s participation in ${lpPairLabel(statusAction.row)}?`
            : ''
        }
        body2={
          statusAction?.kind === 'activate'
            ? "Once activated, the LP's pools will be included in matching candidates for this pair."
            : "Once deactivated, the LP's pools will be immediately excluded from matching candidates for this pair."
        }
        confirmLabel={
          statusAction?.kind === 'activate' ? 'Activate' : 'Deactivate'
        }
        loading={statusMutation.isPending || submitMutation.isPending}
        onConfirm={onStatusConfirm}
      />
    </div>
  );
}

/* ================================================================== */
/* pool — LP 资金池（纯监控）                                            */
/* ================================================================== */

/**
 * 金额与 token 单位同行展示（单位小号弱化），等宽半粗、右对齐；
 * 空值展示 '-' 且不追加单位。
 */
function AmountWithToken({
  value,
  token,
}: {
  value: string | number | null | undefined;
  token?: string | null;
}) {
  const hasAmount = value != null && value !== '';
  return (
    <div className="flex items-baseline justify-end gap-1 whitespace-nowrap font-mono text-sm font-semibold tabular-nums">
      {value == null ? (
        <Dash />
      ) : (
        <span>{formatProtoTokenAmount(value)}</span>
      )}
      {hasAmount && token ? (
        <span className="text-xs font-normal text-muted-foreground">
          {token}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Authorized Amount 单元格：主行 authAmount（未设置 → '-'），副行
 * `Avail: <可用预授权> <token>`；可用授权无快照时副行 '-' 并悬浮说明。
 */
function AuthorizedAmountCell({ row }: { row: LpPoolRow }) {
  const token = row.tokenSymbol || row.tokenCode || '';
  return (
    <div className="text-right">
      <AmountWithToken value={row.authAmount} token={token} />
      {row.preauthAvailable == null ? (
        <div className="text-xs text-muted-foreground">
          <span
            title="No pre-authorization snapshot yet"
            className="cursor-default"
          >
            -
          </span>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Avail: {formatProtoTokenAmount(row.preauthAvailable)}
          {token ? ` ${token}` : ''}
        </div>
      )}
    </div>
  );
}

/** 水位条比例：coverage 219% 才满条，45.6% 位置为 100% 刻度线（原型口径）。 */
const POOL_COVERAGE_BAR_SCALE = 0.456;

/**
 * Liq. Coverage 水位单元格（原型 dashboard/LiquidityPoolManagement 同口径）：
 * 分子 = min(可用余额, 可用预授权)（未设置预授权时 = 余额），
 * 分母 = Σ生效参与对最低流动性（requiredMinSum）；分母无效（含未挂参与对）
 * 或分子缺失 → '-'。低水位判定用逐池 remindThreshold（原型列表页为全局
 * 20%，表头 ⓘ 文案保留 20% 原文）。
 */
function PoolCoverageCell({ row }: { row: LpPoolRow }) {
  const balance = Number(row.availableBalanceCache);
  const avail =
    row.preauthAvailable == null ? null : Number(row.preauthAvailable);
  const numerator =
    avail != null && !Number.isNaN(avail) && avail >= 0 && avail < balance
      ? avail
      : balance;
  const requiredMinSum =
    row.requiredMinSum == null ? Number.NaN : Number(row.requiredMinSum);
  const hasCalculation =
    Number.isFinite(numerator) &&
    Number.isFinite(requiredMinSum) &&
    requiredMinSum > 0;
  const percentage = hasCalculation
    ? Math.round((numerator / requiredMinSum) * 100)
    : null;
  // 三档水位色（原型 2026-09-20 口径）：0 → 红，低于提醒阈值 → 琥珀，充足 → 绿。
  const remindThreshold = Number(row.remindThreshold);
  const isLow =
    percentage != null &&
    Number.isFinite(remindThreshold) &&
    percentage < remindThreshold * 100;
  const barTone =
    percentage != null && percentage <= 0
      ? 'bg-destructive'
      : isLow
        ? 'bg-warning'
        : 'bg-success';
  const fillWidth =
    percentage == null
      ? 0
      : Math.min(100, Math.round(percentage * POOL_COVERAGE_BAR_SCALE));

  if (!hasCalculation) {
    return <span className="block text-center text-muted-foreground">-</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="relative h-1.5 w-[130px] shrink-0 rounded bg-muted"
      >
        <span
          className={cn('absolute inset-y-0 left-0 rounded', barTone)}
          style={{ width: `${fillWidth}%` }}
        />
        <span
          className="absolute -inset-y-[3px] w-0.5 bg-muted-foreground/50"
          style={{ left: `${POOL_COVERAGE_BAR_SCALE * 100}%` }}
        />
      </span>
      <span className="w-[52px] text-xs tabular-nums text-muted-foreground">
        {percentage}%
      </span>
      <ProtoStatusBadge tone={isLow ? 'danger' : 'success'}>
        {isLow ? 'Low' : 'Sufficient'}
      </ProtoStatusBadge>
    </div>
  );
}

/**
 * 资金池表列（原型 LiquidityPoolManagement 列集，列表页与 LP 详情 pools Tab
 * 共用；详情页按需剔除 lpName/snapshotAt）。纯监控零操作，无 Actions 列。
 */
const LP_POOL_TABLE_COLUMNS: ColumnDef<LpPoolRow & { id: string }>[] = [
  {
    id: 'lpName',
    accessorKey: 'lpName',
    header: 'LP Name',
    meta: { maxWidth: 180 },
    cell: ({ row }) => (
      <span className="font-semibold">{row.original.lpName}</span>
    ),
  },
  {
    id: 'poolAddress',
    accessorKey: 'accountAddress',
    header: 'Pool Address',
    meta: { overflow: 'wrap', maxWidth: 220 },
    cell: ({ row }) => <CopyableId value={row.original.accountAddress} />,
  },
  {
    id: 'tokenName',
    accessorKey: 'tokenSymbol',
    header: 'Token Name',
    meta: { maxWidth: 140 },
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.original.tokenSymbol || row.original.tokenCode || <Dash />}
      </span>
    ),
  },
  {
    id: 'walletBalance',
    accessorKey: 'availableBalanceCache',
    header: () => <div className="text-right">Wallet Balance</div>,
    enableSorting: false,
    cell: ({ row }) => (
      <AmountWithToken
        value={row.original.availableBalanceCache}
        token={row.original.tokenSymbol || row.original.tokenCode}
      />
    ),
  },
  {
    id: 'authorizedAmount',
    accessorKey: 'authAmount',
    header: () => <div className="text-right">Authorized Amount</div>,
    enableSorting: false,
    cell: ({ row }) => <AuthorizedAmountCell row={row.original} />,
  },
  {
    id: 'coverage',
    header: () => (
      <div className="flex items-center gap-1.5">
        <span>Liq. Coverage</span>
        <InlineInfoTooltip label="Coverage formula">
          <div>
            Liquidity Coverage = min (Available Balance, Available
            Pre-Authorized) ÷ Min. Liquidity
          </div>
          <div>Low Liquidity Threshold: 20%</div>
        </InlineInfoTooltip>
      </div>
    ),
    enableSorting: false,
    cell: ({ row }) => <PoolCoverageCell row={row.original} />,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <PoolStatusBadge status={row.original.status} />,
  },
  {
    id: 'createdOn',
    accessorKey: 'createTime',
    header: 'Created on',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatUtc8(row.original.createTime)}
      </span>
    ),
  },
  {
    id: 'snapshotAt',
    accessorKey: 'balanceUpdateTime',
    header: 'Updated on',
    cell: ({ row }) =>
      row.original.balanceUpdateTime == null ? (
        <Dash />
      ) : (
        <span className="tabular-nums">
          {formatUtc8(row.original.balanceUpdateTime)}
        </span>
      ),
  },
];

/**
 * Liquidity Pools 列表（原型 LiquidityPoolManagementPage）：纯监控视图，
 * 余额/预授权/水位均为网关周期刷新快照；本页零操作。
 */
export function LpPoolListPage() {
  const [filter, setFilter] = React.useState<{
    lpId: string;
    poolAddress: string;
    status: string;
    /** 创建日期（YYYY-MM-DD）：仅本地过滤（GAP-ADM-08），不下发服务端。 */
    createdFrom: string;
    createdTo: string;
  }>({ lpId: '', poolAddress: '', status: '', createdFrom: '', createdTo: '' });
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const { data: lpList } = useLpListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });

  const { data, isLoading, isError, dataUpdatedAt } = useLpPoolListQuery(
    PROJECT_ID,
    {
      pageNum,
      pageSize,
      filter: {
        lpId: filter.lpId ? Number(filter.lpId) : undefined,
        status: filter.status ? Number(filter.status) : undefined,
      },
    },
  );

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  // STATIC-FILLER(GAP-ADM-08): 池地址/创建日期无服务端筛选参数，仅对当前页行
  // 本地过滤（分页 total 不受影响），后端补参后回写服务端。
  const visibleRows = React.useMemo(() => {
    const address = filter.poolAddress.trim().toLowerCase();
    return rows.filter((r) => {
      if (address && !r.accountAddress.toLowerCase().includes(address)) {
        return false;
      }
      const day = formatUtc8DateKey(r.createTime);
      if (filter.createdFrom && day < filter.createdFrom) return false;
      if (filter.createdTo && day > filter.createdTo) return false;
      return true;
    });
  }, [
    rows,
    filter.poolAddress,
    filter.createdFrom,
    filter.createdTo,
  ]);

  const tableData = React.useMemo(
    () => visibleRows.map((r) => ({ ...r, id: String(r.poolId) })),
    [visibleRows],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-base font-semibold leading-6 text-foreground">
              <span>Liquidity Pools</span>
              <InlineInfoTooltip label="Read-only snapshot">
                Pool balances, pre-authorization amounts and liquidity coverage
                are read-only snapshots refreshed periodically from the bank
                Gateway. Pools are registered via LP onboarding and token pair
                configuration.
              </InlineInfoTooltip>
            </div>
            {!isLoading && pagination ? (
              <span className="text-sm text-muted-foreground tabular-nums">
                {pagination.total} results
              </span>
            ) : null}
            {dataUpdatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Updated {formatAdminDateTime(dataUpdatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="border-b border-border/50 px-4 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="LP Name"
              value={filter.lpId}
              placeholder={LBL.all}
              options={lpToOptions(lpList?.data)}
              onChange={(v) => {
                setFilter((prev) => ({ ...prev, lpId: v }));
                setPageNum(1);
              }}
            />
            <div className="space-y-1.5">
              <label
                htmlFor="pool-address-filter"
                className="text-xs font-medium text-muted-foreground"
              >
                Pool Address
              </label>
              <Input
                id="pool-address-filter"
                placeholder="Search pool address"
                value={filter.poolAddress}
                onChange={(e) => {
                  setFilter((prev) => ({
                    ...prev,
                    poolAddress: e.target.value,
                  }));
                  setPageNum(1);
                }}
              />
            </div>
            <FilterSelect
              label="Status"
              value={filter.status}
              placeholder={LBL.all}
              options={[5, 15, 20, 50].map((code) => ({
                value: String(code),
                label: protoStatusLabel(PROTO_POOL_STATUS, code),
              }))}
              onChange={(v) => {
                setFilter((prev) => ({ ...prev, status: v }));
                setPageNum(1);
              }}
            />
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Creation Date
              </span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={filter.createdFrom}
                  onChange={(e) => {
                    setFilter((prev) => ({
                      ...prev,
                      createdFrom: e.target.value,
                    }));
                    setPageNum(1);
                  }}
                />
                <span aria-hidden="true" className="text-muted-foreground">
                  –
                </span>
                <Input
                  type="date"
                  value={filter.createdTo}
                  onChange={(e) => {
                    setFilter((prev) => ({
                      ...prev,
                      createdTo: e.target.value,
                    }));
                    setPageNum(1);
                  }}
                />
              </div>
              {/* STATIC-FILLER(GAP-ADM-08): 地址/创建日期为当前页本地过滤。 */}
            </div>
          </div>
        </div>
        <div className="p-4">
          {isError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load. Refresh to retry.</AlertTitle>
            </Alert>
          ) : (
            <DataTable
              columns={LP_POOL_TABLE_COLUMNS}
              data={tableData}
              isLoading={isLoading}
              emptyMessage="No liquidity pools found."
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      pageSize,
                      total: pagination.total,
                      onPageChange: (page) => setPageNum(page),
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setPageNum(1);
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

/* ================================================================== */
/* lp-pair detail — LP Participation 详情（原型 LpParticipationDetailsPage） */
/* ================================================================== */

type LpParticipationDetailTab = 'basic' | 'operations';

/**
 * LP Participation Details（原型 LpParticipationDetailsPage 画板⑫）：
 * Supported Token Pairs 行 Details 入口；basic（对/双侧池/备注）+ operations。
 */
export function LpParticipationDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const participationId = parseId(searchParams.get('id'));

  // Tab 状态写 URL（原型同款：basic 缺省不占 query，刷新/分享/后退保持）。
  const tabParam = searchParams.get('tab');
  const activeTab: LpParticipationDetailTab =
    tabParam === 'operations' ? tabParam : 'basic';
  const handleTabChange = (next: string) => {
    const qs = new URLSearchParams();
    if (participationId != null) qs.set('id', String(participationId));
    if (next !== 'basic') qs.set('tab', next);
    router.replace(`${lpRoute('lp-pair', 'detail')}?${qs.toString()}`, {
      scroll: false,
    });
  };

  // STATIC-FILLER(GAP-ADM-05): 无单条参与对端点，借参与对列表首页（pageSize 200）
  // 扫行渲染；超出首页或命中失败按 not-found 处理，后端补端点后回写。
  const { data, isLoading, isError } = useLpPairListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });
  const row = (data?.data ?? []).find((r) => r.id === participationId) ?? null;

  if (!participationId) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <p className="text-sm text-muted-foreground">Missing participation ID</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(lpRoute('lp-pair'))}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 单层页头（原型）：Back + 静态标题 + 状态徽章 + 元信息行。 */}
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="outline"
          size="iconSm"
          aria-label="Back to supported token pairs"
          onClick={() => router.push(lpRoute('lp-pair'))}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">LP Participation Details</h1>
            {row ? <LpPairStatusBadge status={row.status} /> : null}
          </div>
          {row ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                LP:{' '}
                <span className="font-semibold text-foreground">
                  {row.lpName}
                </span>
              </span>
              <span aria-hidden="true">|</span>
              <span className="flex items-center gap-1">
                Pair Code: <CopyableId value={row.pairCode} />
              </span>
              <span aria-hidden="true">|</span>
              <span className="tabular-nums">
                Created on {formatUtc8(row.createTime)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Failed to load participation details.</AlertTitle>
        </Alert>
      ) : null}

      {!isLoading && !isError && !row ? (
        <div className="rounded-lg border border-border/60 bg-card p-6">
          <p className="text-sm font-medium text-foreground">
            Participation not found.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The record may have been removed.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(lpRoute('lp-pair'))}
          >
            Back to Supported Token Pairs
          </Button>
        </div>
      ) : null}

      {row ? (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="operations">Operation History</TabsTrigger>
          </TabsList>

          {/* Tab 1：basic —— 对标识 + 双侧池地址 + 备注。 */}
          <TabsContent value="basic" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
                <ReadonlyField
                  label="Token Pair"
                  value={
                    <span className="font-mono">
                      {row.sourceCurrency} → {row.targetCurrency}
                    </span>
                  }
                />
                <ReadonlyField
                  label="Pair Code"
                  value={<CopyableId value={row.pairCode} />}
                />
                <ReadonlyField
                  label="Receive Pool"
                  value={<CopyableId value={row.sourcePoolAddress} />}
                />
                <ReadonlyField
                  label="Pay Pool"
                  value={<CopyableId value={row.targetPoolAddress} />}
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <ReadonlyField
                    label="Remark"
                    value={row.remark || <Dash />}
                  />
                </div>
              </div>
            </section>
          </TabsContent>

          {/* Tab 2：operations —— 操作流水（GAP-ADM-02 静态空表）。 */}
          <TabsContent value="operations" className="mt-0">
            <section className="rounded-xl border border-border bg-card shadow-sm">
              <div className="p-4">
                {/* STATIC-FILLER(GAP-ADM-02): 操作流水接口缺口，静态空表。 */}
                <DataTable
                  columns={LP_OPERATION_COLUMNS}
                  data={[] as { id: string }[]}
                  emptyMessage="No operations recorded yet."
                />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : null}
    </div>
  );
}
