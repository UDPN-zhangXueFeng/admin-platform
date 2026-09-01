'use client';

/**
 * 入网信息页（源 HEAD `views/onboard/index.vue` 全面重构版，GW-14 UDPN 对齐）。
 *
 * 源是单页语义（/onboard 无子路由）：本行详情三卡（基本信息/联系人/实例列表，
 * detail 有值才渲染）+ 底部入网状态卡（四态互斥：审核中 el-result / 已通过且无
 * detail 兜底 / 未通过表单）。原「银行信息」页并入基本信息卡（O-8 取代裁定）。
 *
 * registry 三键映射（旧 O-5 超集 detail/edit/create 随上游删除收敛为同页）：
 * - list   = /onboard（唯一真实入口，menuKey 'bank:onboard:submit'）
 * - create/edit/detail = 兼容残留路由，渲染同一页面
 *
 * 双轮询（源 onUnmounted 清理，目标 useEffect cleanup 等价）：
 * - 审核轮询 5s：status===5 待审核期间自动查询，终态（15 拒绝/20 通过）停止
 *   并刷新详情与门控缓存 + success/warning toast。
 * - 激活轮询 5s：pushPublicKey 受理后等待管理侧下发下行公钥，activated=true
 *   即解锁门户（toast + 刷新详情/门控缓存）。
 */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, Inbox, Info, Loader2 } from 'lucide-react';

import {
  Alert,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@myorg/shared/ui';
import { FormField, createFormResolver } from '@myorg/shared/ui-forms';
import { cn } from '@myorg/shared/util-classnames';
import {
  instanceConnectivityText,
  instanceConnectivityVariant,
  instanceCredentialModeText,
  onboardStatusText,
  onboardStatusVariant,
  useBankContactUpdateMutation,
  useBankDetailQuery,
  useBankInfoQuery,
  useBankInfoSubmitMutation,
  useBankOnboardStatusQuery,
  useBootstrapStateQuery,
  usePushPublicKeyMutation,
  type InstanceItem,
  type OnboardStatus,
} from '@myorg/modules/kissen-gateway/data-access';

import { DescField, DescGrid } from './desc-grid';
import { formatTime, orDash } from './kit';
import { PageHead } from './page-head';
import { useGatewayPerm } from './use-gateway-perm';
import { LoadingBlock } from './state-blocks';

/* ================================================================== */
/* 常量与判定（源 AGREEMENT_VERSION / ONBOARD_STATUS / isPending…）      */
/* ================================================================== */

/** 协议版本号（与平台入网协议版本对齐，源 index.vue AGREEMENT_VERSION）。 */
const ONBOARD_AGREEMENT_VERSION = '1.0';

/** 审核轮询间隔（源 POLL_INTERVAL=5000）。 */
const POLL_INTERVAL_MS = 5000;
/** 激活轮询间隔（源 ACTIVATE_POLL_INTERVAL=5000）。 */
const ACTIVATE_POLL_INTERVAL_MS = 5000;

/** 待审核（源 isPending）。 */
const ONBOARD_STATUS_PENDING = 5;
/** 已拒绝（源 isRejected）。 */
const ONBOARD_STATUS_REJECTED = 15;
/** 已通过（源 isApproved）。 */
const ONBOARD_STATUS_APPROVED = 20;

/**
 * 状态谓词收窄（源 isPending/isApproved/isRejected computed）。
 * `status === 常量` 隐含非空且已赋值，收窄为带必赋 status 的记录。
 */
type OnboardStatusRecord = OnboardStatus & { status: number };

function isPendingStatus(
  current: OnboardStatus | null | undefined,
): current is OnboardStatusRecord {
  return current?.status === ONBOARD_STATUS_PENDING;
}
function isApprovedStatus(
  current: OnboardStatus | null | undefined,
): current is OnboardStatusRecord {
  return current?.status === ONBOARD_STATUS_APPROVED;
}
function isRejectedStatus(
  current: OnboardStatus | null | undefined,
): current is OnboardStatusRecord {
  return current?.status === ONBOARD_STATUS_REJECTED;
}

/** el-result 的 React 等价（icon + title + sub-title + extra）。 */
function ResultPanel({
  tone,
  icon,
  title,
  subtitle,
  children,
}: {
  tone: 'info' | 'success';
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const toneClass = {
    info: 'text-sky-500',
    success: 'text-emerald-500',
  }[tone];
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full bg-muted',
          toneClass,
        )}
      >
        {icon}
      </span>
      <div className="text-lg font-semibold">{title}</div>
      {subtitle && (
        <p className="max-w-md text-sm text-muted-foreground">{subtitle}</p>
      )}
      {children}
    </div>
  );
}

/* ================================================================== */
/* 激活流程（源 needActivate / onActivate / pollActivate）              */
/* ================================================================== */

/** 「激活实例」按钮显示判定（源 needActivate computed 逐字）。 */
function needActivateOf(
  detail: { instanceId?: string; instances: InstanceItem[] } | undefined,
): boolean {
  if (!detail?.instanceId) return false;
  return detail.instances.some(
    (i) => i.instanceId === detail.instanceId && !i.activated,
  );
}

/**
 * 激活确认弹窗（源 ElMessageBox.confirm type="info"、确认文案「推送激活」）。
 * 确认 → pushPublicKey → 成功 toast + 启动 5s activated 轮询。
 */
function ActivateConfirmDialog({
  open,
  activating,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** pushPublicKey 请求进行中（源 activating ref 控按钮 loading）。 */
  activating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Instance Activation</DialogTitle>
          <DialogDescription>
            The uplink public key of this instance will be pushed to the
            platform (authenticated by BIC + one-time access key). Once the
            platform verifies connectivity and delivers the downlink public
            key, the instance is activated and portal features unlock.
            Continue?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={activating} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={activating} onClick={onConfirm}>
            {activating && <Loader2 className="animate-spin" />}
            Push &amp; Activate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 入网合一表单（源 el-form + formRules；infoSubmit 未入网分支）         */
/* ================================================================== */

/** 表单校验（源 formRules：协议自定义 validator + 联系人/电话必填；长度由 maxLength 截断）。 */
const onboardApplySchema = z.object({
  agreeConfirmed: z
    .boolean()
    .refine((v) => v, { message: 'Please accept the onboarding agreement first' }),
  contactName: z.string().min(1, { message: 'Please enter a contact name' }),
  contactPhone: z.string().min(1, { message: 'Please enter a contact phone' }),
  contactEmail: z.string(),
  contactAddress: z.string(),
});

type OnboardApplyFormValues = z.infer<typeof onboardApplySchema>;

/**
 * 入网申请表单（源表单分支：尚无申请 / 被拒后重新提交）。
 * 提交 POST /bank/info-submit 六字段全量（agreementVersion='1.0'）；
 * resp.result==='INFO_UPDATED' 走已入网联系人更新分支 toast。
 */
function OnboardApplyForm({ onSubmitted }: { onSubmitted: () => void }) {
  const toast = useToast();
  const submitMutation = useBankInfoSubmitMutation();

  const { register, handleSubmit, control, formState } =
    useForm<OnboardApplyFormValues>({
      resolver: createFormResolver(onboardApplySchema),
      mode: 'onTouched',
      defaultValues: {
        agreeConfirmed: false,
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        contactAddress: '',
      },
    });

  const onSubmit = handleSubmit((v) => {
    // 源提交 {...form}：六字段全量（可选字段空串原样上送）。
    submitMutation.mutate(
      {
        agreeConfirmed: v.agreeConfirmed,
        contactName: v.contactName,
        contactPhone: v.contactPhone,
        contactEmail: v.contactEmail,
        contactAddress: v.contactAddress,
        agreementVersion: ONBOARD_AGREEMENT_VERSION,
      },
      {
        onSuccess: (resp) => {
          if (resp.result === 'INFO_UPDATED') {
            // 已入网银行走合一通道的联系人更新分支。
            toast.success('Bank already onboarded. Contact information updated');
          } else {
            toast.success(
              `Onboarding application submitted (apply #${resp.applyId ?? '-'}). Please wait for review`,
            );
          }
          // 源：loadStatus + loadOnboardStatus（缓存失效即重拉，切审核中态）。
          onSubmitted();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Controller
          control={control}
          name="agreeConfirmed"
          render={({ field }) => (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                aria-invalid={!!formState.errors.agreeConfirmed}
              />
              <span>
                I have read and agree to the Kissen Bank Gateway Onboarding
                Service Agreement
              </span>
            </label>
          )}
        />
        {formState.errors.agreeConfirmed && (
          <p className="text-sm text-destructive" role="alert">
            {formState.errors.agreeConfirmed.message}
          </p>
        )}
      </div>
      <FormField
        name="contactName"
        label="Contact Name"
        required
        maxLength={30}
        placeholder="Enter the contact name"
        className="max-w-[360px]"
        error={formState.errors.contactName?.message}
        register={register('contactName')}
      />
      <FormField
        name="contactPhone"
        label="Contact Phone"
        required
        maxLength={30}
        placeholder="Phone number, so the platform can reach you"
        className="max-w-[360px]"
        error={formState.errors.contactPhone?.message}
        register={register('contactPhone')}
      />
      <FormField
        name="contactEmail"
        label="Email"
        maxLength={64}
        placeholder="Optional"
        className="max-w-[360px]"
        error={formState.errors.contactEmail?.message}
        register={register('contactEmail')}
      />
      <FormField
        name="contactAddress"
        label="Address"
        maxLength={128}
        placeholder="Optional"
        className="max-w-[360px]"
        error={formState.errors.contactAddress?.message}
        register={register('contactAddress')}
      />
      <div>
        <Button type="submit" disabled={submitMutation.isPending}>
          {submitMutation.isPending && <Loader2 className="animate-spin" />}
          Submit Application
        </Button>
      </div>
    </form>
  );
}

/* ================================================================== */
/* 联系人编辑弹窗（源 el-dialog 编辑联系人 + contactRules）              */
/* ================================================================== */

/** 弹窗校验（源 contactRules：contactName/contactPhone 必填）。 */
const contactEditSchema = z.object({
  contactName: z.string().min(1, { message: 'Please enter a contact name' }),
  contactPhone: z.string().min(1, { message: 'Please enter a contact phone' }),
  contactEmail: z.string(),
  contactAddress: z.string(),
});

type ContactEditFormValues = z.infer<typeof contactEditSchema>;

/**
 * 联系人就地编辑（源 openContactEdit → dialog → onContactSave：
 * POST /bank/contact-update 四字段；INFO_UPDATED → 「联系人已更新」，
 * 其余分支为未入网状态误走合一通道的兜底文案）。
 * 由父级条件渲染——每次打开重新挂载，defaultValues 即回填结果
 * （等价源 Object.assign + nextTick clearValidate）。
 */
function ContactEditDialog({
  initial,
  onClose,
}: {
  initial: {
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    contactAddress: string;
  };
  onClose: () => void;
}) {
  const toast = useToast();
  const updateMutation = useBankContactUpdateMutation();

  const { register, handleSubmit, formState } = useForm<ContactEditFormValues>({
    resolver: createFormResolver(contactEditSchema),
    mode: 'onTouched',
    defaultValues: initial,
  });

  const onSave = handleSubmit((v) => {
    updateMutation.mutate(
      {
        contactName: v.contactName,
        contactPhone: v.contactPhone,
        contactEmail: v.contactEmail,
        contactAddress: v.contactAddress,
      },
      {
        onSuccess: (resp) => {
          if (resp.result === 'INFO_UPDATED') {
            toast.success('Contact information updated');
          } else {
            // 未入网状态下走到合一通道的入网分支（正常应使用入网申请表单）。
            toast.success(
              resp.result === 'ONBOARD_SUBMITTED'
                ? `Onboarding application submitted (#${resp.applyId ?? '-'})`
                : 'Submitted',
            );
          }
          // mutation 已失效 bank 域缓存（detail 随之重拉，源 loadDetail）。
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* 源 el-dialog width="480px"。 */}
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Update the contact information of this bank
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
          <FormField
            name="contactName"
            label="Contact Name"
            required
            maxLength={30}
            error={formState.errors.contactName?.message}
            register={register('contactName')}
          />
          <FormField
            name="contactPhone"
            label="Contact Phone"
            required
            maxLength={30}
            error={formState.errors.contactPhone?.message}
            register={register('contactPhone')}
          />
          <FormField
            name="contactEmail"
            label="Email"
            maxLength={64}
            error={formState.errors.contactEmail?.message}
            register={register('contactEmail')}
          />
          <FormField
            name="contactAddress"
            label="Address"
            maxLength={128}
            error={formState.errors.contactAddress?.message}
            register={register('contactAddress')}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* 本行详情三卡（源 v-if="detail" 分支）                                */
/* ================================================================== */

/**
 * 详情形状（BankDetail + 协议扩展 P1 可选字段——源 index.vue 的
 * `BankDetail & { website?; description?; registrationTime? }`，后端
 * 下发前为空，前端按源占位 '-'）。
 */
type BankDetailLike = NonNullable<
  Awaited<ReturnType<typeof useBankDetailQuery>>['data']
> & {
  bankId?: number;
  website?: string;
  description?: string;
  registrationTime?: number;
};

/**
 * 卡 A 基本信息（源 el-descriptions column=2 border 八字段）。
 * Bank ID 以本地推送缓存 gw_bank_info.bankId 兜底（源 bankIdOf，协议扩展 P1
 * 前详情报文无此字段）；Registration Time 同为 P1 占位，已通过时以入网通过
 * 时间兜底；入网状态非 20 显示原始数字口径由 onboardStatusText 承接
 * （未知码 `Unknown (n)`，null '-'）。
 */
function BankDetailCards({
  detail,
  bankInfoBankId,
  agreeTimeFallback,
}: {
  detail: BankDetailLike;
  bankInfoBankId?: number;
  /** 已通过且 registrationTime 缺失时的兜底（源 current?.agreeTime）。 */
  agreeTimeFallback?: number;
}) {
  const bankId = String(detail.bankId ?? bankInfoBankId ?? '-');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent>
        <DescGrid cols={2}>
          <DescField label="Bank Name" variant="boxed">
            {detail.bankName || '-'}
          </DescField>
          <DescField label="Bank Code" variant="boxed">
            {detail.bankCode || '-'}
          </DescField>
          <DescField label="Bank ID" variant="boxed">
            <span className="font-mono">{bankId}</span>
          </DescField>
          <DescField label="BIC" variant="boxed">
            {detail.bic || '-'}
          </DescField>
          <DescField label="Onboarding Status" variant="boxed">
            <Badge variant={onboardStatusVariant(detail.onboardStatus)}>
              {onboardStatusText(detail.onboardStatus)}
            </Badge>
          </DescField>
          {/* 协议扩展 P1 占位：Kissen 下发 registrationTime 后自动亮起。 */}
          <DescField label="Registration Time" variant="boxed">
            <span className="font-mono">
              {detail.registrationTime
                ? formatTime(detail.registrationTime)
                : agreeTimeFallback
                  ? formatTime(agreeTimeFallback)
                  : '-'}
            </span>
          </DescField>
          {/* 协议扩展 P1 占位。 */}
          <DescField label="Official Website" variant="boxed">
            {detail.website || '-'}
          </DescField>
          <DescField label="Description" variant="boxed">
            {detail.description || '-'}
          </DescField>
        </DescGrid>
      </CardContent>
    </Card>
  );
}

/** 卡 B 联系人（可就地编辑，v-perm 'bank:info:contact-edit'）。 */
function ContactCard({
  detail,
  onEdit,
}: {
  detail: BankDetailLike;
  onEdit: () => void;
}) {
  const hasPerm = useGatewayPerm();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact</CardTitle>
        <CardAction>
          {hasPerm('bank:info:contact-edit') && (
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        <DescGrid cols={2}>
          <DescField label="Contact Name" variant="boxed">
            {detail.contactName || '-'}
          </DescField>
          <DescField label="Contact Phone" variant="boxed">
            {detail.contactPhone || '-'}
          </DescField>
          <DescField label="Email" variant="boxed">
            {detail.contactEmail || '-'}
          </DescField>
          <DescField label="Address" variant="boxed">
            {detail.contactAddress || '-'}
          </DescField>
        </DescGrid>
      </CardContent>
    </Card>
  );
}

/** 卡 C 本行实例列表（四列；header 右侧 needActivate 时「激活实例」按钮）。 */
function InstanceListCard({
  detail,
  needActivate,
  activating,
  onActivate,
}: {
  detail: BankDetailLike;
  needActivate: boolean;
  activating: boolean;
  onActivate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        {/* §6.2 头条元信息：实体名 + 结果数（激活按钮保持 CardAction 右置）。 */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <CardTitle>Gateway Instances of This Bank</CardTitle>
          <span className="text-sm text-muted-foreground tabular-nums">
            {detail.instances.length} instances
          </span>
        </div>
        {needActivate && (
          <CardAction>
            <Button
              type="button"
              size="sm"
              disabled={activating}
              onClick={onActivate}
            >
              {activating && <Loader2 className="motion-safe:animate-spin" />}
              Activate Instance
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full caption-bottom text-sm">
            <thead className="bg-muted/50">
              <tr>
                {INSTANCE_TABLE_HEADERS.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="h-10 whitespace-nowrap border-b border-border/50 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {detail.instances.length === 0 ? (
                <tr>
                  <td
                    colSpan={INSTANCE_TABLE_HEADERS.length}
                    className="px-4 py-10"
                  >
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      <Inbox
                        className="h-9 w-9 text-muted-foreground/40"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      <p className="text-sm text-muted-foreground">
                        No gateway instances yet
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                detail.instances.map((row) => (
                  <tr
                    key={row.instanceId}
                    className="motion-safe:transition-colors hover:bg-muted/50"
                  >
                    <td className="max-w-[16rem] px-4 py-3 align-middle font-mono font-medium">
                      <span className="block truncate" title={orDash(row.instanceId)}>
                        {orDash(row.instanceId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Badge variant={instanceConnectivityVariant(row.connectivity)}>
                        {instanceConnectivityText(row.connectivity)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Badge variant={row.activated ? 'default' : 'secondary'}>
                        {row.activated ? 'Activated' : 'Not Activated'}
                      </Badge>
                    </td>
                    <td className="max-w-[10rem] px-4 py-3 align-middle">
                      <span
                        className="block truncate"
                        title={instanceCredentialModeText(row.credentialMode)}
                      >
                        {instanceCredentialModeText(row.credentialMode)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/** 源实例表列头（实例编码/连通状态/激活状态/凭证模式）。 */
const INSTANCE_TABLE_HEADERS = [
  'Instance ID',
  'Connectivity',
  'Activation',
  'Credential Mode',
] as const;

/* ================================================================== */
/* 页面主体                                                             */
/* ================================================================== */

/**
 * 入网信息页（源单页；registry list/create/edit/detail 四键同页收敛）。
 *
 * 数据流（源 loadAll 并行四请求 → 目标四 query 挂载即拉）：
 * - GET /bank/detail（detail；失败降级本地缓存 degraded=true）
 * - GET /bank/onboard/status（current）
 * - GET /bank/info（bankId 兜底展示）
 * - 门控缓存（session-guard 的 useGatewayLockState 复用同一 query key，
 *   本页 invalidate 后自动重判——等价源 loadOnboardStatus/loadInstanceStatus）
 */
export function OnboardListPage() {
  const toast = useToast();

  const detailQuery = useBankDetailQuery();
  const statusQuery = useBankOnboardStatusQuery();
  const [contactEditing, setContactEditing] = React.useState(false);
  const bankInfoQuery = useBankInfoQuery();
  const [manualRefreshing, setManualRefreshing] = React.useState(false);
  const bootstrapQuery = useBootstrapStateQuery(false);

  const detail = detailQuery.data;
  const current = statusQuery.data;
  const needActivate = needActivateOf(detail);

  /* ── 审核轮询：待审核期间 5s 刷新 status；终态 toast + 刷新详情 ── */
  const isPending = isPendingStatus(current);

  /**
   * 已通过合并判定（39c8a2b）：status 接口失败时以 detail.onboardStatus
   * 兜底——任一数据源 = 20 即通过；表单态与底部卡可见性同步用 approved。
   */
  const approved =
    isApprovedStatus(current) ||
    detail?.onboardStatus === ONBOARD_STATUS_APPROVED;
  /** 已通过且详情已在上方展示：底部状态/申请卡整体隐藏（防空壳/表单残留）。 */
  const hideOnboardCard = approved && !!detail;
  const { refetch: refetchStatus } = statusQuery;
  const { refetch: refetchDetail } = detailQuery;

  React.useEffect(() => {
    if (!isPending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const pollOnce = async () => {
      timer = undefined;
      try {
        const res = await refetchStatus();
        const st = res.data?.status;
        if (st === ONBOARD_STATUS_REJECTED || st === ONBOARD_STATUS_APPROVED) {
          // 终态：刷新详情（通过后数据就位）与门控缓存由下方
          // terminalStatus effect 承接；此处仅停止节奏。
          return;
        }
      } catch {
        /* 拦截器已提示；轮询继续（源语义） */
      }
      if (!cancelled) {
        timer = setTimeout(pollOnce, POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(pollOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isPending, refetchStatus]);

  /** 前一次观测的 status（仅 5→15/20 转换时弹一次；undefined=尚未观测，挂载即终态不弹）。 */
  const prevStatusRef = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    const st = current?.status;
    const prev = prevStatusRef.current;
    prevStatusRef.current = st;
    // 源 pollOnce 只在待审核轮询中发现终态：仅 5→15/20 转换触发，终态间跳转不弹。
    if (prev !== ONBOARD_STATUS_PENDING) return;
    if (st !== ONBOARD_STATUS_REJECTED && st !== ONBOARD_STATUS_APPROVED) return;
    // 轮询期间待审核→终态：刷新详情（通过后数据就位）+ 一次性结果 toast。
    refetchDetail();
    if (st === ONBOARD_STATUS_APPROVED) {
      toast.success('Onboarding application approved');
    } else {
      toast.warning(
        'Onboarding application was rejected. You may revise and resubmit',
      );
    }
  }, [current?.status, refetchDetail, toast]);

  /* ── 激活流程：confirm → pushPublicKey → 5s activated 轮询 ── */
  const [activateConfirmOpen, setActivateConfirmOpen] = React.useState(false);
  /** 推送已受理，轮询等待下行公钥（源 activateTimer 活跃态）。 */
  const [activatePolling, setActivatePolling] = React.useState(false);
  const pushKeyMutation = usePushPublicKeyMutation();
  const { refetch: refetchBootstrap } = bootstrapQuery;

  /** 激活轮询：bootstrap state 每 5s 查一次，activated 即停并解锁。 */
  React.useEffect(() => {
    if (!activatePolling) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      timer = undefined;
      try {
        const res = await refetchBootstrap();
        if (res.data?.activated) {
          toast.success('Instance activated. Portal features unlocked');
          setActivatePolling(false);
          // 刷新详情（activated 列变化）+ 门控缓存（detail 复用同一 key）。
          refetchDetail();
          return;
        }
      } catch {
        /* 拦截器已提示；轮询继续 */
      }
      if (!cancelled) {
        timer = setTimeout(poll, ACTIVATE_POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(poll, ACTIVATE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activatePolling, refetchBootstrap, refetchDetail, toast]);

  /** 确认推送（源 onActivate 确认分支：pushPublicKey → toast → 启动轮询）。 */
  const onConfirmActivate = React.useCallback(() => {
    pushKeyMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(
          'Public key pushed. Waiting for the platform to deliver the downlink public key',
        );
        setActivateConfirmOpen(false);
        setActivatePolling(true);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  }, [pushKeyMutation, toast]);

  /* ── 刷新（源 loadAll；query 缓存口径下为手动 refetch 四数据源） ── */
  /** 仅用户主动刷新期间置真：后台审核轮询的 isFetching 不得禁用 Refresh（源 :loading=loading）。 */
  const onRefreshAll = React.useCallback(() => {
    setManualRefreshing(true);
    void Promise.all([
      refetchDetail(),
      refetchStatus(),
      bankInfoQuery.refetch(),
      refetchBootstrap(),
    ]).finally(() => setManualRefreshing(false));
  }, [refetchDetail, refetchStatus, bankInfoQuery, refetchBootstrap]);
  const isLoading = detailQuery.isLoading || statusQuery.isLoading;

  return (
    <div className="space-y-4">
      <PageHead variant="banner" eyebrow="ONBOARDING" title="Onboarding Information">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={manualRefreshing}
          onClick={onRefreshAll}
        >
          Refresh
        </Button>
      </PageHead>

      {/* 降级告警条（源 degraded alert warning，持久内联非 toast）。 */}
      {detail?.degraded ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <AlertTitle>
            Platform uplink unreachable. Showing locally cached data (synced at{' '}
            {formatTime(detail.lastSyncTime)}); information may be outdated
          </AlertTitle>
        </Alert>
      ) : null}

      {/* 本行详情三卡（v-if detail：未入网/detail 缺失时整组不渲染）。 */}
      {detail ? (
        <>
          <BankDetailCards
            detail={detail}
            bankInfoBankId={bankInfoQuery.data?.bankId}
            agreeTimeFallback={
              isApprovedStatus(current) ? current.agreeTime : undefined
            }
          />
          <ContactCard detail={detail} onEdit={() => setContactEditing(true)} />
          <InstanceListCard
            detail={detail}
            needActivate={needActivate}
            activating={pushKeyMutation.isPending}
            onActivate={() => setActivateConfirmOpen(true)}
          />
        </>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-5">
            <LoadingBlock variant="skeleton" />
          </CardContent>
        </Card>
      ) : null}

      {/* 入网状态与申请卡（源 onboard-card max-width 680px；39c8a2b：approved
          且 detail 存在时整卡隐藏，防空壳/表单残留）。 */}
      {!hideOnboardCard ? (
        <Card className="max-w-[680px]">
          <CardContent className="py-5">
            {isPending ? (
              <ResultPanel
                tone="info"
                icon={<Info className="h-8 w-8" />}
                title="Onboarding Application Under Review"
                subtitle="Your onboarding application has been submitted and is awaiting Kissen review. Portal features unlock once approved."
              >
                {/* 源 L99：approveFeedback 有值 → info alert 持久内联展示。 */}
                {current.approveFeedback ? (
                  <Alert className="max-w-md border-sky-200 bg-sky-50 text-sky-900">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <AlertTitle>{current.approveFeedback}</AlertTitle>
                  </Alert>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Submitted: {formatTime(current.agreeTime)}
                </p>
                <p className="text-sm text-muted-foreground">
                  The review result is queried automatically every{' '}
                  {POLL_INTERVAL_MS / 1000} seconds. No manual refresh needed
                </p>
              </ResultPanel>
            ) : approved ? (
              /* 已通过：无详情数据的兜底提示（有详情时上方卡片已表达，整卡隐藏）。 */
              <ResultPanel
                tone="success"
                icon={<CheckCircle2 className="h-8 w-8" />}
                title="Approved"
                subtitle="Your onboarding application has been approved. All portal features are available."
              >
                <p className="text-sm text-muted-foreground">
                  Approved: {formatTime(current?.agreeTime)}
                </p>
              </ResultPanel>
            ) : (
              <div className="space-y-4">
                {/* 源 L114-118：驳回后重新提交 → 表单上方 warning alert。 */}
                {isRejectedStatus(current) && current.approveFeedback ? (
                  <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <AlertTitle>
                      Previous application was rejected: {current.approveFeedback}
                    </AlertTitle>
                  </Alert>
                ) : null}
                <OnboardApplyForm
                  onSubmitted={() => {
                    // 提交后缓存失效自动重拉 status（切审核中态）。
                    refetchStatus();
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* 联系人编辑弹窗（条件渲染重挂载即回填）。 */}
      {contactEditing && detail ? (
        <ContactEditDialog
          initial={{
            contactName: detail.contactName ?? '',
            contactPhone: detail.contactPhone ?? '',
            contactEmail: detail.contactEmail ?? '',
            contactAddress: detail.contactAddress ?? '',
          }}
          onClose={() => setContactEditing(false)}
        />
      ) : null}

      {/* 激活确认弹窗。 */}
      <ActivateConfirmDialog
        open={activateConfirmOpen}
        activating={pushKeyMutation.isPending}
        onCancel={() => setActivateConfirmOpen(false)}
        onConfirm={onConfirmActivate}
      />
    </div>
  );
}

/** 兼容残留路由（旧 O-5 超集；HEAD 上游已收敛单页，四键同页）。 */
export function OnboardFormPage() {
  return <OnboardListPage />;
}

/** 兼容残留路由（同上）。 */
export function OnboardDetailPage() {
  return <OnboardListPage />;
}
