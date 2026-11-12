'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ArrowLeftRight, TriangleAlert } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CopyableEllipsisText,
  Skeleton,
} from '@myorg/shared/ui';
import {
  useKissenTransferDetail,
  type KissenTransferDetail,
  type KissenTransferStage,
} from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import {
  formatDuration,
  formatRate,
  formatTokenAmount,
  isTruthyFlag,
  KISSEN_EMPTY_DISPLAY,
  KISSEN_STAGE_TITLE_KEYS,
  KISSEN_TERMINAL_STATUSES,
  KISSEN_TX_STATUS,
} from './kissen-transfer.constants';

interface ChainField {
  label: string;
  value: string;
}

/**
 * Kissen 跨行转账详情。
 *
 * 迁移自 td-manage `pages/transaction-flow/kissen-transfer/view.tsx`：
 * Overview（Sent / Received / FX Rate）/ Transaction Information（Source、Target）/
 * Timing / Transaction Chain；`found=false` 时提示交易尚未同步到本地系统。
 * 数据来源 POST /api/manage/v1/kissen/transfer/detail（includeChain=true）。
 */
export function KissenTransferDetailPage() {
  const t = useTranslations('modules.transaction-flow');
  const tc = useTranslations('common');
  const router = useRouter();
  const routeParams = useParams();
  const searchParams = useSearchParams();

  const rawSlug = routeParams?.slug;
  const slug: string[] = Array.isArray(rawSlug) ? rawSlug : [];
  const segment = slug[1] ?? '';
  const routeId = /^\d+$/.test(segment) ? Number(segment) : 0;
  const queryId = Number(searchParams.get('id') ?? 0);
  const transactionId = routeId || queryId || 0;
  const txUuid = searchParams.get('txUuid') || undefined;
  const sourceCsTxId = searchParams.get('sourceCsTxId') || undefined;
  const targetCsTxId = searchParams.get('targetCsTxId') || undefined;

  const detailParams = React.useMemo(
    () => ({
      transactionId,
      includeChain: true,
      txUuid,
      sourceCsTxId,
      targetCsTxId,
    }),
    [transactionId, txUuid, sourceCsTxId, targetCsTxId],
  );

  const { data, isLoading, isError, refetch } =
    useKissenTransferDetail(detailParams);

  const info: KissenTransferDetail = data ?? {};
  const flowNodes = React.useMemo(
    () => info.chain?.kissenChain ?? [],
    [info.chain?.kissenChain],
  );

  const statusMeta =
    info.status === null || info.status === undefined
      ? undefined
      : KISSEN_TX_STATUS[Number(info.status)];

  /** 完成时刻取链路最后一个终态事件；链路未取回时为空。 */
  const timing = React.useMemo(() => {
    const created =
      info.createTime === null || info.createTime === undefined
        ? null
        : Number(info.createTime);
    const completed = flowNodes
      .filter((node) =>
        KISSEN_TERMINAL_STATUSES.includes(Number(node.statusTo ?? -1)),
      )
      .reduce<number | null>((latest, node) => {
        const time =
          node.eventTime === null || node.eventTime === undefined
            ? null
            : Number(node.eventTime);
        return time !== null && (latest === null || time > latest)
          ? time
          : latest;
      }, null);
    const duration =
      created !== null && completed !== null && completed >= created
        ? completed - created
        : null;
    return { created, completed, duration };
  }, [info.createTime, flowNodes]);

  const srcSymbol = info.sourceTokenSymbol || KISSEN_EMPTY_DISPLAY;
  const tgtSymbol = info.targetTokenSymbol || KISSEN_EMPTY_DISPLAY;
  const lpDisplay = info.lpNames?.length
    ? info.lpNames.join(', ')
    : info.lpCode || KISSEN_EMPTY_DISPLAY;

  const stageFieldsOf = (
    node: KissenTransferStage,
    record: KissenTransferDetail,
  ): ChainField[] => {
    const step = Number(node.stageStep ?? 0);
    if (step === 0) return [];
    const src = record.sourceTokenSymbol || KISSEN_EMPTY_DISPLAY;
    const tgt = record.targetTokenSymbol || KISSEN_EMPTY_DISPLAY;
    const fields: ChainField[] = [];
    const lp = record.lpNames?.length
      ? record.lpNames.join(', ')
      : record.lpCode;
    const deduction =
      record.userDeduction !== null && record.userDeduction !== undefined
        ? `${formatTokenAmount(record.userDeduction)} ${src}`
        : undefined;
    const receiver =
      record.receiverAmount !== null && record.receiverAmount !== undefined
        ? `${formatTokenAmount(record.receiverAmount)} ${tgt}`
        : undefined;
    const rate =
      record.userRate !== null && record.userRate !== undefined
        ? `1 ${src} ≈ ${formatRate(record.userRate)} ${tgt}`
        : undefined;
    if (step === 1) {
      if (lp) fields.push({ label: t('kissen_transfer_lp'), value: lp });
      if (deduction) {
        fields.push({ label: t('kissen_transfer_payment'), value: deduction });
      }
      if (receiver) {
        fields.push({ label: t('kissen_transfer_target'), value: receiver });
      }
      if (rate) fields.push({ label: t('kissen_transfer_rate'), value: rate });
    } else if (step === 3 || step === 4) {
      if (deduction) {
        fields.push({ label: t('kissen_transfer_payment'), value: deduction });
      }
      if (node.csTxId) {
        fields.push({ label: t('kissen_transfer_ref'), value: node.csTxId });
      }
    } else if (step === 5 || step === 6) {
      if (receiver) {
        fields.push({ label: t('kissen_transfer_target'), value: receiver });
      }
      if (node.csTxId) {
        fields.push({ label: t('kissen_transfer_ref'), value: node.csTxId });
      }
    }
    return fields;
  };

  const goBack = () => router.back();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid gap-5 xl:grid-cols-5">
          <Skeleton className="h-72 rounded-xl xl:col-span-3" />
          <Skeleton className="h-72 rounded-xl xl:col-span-2" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-5">
        <Alert variant="destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <div>
            <AlertTitle>{t('kissen_transfer_load_failed')}</AlertTitle>
            <AlertDescription>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => refetch()}
              >
                {t('kissen_transfer_retry')}
              </Button>
            </AlertDescription>
          </div>
        </Alert>
        <div className="flex justify-center">
          <Button variant="outline" onClick={goBack}>
            {tc('PUB_GoBack')}
          </Button>
        </div>
      </div>
    );
  }

  if (!data || transactionId <= 0) {
    return (
      <div className="space-y-5">
        <Alert variant="warning">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <div>
            <AlertTitle>
              {transactionId <= 0
                ? t('kissen_transfer_missing_id')
                : t('kissen_transfer_not_found_title')}
            </AlertTitle>
            <AlertDescription>{t('kissen_transfer_not_found')}</AlertDescription>
          </div>
        </Alert>
        <div className="flex justify-center">
          <Button variant="outline" onClick={goBack}>
            {tc('PUB_GoBack')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {info.found === false && (
        <Alert variant="warning">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <div>
            <AlertTitle>{t('kissen_transfer_not_found_title')}</AlertTitle>
            <AlertDescription>{t('kissen_transfer_not_found')}</AlertDescription>
          </div>
        </Alert>
      )}

      {/* 页头：标题 + 状态 + 元信息行 */}
      <Card>
        <CardHeader className="flex-col items-start gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-xl">
              {t('kissen_transfer_detail_title')}
            </CardTitle>
            {statusMeta && (
              <Badge variant={statusMeta.variant} dot>
                {t(statusMeta.labelKey)}
              </Badge>
            )}
            {isTruthyFlag(info.pendingFlag) && (
              <Badge variant="warning">{t('kissen_transfer_pending')}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span>{t('kissen_transfer_transaction_no')}</span>
              <CopyableEllipsisText
                value={info.txNo || info.txUuid || String(transactionId)}
                truncate="middle"
                maxWidth={220}
                className="font-medium text-foreground"
              />
            </span>
            <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
            <span>
              {t('kissen_transfer_created_on')}{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatAdminTimestamp(info.createTime)}
              </span>
            </span>
            <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
            <span>
              {t('kissen_transfer_last_sync')}{' '}
              <span className="font-medium tabular-nums text-foreground">
                {formatAdminTimestamp(info.lastSyncTime)}
              </span>
            </span>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 xl:grid-cols-5 xl:items-start">
        {/* 左栏：概览、交易信息与时间信息 */}
        <div className="space-y-5 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{t('kissen_transfer_overview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t('kissen_transfer_sent_amount')}
                    </span>
                    {info.sourceBankCode && (
                      <Badge variant="outline">{info.sourceBankCode}</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
                    <span className="break-all text-2xl font-bold tabular-nums">
                      {formatTokenAmount(info.userDeduction)}
                    </span>
                    <span className="text-sm font-semibold">{srcSymbol}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <Badge variant="outline" className="tabular-nums">
                    {`1 ${srcSymbol} ≈ ${formatRate(info.userRate)} ${tgtSymbol}`}
                  </Badge>
                  <ArrowLeftRight
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Badge variant="info">{lpDisplay}</Badge>
                </div>

                <div className="md:text-right">
                  <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                    {info.targetBankCode && (
                      <Badge variant="outline">{info.targetBankCode}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {t('kissen_transfer_received_amount')}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-baseline gap-1.5 md:justify-end">
                    <span className="break-all text-2xl font-bold tabular-nums text-success">
                      {info.receiverAmount === null ||
                      info.receiverAmount === undefined
                        ? KISSEN_EMPTY_DISPLAY
                        : `+${formatTokenAmount(info.receiverAmount)}`}
                    </span>
                    <span className="text-sm font-semibold">{tgtSymbol}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('kissen_transfer_information')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <section>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {t('kissen_transfer_source')}
                    </span>
                    <Badge variant="outline">{srcSymbol}</Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    <InfoRow label={t('kissen_transfer_bank')}>
                      {info.senderBankName || KISSEN_EMPTY_DISPLAY}
                    </InfoRow>
                    <InfoRow label={t('kissen_transfer_wallet')}>
                      <CopyableEllipsisText
                        value={info.senderAccount}
                        truncate="middle"
                        maxWidth={260}
                        className="font-mono"
                      />
                    </InfoRow>
                    <InfoRow label={t('kissen_transfer_tx_id')}>
                      <CopyableEllipsisText
                        value={info.sourceCsTxId}
                        truncate="middle"
                        maxWidth={260}
                        className="font-mono"
                      />
                    </InfoRow>
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">
                      {t('kissen_transfer_target')}
                    </span>
                    <Badge variant="outline">{tgtSymbol}</Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    <InfoRow label={t('kissen_transfer_bank')}>
                      {info.receivingBankName || KISSEN_EMPTY_DISPLAY}
                    </InfoRow>
                    <InfoRow label={t('kissen_transfer_wallet')}>
                      <CopyableEllipsisText
                        value={info.receiverAccount}
                        truncate="middle"
                        maxWidth={260}
                        className="font-mono"
                      />
                    </InfoRow>
                    <InfoRow label={t('kissen_transfer_tx_id')}>
                      <CopyableEllipsisText
                        value={info.targetCsTxId}
                        truncate="middle"
                        maxWidth={260}
                        className="font-mono"
                      />
                    </InfoRow>
                  </div>
                </section>
              </div>

              {isTruthyFlag(info.pendingFlag) && (
                <div className="mt-4 border-t border-border pt-4 text-sm">
                  <Badge variant="warning">
                    {t('kissen_transfer_pending')}
                  </Badge>
                  <span className="ml-2 break-words">
                    {info.pendingReason || KISSEN_EMPTY_DISPLAY}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('kissen_transfer_timing')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <TimingItem
                  label={t('kissen_transfer_created_on')}
                  value={formatAdminTimestamp(timing.created)}
                />
                <TimingItem
                  label={t('kissen_transfer_completed_on')}
                  value={formatAdminTimestamp(timing.completed)}
                />
                <TimingItem
                  label={t('kissen_transfer_duration')}
                  value={
                    timing.duration !== null
                      ? formatDuration(timing.duration)
                      : KISSEN_EMPTY_DISPLAY
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右栏：Transaction Chain */}
        <div className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t('kissen_transfer_chain_title')}</CardTitle>
              <span className="text-xs tabular-nums text-muted-foreground">
                {t('kissen_transfer_chain_count', {
                  count: flowNodes.length,
                })}
              </span>
            </CardHeader>
            <CardContent>
              {flowNodes.length ? (
                <ol className="space-y-0">
                  {flowNodes.map((node, index) => {
                    const stage = Number(node.stageStep ?? 0);
                    const title =
                      KISSEN_STAGE_TITLE_KEYS[stage] !== undefined
                        ? t(KISSEN_STAGE_TITLE_KEYS[stage])
                        : node.remark ||
                          (KISSEN_TX_STATUS[Number(node.statusTo)]
                            ? t(
                                KISSEN_TX_STATUS[Number(node.statusTo)]
                                  .labelKey,
                              )
                            : KISSEN_EMPTY_DISPLAY);
                    const fields = stageFieldsOf(node, info);
                    return (
                      <li
                        key={String(node.flowId ?? `${node.step}-${node.eventTime}`)}
                        className="relative flex gap-3 pb-5 last:pb-0"
                      >
                        {index < flowNodes.length - 1 && (
                          <span
                            className="absolute left-[6px] top-4 h-full w-px bg-border"
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className="relative z-10 mt-1 size-3 shrink-0 rounded-full border-2 border-primary bg-card"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold">
                              {title}
                            </span>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {formatAdminTimestamp(node.eventTime)}
                            </span>
                          </div>
                          {fields.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {fields.map((field) => (
                                <div
                                  key={field.label}
                                  className="flex items-baseline gap-2 text-xs"
                                >
                                  <span className="w-14 shrink-0 text-muted-foreground">
                                    {field.label}
                                  </span>
                                  <span className="min-w-0 flex-1 break-all font-mono tabular-nums">
                                    {field.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {node.remark && stage !== 0 && (
                            <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                              {node.remark}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {t('kissen_transfer_no_stages')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={goBack}>
          {tc('PUB_GoBack')}
        </Button>
      </div>
    </div>
  );
}

/** 信息行：左侧标签固定宽度，右侧值。 */
function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1 break-all text-sm font-medium">
        {children}
      </div>
    </div>
  );
}

/** 时间信息单元。 */
function TimingItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 break-words text-sm font-medium tabular-nums">
        {value}
      </div>
    </div>
  );
}
