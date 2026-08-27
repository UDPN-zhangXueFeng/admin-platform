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
import { AlertCircle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

import {
  Alert,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
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

import { DescField, DescGrid } from './desc-grid';
import { formatTime } from './kit';
import { PageHead } from './page-head';
import { LoadingBlock, QueryErrorRetry } from './state-blocks';

/* ================================================================== */
/* 展示工具（源 views/onboard/index.vue fmtTime / supportedCurrencies） */
/* ================================================================== */

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
    <Card className="max-w-[680px]">
      <CardHeader>
        <CardTitle>Bank Information</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingBlock variant="skeleton" />
        ) : isError ? (
          <QueryErrorRetry error={error} onRetry={() => refetch()} withIcon />
        ) : !bankInfo ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Info className="h-8 w-8" />
            <p className="text-sm">No bank information</p>
          </div>
        ) : (
          <DescGrid cols={2}>
            <DescField label="Bank Name" variant="boxed">{bankInfo.bankName || '-'}</DescField>
            <DescField label="Bank Code" variant="boxed">{bankInfo.bankCode || '-'}</DescField>
            <DescField label="BIC/SWIFT" variant="boxed">{bankInfo.bic || '-'}</DescField>
            <DescField label="Status" variant="boxed">
              {bankInfo.status === ONBOARD_STATUS_APPROVED ? (
                <Badge>Enabled</Badge>
              ) : (
                <Badge variant="outline">{bankInfo.status ?? '-'}</Badge>
              )}
            </DescField>
            <DescField label="Supported Currencies" span variant="boxed">
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
            <DescField label="Single Tx Limit" variant="boxed">{bankInfo.singleLimit ?? '-'}</DescField>
            <DescField label="Daily Limit" variant="boxed">{bankInfo.dailyLimit ?? '-'}</DescField>
            <DescField label="Account Config" span variant="boxed">
              {bankInfo.accountConfig || '-'}
            </DescField>
          </DescGrid>
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
  if (isPendingStatus(current)) {
    return (
      <ResultPanel
        tone="info"
        icon={<Info className="h-8 w-8" />}
        title="Application Under Review"
        subtitle="Your onboarding application has been submitted and is awaiting Kissen review. Portal features unlock once approved."
      >
        {/* 源 L39：approveFeedback 有值 → info alert 持久内联展示（非 toast）。 */}
        {current.approveFeedback ? (
          <Alert className="max-w-md border-sky-200 bg-sky-50 text-sky-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <AlertTitle>{current.approveFeedback}</AlertTitle>
          </Alert>
        ) : null}
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

/** 驳回反馈内联告警（源 L53-57 el-alert warning「上次申请未通过:${approveFeedback}」，有值才渲染）。 */
function RejectFeedbackAlert({ current }: { current: OnboardStatusRecord }) {
  if (!current.approveFeedback) return null;
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <AlertTitle>Previous application was rejected: {current.approveFeedback}</AlertTitle>
    </Alert>
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

  return (
    <div className="space-y-6">
      <PageHead variant="stacked" title="Onboarding" />
      <BankInfoCard />
      <Card className="max-w-[680px]">
        <CardHeader>
          <CardTitle>Onboarding Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingBlock variant="skeleton" />
          ) : isError ? (
            <QueryErrorRetry error={error} onRetry={() => refetch()} withIcon />
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
              {/* 源 L53-57：驳回态在表单/入口上方持久展示驳回原因。 */}
              {isRejectedStatus(current) ? (
                <RejectFeedbackAlert current={current} />
              ) : null}
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
                    : 'Not Submitted'}
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

  return (
    <div className="space-y-6">
      <PageHead variant="stacked" title="Submit Onboarding Application" />
      <BankInfoCard />
      <Card className="max-w-[680px]">
        <CardHeader>
          <CardTitle>Onboarding Application</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingBlock variant="skeleton" />
          ) : isError ? (
            <QueryErrorRetry error={error} onRetry={() => refetch()} withIcon />
          ) : isPendingStatus(current) || isApprovedStatus(current) ? (
            // 源语义：审核中/已通过不渲染表单，只渲染状态结果。
            <OnboardStatusResult current={current} />
          ) : (
            <div className="space-y-4">
              {/* 源 L53-57：驳回后重新提交 → 表单上方 warning alert 展示上次驳回原因。 */}
              {isRejectedStatus(current) ? (
                <RejectFeedbackAlert current={current} />
              ) : null}
              <OnboardApplyForm />
            </div>
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
      <PageHead variant="stacked" title="Onboarding Status" />
      <BankInfoCard />
      <Card className="max-w-[680px]">
        <CardHeader>
          <CardTitle>Onboarding Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingBlock variant="skeleton" />
          ) : isError ? (
            <QueryErrorRetry error={error} onRetry={() => refetch()} withIcon />
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
