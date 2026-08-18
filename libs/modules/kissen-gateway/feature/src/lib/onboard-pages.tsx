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
  Alert,
  AlertTitle,
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
      <p className="text-sm text-destructive">加载失败:{(error as Error).message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw />
        重试
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

/** 信息/警示 alert 色调（源 el-alert type=info/warning，shared Alert 仅 default/destructive）。 */
const ALERT_INFO_CLASS =
  'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100';
const ALERT_WARNING_CLASS =
  'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100';

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
        <CardTitle>银行基本信息</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingBlock />
        ) : isError ? (
          <QueryErrorRetry error={error} onRetry={() => refetch()} />
        ) : !bankInfo ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Info className="h-8 w-8" />
            <p className="text-sm">暂无银行信息（由 Kissen 推送）</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DescField label="银行名称">{bankInfo.bankName || '-'}</DescField>
            <DescField label="银行编码">{bankInfo.bankCode || '-'}</DescField>
            <DescField label="BIC/SWIFT">{bankInfo.bic || '-'}</DescField>
            <DescField label="状态">
              {bankInfo.status === ONBOARD_STATUS_APPROVED ? (
                <Badge>启用</Badge>
              ) : (
                <Badge variant="outline">{bankInfo.status ?? '-'}</Badge>
              )}
            </DescField>
            <DescField label="支持币种" span>
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
            <DescField label="单笔限额">{bankInfo.singleLimit ?? '-'}</DescField>
            <DescField label="日累计限额">{bankInfo.dailyLimit ?? '-'}</DescField>
            <DescField label="账户参数" span>
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
  if (isPendingStatus(current)) {
    return (
      <ResultPanel
        tone="info"
        icon={<Info className="h-8 w-8" />}
        title="入网申请审核中"
        subtitle="您的入网申请已提交,等待 Kissen 审核,通过后即可使用门户功能。"
      >
        {current.approveFeedback ? (
          <Alert className={ALERT_INFO_CLASS}>
            <Info className="h-4 w-4 shrink-0" />
            <AlertTitle>{current.approveFeedback}</AlertTitle>
          </Alert>
        ) : null}
        <p className="text-sm text-muted-foreground">
          申请时间:{formatTime(current.agreeTime)}
        </p>
      </ResultPanel>
    );
  }
  return (
    <ResultPanel
      tone="success"
      icon={<CheckCircle2 className="h-8 w-8" />}
      title="已通过"
      subtitle="您的入网申请已审核通过,可正常使用门户各项功能。"
    >
      <p className="text-sm text-muted-foreground">
        通过时间:{formatTime(current.agreeTime)}
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
    .refine((v) => v, { message: '请先勾选入网协议' }),
  contactName: z.string().min(1, { message: '请输入联系人' }),
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
          toast.success('入网申请已提交,请等待审核');
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
              <span>我已阅读并同意《Kissen 银行网关入网服务协议》</span>
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
        label="联系人"
        required
        maxLength={30}
        placeholder="请输入联系人姓名"
        className="max-w-[360px]"
        error={formState.errors.contactName?.message}
        register={register('contactName')}
      />
      <FormField
        name="contactInfo"
        label="联系方式"
        maxLength={50}
        placeholder="手机 / 邮箱等,便于平台联系"
        className="max-w-[360px]"
        error={formState.errors.contactInfo?.message}
        register={register('contactInfo')}
      />
      <div>
        <Button type="submit" disabled={submitMutation.isPending}>
          {submitMutation.isPending && <Loader2 className="animate-spin" />}
          提交入网申请
        </Button>
      </div>
    </form>
  );
}

/** 被拒提示（源 reject-alert：type=warning，仅被拒且有反馈时展示）。 */
function RejectAlert({ feedback }: { feedback: string }) {
  return (
    <Alert className={cn('mb-4', ALERT_WARNING_CLASS)}>
      <XCircle className="h-4 w-4 shrink-0" />
      <AlertTitle>上次申请未通过:{feedback}</AlertTitle>
    </Alert>
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
      <PageHead title="入网申请" />
      <BankInfoCard />
      <Card>
        <CardHeader>
          <CardTitle>入网状态</CardTitle>
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
                  <Link href="/onboard/detail">查看详情</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {isRejectedStatus(current) && current.approveFeedback ? (
                <RejectAlert feedback={current.approveFeedback} />
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
                    : '未入网'}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  提交入网申请,等待 Kissen 审核,通过后即可使用门户功能。
                </p>
                <Button asChild>
                  <Link href="/onboard/create">提交入网申请</Link>
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
      <PageHead title="提交入网申请" />
      <BankInfoCard />
      <Card>
        <CardHeader>
          <CardTitle>入网申请</CardTitle>
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
              {isRejectedStatus(current) && current.approveFeedback ? (
                <RejectAlert feedback={current.approveFeedback} />
              ) : null}
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
      <PageHead title="入网状态详情" />
      <BankInfoCard />
      <Card>
        <CardHeader>
          <CardTitle>入网状态</CardTitle>
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
              title="上次申请未通过"
              subtitle={current.approveFeedback}
            >
              <p className="text-sm text-muted-foreground">
                申请时间:{formatTime(current.agreeTime)}
              </p>
              <Button asChild size="sm">
                <Link href="/onboard/create">重新提交入网申请</Link>
              </Button>
            </ResultPanel>
          ) : (
            <ResultPanel
              tone="info"
              icon={<Info className="h-8 w-8" />}
              title="尚无入网申请"
              subtitle="提交入网申请,等待 Kissen 审核,通过后即可使用门户功能。"
            >
              <Button asChild size="sm">
                <Link href="/onboard/create">提交入网申请</Link>
              </Button>
            </ResultPanel>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
