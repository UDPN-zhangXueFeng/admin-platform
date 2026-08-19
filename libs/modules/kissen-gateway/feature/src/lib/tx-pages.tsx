'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';

import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Skeleton,
  useToast,
} from '@myorg/shared/ui';
import { FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useRouter } from '@myorg/shared/util-i18n';
import { cn } from '@myorg/shared/util-classnames';

import {
  TX_STATUS_OPTIONS,
  txBankRoleText,
  txBankRoleVariant,
  txDirectionText,
  txMsgTypeText,
  txMsgTypeVariant,
  txProcessStatusText,
  txProcessStatusVariant,
  txStatusText,
  txStatusVariant,
  useTxDetail,
  useTxMessages,
  useTxPage,
  type TxListReq,
  type TxMessage,
  type TxRecord,
} from '@myorg/modules/kissen-gateway/data-access';

/**
 * 交易记录域页面（源 `views/tx/list.vue`：列表筛选/分页 + 详情字段 + 报文链路）。
 * 详情从源 Dialog 改为独立路由页（registry：/tx + detail key）。
 */

/* ================================================================== */
/* 展示工具（源 views/tx/list.vue fmtAmount/fmtTime，语义 1:1）        */
/* ================================================================== */

/** 金额展示：源 `String(Number(v))`（去尾零的原始数值串）；null/undefined → '-'。 */
function fmtAmount(v?: number): string {
  return v == null ? '-' : String(Number(v));
}

/** 毫秒时间戳 → `zh-CN` 本地时间串（24 小时制，源 toLocaleString 语义）；空值 → '-'。 */
function fmtTime(ms?: number): string {
  return ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-';
}

/** datetime-local 字符串（YYYY-MM-DDTHH:mm）→ 毫秒时间戳（源 datetimerange value-format="x"）。 */
function toEpochMs(value: string): number | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

/** 路由 query 中的交易 ID → 正整数；非法 → undefined。 */
function parseTxId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 空值统一显示 '-'（源 `|| '-'` 语义）。 */
function orDash(v: string | number | null | undefined): string {
  return v === null || v === undefined || v === '' ? '-' : String(v);
}

/** 详情描述字段（el-descriptions-item 的 React 等价）。 */
function DescField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function DescGrid({
  cols = 2,
  className,
  children,
}: {
  cols?: 1 | 2;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-4 gap-y-3',
        cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {children}
    </dl>
  );
}

/* ================================================================== */
/* 列表页（源筛选：状态 + 仅看待处理 + 时间范围）                       */
/* ================================================================== */

/** Select 的「全部状态」哨兵值（Radix SelectItem 不宜用空串）。 */
const OPT_ALL = '__all__';

const txFilterSchema = z.object({
  status: z.string(),
  pendingOnly: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
});
type TxFilterForm = z.infer<typeof txFilterSchema>;

const TX_FILTER_DEFAULT: TxFilterForm = {
  status: OPT_ALL,
  pendingOnly: false,
  startTime: '',
  endTime: '',
};

/** RHF 筛选表单 → 后端 TxListReq（源 load() 的 query 组装：pendingOnly→pendingFlag=1、时间→毫秒）。 */
function formToFilter(form: TxFilterForm): TxListReq {
  return {
    status: form.status === OPT_ALL ? undefined : Number(form.status),
    pendingFlag: form.pendingOnly ? 1 : undefined,
    startTime: toEpochMs(form.startTime),
    endTime: toEpochMs(form.endTime),
  };
}

const TX_PAGE_SIZE_DEFAULT = 10;

export function TxListPage() {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, reset, control } = useForm<TxFilterForm>({
    resolver: zodResolver(txFilterSchema),
    defaultValues: TX_FILTER_DEFAULT,
  });

  const [filter, setFilter] = React.useState<TxListReq>(() =>
    formToFilter(TX_FILTER_DEFAULT),
  );
  const [pageNum, setPageNum] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(TX_PAGE_SIZE_DEFAULT);

  const { data, isLoading, isError, error, refetch } = useTxPage({
    pageNum,
    pageSize,
    filter,
  });

  const rows = data?.data ?? [];
  const paginationMeta = data?.pagination;

  React.useEffect(() => {
    if (isError) {
      toast.error('Failed to load transactions', {
        description:
          error instanceof Error ? error.message : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetch() },
      });
    }
  }, [isError, error, refetch, toast]);

  const onSubmit = React.useCallback((form: TxFilterForm) => {
    setFilter(formToFilter(form));
    setPageNum(1);
  }, []);

  const onReset = React.useCallback(() => {
    reset(TX_FILTER_DEFAULT);
    setFilter(formToFilter(TX_FILTER_DEFAULT));
    setPageNum(1);
  }, [reset]);

  /** 详情跳转（registry：/tx + detail key；源行点击/详情按钮同一目标）。 */
  const onView = React.useCallback(
    (transactionId: number) => {
      router.push(`/tx/detail?id=${transactionId}`);
    },
    [router],
  );

  const statusSelectOptions = React.useMemo(
    () => [{ value: OPT_ALL, label: 'All Statuses' }, ...TX_STATUS_OPTIONS],
    [],
  );

  const columns = React.useMemo<
    ColumnDef<TxRecord & { id: string }>[]
  >(() => {
    return [
      {
        id: 'transactionId',
        header: 'TransactionId',
        cell: ({ row }) => <span>{row.original.transactionId}</span>,
      },
      {
        id: 'bankRole',
        header: 'Bank Role',
        cell: ({ row }) => {
          const role = row.original.bankRole;
          return role != null && role !== 0 ? (
            <Badge variant={txBankRoleVariant(role)}>{txBankRoleText(role)}</Badge>
          ) : (
            <span>-</span>
          );
        },
      },
      {
        id: 'pairId',
        header: 'PairId',
        cell: ({ row }) => <span>{row.original.pairId ?? '-'}</span>,
      },
      {
        id: 'principal',
        header: 'Principal',
        cell: ({ row }) => <span>{fmtAmount(row.original.principal)}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={txStatusVariant(row.original.status)}>
            {txStatusText(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'pendingFlag',
        header: 'Pending',
        cell: ({ row }) =>
          row.original.pendingFlag === 1 ? (
            <Badge variant="secondary">Pending</Badge>
          ) : (
            <span>-</span>
          ),
      },
      {
        id: 'lastSyncTime',
        header: 'Last Sync',
        cell: ({ row }) => <span>{fmtTime(row.original.lastSyncTime)}</span>,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => onView(row.original.transactionId)}
          >
            Detail
          </Button>
        ),
      },
    ];
  }, [onView]);

  const tableData = React.useMemo(
    () => rows.map((r) => ({ ...r, id: String(r.recordId) })),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium tracking-wide text-muted-foreground">
          TRANSACTIONS
        </div>
        <h1 className="mt-1 text-xl font-semibold">Transactions</h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border-border/60 bg-card p-6 text-card-foreground shadow-float"
      >
        <div className="mb-4 text-sm font-semibold">Filters</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormSelect
            name="status"
            control={control}
            label="Status"
            options={statusSelectOptions}
            placeholder="All Statuses"
          />
          <Controller
            control={control}
            name="pendingOnly"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="field-pendingOnly"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Pending
                </label>
                <div className="flex h-10 items-center gap-2">
                  <Checkbox
                    id="field-pendingOnly"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <span className="text-sm text-foreground">Pending only</span>
                </div>
              </div>
            )}
          />
          <FormField
            name="startTime"
            label="Start Time"
            type="datetime-local"
            register={register('startTime')}
          />
          <FormField
            name="endTime"
            label="End Time"
            type="datetime-local"
            register={register('endTime')}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Search</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>
      </form>


      <div className="rounded-lg border-border/60 bg-card shadow-float">
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
          pagination={
            paginationMeta
              ? {
                  page: paginationMeta.page,
                  pageSize: paginationMeta.pageSize,
                  total: paginationMeta.total,
                  onPageChange: setPageNum,
                  onPageSizeChange: (n) => {
                    setPageSize(n);
                    setPageNum(1);
                  },
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

/* ================================================================== */
/* 详情页（源详情 Dialog 字段 + 报文链路 el-timeline）                  */
/* ================================================================== */

/** 单条报文卡（源 el-timeline-item：时间戳 + 三标签 + TraceId/幂等键）。 */
function TxMessageItem({ message }: { message: TxMessage }) {
  return (
    <li className="relative pl-6">
      <span
        className="absolute left-0 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-background bg-primary"
        aria-hidden="true"
      />
      <div className="text-xs text-muted-foreground">
        {fmtTime(message.createTime)}
      </div>
      <div className="mt-2 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={txMsgTypeVariant(message.msgType)}>
            {txMsgTypeText(message.msgType)}
          </Badge>
          {/* 源 tag type：出向 warning / 入向 primary，语义分层后同为 secondary，以文案区分 */}
          <Badge variant="secondary">{txDirectionText(message.direction)}</Badge>
          <Badge variant={txProcessStatusVariant(message.processStatus)}>
            {txProcessStatusText(message.processStatus)}
          </Badge>
        </div>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">TraceId</span>
            <span className="break-all">{orDash(message.traceId)}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-14 shrink-0 text-muted-foreground">Idempotency Key</span>
            <span className="break-all">{orDash(message.idempotentKey)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

export function TxDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionId = parseTxId(searchParams.get('id'));

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    error: detailErrorInfo,
    refetch: refetchDetail,
  } = useTxDetail(transactionId);
  const {
    data: messages,
    isLoading: messagesLoading,
    isError: messagesError,
    error: messagesErrorInfo,
    refetch: refetchMessages,
  } = useTxMessages(transactionId);

  const toast = useToast();
  React.useEffect(() => {
    if (detailError) {
      toast.error('Failed to load transaction detail', {
        description:
          detailErrorInfo instanceof Error
            ? detailErrorInfo.message
            : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetchDetail() },
      });
    }
  }, [detailError, detailErrorInfo, refetchDetail, toast]);
  React.useEffect(() => {
    if (messagesError) {
      toast.error('Failed to load message trail', {
        description:
          messagesErrorInfo instanceof Error
            ? messagesErrorInfo.message
            : 'Please try again later',
        action: { label: 'Retry', onClick: () => refetchMessages() },
      });
    }
  }, [messagesError, messagesErrorInfo, refetchMessages, toast]);

  if (!transactionId) {
    return (
      <div className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <p className="text-sm text-muted-foreground">Missing a transaction ID. Unable to view details.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Transaction Detail #{transactionId}</h1>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      {detailLoading && !detail ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : detail ? (
        <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <DescGrid cols={2}>
            <DescField label="Record ID">
              <span>{detail.recordId ?? '-'}</span>
            </DescField>
            <DescField label="TransactionId">
              <span>{detail.transactionId ?? '-'}</span>
            </DescField>
            <DescField label="Bank Role">
              {detail.bankRole != null && detail.bankRole !== 0 ? (
                <Badge variant={txBankRoleVariant(detail.bankRole)}>
                  {txBankRoleText(detail.bankRole)}
                </Badge>
              ) : (
                <span>-</span>
              )}
            </DescField>
            <DescField label="PairId">
              <span>{detail.pairId ?? '-'}</span>
            </DescField>
            <DescField label="Principal">
              <span>{fmtAmount(detail.principal)}</span>
            </DescField>
            <DescField label="Status">
              <Badge variant={txStatusVariant(detail.status)}>
                {txStatusText(detail.status)}
              </Badge>
            </DescField>
            <DescField label="Source Tx ID">
              <span>{orDash(detail.sourceCsTxId)}</span>
            </DescField>
            <DescField label="Target Tx ID">
              <span>{orDash(detail.targetCsTxId)}</span>
            </DescField>
            <DescField label="Pending">
              {detail.pendingFlag === 1 ? (
                <Badge variant="secondary">Pending</Badge>
              ) : (
                <span>No</span>
              )}
            </DescField>
            <DescField label="Pending Reason">
              <span>{orDash(detail.pendingReason)}</span>
            </DescField>
            <DescField label="Last Sync">
              <span>{fmtTime(detail.lastSyncTime)}</span>
            </DescField>
            <DescField label="Created At">
              <span>{fmtTime(detail.createTime)}</span>
            </DescField>
          </DescGrid>
        </section>
      ) : (
        <div className="rounded-lg border-border/60 bg-card p-6 text-sm text-muted-foreground shadow-float">
          No transaction detail available.
        </div>
      )}

      <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
        <div className="mb-4 text-sm font-semibold">Message Trail</div>
        {messagesLoading && !messages ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : messages && messages.length > 0 ? (
          <ol className="relative space-y-6 border-l">
            {messages.map((m) => (
              <TxMessageItem key={m.msgId} message={m} />
            ))}
          </ol>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No messages yet
          </p>
        )}
      </section>
    </div>
  );
}
