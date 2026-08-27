'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

import { DescField, DescGrid } from './desc-grid';
import { OPT_ALL, fmtAmount, formatTime, orDash, toEpochMs } from './kit';

/**
 * 交易记录域页面（源 `views/tx/list.vue`：列表筛选/分页 + 详情字段 + 报文链路）。
 * 详情从源 Dialog 改为独立路由页（registry：/tx + detail key）。
 */

/** 路由 query 中的交易 ID → 正整数；非法 → undefined。 */
function parseTxId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/* ================================================================== */
/* 列表页（源筛选：状态 + 仅看待处理 + 时间范围）                       */
/* ================================================================== */

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

/** 源分页 pageSize 固定 10（el-pagination layout 无 sizes/jumper）。 */
const TX_PAGE_SIZE = 10;

/** 列表 → 详情行数据暂存前缀（源 openDetail 先用行数据立即渲染，接口返回后覆盖）。 */
const TX_STASH_PREFIX = 'kissen-gateway.tx.seed.';

/** 暂存被点击的行（sessionStorage；写失败静默——详情页回退纯接口渲染）。 */
function stashTxSeed(row: TxRecord): void {
  try {
    sessionStorage.setItem(
      `${TX_STASH_PREFIX}${row.transactionId}`,
      JSON.stringify(row),
    );
  } catch {
    /* 隐私模式/配额超限时放弃暂存 */
  }
}

/** 读取暂存行；缺失/损坏/ID 不符 → null。 */
function readTxSeed(transactionId: number): TxRecord | null {
  try {
    const raw = sessionStorage.getItem(`${TX_STASH_PREFIX}${transactionId}`);
    const parsed = raw ? (JSON.parse(raw) as TxRecord) : null;
    return parsed?.transactionId === transactionId ? parsed : null;
  } catch {
    return null;
  }
}

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

  const { data, isLoading, isError, error, refetch } = useTxPage({
    pageNum,
    pageSize: TX_PAGE_SIZE,
    filter,
  });

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

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

  /** 详情跳转（registry：/tx + detail key；源行点击/详情按钮同一目标）。
   *  先暂存行数据——详情页据此立即渲染，等接口返回后覆盖（源 openDetail L194-207）。 */
  const onView = React.useCallback(
    (row: TxRecord) => {
      stashTxSeed(row);
      router.push(`/tx/detail?id=${row.transactionId}`);
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
        cell: ({ row }) => <span>{formatTime(row.original.lastSyncTime)}</span>,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => onView(row.original)}
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

      <div className="rounded-lg border-border/60 bg-card p-4 shadow-float">
        <DataTable
          columns={columns}
          data={tableData}
          isLoading={isLoading}
          emptyMessage="No data"
        />
        <TxPager
          total={total}
          pageNum={pageNum}
          onPageChange={setPageNum}
        />
      </div>
    </div>
  );
}

/**
 * 分页（源 el-pagination layout `total, prev, pager, next`，pageSize 固定 10 无
 * sizes/jumper。有意差异与 log-pages 同口径：省略页码 pager，仅 total + prev/next）。
 */
function TxPager({
  total,
  pageNum,
  onPageChange,
}: {
  total: number;
  pageNum: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / TX_PAGE_SIZE));

  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {total} records · Page {pageNum} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={pageNum <= 1}
          className="h-8 w-8"
          onClick={() => onPageChange(pageNum - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={pageNum >= totalPages}
          className="h-8 w-8"
          onClick={() => onPageChange(pageNum + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
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
        {formatTime(message.createTime)}
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
    data: detailData,
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

  /**
   * 源 openDetail 语义：进入详情先用被点击的行立即渲染（messages 起始为空），
   * detail 接口返回后覆盖；接口失败则停留行数据。直链无暂存时回退骨架屏。
   */
  const seed = React.useMemo(
    () => (transactionId != null ? readTxSeed(transactionId) : null),
    [transactionId],
  );
  const record = detailData ?? seed;

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

      {record ? (
        <section className="rounded-lg border-border/60 bg-card p-6 shadow-float">
          <DescGrid>
            <DescField label="Record ID">
              <span>{record.recordId ?? '-'}</span>
            </DescField>
            <DescField label="TransactionId">
              <span>{record.transactionId ?? '-'}</span>
            </DescField>
            <DescField label="Bank Role">
              {record.bankRole != null && record.bankRole !== 0 ? (
                <Badge variant={txBankRoleVariant(record.bankRole)}>
                  {txBankRoleText(record.bankRole)}
                </Badge>
              ) : (
                <span>-</span>
              )}
            </DescField>
            <DescField label="PairId">
              <span>{record.pairId ?? '-'}</span>
            </DescField>
            <DescField label="Principal">
              <span>{fmtAmount(record.principal)}</span>
            </DescField>
            <DescField label="Status">
              <Badge variant={txStatusVariant(record.status)}>
                {txStatusText(record.status)}
              </Badge>
            </DescField>
            <DescField label="Source Tx ID">
              <span>{orDash(record.sourceCsTxId)}</span>
            </DescField>
            <DescField label="Target Tx ID">
              <span>{orDash(record.targetCsTxId)}</span>
            </DescField>
            <DescField label="Pending">
              {record.pendingFlag === 1 ? (
                <Badge variant="secondary">Pending</Badge>
              ) : (
                <span>No</span>
              )}
            </DescField>
            <DescField label="Pending Reason">
              <span>{orDash(record.pendingReason)}</span>
            </DescField>
            <DescField label="Last Sync">
              <span>{formatTime(record.lastSyncTime)}</span>
            </DescField>
            <DescField label="Created At">
              <span>{formatTime(record.createTime)}</span>
            </DescField>
          </DescGrid>
        </section>
      ) : detailLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
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
            No message records
          </p>
        )}
      </section>
    </div>
  );
}
