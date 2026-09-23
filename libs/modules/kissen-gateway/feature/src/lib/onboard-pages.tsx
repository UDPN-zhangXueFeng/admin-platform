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
 *   即强制重登（2f92680：success 弹窗 → logout → 登录页，ESC/关闭视同确认，
 *   不再就地刷新解锁）。
 */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Inbox,
  Info,
  Loader2,
  Pencil,
  Server,
  User,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Alert,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@myorg/shared/ui';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import { FormField, createFormResolver } from '@myorg/shared/ui-forms';
import { cn } from '@myorg/shared/util-classnames';
import {
  instanceConnectivityText,
  instanceCredentialModeText,
  instanceStatusText,
  clearGatewaySession,
  useBankContactUpdateMutation,
  useBankDetailQuery,
  useBankInfoSubmitMutation,
  useBankOnboardStatusQuery,
  useBootstrapStateQuery,
  usePushPublicKeyMutation,
  useAuthLogoutMutation,
  type BankDetail,
  type InstanceItem,
  type OnboardStatus,
} from '@myorg/modules/kissen-gateway/data-access';

import { formatTime } from './kit';
import { formatUtc8 } from './proto-format';
import { protoStatusText, PROTO_BANK_ONBOARD_STATUS } from './proto-enums';
import { CopyableId, ProtoStatusBadge, type ProtoStatusTone } from './proto-ui';
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

/* ── 原型对齐常量（OnboardingInformationPage.jsx 2026-09-21 改版） ── */

/** 入网状态 → 徽章语义色（proto 徽章分层）。 */
const ONBOARD_TONE: Record<number, ProtoStatusTone> = {
  0: 'muted',
  5: 'warning',
  15: 'danger',
  20: 'success',
};

/** 实例状态文案 → 徽章语义色。 */
const INSTANCE_STATUS_TONE: Record<string, ProtoStatusTone> = {
  Active: 'success',
  Pending: 'warning',
  Inactive: 'muted',
};

/** 实例表前端分页每页条数（原型 INSTANCE_PAGE_SIZE）。 */
const INSTANCE_PAGE_SIZE = 5;

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
            key, the instance is activated. A re-login is required after
            activation to use the full portal (2f92680). Continue?
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

/**
 * 激活成功强制重登弹窗（2f92680 源 ElMessageBox.alert type="success"：
 * 「实例已激活。为加载完整门户功能,请重新登录。」）。ESC/关闭视同确认，
 * 同样触发登出回登录页——不再就地刷新解锁。
 */
function ActivateReloginDialog({
  open,
  onConfirm,
}: {
  open: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onConfirm()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Activation Successful</AlertDialogTitle>
          <AlertDialogDescription>
            The instance has been activated. To load the full portal
            features, please sign in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onConfirm}>Re-login</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 轻分节（§6.4）：协议确认 / 联系人信息各自成组，不堆叠同质 Card。 */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Onboarding Agreement
          </h3>
          <p className="text-sm text-muted-foreground">
            Acceptance is required before the application can be submitted
          </p>
        </div>
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
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Bank Contact Information
          </h3>
          <p className="text-sm text-muted-foreground">
            How the platform reaches your bank during the onboarding review
          </p>
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
      </section>

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
/* 联系人编辑弹窗（原型 EditContactDialog.jsx：2026-09-22 拍板三字段，   */
/* 仅 Email 必填；phone 从联系信息整体移除）                             */
/* ================================================================== */

/** 原型 EMAIL_PATTERN 逐字。 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 弹窗校验（原型 validate 逐字）：Name 可选 max 64、Email 必填 +
 * pattern + max 128、Address 可选 max 200；contactPhone 不再可编辑。
 */
const contactEditSchema = z.object({
  contactName: z.string().max(64, { message: 'Max 64 characters.' }),
  contactEmail: z
    .string()
    .min(1, { message: 'Required field' })
    .max(128, {
      message: 'Enter a valid email address (max 128).',
    })
    .regex(EMAIL_PATTERN, {
      message: 'Enter a valid email address (max 128).',
    }),
  contactAddress: z
    .string()
    .max(200, { message: 'Address must be 200 characters or fewer.' }),
});

type ContactEditFormValues = z.infer<typeof contactEditSchema>;

/**
 * 联系人就地编辑（原型 EditContactDialog：三字段仅 Email 必填）。
 * POST /bank/contact-update：INFO_UPDATED → 「联系人已更新」，其余分支为
 * 未入网状态误走合一通道的兜底文案。由父级条件渲染——每次打开重新挂载，
 * defaultValues 即回填结果（等价原型 open 时 useEffect 回填）。
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
    defaultValues: {
      contactName: initial.contactName,
      contactEmail: initial.contactEmail,
      contactAddress: initial.contactAddress,
    },
  });

  const onSave = handleSubmit((v) => {
    updateMutation.mutate(
      {
        contactName: v.contactName.trim(),
        // 原型 2026-09-22 拍板 phone 移出联系信息编辑；后端契约
        // contactPhone 仍必填 → 原值透传（'' 兜底），不由弹窗改动。
        contactPhone: initial.contactPhone.trim(),
        contactEmail: v.contactEmail.trim(),
        contactAddress: v.contactAddress.trim(),
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Contact details Kissen uses to reach your bank operations team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
          <FormField
            name="contactName"
            label="Contact Name"
            maxLength={64}
            error={formState.errors.contactName?.message}
            register={register('contactName')}
          />
          <FormField
            name="contactEmail"
            label="Email"
            type="email"
            required
            maxLength={128}
            error={formState.errors.contactEmail?.message}
            register={register('contactEmail')}
          />
          <div>
            <label
              htmlFor="field-contactAddress"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Address
            </label>
            <textarea
              id="field-contactAddress"
              rows={3}
              maxLength={200}
              aria-invalid={!!formState.errors.contactAddress}
              aria-describedby={
                formState.errors.contactAddress ? 'error-contactAddress' : undefined
              }
              className={
                'flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50' +
                (formState.errors.contactAddress
                  ? ' border-destructive focus:ring-destructive'
                  : '')
              }
              {...register('contactAddress')}
            />
            {formState.errors.contactAddress ? (
              <p
                id="error-contactAddress"
                className="mt-1 text-sm text-destructive"
                role="alert"
              >
                {formState.errors.contactAddress.message}
              </p>
            ) : null}
          </div>
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
/* 本行详情（原型 2026-09-21 改版：概要条 + Basic/Contact 双列卡）       */
/* ================================================================== */

/**
 * 详情形状（BankDetail + 协议扩展 P1 可选字段——原型 bank-profile 的
 * website/description/registrationTime，后端下发前为空，前端占位 '-'）。
 * 原型概要条不展示 Bank ID（2026-09-22 拍板），gw_bank_info 兜底随之移除。
 */
type BankDetailLike = BankDetail & {
  website?: string;
  description?: string;
  registrationTime?: number;
};

/**
 * 概要条（原型 BankSummaryCard）：品牌块 + 银行名 + 入网状态徽标 +
 * BIC（可复制）/ Registered meta 行。Registered 为协议扩展 P1 占位，
 * 缺失时以入网通过时间兜底。
 */
function BankSummaryStrip({
  detail,
  agreeTimeFallback,
}: {
  detail: BankDetailLike;
  /** 已通过且 registrationTime 缺失时的兜底（源 current?.agreeTime）。 */
  agreeTimeFallback?: number;
}) {
  const registered = detail.registrationTime ?? agreeTimeFallback;
  return (
    <section className="rounded-lg border border-border/60 bg-card panel-pad">
      <div className="flex min-w-0 items-center gap-4">
        {/* 品牌块（原型 avatar：浅渐变底 + udpn lowercase 品牌占位）。 */}
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-muted text-base font-bold lowercase tracking-wide text-primary"
        >
          udpn
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {detail.bankName || '-'}
            </h2>
            <ProtoStatusBadge
              label={protoStatusText(
                PROTO_BANK_ONBOARD_STATUS,
                detail.onboardStatus,
              )}
              tone={ONBOARD_TONE[detail.onboardStatus] ?? 'muted'}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {detail.bankBic ? (
              <span className="inline-flex items-center gap-1.5">
                <span>BIC</span>
                <CopyableId value={detail.bankBic} />
              </span>
            ) : null}
            {detail.bankBic && registered != null ? (
              <span aria-hidden="true" className="text-muted-foreground/70">
                •
              </span>
            ) : null}
            {registered != null ? (
              <span className="inline-flex items-center gap-1.5">
                <span>Registered</span>
                <span className="font-medium text-foreground">
                  {formatUtc8(registered)}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** 双列卡行（原型 dl 行：label 上、值下，堆叠）。 */
function InfoRow({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={'min-w-0 ' + (className ?? '')}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm font-semibold text-foreground">
        {children}
      </dd>
    </div>
  );
}

/**
 * 双列卡（原型 ③：desktop 2 列 divide-x）：左 Basic Information
 * （Bank Code + System 小灰标 / Official Website / Description，行有值才渲染）；
 * 右 Contact Information（Edit 弹窗入口，v-perm 'bank:info:contact-edit'；
 * 原型 2026-09-22 拍板不展示 phone；Email 主色）。
 */
function BankInfoCards({
  detail,
  onEditContact,
}: {
  detail: BankDetailLike;
  onEditContact: () => void;
}) {
  const hasPerm = useGatewayPerm();
  return (
    <section className="grid gap-6 rounded-lg border border-border/60 bg-card panel-pad lg:grid-cols-2 lg:divide-x lg:divide-border/50">
      {/* 左：Basic Information（lg:pr-6 避开 divide-x 贴边）。 */}
      <div className="min-w-0 lg:pr-6">
        <div className="mb-5 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
          >
            <Building2 className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">
            Basic Information
          </h3>
        </div>
        <dl className="flex flex-col gap-5">
          {/* 62d1c33：Bank Code + BIC 合并为 bankBic。 */}
          <InfoRow label="Bank Code">
            <span className="flex flex-wrap items-center gap-2">
              <CopyableId value={detail.bankBic} />
              <Badge variant="mute">System</Badge>
            </span>
          </InfoRow>
          {detail.website ? (
            <InfoRow label="Official Website">
              <a
                href={detail.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 break-all font-semibold text-primary hover:underline"
              >
                <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
                {detail.website}
              </a>
            </InfoRow>
          ) : null}
          {detail.description ? (
            <InfoRow label="Description">
              <span className="font-normal leading-relaxed text-muted-foreground">
                {detail.description}
              </span>
            </InfoRow>
          ) : null}
        </dl>
      </div>

      {/* 右：Contact Information（原型 tablet 起 Name/Email 两列、Address 整行）。 */}
      <div className="min-w-0 lg:pl-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"
            >
              <User className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">
              Contact Information
            </h3>
          </div>
          {hasPerm('bank:info:contact-edit') && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={onEditContact}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <InfoRow label="Contact Name">{detail.contactName || '-'}</InfoRow>
          <InfoRow label="Email">
            <span className="break-all text-primary">
              {detail.contactEmail || '-'}
            </span>
          </InfoRow>
          <InfoRow label="Address" className="sm:col-span-2">
            {detail.contactAddress || '-'}
          </InfoRow>
        </dl>
      </div>
    </section>
  );
}


/** 实例表列头（原型列序：实例编码/连通/凭证模式/状态）。 */
const INSTANCE_TABLE_HEADERS = [
  'Instance ID',
  'Connectivity',
  'Credential Mode',
  'Status',
] as const;

/**
 * 连通脉冲徽章（原型 pulse badge）：Online → success 底 + animate-ping 点；
 * 其余静默灰点。文案沿用 instanceConnectivityText（Online/Offline/Degraded）。
 */
function ConnectivityBadge({ row }: { row: InstanceItem }) {
  const online = instanceConnectivityText(row.connectivity) === 'Online';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        online
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border bg-muted/50 text-muted-foreground'
      }`}
    >
      <span aria-hidden="true" className="relative flex size-1.5">
        {online ? (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </>
        ) : (
          <span className="relative inline-flex size-1.5 rounded-full bg-muted-foreground/60" />
        )}
      </span>
      {instanceConnectivityText(row.connectivity)}
    </span>
  );
}

/**
 * 卡 C 本行实例列表（原型 Gateway Instances 表）：Instance ID（可复制）/
 * Connectivity（脉冲徽章）/Credential Mode/Status；前端分页 5/页 +
 * `Showing n of m instances`。header 右侧保留 needActivate 时「激活实例」
 * 按钮（入网流程，非原型表内 Actions）。
 * 有意偏差：原型每行 Actions（View keys）不落地——本仓实例密钥是 app-shell
 * 全局抽屉（InstanceKeyDrawer）而非页面内跳转，行内动作无目标页。
 */
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
  const [page, setPage] = React.useState(0);
  const total = detail.instances.length;
  const pageCount = Math.max(1, Math.ceil(total / INSTANCE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = detail.instances.slice(
    safePage * INSTANCE_PAGE_SIZE,
    (safePage + 1) * INSTANCE_PAGE_SIZE,
  );

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
          >
            <Server className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-6 text-foreground">
              Gateway Instances
            </h2>
            {/* 原型单复数副标题逐字。 */}
            <p className="text-xs text-muted-foreground">
              {total === 1
                ? '1 instance connected and operational'
                : `${total} instances connected and operational`}
            </p>
          </div>
        </div>
        {needActivate && (
          <Button
            type="button"
            size="sm"
            disabled={activating}
            onClick={onActivate}
          >
            {activating && <Loader2 className="motion-safe:animate-spin" />}
            Activate Instance
          </Button>
        )}
      </div>
      <div className="panel-pad">
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
              {rows.length === 0 ? (
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
                        No gateway instance is connected to this bank yet.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.instanceId}
                    className="motion-safe:transition-colors hover:bg-muted/50"
                  >
                    <td className="max-w-[16rem] px-4 py-3 align-middle">
                      <CopyableId value={row.instanceId} className="font-mono" />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <ConnectivityBadge row={row} />
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {instanceCredentialModeText(row.credentialMode)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <ProtoStatusBadge
                        label={instanceStatusText(row)}
                        tone={INSTANCE_STATUS_TONE[instanceStatusText(row)] ?? 'muted'}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {/* 原型 showingLabel：单数 'Showing 1 of 1 instance'，复数同构。 */}
          <span className="text-xs text-muted-foreground tabular-nums">
            Showing {total} of {total} instance{total === 1 ? '' : 's'}
          </span>
          {pageCount > 1 ? (
            <span className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="iconSm"
                aria-label="Previous page"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Page {safePage + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="iconSm"
                aria-label="Next page"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}


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
  const [manualRefreshing, setManualRefreshing] = React.useState(false);
  const bootstrapQuery = useBootstrapStateQuery(false);

  const detail = detailQuery.data;
  const current = statusQuery.data;

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
  /** 78097e9：未入网通过不提供激活入口（源 needActivate 前置 if (!approved.value) return false）。 */
  const needActivate = approved && needActivateOf(detail);
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
          // 2f92680：不再就地解锁，弹强制重登确认（ESC/关闭视同确认）。
          setActivatePolling(false);
          setReloginOpen(true);
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
  }, [activatePolling, refetchBootstrap]);

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

  /* ── 激活成功强制重登（2f92680：logout → 登录页整页跳转） ── */
  const [reloginOpen, setReloginOpen] = React.useState(false);
  /** 防重入：Action 点击与 onOpenChange(false) 可能连续触发。 */
  const reloginStartedRef = React.useRef(false);
  const logoutMutation = useAuthLogoutMutation();
  /** 先 POST /logout 再清本地会话回登录页；服务端失败也必须完成本地登出（源 store.logout try/finally，与 app-shell 同口径）。 */
  const onActivatedRelogin = React.useCallback(() => {
    if (reloginStartedRef.current) return;
    reloginStartedRef.current = true;
    logoutMutation
      .mutateAsync()
      .catch(() => undefined)
      .finally(() => {
        clearGatewaySession();
        logoutAndRedirect();
      });
  }, [logoutMutation]);

  /* ── 刷新（源 loadAll；query 缓存口径下为手动 refetch 四数据源） ── */
  /** 仅用户主动刷新期间置真：后台审核轮询的 isFetching 不得禁用 Refresh（源 :loading=loading）。 */
  const onRefreshAll = React.useCallback(() => {
    setManualRefreshing(true);
    void Promise.all([
      refetchDetail(),
      refetchStatus(),
      refetchBootstrap(),
    ]).finally(() => setManualRefreshing(false));
  }, [refetchDetail, refetchStatus, refetchBootstrap]);
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

      {/* 本行详情（原型 2026-09-21：概要条 + 双列卡 + 实例表）。 */}
      {detail ? (
        <>
          <BankSummaryStrip
            detail={detail}
            agreeTimeFallback={
              isApprovedStatus(current) ? current.agreeTime : undefined
            }
          />
          <BankInfoCards
            detail={detail}
            onEditContact={() => setContactEditing(true)}
          />
          <InstanceListCard
            detail={detail}
            needActivate={needActivate}
            activating={pushKeyMutation.isPending}
            onActivate={() => setActivateConfirmOpen(true)}
          />
        </>
      ) : isLoading ? (
        <section className="rounded-lg border border-border/60 bg-card panel-pad">
          <LoadingBlock variant="skeleton" />
        </section>
      ) : null}

      {/* 入网状态与申请卡（源 onboard-card max-width 680px；39c8a2b：approved
          且 detail 存在时整卡隐藏，防空壳/表单残留）。 */}
      {!hideOnboardCard ? (
        <section className="max-w-[680px] rounded-lg border border-border/60 bg-card panel-pad">
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
        </section>
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

      {/* 激活成功强制重登弹窗（2f92680）。 */}
      <ActivateReloginDialog
        open={reloginOpen}
        onConfirm={onActivatedRelogin}
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
