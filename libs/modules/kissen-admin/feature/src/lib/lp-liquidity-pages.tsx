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
import { Copy, Info, TriangleAlert } from 'lucide-react';

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
  createActionColumn,
  type TableRowAction,
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
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect, type SelectOption } from '@myorg/shared/ui-forms';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';

import {
  KISSEN_PROJECT_ID,
  LP_PAIR_STATUS_LABEL,
  LP_PAIR_STATUS_VARIANT,
  LP_PAIR_TARGET_STATUS,
  LP_POOL_STATUS_LABEL,
  LP_POOL_STATUS_VARIANT,
  LP_STATUS_LABEL,
  LP_STATUS_VARIANT,
  PRECHECK_REASON_LABEL,
  SETTLE_CYCLE_MAP,
  type LpFullPairRow,
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
  useTokenListQuery,
  useUpdateLpPairStatusMutation,
} from '@myorg/modules/kissen-admin/data-access';

/* ================================================================== */
/* 共享常量与工具                                                       */
/* ================================================================== */
const PROJECT_ID = KISSEN_PROJECT_ID;

/** 表格行：后端 id（number）被 DataTable 行键覆盖为 string。 */
type LpPairTableRow = Omit<LpPairRow, 'id'> & { id: string };
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

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

/** 时间戳/ISO → 统一管理台日期时间串（后端时间为 ms 时间戳 number；0=未设置 → '--'）。 */
function formatDateTime(
  value: number | string | null | undefined,
): string {
  if (!value) return '--';
  const n = typeof value === 'number' ? value : Number(value);
  const d = Number.isFinite(n) ? new Date(n) : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return formatAdminDateTime(d);
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

/** label map → 筛选下拉选项（仅列源筛选项；对齐源各 index.vue 的 el-option 集合）。 */
function statusFilterOptions(
  labelMap: Record<number, string>,
  statuses: number[],
): SelectOption[] {
  return statuses.map((s) => ({
    value: String(s),
    label: labelMap[s] ?? `Status ${s}`,
  }));
}

/** LP 选项 → 下拉选项（对齐源 `lpName(lpCode)` 展示）。 */
function lpToOptions(list: LpOption[] | undefined): SelectOption[] {
  return (list ?? []).map((o) => ({
    value: String(o.lpId),
    label: `${o.lpName}(${o.lpCode})`,
  }));
}

/** 通用状态 Badge。 */
function StatusBadge({
  status,
  labelMap,
  variantMap,
}: {
  status: number;
  labelMap: Record<number, string>;
  variantMap: Record<number, BadgeVariant>;
}) {
  return (
    <Badge variant={variantMap[status] ?? 'outline'}>
      {labelMap[status] ?? `Status ${status}`}
    </Badge>
  );
}

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
          <AlertDialogCancel>{LBL.cancel}</AlertDialogCancel>
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
}
const LP_INFO_EMPTY: LpInfoFilter = { lpName: '', lpCode: '', status: '' };

/**
 * 状态筛选选项 label（源 2026-09-09：status=1 选项「草稿」；列 badge 仍用
 * LP_STATUS_LABEL 的「Draft」，与源筛选硬编码/列 COMMON_STATUS_MAP 分置一致）。
 */
const LP_INFO_FILTER_STATUS_LABEL: Record<number, string> = {
  ...LP_STATUS_LABEL,
  1: 'Draft',
};

interface LpInfoParams {
  pageNum: number;
  lpName?: string;
  lpCode?: string;
  status?: number;
}

function lpInfoFormToParams(f: LpInfoFilter): LpInfoParams {
  const p: LpInfoParams = { pageNum: 1 };
  if (f.lpName.trim()) p.lpName = f.lpName.trim();
  if (f.lpCode.trim()) p.lpCode = f.lpCode.trim();
  if (f.status) p.status = Number(f.status);
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
  const { register, handleSubmit, reset, control } = useForm<LpInfoFilter>({
    defaultValues: LP_INFO_EMPTY,
  });
  const [params, setParams] = React.useState<LpInfoParams>(() =>
    lpInfoFormToParams(LP_INFO_EMPTY),
  );
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [portalTarget, setPortalTarget] = React.useState<PortalAccountTarget | null>(
    null,
  );

  const { data, isLoading, isError, dataUpdatedAt } = useLpListQuery(PROJECT_ID, {
    pageNum: params.pageNum,
    pageSize,
    filter: {
      lpName: params.lpName,
      lpCode: params.lpCode,
      status: params.status,
    },
  });
  const submitMutation = useSubmitLpOnboardMutation(PROJECT_ID);
  const freezeMutation = useLpFreezeToggleMutation(PROJECT_ID);
  const toast = useToast();

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const onSearch = React.useCallback(
    (f: LpInfoFilter) => setParams(lpInfoFormToParams(f)),
    [],
  );
  const onReset = React.useCallback(() => {
    reset(LP_INFO_EMPTY);
    setParams(lpInfoFormToParams(LP_INFO_EMPTY));
  }, [reset]);

  /** 提交入网（1/15）：进入审批中心待办。 */
  const confirmSubmitOnboard = React.useCallback(
    (row: LpRow) => {
      submitMutation.mutate(row.lpId, {
        onSuccess: () => {
          toast.success('Onboarding application submitted');
          setConfirm(null);
        },
        onError: (e) => toast.error((e as Error).message),
      });
    },
    [submitMutation, toast],
  );

  /** 冻结/解冻（20↔50）：立即生效不走审批（规格 R-4）。 */
  const confirmToggleFreeze = React.useCallback(
    (row: LpRow, freeze: boolean) => {
      freezeMutation.mutate(
        { targetId: row.lpId, freeze },
        {
          onSuccess: () => {
            toast.success(freeze ? 'Frozen' : 'Unfrozen');
            setConfirm(null);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [freezeMutation, toast],
  );

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
        accessorKey: 'riskAssessment',
        header: 'Risk Assessment',
        meta: { maxWidth: 200 },
        cell: ({ row }) => (
          <span>{row.original.riskAssessment || '--'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_STATUS_LABEL}
            variantMap={LP_STATUS_VARIANT}
          />
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Created On',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDateTime(row.original.createTime)}
          </span>
        ),
      },
      createActionColumn<LpRow & { id: string }>((item) => {
        const s = item.status;
        const editable = s === 1 || s === 15;
        // status=20 的 Edit 为禁用态（已审批 LP 页面不可改）；源按钮的
        // title 提示无 TableRowAction 对应字段，随迁移移除（沿 wave-1 裁决）。
        // Details 使用独立只读页；Edit 仍受状态约束。
        const actions: TableRowAction<LpRow & { id: string }>[] = [
          {
            label: 'Details',
            onClick: () => router.push(`/onboard/lp/detail?id=${item.lpId}`),
          },
        ];
        if (editable || s === 20) {
          actions.push({
            label: LBL.edit,
            disabled: s === 20 || submitMutation.isPending,
            onClick: () => router.push(lpRoute('lp-info', 'edit', item.lpId)),
          });
        }
        if (editable) {
          actions.push({
            label: 'Submit Onboarding',
            disabled: submitMutation.isPending,
            onClick: () =>
              setConfirm({
                title: 'Submit Onboarding Application',
                description: `Submit the onboarding application for "${item.lpName}"? It will enter the approval center todo list.`,
                actionLabel: 'Submit',
                onConfirm: () => confirmSubmitOnboard(item),
              }),
          });
        }
        if (s === 20) {
          actions.push(
            {
              label: 'Portal Account',
              onClick: () =>
                setPortalTarget({
                  lpId: item.lpId,
                  lpCode: item.lpCode,
                  lpName: item.lpName,
                  contactEmail: item.contactEmail,
                }),
            },
            {
              label: 'Freeze',
              disabled: freezeMutation.isPending,
              onClick: () =>
                setConfirm({
                  title: 'Freeze LP',
                  description: `Freeze LP "${item.lpName}"? It immediately stops matching, and its new settlement requests will be rejected.`,
                  actionLabel: 'Freeze',
                  destructive: true,
                  onConfirm: () => confirmToggleFreeze(item, true),
                }),
            },
          );
        }
        if (s === 50) {
          actions.push({
            label: 'Unfreeze',
            disabled: freezeMutation.isPending,
            onClick: () =>
              setConfirm({
                title: 'Unfreeze LP',
                description: `Unfreeze LP "${item.lpName}"? It is re-enabled and resumes matching.`,
                actionLabel: 'Unfreeze',
                onConfirm: () => confirmToggleFreeze(item, false),
              }),
          });
        }
        return actions;
      }),
    ],
    [
      router,
      submitMutation.isPending,
      freezeMutation.isPending,
      confirmSubmitOnboard,
      confirmToggleFreeze,
    ],
  );

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.lpId) })),
    [rows],
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
            Register LP
          </Button>
        </div>
        <form
          onSubmit={handleSubmit(onSearch)}
          className="border-b border-border/50 px-4 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField name="lpName" label="LP Name" register={register('lpName')} />
            <FormField name="lpCode" label="LP Code" register={register('lpCode')} />
            <FormSelect
              name="status"
              control={control}
              label="Status"
              placeholder={LBL.all}
              options={statusFilterOptions(
                LP_INFO_FILTER_STATUS_LABEL,
                [1, 5, 10, 15, 20, 50],
              )}
            />
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
              emptyMessage="No LPs yet"
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      pageSize,
                      total: pagination.total,
                      onPageChange: (page) =>
                        setParams((prev) => ({ ...prev, pageNum: page })),
                      onPageSizeChange: (n) => {
                        setPageSize(n);
                        setParams((prev) => ({ ...prev, pageNum: 1 }));
                      },
                      pageSizeOptions: PAGE_SIZE_OPTIONS,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </section>

      <ConfirmDialog request={confirm} onDismiss={() => setConfirm(null)} />
      {portalTarget && (
        <PortalAccountDialog
          target={portalTarget}
          onClose={() => setPortalTarget(null)}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/* PairPoolEditor / PrecheckDialog（源 pair-pool-editor.vue / precheck-dialog.vue，16a3b8f） */
/* ================================================================== */

/** 配池编辑器条目本地态（受控组件值；pairId 用 string 适配 Select）。 */
interface PairPoolEntry {
  pairId: string;
  sourceAddress: string;
  sourceMin: string;
  sourceAuth: string;
  targetAddress: string;
  targetMin: string;
  targetAuth: string;
}

const PAIR_POOL_ENTRY_EMPTY: PairPoolEntry = {
  pairId: '',
  sourceAddress: '',
  sourceMin: '',
  sourceAuth: '',
  targetAddress: '',
  targetMin: '',
  targetAuth: '',
};

/** 已保存配池草稿（detail.pairs）→ 编辑器条目回填。 */
function onboardPairToEntry(pair: LpOnboardPair): PairPoolEntry {
  return {
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
 * 换对保留已填地址，Min 按新对默认预填（源 watch pairId 行为）。
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
  const pairOptions: SelectOption[] = options.map((o) => ({
    value: String(o.pairId),
    label: `${o.sourceSymbol || o.sourceTokenCode}/${o.targetSymbol || o.targetTokenCode} (${o.sourceBankName || '--'} → ${o.targetBankName || '--'})`,
  }));
  const onPairChange = (pairId: string) => {
    const opt = options.find((o) => String(o.pairId) === pairId);
    onChange({
      ...entry,
      pairId,
      sourceMin: opt?.sourceMinLiquidity != null ? String(opt.sourceMinLiquidity) : '',
      targetMin: opt?.targetMinLiquidity != null ? String(opt.targetMinLiquidity) : '',
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
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Token Pair</label>
          {pairLocked && selected ? (
            <div className="text-sm font-medium">
              {selected.sourceSymbol || selected.sourceTokenCode}/
              {selected.targetSymbol || selected.targetTokenCode} (
              {selected.sourceBankName || '--'} → {selected.targetBankName || '--'})
            </div>
          ) : (
            <Select value={entry.pairId || undefined} onValueChange={onPairChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a token pair" />
              </SelectTrigger>
              <SelectContent>
                {pairOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      formatAmount(item.balance)
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {formatAmount(item.minRequired)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {item.authRequired == null ? '-' : formatAmount(item.authRequired)}
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
  const [precheckResult, setPrecheckResult] =
    React.useState<LpPoolPrecheckResp | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } =
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
    setPairs((detail.pairs ?? []).map(onboardPairToEntry));
  }, [detail, isEdit, reset]);

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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-6 text-base font-semibold">
          {isEdit ? 'Edit LP' : 'Add LP'}
        </div>

        {/* §6.4 Section：基本信息 / 联系 / 风评（标题 + 说明 + 分隔）。 */}
        <div className="mb-4">
          <div className="text-sm font-medium">Basic Information</div>
          <p className="text-sm text-muted-foreground">
            Identity of the LP; name and code are required.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              LP Name<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              maxLength={64}
              {...register('lpName', {
                required: 'Please enter the LP name',
                validate: (v) => v.trim().length > 0 || 'Please enter the LP name',
              })}
            />
            {errors.lpName && (
              <p className="text-sm text-destructive" role="alert">
                {errors.lpName.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              LP Code<span className="ml-0.5 text-destructive">*</span>
            </label>
            <Input
              maxLength={32}
              {...register('lpCode', {
                required: 'Please enter the LP code',
                validate: (v) => v.trim().length > 0 || 'Please enter the LP code',
              })}
            />
            {errors.lpCode && (
              <p className="text-sm text-destructive" role="alert">
                {errors.lpCode.message}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 border-t border-border/50 pt-6">
          <div className="mb-4">
            <div className="text-sm font-medium">Contact</div>
            <p className="text-sm text-muted-foreground">
              Operational contact and mailing address (optional).
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Name</label>
            <Input maxLength={50} {...register('contactName')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact Email</label>
            <Input
              maxLength={100}
              {...register('contactEmail', {
                validate: (v) =>
                  !v.trim() ||
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ||
                  'Invalid email format',
              })}
            />
            {errors.contactEmail && (
              <p className="text-sm text-destructive" role="alert">
                {errors.contactEmail.message}
              </p>
            )}
          </div>
        </div>
          <div className="mt-4 space-y-1.5">
            <label className="text-sm font-medium">Address</label>
            <Input maxLength={300} {...register('address')} />
          </div>
        </div>
        <div className="mt-6 border-t border-border/50 pt-6">
          <label htmlFor="riskAssessment" className="block text-sm font-medium">
            Risk Assessment
          </label>
          <p className="mb-4 text-sm text-muted-foreground">
            Internal risk evaluation notes (optional).
          </p>
          <Textarea id="riskAssessment" rows={3} {...register('riskAssessment')} />
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-4">
          <div className="text-base font-semibold">Supported Token Pairs &amp; Pools</div>
          <p className="text-sm text-muted-foreground">
            Register one pool address for each side of every token pair. Leave Min.
            Liquidity blank to use the token default; leave the auth threshold blank to
            skip the check. An address shared across pairs is validated against the
            aggregated requirements. Draft LPs may be saved with no pairs.
          </p>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pairs.length === 0 || precheckMutation.isPending}
            onClick={onPrecheck}
          >
            {precheckMutation.isPending ? 'Checking...' : 'Balance Check'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPairs((prev) => [...prev, { ...PAIR_POOL_ENTRY_EMPTY }])}
          >
            + Add Token Pair
          </Button>
        </div>
        {pairs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No token pairs added yet
          </div>
        ) : (
          <div className="space-y-4">
            {pairs.map((entry, idx) => (
              <PairPoolEditor
                key={idx}
                entry={entry}
                options={pairOptions}
                onChange={(next) =>
                  setPairs((prev) => prev.map((p, i) => (i === idx ? next : p)))
                }
                onRemove={() => setPairs((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between rounded-lg border-border/60 bg-card p-4 text-card-foreground shadow-float">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(lpRoute('lp-info'))}
          disabled={saveMutation.isPending}
        >
          {LBL.cancel}
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? LBL.saving : LBL.save}
        </Button>
      </div>
      {precheckResult ? (
        <PrecheckDialog result={precheckResult} onClose={() => setPrecheckResult(null)} />
      ) : null}
    </form>
  );
}

/**
 * LP 详情页（源 37010e0 detail.vue；GET /manage/lp/full 聚合视图）。
 *
 * 基本信息只读 + 参与 Token 对表（Approved 可改参/停用、Disabled 可恢复并自动
 * 重提 KLP；改参在途禁用）+ 资金池快照（含 Σ min/auth 参照门槛列）。
 * 页头提供「+ Add Token Pair」（走 KLP 审批）。Freeze/Unfreeze 仅列表页提供。
 */
export function LpInfoDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lpId = parseId(searchParams.get('id'));
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [pairDialog, setPairDialog] = React.useState<PairDialogState | null>(null);
  const toast = useToast();

  const detailQuery = useLpFullDetailQuery(PROJECT_ID, lpId);
  const statusMutation = useUpdateLpPairStatusMutation(PROJECT_ID);
  const submitMutation = useSubmitLpPairMutation(PROJECT_ID);

  /** 停用生效对（20 → 50）：立即退出匹配候选，在途交易按状态机继续。 */
  const disablePair = (pair: LpFullPairRow) => {
    statusMutation.mutate(
      { id: pair.id, targetStatus: LP_PAIR_TARGET_STATUS.disable },
      {
        onSuccess: () => {
          toast.success('Disabled');
          setConfirm(null);
          void detailQuery.refetch();
        },
        onError: (e) => {
          setConfirm(null);
          toast.error((e as Error).message);
        },
      },
    );
  };

  /** 恢复停用对（50 → 1）：恢复为草稿并自动重提 KLP 审批。 */
  const enablePair = (pair: LpFullPairRow) => {
    statusMutation.mutate(
      { id: pair.id, targetStatus: LP_PAIR_TARGET_STATUS.restore },
      {
        onSuccess: () => {
          submitMutation.mutate(pair.id, {
            onSuccess: () => {
              toast.success('Restored and resubmitted for KLP approval');
              setConfirm(null);
              void detailQuery.refetch();
            },
            onError: (e) => {
              setConfirm(null);
              toast.error((e as Error).message);
            },
          });
        },
        onError: (e) => {
          setConfirm(null);
          toast.error((e as Error).message);
        },
      },
    );
  };

  if (!lpId) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Invalid LP</AlertTitle>
        <AlertDescription>The LP id is missing or invalid.</AlertDescription>
      </Alert>
    );
  }

  if (detailQuery.isLoading) return <LoadingBlock />;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Failed to load LP details</AlertTitle>
        <AlertDescription>Refresh to retry.</AlertDescription>
      </Alert>
    );
  }

  const { base, pairs, pools } = detailQuery.data;
  const refreshDetail = () => void detailQuery.refetch();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{base.lpName}</h1>
            <span className="font-mono text-sm text-muted-foreground">{base.lpCode}</span>
            <StatusBadge
              status={base.status}
              labelMap={LP_STATUS_LABEL}
              variantMap={LP_STATUS_VARIANT}
            />
          </div>
        </div>
        <Button type="button" onClick={() => setPairDialog({ mode: 'add' })}>
          + Add Token Pair
        </Button>
      </div>

      <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <h2 className="mb-4 text-base font-semibold">Basic Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReadonlyField label="LP Code" value={base.lpCode} />
          <ReadonlyField label="Contact Name" value={base.contactName} />
          <ReadonlyField label="Contact Email" value={base.contactEmail} />
          <ReadonlyField label="Address" value={base.address} />
          <ReadonlyField
            label="Settlement Cycle"
            value={SETTLE_CYCLE_MAP[base.settleCycle] ?? '--'}
          />
          <ReadonlyField label="Created On" value={formatDateTime(base.createTime)} />
          <ReadonlyField label="Risk Assessment" value={base.riskAssessment} />
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Token Pairs</h2>
          <p className="text-sm text-muted-foreground">
            Participation and both-side pool parameters. Changes on approved pairs go
            through KLP approval.
          </p>
        </div>
        {pairs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No participation records
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Token Pair</th>
                  <th className="px-3 py-2">Pool Addresses</th>
                  <th className="px-3 py-2 text-right">Min. Liquidity (Src / Tgt)</th>
                  <th className="px-3 py-2 text-right">Auth Threshold (Src / Tgt)</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((pair) => (
                  <tr key={pair.id} className="border-b last:border-0">
                    <td className="px-3 py-3">
                      <div className="font-medium">
                        {pair.sourceCurrency}/{pair.targetCurrency}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {pair.pairCode}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <LpPairPoolAddressLine
                        label=""
                        address={pair.sourcePoolAddress || '--'}
                        title={pair.sourcePoolAddress || '--'}
                      />
                      <LpPairPoolAddressLine
                        label=""
                        address={pair.targetPoolAddress || '--'}
                        title={pair.targetPoolAddress || '--'}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      <div>{formatAmount(pair.sourceMinLiquidity)}</div>
                      <div>{formatAmount(pair.targetMinLiquidity)}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      <div>
                        {pair.sourceAuthRequired == null
                          ? '-'
                          : formatAmount(pair.sourceAuthRequired)}
                      </div>
                      <div>
                        {pair.targetAuthRequired == null
                          ? '-'
                          : formatAmount(pair.targetAuthRequired)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge
                          status={pair.status}
                          labelMap={LP_PAIR_STATUS_LABEL}
                          variantMap={LP_PAIR_STATUS_VARIANT}
                        />
                        {pair.pendingChange ? (
                          <Badge variant="secondary">Change Pending</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {pair.status === 20 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pair.pendingChange || pairDialog != null}
                            onClick={() => setPairDialog({ mode: 'change', row: pair })}
                          >
                            Change Params
                          </Button>
                        ) : null}
                        {pair.status === 20 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={statusMutation.isPending}
                            onClick={() =>
                              setConfirm({
                                title: 'Disable Token Pair',
                                description:
                                  'The pair immediately leaves the matching and payout candidate set; in-flight transactions continue per the state machine.',
                                actionLabel: 'Disable',
                                destructive: true,
                                onConfirm: () => disablePair(pair),
                              })
                            }
                          >
                            Disable
                          </Button>
                        ) : null}
                        {pair.status === 50 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={statusMutation.isPending}
                            onClick={() =>
                              setConfirm({
                                title: 'Enable Token Pair',
                                description:
                                  'The pair is restored as a draft and automatically resubmitted for KLP approval.',
                                actionLabel: 'Enable',
                                onConfirm: () => enablePair(pair),
                              })
                            }
                          >
                            Enable
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-6 text-card-foreground shadow-float">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Pool Snapshots</h2>
          <p className="text-sm text-muted-foreground">
            Read-only snapshots refreshed from the bank Gateway. Σ requirements are
            aggregated over the approved pairs referencing each address (same scale as
            the balance check).
          </p>
        </div>
        {pools.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No pool snapshots
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Token</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2 text-right">Balance Snapshot</th>
                  <th className="px-3 py-2 text-right">Σ Min. Liquidity</th>
                  <th className="px-3 py-2 text-right">Σ Auth Threshold</th>
                  <th className="px-3 py-2">Updated On</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((pool) => (
                  <tr key={pool.poolId} className="border-b last:border-0">
                    <td className="px-3 py-3">
                      {pool.tokenSymbol || pool.tokenCode || '--'}
                    </td>
                    <td className="px-3 py-3">
                      <LpPairPoolAddressLine
                        label=""
                        address={pool.accountAddress || '--'}
                        title={pool.accountAddress || '--'}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatAmount(pool.availableBalanceCache)}
                      {pool.tokenSymbol ? ` ${pool.tokenSymbol}` : ''}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatAmount(pool.requiredMinSum)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {pool.requiredAuthSum == null
                        ? '-'
                        : formatAmount(pool.requiredAuthSum)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {formatDateTime(pool.balanceUpdateTime)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        status={pool.status}
                        labelMap={LP_POOL_STATUS_LABEL}
                        variantMap={LP_POOL_STATUS_VARIANT}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog request={confirm} onDismiss={() => setConfirm(null)} />
      {pairDialog != null ? (
        <LpPairConfigDialog
          lpId={lpId}
          state={pairDialog}
          onDone={() => {
            setPairDialog(null);
            refreshDetail();
          }}
          onClose={() => setPairDialog(null)}
        />
      ) : null}
    </div>
  );
}

/** 详情页新增/改参与对弹窗状态（change = 生效对改参，token 对锁定）。 */
type PairDialogState = { mode: 'add' } | { mode: 'change'; row: LpFullPairRow };

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
      : { ...PAIR_POOL_ENTRY_EMPTY },
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
              { id: state.row.id, lpId, source: req.source, target: req.target },
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
 * 分成展示（源 v2.1）：覆盖 splitRatio>0 显覆盖%，否则显 token 对默认
 * defaultSplitRatio%（不再显「Default」占位；缺省一并返回 '-'）。
 */
function lpPairSplitText(
  row: Pick<LpPairRow, 'splitRatio' | 'defaultSplitRatio'>,
): string {
  const own = Number(row.splitRatio);
  if (own > 0) return `${(own * 100).toFixed(2)}%`;
  const def = Number(row.defaultSplitRatio);
  return row.defaultSplitRatio != null && Number.isFinite(def)
    ? `${(def * 100).toFixed(2)}%`
    : '-';
}

/**
 * 池地址行（源 v2.1）：默认收起显首6…尾4（长度 ≤12 直显），点击地址切换
 * 展开/收起；复制图标直写剪贴板（两侧地址独立展开，toast 与既有 onCopy 一致）。
 */
function LpPairPoolAddressLine({
  label,
  address,
  title,
}: {
  label: string;
  address: string;
  title: string;
}) {
  const toast = useToast();
  const [expanded, setExpanded] = React.useState(false);
  const text =
    expanded || address.length <= 12
      ? address
      : `${address.slice(0, 6)}…${address.slice(-4)}`;
  const onCopy = React.useCallback(() => {
    navigator.clipboard
      .writeText(address)
      .then(() => toast.success('Copied'))
      .catch(() => toast.warning('Copy failed; select and copy manually'));
  }, [address, toast]);
  return (
    <div
      className="flex items-center gap-1 font-mono text-xs text-muted-foreground"
      title={title}
    >
      <span className="shrink-0">{label}</span>
      <button
        type="button"
        className="cursor-pointer break-all text-left hover:text-primary"
        onClick={() => setExpanded((v) => !v)}
      >
        {text}
      </button>
      <button
        type="button"
        aria-label="Copy address"
        className="shrink-0 cursor-pointer hover:text-primary"
        onClick={onCopy}
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * LP×Token 对紧凑单元格：token 对多行式（tokens/银行/激活池地址；
 * 源 v2.1 移除 pairCode 副行，池地址行可展开/复制，title 显完整地址）。
 */
function LpPairCell({ row }: { row: LpPairTableRow }) {
  return (
    <div className="space-y-0.5">
      <div className="font-mono text-sm font-semibold">
        {row.sourceCurrency} / {row.targetCurrency}
      </div>
      <div className="text-xs text-muted-foreground">
        {row.sourceBankName || '--'} → {row.targetBankName || '--'}
      </div>
      {row.sourcePoolAddress ? (
        <LpPairPoolAddressLine
          label="Source"
          address={row.sourcePoolAddress}
          title={`Source ${row.sourcePoolAddress} — pool address configured on the source side; click the address to expand or collapse`}
        />
      ) : null}
      {row.targetPoolAddress ? (
        <LpPairPoolAddressLine
          label="Target"
          address={row.targetPoolAddress}
          title={`Target ${row.targetPoolAddress} — pool address configured on the target side; click the address to expand or collapse`}
        />
      ) : null}
    </div>
  );
}

/** Override split change dialog (source lp-pair/index.vue prompt; 2023418: submits a KLS approval — empty/0 clears the override and falls back to the pair default). */
function LpPairSplitDialog({
  row,
  onClosed,
}: {
  row: LpPairTableRow;
  onClosed: () => void;
}) {
  const toast = useToast();
  const currentPct =
    Number(row.splitRatio) > 0 ? (Number(row.splitRatio) * 100).toFixed(2) : '';
  const [value, setValue] = React.useState(currentPct);
  const [error, setError] = React.useState<string | null>(null);
  const splitMutation = useSetLpPairSplitMutation(PROJECT_ID);

  const onSave = React.useCallback(() => {
    const v = value.trim();
    if (!LP_PAIR_SPLIT_PCT_PATTERN.test(v)) {
      setError('Enter a percentage between 0 and 100, e.g. 30 for 30%');
      return;
    }
    setError(null);
    const ratio = v === '' || Number(v) === 0 ? 0 : Number(v) / 100;
    splitMutation.mutate(
      { id: Number(row.id), splitRatio: ratio },
      {
        onSuccess: () => {
          toast.success(
            'LP split change submitted for approval (KLS); the current value stays effective until approved',
          );
          onClosed();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }, [onClosed, row.id, splitMutation, toast, value]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClosed()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Set LP Split</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Set the LP share of the markup override for {row.lpName} ·{' '}
            {row.sourceCurrency}/{row.targetCurrency}. Leave empty or enter 0
            to clear the override and fall back to the token pair default
            split. The change requires approval; The current value remains
            effective until approved.
          </p>
          <FormField
            name="lpPairSplitPercent"
            label="LP Split (%)"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            error={error ?? undefined}
            inputMode="decimal"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClosed}>
            {LBL.cancel}
          </Button>
          <Button type="button" onClick={onSave} disabled={splitMutation.isPending}>
            {splitMutation.isPending ? LBL.saving : LBL.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * LP×Token 对参与列表（源 onboard/lp-pair/index.vue）。
 * 参与对由管理侧维护并沿用真实 KLP 审批接口；本页展示状态并提供分成、
 * 停用/恢复等既有管理操作（v2.1：查看弹窗退役，notApproved Tab 改 Status 筛选）。
 */
export function LpTokenPairListPage() {
  const [filter, setFilter] = React.useState<LpPairFilter>(LP_PAIR_FILTER_EMPTY);
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [splitRow, setSplitRow] = React.useState<LpPairTableRow | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);

  const { data: lpList } = useLpListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });
  const { data: tokenPairOptions } = useLpPairTokenPairOptionsQuery(PROJECT_ID);

  const { data, isLoading, isError, dataUpdatedAt } = useLpPairListQuery(PROJECT_ID, {
    pageNum,
    pageSize,
    filter: {
      lpId: filter.lpId ? Number(filter.lpId) : undefined,
      pairId: filter.pairId ? Number(filter.pairId) : undefined,
      status: filter.status ? Number(filter.status) : undefined,
    },
  });
  const statusMutation = useUpdateLpPairStatusMutation(PROJECT_ID);
  const toast = useToast();

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const patchFilter = React.useCallback(
    (patch: Partial<LpPairFilter>) => {
      setFilter((prev) => ({ ...prev, ...patch }));
      setPageNum(1);
    },
    [],
  );

  /** 停用（仅 20）：targetStatus=50，立即移出匹配候选。 */
  const confirmDisable = React.useCallback(
    (row: LpPairTableRow) => {
      statusMutation.mutate(
        { id: Number(row.id), targetStatus: LP_PAIR_TARGET_STATUS.disable },
        {
          onSuccess: () => {
            toast.success('Disabled');
            setConfirm(null);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [statusMutation, toast],
  );

  /** 恢复草稿（仅 50）：targetStatus=1，回到草稿待重新提交审批。 */
  const confirmRestore = React.useCallback(
    (row: LpPairTableRow) => {
      statusMutation.mutate(
        { id: Number(row.id), targetStatus: LP_PAIR_TARGET_STATUS.restore },
        {
          onSuccess: () => {
            toast.success('Restored to draft');
            setConfirm(null);
          },
          onError: (e) => toast.error((e as Error).message),
        },
      );
    },
    [statusMutation, toast],
  );

  const columns = React.useMemo<
    ColumnDef<LpPairTableRow>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      {
        id: 'tokenPair',
        header: 'Token Pair',
        cell: ({ row }) => <LpPairCell row={row.original} />,
      },
      {
        accessorKey: 'baseRate',
        header: 'Base Rate',
        cell: ({ row }) => {
          const raw = row.original.baseRate;
          const n = raw == null || raw === '' ? Number.NaN : Number(raw);
          return (
            <span className="block text-right font-mono tabular-nums">
              {Number.isNaN(n) ? '-' : n.toFixed(4)}
            </span>
          );
        },
      },
      {
        accessorKey: 'markupRate',
        header: 'Markup Rate',
        cell: ({ row }) => {
          const n =
            row.original.markupRate == null ? 0 : Number(row.original.markupRate);
          return (
            <span className="block text-right font-mono tabular-nums">
              {(n * 100).toFixed(2)}%
            </span>
          );
        },
      },
      {
        id: 'userRate',
        header: 'User Rate',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {lpPairUserRateText(row.original)}
          </span>
        ),
      },
      {
        accessorKey: 'splitRatio',
        header: 'LP Split',
        cell: ({ row }) => {
          const own = Number(row.original.splitRatio);
          return (
            <span
              className="block text-right font-mono tabular-nums"
              title={own > 0 ? 'LP override split' : 'Token pair default split'}
            >
              {lpPairSplitText(row.original)}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_PAIR_STATUS_LABEL}
            variantMap={LP_PAIR_STATUS_VARIANT}
          />
        ),
      },
      {
        accessorKey: 'createTime',
        header: 'Created On',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatDateTime(row.original.createTime)}
          </span>
        ),
      },
      createActionColumn<LpPairTableRow>((item) => {
        const s = item.status;
        const pairLabel = `${item.sourceCurrency}/${item.targetCurrency}`;
        const actions: TableRowAction<LpPairTableRow>[] = [];
        if (s === 20) {
          actions.push(
            {
              label: Number(item.pendingSplit) > 0 ? 'Split In Approval' : 'Set LP Split',
              disabled: statusMutation.isPending || Number(item.pendingSplit) > 0,
              onClick: () => setSplitRow(item),
            },
            {
              label: 'Disable',
              disabled: statusMutation.isPending,
              destructive: true,
              onClick: () =>
                setConfirm({
                  title: 'Disable Participation',
                  description: `Disable the ${pairLabel} participation for ${item.lpName}? The pair will be excluded from matching immediately.`,
                  actionLabel: 'Disable',
                  destructive: true,
                  onConfirm: () => confirmDisable(item),
                }),
            },
          );
        }
        if (s === 50) {
          actions.push({
            label: 'Restore Draft',
            disabled: statusMutation.isPending,
            onClick: () =>
              setConfirm({
                title: 'Restore to Draft',
                description: `Restore ${item.lpName} ${pairLabel} to draft? It stays out of the matching candidates until it is submitted and approved again.`,
                actionLabel: 'Restore Draft',
                onConfirm: () => confirmRestore(item),
              }),
          });
        }
        return actions;
      }),
    ],
    [statusMutation.isPending, confirmDisable, confirmRestore],
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
      <Alert>
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <AlertTitle>Administration-managed participation</AlertTitle>
          <AlertDescription>
          New participation and pool parameter changes are initiated by the
          administration side through the approval workflow. This page displays
          real participation data and keeps the existing split/status operations.
          </AlertDescription>
      </Alert>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              LP Participations
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
              label="LP"
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
              options={statusFilterOptions(LP_PAIR_STATUS_LABEL, [5, 15, 20, 50])}
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
              emptyMessage="No participation records yet"
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

      {splitRow && (
        <LpPairSplitDialog row={splitRow} onClosed={() => setSplitRow(null)} />
      )}
      <ConfirmDialog request={confirm} onDismiss={() => setConfirm(null)} />
    </div>
  );
}

/* ================================================================== */
/* pool — LP 资金池（纯监控）                                            */
/* ================================================================== */

/**
 * 水位单元格（源 liquidity/pool/index.vue 自绘水位条，16a3b8f 口径）：
 * 有效分子 = min(可用预授权, 可用余额)（未设置预授权时=余额）；
 * level = 分子 ÷ Σ min liquidity（requiredMinSum = 引用该地址的生效参与对
 * 累计门槛，与 precheck 同尺）；低于提醒阈值=低水位（红，区分授权不足/
 * 余额不足），预授权成为瓶颈时条色琥珀并追加 Auth Limited。
 * requiredMinSum 缺失/≤0（含未挂参与对）或分子未快照 → '--'。
 */
function WaterLevelCell({ row }: { row: LpPoolRow }) {
  const balanceRaw = row.availableBalanceCache;
  const preauthRaw = row.preauthAvailable;
  const minRaw = row.requiredMinSum == null ? Number.NaN : Number(row.requiredMinSum);
  const min = Number.isFinite(minRaw) ? minRaw : Number.NaN;
  const threshold = Number(row.remindThreshold);
  const balanceNum =
    balanceRaw != null && balanceRaw !== '' && Number.isFinite(Number(balanceRaw))
      ? Number(balanceRaw)
      : null;
  const preauthNum =
    preauthRaw != null && preauthRaw !== '' && Number.isFinite(Number(preauthRaw))
      ? Number(preauthRaw)
      : null;
  // 瓶颈=预授权：可用预授权 < 可用余额（未设置/≥余额 时瓶颈均为余额）。
  const isAuthLimited =
    balanceNum != null && preauthNum != null && preauthNum < balanceNum;
  const numerator = isAuthLimited && preauthNum != null ? preauthNum : balanceNum;
  if (numerator == null || !Number.isFinite(min) || min <= 0) {
    return <span>--</span>;
  }

  const level = numerator / min;
  const isLow = Number.isFinite(threshold) && level < threshold;
  const isOverflow = level > 1;
  const percent = `${(level * 100).toFixed(1)}%`;
  const barWidth = Math.min(100, Math.max(0, level * 100));
  const markLeft = Number.isFinite(threshold)
    ? Math.min(100, Math.max(0, threshold * 100))
    : 0;
  // 条色优先级（源 CSS is-low 注释「红优先级最高」）：低水位红 > 授权瓶颈
  // 琥珀 > 充足绿 > 常规。
  const barColor = isLow
    ? 'bg-destructive'
    : isAuthLimited
      ? 'bg-warning'
      : isOverflow
        ? 'bg-emerald-500'
        : 'bg-primary';
  const badgeVariant: BadgeVariant = isLow
    ? 'destructive'
    : isOverflow
      ? 'default'
      : 'outline';
  const symbol = row.tokenSymbol || '';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-[220px] cursor-default space-y-1">
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${barWidth}%` }}
              />
              <div
                className="absolute top-0 h-full w-px bg-foreground/50"
                style={{ left: `${markLeft}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="tabular-nums text-xs text-muted-foreground">
                {percent}
              </span>
              <span className="flex flex-wrap items-center gap-1">
                <Badge variant={badgeVariant}>
                  {isLow
                    ? isAuthLimited
                      ? 'Insufficient Auth'
                      : 'Insufficient Balance'
                    : isOverflow
                      ? 'Sufficient'
                      : 'Normal'}
                </Badge>
                {!isLow && isAuthLimited ? (
                  <Badge variant="warning">Auth Limited</Badge>
                ) : null}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="space-y-1 text-xs">
          <div>
            Available balance {formatAmount(balanceRaw)}
            {symbol ? ` ${symbol}` : ''} · Available auth{' '}
          </div>
          <div>
            Effective level min(auth, balance) {formatAmount(numerator)} ÷ Σ min
            liquidity (referencing pairs) {formatAmount(row.requiredMinSum)}
          </div>
          <div>
            Σ auth threshold{' '}
            {row.requiredAuthSum == null
              ? '-'
              : formatAmount(row.requiredAuthSum)}
          </div>
          <div>
            = {percent}
            {Number.isFinite(threshold)
              ? ` (remind threshold ${(threshold * 100).toFixed(0)}%)`
              : ''}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * LP 资金池监控列表（源 liquidity/pool/index.vue）。
 * 池由管理侧配置维护；本页纯监控零操作：余额/水位/预授权快照。
 */
export function LpPoolListPage() {
  const [lpId, setLpId] = React.useState('');
  const [tokenId, setTokenId] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);

  const { data: lpList } = useLpListQuery(PROJECT_ID, {
    pageNum: 1,
    pageSize: 200,
    filter: {},
  });
  const { data: tokenList } = useTokenListQuery(PROJECT_ID, {});

  const { data, isLoading, isError, dataUpdatedAt } = useLpPoolListQuery(PROJECT_ID, {
    pageNum,
    pageSize,
    filter: {
      lpId: lpId ? Number(lpId) : undefined,
      tokenId: tokenId ? Number(tokenId) : undefined,
      status: status ? Number(status) : undefined,
    },
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const columns = React.useMemo<
    ColumnDef<LpPoolRow & { id: string }>[]
  >(
    () => [
      { accessorKey: 'lpName', header: 'LP Name' },
      {
        id: 'token',
        header: 'Token',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-fit cursor-default font-mono text-sm font-semibold">
                    {row.original.tokenSymbol || row.original.tokenCode || '--'}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  tokenCode: {row.original.tokenCode || '--'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="text-xs text-muted-foreground">
              {row.original.tokenBankName || '--'}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'accountAddress',
        header: 'Pool Address',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="break-all">{row.original.accountAddress || '--'}</span>
          </div>
        ),
      },
      {
        accessorKey: 'availableBalanceCache',
        header: 'Available Balance',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {formatAmount(row.original.availableBalanceCache)}
            {row.original.tokenSymbol ? ` ${row.original.tokenSymbol}` : ''}
          </span>
        ),
      },
      {
        id: 'waterLevel',
        header: 'Water Level',
        enableSorting: false,
        cell: ({ row }) => <WaterLevelCell row={row.original} />,
      },
      {
        id: 'authAmount',
        header: 'Pre-authorized Amount',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.authAmount == null ? (
            <Badge variant="secondary">Not Set</Badge>
          ) : (
            <span className="block text-right font-mono tabular-nums">
              {formatAmount(row.original.authAmount)}
              {row.original.tokenSymbol ? ` ${row.original.tokenSymbol}` : ''}
            </span>
          ),
      },
      {
        id: 'preauthAvailable',
        header: 'Available Pre-authorization',
        enableSorting: false,
        cell: ({ row }) => {
          const n = Number(row.original.preauthAvailable);
          return (
            <span
              className={`block text-right font-mono tabular-nums ${
                row.original.preauthAvailable != null && n <= 0
                  ? 'font-semibold text-destructive'
                  : ''
              }`}
            >
              {formatAmount(row.original.preauthAvailable)}
              {row.original.tokenSymbol ? ` ${row.original.tokenSymbol}` : ''}
            </span>
          );
        },
      },
      {
        id: 'snapshotTime',
        header: 'Updated On',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {formatDateTime(row.original.balanceUpdateTime)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            labelMap={LP_POOL_STATUS_LABEL}
            variantMap={LP_POOL_STATUS_VARIANT}
          />
        ),
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () =>
      (rows as LpPoolRow[]).map((r) => ({ ...r, id: String(r.poolId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <AlertTitle>Read only</AlertTitle>
        <AlertDescription>
          Pool addresses are registered on the LP onboarding form or the LP detail
          page when configuring token pairs; the dedicated payout-pool concept has
          been retired — matching and payout locate the address on the opposite
          side of the pair a transaction belongs to. The data below is a read-only
          snapshot refreshed periodically from the bank Gateway.
        </AlertDescription>
      </Alert>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-base font-semibold leading-6 text-foreground">
              LP Pools
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
              label="LP"
              value={lpId}
              placeholder={LBL.all}
              options={lpToOptions(lpList?.data)}
              onChange={(v) => {
                setLpId(v);
                setPageNum(1);
              }}
            />
            <FilterSelect
              label="Token"
              value={tokenId}
              placeholder={LBL.all}
              options={(tokenList ?? []).map((token) => ({
                value: String(token.tokenId),
                label: `${token.symbol || token.tokenNo || token.tokenCode} (${token.bankName || '--'})`,
              }))}
              onChange={(value) => {
                setTokenId(value);
                setPageNum(1);
              }}
            />
            <FilterSelect
              label="Status"
              value={status}
              placeholder={LBL.all}
              options={statusFilterOptions(LP_POOL_STATUS_LABEL, [5, 15, 20, 50])}
              onChange={(v) => {
                setStatus(v);
                setPageNum(1);
              }}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLpId('');
                  setStatus('');
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
              emptyMessage="No pools yet"
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
