/**
 * KeySignedTransactionsListPage — paginated list with search, filters, and detail navigation.
 *
 * Architecture:
 * - Server-state (list data)    → TanStack Query via useKeySignedTransactionsQuery
 * - Reference data              → TanStack Query for key-services, stablecoins, blockchains
 * - Client-state (filters)      → react-hook-form
 * - Table rendering             → shared DataTable
 *
 * Contract notes (vs upstream key-signed-transactions/index.tsx):
 * - Filter set matches upstream incl. the Signature Date / Submission Date
 *   ranges, posted as day-bounded ms timestamps (start 00:00:00 / end
 *   23:59:59, upstream CustomForm range semantics).
 * - Key Service Name dropdown loads from POST /key/config/listKeyService
 *   (keyConfigListKeyServiceApi) — same endpoint the data-access layer now
 *   uses; the previously-fabricated GET endpoint is gone.
 * - Status cell: label from `common_task_status_${n}` (module ns) guarded by
 *   t.has (next-intl throws on missing messages in production; unknown codes
 *   render the raw number like upstream renders the raw key), tone from
 *   `common.approval_task_status_color_${n}`.
 * - Details action is always rendered (upstream `limit: 'OS_P_show'` is a
 *   hard-coded always-visible case in CustomTable), disabled without a
 *   txRecordId.
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';

import { formatDate } from '@myorg/shared/util-dates';
import { Alert, Button, DataTable, Input } from '@myorg/shared/ui';
import { FormSelect } from '@myorg/shared/ui-forms';

import {
  useKeySignedTransactionsQuery,
  useKeyServicePlatformsQuery,
  useStablecoinOptionsQuery,
  useBlockchainOptionsQuery,
  type KeySignedTransaction,
  type KeySignedTransactionListFilters,
} from '@myorg/modules/td-admin/data-access';

import {
  transactionTypeLabelMap,
  signatureTypeMap,
} from '.';

/** Timestamp column format, matching sibling list pages. */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** Table row handed to DataTable — wire item plus its client-side row id. */
type KeySignedTransactionRow = KeySignedTransaction & { id: string };

/** Minimal structural type of a next-intl messages accessor (t + t.has). */
interface MessagesAccessor {
  (key: string): string;
  has(key: string): boolean;
}

/** Semantic status color word (common.json) → tailwind badge classes. */
const TONE_CLASS: Record<string, string> = {
  success: 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400',
  processing: 'border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warning: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400',
  orange: 'border-orange-600/40 bg-orange-500/10 text-orange-700 dark:text-orange-400',
  gray: 'border-border bg-muted text-muted-foreground',
  default: 'border-border bg-muted text-muted-foreground',
};

/** Local day start (00:00:00) for a yyyy-mm-dd input (upstream range semantics). */
function toDayStart(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Local day end, including the final millisecond. */
function toDayEnd(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Format a Unix timestamp (ms) in the shared portal column format. */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return formatDate(Number(ts), DATETIME_FMT);
}

/** Token Type label — falls back to the raw number for unknown codes. */
function formatTokenType(
  t: MessagesAccessor,
  value: number | string | undefined | null,
): string {
  if (value === undefined || value === null || value === '') return '--';
  const numeric = Number(value);
  if (Number.isFinite(numeric) && t.has(`token_type_${numeric}`)) {
    return t(`token_type_${numeric}`);
  }
  return String(value);
}

/** Status label — raw number fallback for codes missing from messages. */
function formatTaskStatus(
  t: MessagesAccessor,
  raw: number | string | undefined | null,
): string {
  if (raw === undefined || raw === null || raw === '') return '--';
  const status = Number(raw);
  if (Number.isFinite(status) && t.has(`common_task_status_${status}`)) {
    return t(`common_task_status_${status}`);
  }
  return String(raw);
}

const filterSchema = z.object({
  signatureId: z.string().optional(),
  thirdPartyPlatformId: z.string().optional(),
  walletAddress: z.string().optional(),
  transactionType: z.string().optional(),
  signatureType: z.string().optional(),
  tokenId: z.string().optional(),
  blockchainId: z.string().optional(),
  startSignatureDate: z.string().optional(),
  endSignatureDate: z.string().optional(),
  startSubmissionDate: z.string().optional(),
  endSubmissionDate: z.string().optional(),
  transactionHash: z.string().optional(),
});

type FilterFormValues = z.infer<typeof filterSchema>;

const DEFAULT_FILTER_VALUES: FilterFormValues = {
  signatureId: '',
  thirdPartyPlatformId: '',
  walletAddress: '',
  transactionType: '',
  signatureType: '',
  tokenId: '',
  blockchainId: '',
  startSignatureDate: '',
  endSignatureDate: '',
  startSubmissionDate: '',
  endSubmissionDate: '',
  transactionHash: '',
};

export function KeySignedTransactionsListPage() {
  const t = useTranslations('modules.key-management');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const { register, reset, control, getValues } = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: DEFAULT_FILTER_VALUES,
  });

  // Committed filter values — only a Query click sends them to the server.
  const [committed, setCommitted] = React.useState<FilterFormValues>(
    DEFAULT_FILTER_VALUES,
  );

  const params = React.useMemo(() => {
    const data: KeySignedTransactionListFilters = {};
    if (committed.signatureId) data.signatureId = committed.signatureId;
    if (committed.thirdPartyPlatformId)
      data.thirdPartyPlatformId =
        Number(committed.thirdPartyPlatformId) || undefined;
    if (committed.walletAddress) data.walletAddress = committed.walletAddress;
    if (committed.transactionType)
      data.transactionType = committed.transactionType;
    if (committed.signatureType)
      data.signatureType = committed.signatureType;
    if (committed.tokenId) data.tokenId = Number(committed.tokenId) || undefined;
    if (committed.blockchainId)
      data.blockchainId = Number(committed.blockchainId) || undefined;
    const startSignatureDate = toDayStart(committed.startSignatureDate);
    if (startSignatureDate !== undefined)
      data.startSignatureDate = startSignatureDate;
    const endSignatureDate = toDayEnd(committed.endSignatureDate);
    if (endSignatureDate !== undefined)
      data.endSignatureDate = endSignatureDate;
    const startSubmissionDate = toDayStart(committed.startSubmissionDate);
    if (startSubmissionDate !== undefined)
      data.startSubmissionDate = startSubmissionDate;
    const endSubmissionDate = toDayEnd(committed.endSubmissionDate);
    if (endSubmissionDate !== undefined)
      data.endSubmissionDate = endSubmissionDate;
    if (committed.transactionHash)
      data.transactionHash = committed.transactionHash;

    return {
      page: { pageSize, pageNum: page },
      data,
    };
  }, [committed, page, pageSize]);

  const {
    data: listData,
    isLoading,
    isError,
    error,
    refetch,
  } = useKeySignedTransactionsQuery(params);
  const { data: keyServices } = useKeyServicePlatformsQuery();
  const { data: stablecoins } = useStablecoinOptionsQuery();
  const { data: blockchains } = useBlockchainOptionsQuery();

  const rows = listData?.rows ?? [];
  const total = listData?.page?.total ?? 0;

  const handleQuery = () => {
    setCommitted(getValues());
    setPage(1);
  };

  const handleReset = () => {
    reset(DEFAULT_FILTER_VALUES);
    setCommitted(DEFAULT_FILTER_VALUES);
    setPage(1);
  };

  const handleViewDetail = (txRecordId?: number) => {
    if (txRecordId === undefined) return;
    router.push(
      `/key-management/key-signed-transactions/detail?id=${txRecordId}`,
    );
  };

  const columns = React.useMemo<ColumnDef<KeySignedTransactionRow>[]>(
    () => [
      {
        accessorKey: 'signatureId',
        header: t('key_management_0099'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'keyServiceName',
        header: t('key_management_0001'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'walletAddress',
        header: t('key_management_0076'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'transactionType',
        header: t('key_management_0100'),
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return value ? transactionTypeLabelMap[value] || value : '--';
        },
      },
      {
        accessorKey: 'signatureType',
        header: t('key_management_0101'),
        cell: ({ getValue }) => {
          const value = String(getValue() ?? '');
          return signatureTypeMap[value] || value || '--';
        },
      },
      {
        accessorKey: 'tokenName',
        header: t('key_management_0075'),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div>
              <div>{record.tokenName || '--'}</div>
              {record.tokenType !== undefined && record.tokenType !== null && (
                <div className="text-muted-foreground text-xs">
                  {formatTokenType(t, record.tokenType)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'blockchainName',
        header: t('key_management_0063'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'signatureTime',
        header: t('key_management_0102'),
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'submissionTime',
        header: t('key_management_0103'),
        cell: ({ getValue }) => formatTimestamp(getValue() as number),
      },
      {
        accessorKey: 'transactionHash',
        header: t('key_management_0078'),
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'status',
        header: t('key_management_0003'),
        cell: ({ getValue }) => {
          const raw = getValue() as number | string | undefined;
          if (raw === undefined || raw === null || raw === '') return '--';
          const status = Number(raw);
          const colorKey = `approval_task_status_color_${status}`;
          const tone =
            Number.isFinite(status) && tCommon.has(colorKey)
              ? tCommon(colorKey)
              : 'default';
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone] ?? TONE_CLASS.default}`}
            >
              {formatTaskStatus(t, raw)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: t('key_management_0012'),
        cell: ({ row }) => (
          <Button
            variant="link"
            className="h-auto p-0"
            disabled={row.original.txRecordId == null}
            onClick={() => handleViewDetail(row.original.txRecordId)}
          >
            {t('key_management_0012')}
          </Button>
        ),
      },
    ],
    [t, tCommon]
  );

  const transactionTypeOptions = React.useMemo(
    () =>
      Object.entries(transactionTypeLabelMap).map(([value, label]) => ({
        label,
        value,
      })),
    []
  );

  const signatureTypeSelectOptions = React.useMemo(
    () =>
      Object.entries(signatureTypeMap).map(([value, label]) => ({
        label,
        value,
      })),
    []
  );

  const keyServiceOptions = React.useMemo(
    () =>
      // value 为空串的脏数据项（thirdPartyPlatformId 缺失）会被 FormSelect 自动过滤。
      (keyServices ?? []).map((s) => ({
        label: s.platformName || '--',
        value: String(s.thirdPartyPlatformId || ''),
      })),
    [keyServices]
  );

  const tokenOptions = React.useMemo(
    () =>
      (stablecoins ?? []).map((s) => ({
        label: s.name,
        value: String(s.stablecoinId),
      })),
    [stablecoins]
  );

  const blockchainOptions = React.useMemo(
    () =>
      // 筛选场景下不可用链 (status !== 1) 不作为筛选项展示：原 disabled 灰显语义改为过滤。
      (blockchains ?? [])
        .filter((b) => b.status === 1)
        .map((b) => ({
          label: b.value,
          value: String(b.key),
        })),
    [blockchains]
  );

  const loadFailedMessage = t('key_management_load_failed');

  return (
    <div className="space-y-6">
      {/* Query Form */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-lg font-semibold">{t('PUB_Query')}</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium">{t('key_management_0099')}</label>
            <Input placeholder={t('key_management_0150')} {...register('signatureId')} />
          </div>
          <FormSelect
            name="thirdPartyPlatformId"
            control={control}
            label={t('key_management_0001')}
            options={keyServiceOptions}
            placeholder={t('PUB_All')}
          />
          <div>
            <label className="text-sm font-medium">{t('key_management_0076')}</label>
            <Input placeholder={t('key_management_0076')} {...register('walletAddress')} />
          </div>
          <FormSelect
            name="transactionType"
            control={control}
            label={t('key_management_0100')}
            options={transactionTypeOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="signatureType"
            control={control}
            label={t('key_management_0101')}
            options={signatureTypeSelectOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="tokenId"
            control={control}
            label={t('key_management_0075')}
            options={tokenOptions}
            placeholder={t('PUB_All')}
          />
          <FormSelect
            name="blockchainId"
            control={control}
            label={t('key_management_0063')}
            options={blockchainOptions}
            placeholder={t('PUB_All')}
          />
          <div>
            <label className="text-sm font-medium">{t('key_management_0102')}</label>
            <div className="flex items-center gap-2">
              <Input type="date" {...register('startSignatureDate')} />
              <span className="text-muted-foreground">-</span>
              <Input type="date" {...register('endSignatureDate')} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('key_management_0103')}</label>
            <div className="flex items-center gap-2">
              <Input type="date" {...register('startSubmissionDate')} />
              <span className="text-muted-foreground">-</span>
              <Input type="date" {...register('endSubmissionDate')} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('key_management_0078')}</label>
            <Input placeholder={t('key_management_0078')} {...register('transactionHash')} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={handleQuery}>{t('PUB_Query')}</Button>
          <Button variant="outline" onClick={handleReset}>
            {t('PUB_Reset')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('key_management_0155')}</h3>
        </div>

        {isError && (
          <Alert variant="destructive" className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <span>{error instanceof Error ? error.message : loadFailedMessage}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {t('key_management_retry')}
              </Button>
            </div>
          </Alert>
        )}

        <DataTable<KeySignedTransactionRow>
          columns={columns}
          data={rows.map(
            (r): KeySignedTransactionRow => ({ ...r, id: String(r.txRecordId ?? '') }),
          )}
          isLoading={isLoading}
          emptyMessage={t('PUB_NoData')}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
          }}
        />
      </div>
    </div>
  );
}
