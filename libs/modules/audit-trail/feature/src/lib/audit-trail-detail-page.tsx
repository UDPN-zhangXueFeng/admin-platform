'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';

import { Button, CopyableEllipsisText } from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';

import {
  useAuditTrailDetailQuery,
  type AuditLogItem,
} from '@myorg/modules/audit-trail/data-access';
import {
  EMPTY_DISPLAY,
  resolveProcessingStatusMessageKey,
  resolveTokenTypeMessageKey,
  resolveTxTypeMessageKey,
} from '@myorg/modules/audit-trail/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

interface KvRow {
  key: string;
  label: string;
  value: React.ReactNode;
}

/** JSON 字符串格式化（源 view.tsx formatJsonContent）。 */
function formatJson(value?: string): string {
  if (!value) return EMPTY_DISPLAY;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatTime(ts?: number): string {
  return ts ? formatDate(ts, DATETIME_FMT) : EMPTY_DISPLAY;
}

/**
 * AuditTrailDetailPage — 审计追踪详情页。
 *
 * 迁移自 td-manage src/pages/financial/audit-trail/view.tsx（271 行）。
 * 区块：Basic Information（kv 10）+ Audit Logs（logList Timeline，每项 9 kv grid +
 * requestData/responseData JSON <pre>）+ Back。
 *
 * 路由：/audit-trail/view?id=traceId（dispatcher slug[0]=view → detail）。
 */
export function AuditTrailDetailPage() {
  const t = useTranslations('modules.audit-trail');
  const router = useRouter();
  const searchParams = useSearchParams();
  const traceId = searchParams.get('id') ?? '';

  const { data: detail, isLoading } = useAuditTrailDetailQuery(
    traceId || undefined,
  );

  if (!traceId) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          {t('action.back')}
        </Button>
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        {isLoading ? '' : t('empty')}
      </div>
    );
  }

  const txTypeKey = resolveTxTypeMessageKey(detail.txType);
  const tokenTypeKey = resolveTokenTypeMessageKey(detail.tokenType);

  const basicRows: KvRow[] = [
    {
      key: 'traceId',
      label: t('field.traceId'),
      value: <CopyableEllipsisText value={detail.traceId ?? ''} />,
    },
    {
      key: 'txType',
      label: t('field.txType'),
      value: <span>{txTypeKey ? t(txTypeKey) : EMPTY_DISPLAY}</span>,
    },
    {
      key: 'txFrom',
      label: t('field.txFrom'),
      value: <CopyableEllipsisText value={detail.txFrom ?? ''} />,
    },
    {
      key: 'txTo',
      label: t('field.txTo'),
      value: <CopyableEllipsisText value={detail.txTo ?? ''} />,
    },
    {
      key: 'txAmount',
      label: t('field.txAmount'),
      value: (
        <span>
          {detail.txAmount != null
            ? `${detail.txAmount} ${detail.symbol ?? ''}`.trim()
            : EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      key: 'tokenName',
      label: t('field.tokenName'),
      value: (
        <span>
          {detail.tokenName
            ? `${detail.tokenName}${
                tokenTypeKey ? ` (${t(tokenTypeKey)})` : ''
              }`
            : EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      key: 'blockchainName',
      label: t('field.blockchain'),
      value: <span>{detail.blockchainName || EMPTY_DISPLAY}</span>,
    },
    {
      key: 'createTime',
      label: t('field.createTime'),
      value: <span>{formatTime(detail.createTime)}</span>,
    },
    {
      key: 'txTime',
      label: t('field.txTime'),
      value: <span>{formatTime(detail.txTime)}</span>,
    },
    {
      key: 'txHash',
      label: t('field.txHash'),
      value: <CopyableEllipsisText value={detail.txHash ?? ''} />,
    },
  ];

  const logs = detail.logList ?? [];

  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('detail.basicInformation')}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>
              {basicRows.map((row) => (
                <tr key={row.key}>
                  <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                    {row.label}
                  </td>
                  <td className="break-all border px-4 py-3">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit Logs Timeline */}
      <section className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('detail.auditLogs')}
        </div>
        <div className="space-y-4 p-4">
          {logs.length ? (
            logs.map((log, idx) => (
              <AuditLogCard
                key={log.logId ?? idx}
                log={log}
                traceId={detail.traceId}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.back()}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}

/** 单条审计日志卡（源 view.tsx Timeline children）。 */
function AuditLogCard({
  log,
  traceId,
}: {
  log: AuditLogItem;
  traceId?: string;
}) {
  const t = useTranslations('modules.audit-trail');
  const statusKey = resolveProcessingStatusMessageKey(log.processingStatus);

  const items: KvRow[] = [
    {
      key: 'serviceName',
      label: t('field.serviceName'),
      value: <span>{log.serviceName || EMPTY_DISPLAY}</span>,
    },
    {
      key: 'requestor',
      label: t('field.requestor'),
      value: <span>{log.requestor || EMPTY_DISPLAY}</span>,
    },
    {
      key: 'requestHost',
      label: t('field.requestHost'),
      value: <span>{log.requestHost || EMPTY_DISPLAY}</span>,
    },
    {
      key: 'requestMethod',
      label: t('field.requestMethod'),
      value: <span>{log.requestMethod || EMPTY_DISPLAY}</span>,
    },
    {
      key: 'requestAddress',
      label: t('field.requestAddress'),
      value: <span>{log.requestAddress || EMPTY_DISPLAY}</span>,
    },
    {
      key: 'requestUrl',
      label: t('field.requestUrl'),
      value: <span>{log.requestUrl || EMPTY_DISPLAY}</span>,
    },
    {
      key: 'processingTime',
      label: t('field.processingTime'),
      value: (
        <span>
          {log.processingTime != null
            ? `${log.processingTime}${t('field.ms')}`
            : EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      key: 'traceId',
      label: t('field.traceId'),
      value: <span>{traceId || EMPTY_DISPLAY}</span>,
    },
    {
      key: 'processingStatus',
      label: t('field.processingStatus'),
      value: <span>{statusKey ? t(statusKey) : EMPTY_DISPLAY}</span>,
    },
  ];

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 text-sm font-medium text-muted-foreground">
        {log.serviceName || EMPTY_DISPLAY}{' '}
        {log.requestTime ? formatDate(log.requestTime, DATETIME_FMT) : ''}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.key} className="break-all">
            <span className="text-xs font-medium text-muted-foreground">
              {item.label}:{' '}
            </span>
            <span className="text-xs">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs font-medium">{t('field.requestData')}</div>
      <pre className="mt-1 max-h-24 overflow-auto rounded border bg-muted/30 p-3 text-xs">
        <code>{formatJson(log.requestData)}</code>
      </pre>
      <div className="mt-3 text-xs font-medium">
        {t('field.responseTime')}: {formatTime(log.responseTime)}
      </div>
      <div className="mt-1 text-xs font-medium">{t('field.responseData')}</div>
      <pre className="mt-1 max-h-24 overflow-auto rounded border bg-muted/30 p-3 text-xs">
        <code>{formatJson(log.responseData)}</code>
      </pre>
    </div>
  );
}
