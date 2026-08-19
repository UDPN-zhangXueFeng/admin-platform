'use client';

/**
 * 入网申请域页面（源 `views/onboard/index.vue`）。
 *
 * 源是单页语义：查询当前入网状态 → 未入网/被拒展示提交表单，
 * 审核中/已通过展示状态视图。registry 三键映射（主控契约）：
 * - list   = 状态总览 + 入口（/onboard）
 * - create = 提交表单（/onboard/create；已入网时按源语义回落状态视图）
 * - detail = 状态详情（/onboard/detail）
 */
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, Info, Loader2, RefreshCw, XCircle } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Skeleton,
  useToast,
} from '@myorg/shared/ui';
import { FormField, createFormResolver } from '@myorg/shared/ui-forms';
import { Link, useRouter } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  ONBOARD_AGREEMENT_VERSION,
  ONBOARD_STATUS_APPROVED,
  ONBOARD_STATUS_LABEL,
  ONBOARD_STATUS_PENDING,
  ONBOARD_STATUS_REJECTED,
  ONBOARD_STATUS_VARIANT,
  useOnboardBankInfoQuery,
  useOnboardStatusQuery,
  useOnboardSubmitMutation,
  type OnboardStatus,
} from '@myorg/modules/kissen-gateway/data-access';

/* ================================================================== */
/* 展示工具（源 views/onboard/index.vue fmtTime / supportedCurrencies） */
/* ================================================================== */

/** 毫秒时间戳 → 本地时间（源 fmtTime，1:1 移植；空 → '-'）。 */
function formatTime(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-';
}

/** supportedCurrencies 逗号分隔 → 币种数组（源 computed，1:1 移植）。 */
function splitCurrencies(
  bankInfo: { supportedCurrencies?: string } | null | undefined,
): string[] {
  return (bankInfo?.supportedCurrencies ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 状态判定（源 isPending/isApproved/isRejected computed）。
 * 谓词收窄目标为「非空且 status 已赋值」——`status === 常量` 隐含两者；
 * 不能声明成 `current is OnboardStatus`（那样未命中分支会被收窄成 never，
 * 因为入参联合里的 OnboardStatus 会被整体排除）。
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

/* ================================================================== */
/* 通用展示组件                                                        */
/* ================================================================== */

/** 页头（源 .page-head：eyebrow + 标题）。 */
function PageHead({ title }: { title: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold tracking-widest text-muted-foreground">
        PORTAL
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
    </div>
  );
}

/** 详情描述字段（el-descriptions-item 的 React 等价）。 */
function DescField({
  label,
  span = false,
  children,
}: {
  label: string;
  span?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5 rounded-md border px-4 py-3', span && 'sm:col-span-2')}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm tabular-nums">{children}</div>
    </div>
  );
}

/** 查询失败 + 重试（loading/empty/error 可感知约定）。 */
function QueryErrorRetry({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-destructive">Failed to load: {(error as Error).message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw />
        Retry
      </Button>
    </div>
  );
}

/** 加载骨架（源 v-loading 的等价）。 */
function LoadingBlock() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** el-result 的 React 等价（icon + title + sub-title + extra）。 */
function ResultPanel({
  tone,
  icon,
  title,
  subtitle,
  children,
}: {
  tone: 'info' | 'success' | 'danger';
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const toneClass = {
    info: 'text-sky-500',
    success: 'text-emerald-500',
    danger: 'text-destructive',
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
/* 银行基本信息卡（源 bankinfo-card + api/bank.ts GET /bank/info）       */
/* ================================================================== */

function BankInfoCard() {
  const { data: bankInfo, isLoading, isError, error, refetch } =
    useOnboardBankInfoQuery(KISSEN_GATEWAY_PROJECT_ID);

  const currencies = splitCurrencies(bankInfo);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Information</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <QueryErrorRetry error={error} onRetry={() => refetch()} />
        ) : !bankInfo ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Info className="h-8 w-8" />
            <p className="text-sm">No bank information yet (pushed by Kissen)</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DescField label="Bank Name">{bankInfo.bankName || '-'}</DescField>
            <DescField label="Bank Code">{bankInfo.bankCode || '-'}</DescField>
            <DescField label="BIC/SWIFT">{bankInfo.bic || '-'}</DescField>
            <DescField label="Status">
              {bankInfo.status === ONBOARD_STATUS_APPROVED ? (
                <Badge>Enabled</Badge>
              ) : (
                <Badge variant="outline">{bankInfo.status ?? '-'}</Badge>
              )}
            </DescField>
            <DescField label="Supported Currencies" span>
              {currencies.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {currencies.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </span>
              ) : (
                '-'
              )}
            </DescField>
            <DescField label="Single Tx Limit">{bankInfo.singleLimit ?? '-'}</DescField>
            <DescField label="Daily Limit">{bankInfo.dailyLimit ?? '-'}</DescField>
            <DescField label="Account Config" span>
              {bankInfo.accountConfig || '-'}
            </DescField>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================================================================== */
/* 状态视图（源 el-result 审核中 / 已通过 分支）                        */
/* ================================================================== */

/** 审核中 / 已通过 result（源模板 1:1；供 overview/detail 共用）。 */
function OnboardStatusResult({ current }: { current: OnboardStatus }) {
  const toast = useToast();
  const reviewFeedback = isPendingStatus(current)
    ? current.approveFeedback
    : null;
  React.useEffect(() => {
    if (reviewFeedback) {
      toast.info('Kissen review feedback', { description: reviewFeedback });
    }
  }, [reviewFeedback, toast]);

  if (isPendingStatus(current)) {
    return (
      <ResultPanel
        tone="info"
        icon={<Info className="h-8 w-8" />}
        title="Application Under Review"
        subtitle="Your onboarding application has been submitted and is awaiting Kissen review. Portal features unlock once approved."
      >
        <p className="text-sm text-muted-foreground">
          Submitted: {formatTime(current.agreeTime)}
        </p>
      </ResultPanel>
    );
  }
  return (
    <ResultPanel
      tone="success"
      icon={<CheckCircle2 className="h-8 w-8" />}
      title="Approved"
      subtitle="Your onboarding application has been approved. All portal features are available."
    >
      <p className="text-sm text-muted-foreground">
        Approved: {formatTime(current.agreeTime)}
      </p>
    </ResultPanel>
  );
}

/* ================================================================== */
/* 提交表单（源 el-form 分支 + formRules）                              */
/* ================================================================== */

/** 表单校验（源 FormRules：协议必勾 + 联系人必填；长度由 input maxLength 截断）。 */
const onboardApplySchema = z.object({
  agreeConfirmed: z
    .boolean()
    .refine((v) => v, { message: 'Please accept the onboarding agreement' }),
  contactName: z.string().min(1, { message: 'Please enter a contact name' }),
  contactInfo: z.string(),
});

type OnboardApplyFormValues = z.infer<typeof onboardApplySchema>;

function OnboardApplyForm() {
  const toast = useToast();
  const router = useRouter();
  const submitMutation = useOnboardSubmitMutation(KISSEN_GATEWAY_PROJECT_ID);

  const { register, handleSubmit, control, formState } =
    useForm<OnboardApplyFormValues>({
      resolver: createFormResolver(onboardApplySchema),
      mode: 'onTouched',
      defaultValues: { agreeConfirmed: false, contactName: '', contactInfo: '' },
    });

  const onSubmit = handleSubmit((v) => {
    // 源提交 {...form}：四个字段全量（contactInfo 空串也随源原样上送）。
    submitMutation.mutate(
      {
        agreeConfirmed: v.agreeConfirmed,
        contactName: v.contactName,
        contactInfo: v.contactInfo,
        agreementVersion: ONBOARD_AGREEMENT_VERSION,
      },
      {
        onSuccess: () => {
          // 源：ElMessage.success → loadStatus() 刷新回状态视图（审核中）。
          toast.success('Application submitted. Please wait for review');
          router.push('/onboard');
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
              <span>I have read and agree to the Kissen Bank Gateway Onboarding Service Agreement</span>
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
        name="contactInfo"
        label="Contact Info"
        maxLength={50}
        placeholder="Phone or email, so the platform can reach you"
        className="max-w-[360px]"
        error={formState.errors.contactInfo?.message}
        register={register('contactInfo')}
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
/* 导出页（registry 依赖，名字不可改）                                  */
/* ================================================================== */

/** 入网申请 — 状态总览 + 入口（源单页 list 映射）。 */
export function OnboardListPage() {
  const { data: current, isLoading, isError, error, refetch } =
    useOnboardStatusQuery(KISSEN_GATEWAY_PROJECT_ID);

  const toast = useToast();
  const rejectFeedback = isRejectedStatus(current)
    ? current.approveFeedback
    : null;
  React.useEffect(() => {
    if (rejectFeedback) {
      toast.warning('Previous application was rejected', {
        description: rejectFeedback,
      });
    }
  }, [rejectFeedback, toast]);

  return (
    <div className="space-y-6">
      <PageHead title="Onboarding" />
      <BankInfoCard />
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingBlock />
          ) : isError ? (
            <QueryErrorRetry error={error} onRetry={() => refetch()} />
          ) : isPendingStatus(current) || isApprovedStatus(current) ? (
            <div className="space-y-4">
              <OnboardStatusResult current={current} />
              <div className="flex justify-center">
                <Button asChild variant="outline" size="sm">
                  <Link href="/onboard/detail">View Details</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Badge
                  variant={
                    isRejectedStatus(current)
                      ? ONBOARD_STATUS_VARIANT[ONBOARD_STATUS_REJECTED]
                      : 'outline'
                  }
                >
                  {isRejectedStatus(current)
                    ? ONBOARD_STATUS_LABEL[ONBOARD_STATUS_REJECTED]
                    : 'Not Onboarded'}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Submit an onboarding application and wait for Kissen review. Portal features unlock once approved.
                </p>
                <Button asChild>
                  <Link href="/onboard/create">Submit Application</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** 入网申请 — 提交表单（源表单分支；已入网时按源语义回落状态视图）。 */
export function OnboardFormPage() {
  const { data: current, isLoading, isError, error, refetch } =
    useOnboardStatusQuery(KISSEN_GATEWAY_PROJECT_ID);

  const toast = useToast();
  const rejectFeedback = isRejectedStatus(current)
    ? current.approveFeedback
    : null;
  React.useEffect(() => {
    if (rejectFeedback) {
      toast.warning('Previous application was rejected', {
        description: rejectFeedback,
      });
    }
  }, [rejectFeedback, toast]);

  return (
    <div className="space-y-6">
      <PageHead title="Submit Onboarding Application" />
      <BankInfoCard />
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Application</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingBlock />
          ) : isError ? (
            <QueryErrorRetry error={error} onRetry={() => refetch()} />
          ) : isPendingStatus(current) || isApprovedStatus(current) ? (
            // 源语义：审核中/已通过不渲染表单，只渲染状态结果。
            <OnboardStatusResult current={current} />
          ) : (
            <>
              <OnboardApplyForm />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** 入网申请 — 状态详情（detail 映射；四态各有可感知视图）。 */
export function OnboardDetailPage() {
  const { data: current, isLoading, isError, error, refetch } =
    useOnboardStatusQuery(KISSEN_GATEWAY_PROJECT_ID);

  return (
    <div className="space-y-6">
      <PageHead title="Onboarding Status" />
      <BankInfoCard />
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingBlock />
          ) : isError ? (
            <QueryErrorRetry error={error} onRetry={() => refetch()} />
          ) : isPendingStatus(current) || isApprovedStatus(current) ? (
            <OnboardStatusResult current={current} />
          ) : isRejectedStatus(current) ? (
            <ResultPanel
              tone="danger"
              icon={<XCircle className="h-8 w-8" />}
              title="Previous Application Rejected"
              subtitle={current.approveFeedback}
            >
              <p className="text-sm text-muted-foreground">
                Submitted: {formatTime(current.agreeTime)}
              </p>
              <Button asChild size="sm">
                <Link href="/onboard/create">Resubmit Application</Link>
              </Button>
            </ResultPanel>
          ) : (
            <ResultPanel
              tone="info"
              icon={<Info className="h-8 w-8" />}
              title="No Application Yet"
              subtitle="Submit an onboarding application and wait for Kissen review. Portal features unlock once approved."
            >
              <Button asChild size="sm">
                <Link href="/onboard/create">Submit Application</Link>
              </Button>
            </ResultPanel>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
