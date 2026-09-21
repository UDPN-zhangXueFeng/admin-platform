'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';

import {
  Alert,
  AlertTitle,
  Badge,
  Button,
  DataTable,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type BadgeProps,
} from '@myorg/shared/ui';
import { formatAdminDateTime } from '@myorg/shared/util-dates';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  CONNECTIVITY_STATUS_LABEL,
  CONNECTIVITY_STATUS_VARIANT,
  CS_TYPE_LABEL,
  INSTANCE_STATUS_LABEL,
  INSTANCE_STATUS_VARIANT,
  KISSEN_PROJECT_ID,
  useInstanceHeartbeatQuery,
  useInstanceListQuery,
  type HeartbeatRow,
  type InstanceRow,
} from '@myorg/modules/kissen-admin/data-access';

import { peekRow } from './row-stash';

const INSTANCE_LIST_PATH = '/onboard/instance';
const INSTANCE_ROW_STASH_SCOPE = 'gateway-instance';
const DETAIL_FALLBACK_PAGE_SIZE = 200;
const HEARTBEAT_PAGE_SIZE = 10;
const ACTIVE_STATUS_CODE = 20;
const ONLINE_CONNECTIVITY_CODE = 1;

function parseInstanceId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '--';
  const date = new Date(Number(ms));
  return Number.isNaN(date.getTime()) ? '--' : formatAdminDateTime(date);
}

/** Maps a Badge variant to a solid dot color so status reads at a glance. */
function statusDotClass(variant: BadgeProps['variant']): string {
  switch (variant) {
    case 'default':
      return 'bg-primary';
    case 'destructive':
      return 'bg-destructive';
    case 'warning':
      return 'bg-warning';
    case 'success':
      return 'bg-success';
    case 'info':
      return 'bg-info';
    default:
      return 'bg-muted-foreground';
  }
}

function StatusPill({
  label,
  variant,
  live = false,
}: {
  label: string;
  variant: BadgeProps['variant'];
  live?: boolean;
}) {
  const dotClass = statusDotClass(variant);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-sm font-medium text-foreground">
      <span className="relative flex size-2 shrink-0">
        {live ? (
          <span
            aria-hidden="true"
            className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${dotClass}`}
          />
        ) : null}
        <span
          aria-hidden="true"
          className={`relative inline-flex size-2 rounded-full ${dotClass}`}
        />
      </span>
      {label}
    </span>
  );
}

function MetricStripItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 px-5 py-3 first:pl-0 last:pr-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-sm text-foreground">
        {value}
      </p>
    </div>
  );
}

function SpecGroup({
  title,
  accent = 'bg-primary',
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 pb-2">
        <span aria-hidden="true" className={`h-3 w-0.5 rounded-full ${accent}`} />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>
      <dl className="divide-y divide-border/60 rounded-lg border border-border/60">
        {children}
      </dl>
    </div>
  );
}

function SpecRow({
  label,
  children,
  mono = false,
  stacked = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  stacked?: boolean;
}) {
  return (
    <div
      className={`flex gap-4 px-4 py-2.5 text-sm ${
        stacked ? 'flex-col' : 'items-center justify-between'
      }`}
    >
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 text-foreground ${stacked ? '' : 'text-right'} ${
          mono ? 'break-all font-mono text-[13px]' : 'truncate'
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function KeyFingerprintRow({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null | undefined;
  fallback: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">
        {value ? (
          <span className="inline-block max-w-full truncate rounded-md bg-muted px-2 py-1 font-mono text-[13px] text-foreground">
            {value}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{fallback}</span>
        )}
      </dd>
    </div>
  );
}

type HeartbeatRowWithId = HeartbeatRow & { id: string };

function HeartbeatResultBadge({ ok, detail }: { ok: number; detail?: string }) {
  const isTimeout = ok === 2 || /timeout/i.test(detail ?? '');
  if (ok === 1) return <Badge variant="default">Success</Badge>;
  if (isTimeout) return <Badge variant="warning">Timeout</Badge>;
  return <Badge variant="destructive">Failed</Badge>;
}

function HeartbeatHistoryTab({
  instanceId,
  enabled,
}: {
  instanceId: number;
  enabled: boolean;
}) {
  const [page, setPage] = React.useState(1);
  const query = useInstanceHeartbeatQuery(
    KISSEN_PROJECT_ID,
    instanceId,
    page,
    HEARTBEAT_PAGE_SIZE,
    enabled,
  );
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  const columns = React.useMemo<ColumnDef<HeartbeatRowWithId>[]>(
    () => [
      {
        accessorKey: 'probeTime',
        header: 'Time',
        cell: ({ row }) => <span>{formatTime(row.original.probeTime)}</span>,
      },
      {
        accessorKey: 'ok',
        header: 'Result',
        cell: ({ row }) => (
          <HeartbeatResultBadge
            ok={row.original.ok}
            detail={row.original.detail}
          />
        ),
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <span>
            {row.original.mode === 'SIGNED'
              ? 'Signed probe'
              : row.original.mode === 'BARE'
                ? 'Bare probe'
                : '--'}
          </span>
        ),
      },
      {
        accessorKey: 'latencyMs',
        header: 'Latency',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {row.original.latencyMs}ms
          </span>
        ),
      },
      {
        accessorKey: 'detail',
        header: 'Detail',
        cell: ({ row }) => <span>{row.original.detail || '--'}</span>,
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => rows.map((row) => ({ ...row, id: String(row.logId) })),
    [rows],
  );

  if (query.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>Failed to load heartbeat history.</AlertTitle>
      </Alert>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={tableData}
      isLoading={query.isLoading}
      emptyMessage="No data"
      pagination={{
        page,
        pageSize: HEARTBEAT_PAGE_SIZE,
        total,
        onPageChange: setPage,
      }}
    />
  );
}

export function GatewayInstanceDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const instanceId = parseInstanceId(searchParams.get('id'));
  const [activeTab, setActiveTab] = React.useState('details');

  const stashedInstance = React.useMemo(
    () =>
      instanceId === undefined
        ? null
        : peekRow<InstanceRow>(INSTANCE_ROW_STASH_SCOPE, instanceId),
    [instanceId],
  );
  const hasStashedInstance = stashedInstance?.instanceId === instanceId;
  const fallbackQuery = useInstanceListQuery(
    KISSEN_PROJECT_ID,
    {
      pageNum: 1,
      pageSize: DETAIL_FALLBACK_PAGE_SIZE,
      filter: {},
    },
    instanceId !== undefined && !hasStashedInstance,
  );
  const instance = hasStashedInstance
    ? stashedInstance
    : fallbackQuery.data?.data.find((row) => row.instanceId === instanceId);

  if (instanceId === undefined) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <p className="text-sm text-muted-foreground">Missing instance ID.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(INSTANCE_LIST_PATH)}
        >
          Back to list
        </Button>
      </div>
    );
  }

  const isActive = instance?.status === ACTIVE_STATUS_CODE;
  const isOnline = instance?.connectivityStatus === ONLINE_CONNECTIVITY_CODE;

  return (
    <div className="space-y-5">
      <Button
        variant="link"
        className="h-auto p-0 text-muted-foreground"
        onClick={() => router.push(INSTANCE_LIST_PATH)}
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        Back to list
      </Button>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-xl font-semibold leading-7 text-foreground">
              {instance?.instanceName ||
                instance?.instanceCode ||
                `Gateway Instance ${instanceId}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {instance?.bankName || '--'}
              {instance?.bankBic ? ` (${instance.bankBic})` : ''}
              {instance?.instanceCode ? ` · ${instance.instanceCode}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {instance ? (
              <>
                <StatusPill
                  label={
                    INSTANCE_STATUS_LABEL[instance.status] ?? instance.status
                  }
                  variant={INSTANCE_STATUS_VARIANT[instance.status] ?? 'outline'}
                  live={isActive}
                />
                <StatusPill
                  label={
                    CONNECTIVITY_STATUS_LABEL[instance.connectivityStatus] ??
                    'Unknown'
                  }
                  variant={
                    CONNECTIVITY_STATUS_VARIANT[instance.connectivityStatus] ??
                    'secondary'
                  }
                  live={isOnline}
                />
              </>
            ) : fallbackQuery.isLoading ? (
              <Skeleton className="h-7 w-40" />
            ) : null}
          </div>
        </div>

        {instance ? (
          <div className="flex flex-wrap divide-x divide-border/60 rounded-lg border border-border/60 bg-card">
            <MetricStripItem label="Instance ID" value={instance.instanceId} />
            <MetricStripItem
              label="Last Heartbeat"
              value={formatTime(instance.lastHeartbeatTime)}
            />
            <MetricStripItem
              label="Last Verify"
              value={formatTime(instance.lastVerifyTime)}
            />
            <MetricStripItem
              label="Registered At"
              value={formatTime(instance.createTime)}
            />
          </div>
        ) : null}
      </section>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="heartbeat">Heartbeat History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-0 space-y-4">
          {fallbackQuery.isLoading && !instance ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : null}
          {fallbackQuery.isError && !instance ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load gateway instance details.</AlertTitle>
            </Alert>
          ) : null}
          {!fallbackQuery.isLoading && !fallbackQuery.isError && !instance ? (
            <div className="rounded-lg border border-border/60 bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Gateway instance not found.
              </p>
            </div>
          ) : null}
          {instance ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <SpecGroup title="Identity">
                  <SpecRow label="Bank Name">{instance.bankName || '--'}</SpecRow>
                  <SpecRow label="Bank BIC" mono>
                    {instance.bankBic || '--'}
                  </SpecRow>
                  <SpecRow label="Instance Code">
                    {instance.instanceCode || '--'}
                  </SpecRow>
                  <SpecRow label="Instance Name">
                    {instance.instanceName || '--'}
                  </SpecRow>
                  <SpecRow label="Status">
                    <Badge
                      variant={
                        INSTANCE_STATUS_VARIANT[instance.status] ?? 'outline'
                      }
                    >
                      {INSTANCE_STATUS_LABEL[instance.status] ??
                        instance.status}
                    </Badge>
                  </SpecRow>
                </SpecGroup>

                <SpecGroup title="Connectivity" accent="bg-info">
                  <SpecRow label="Endpoint URL" mono stacked>
                    {instance.endpointUrl || '--'}
                  </SpecRow>
                  <SpecRow label="Connectivity">
                    <Badge
                      variant={
                        CONNECTIVITY_STATUS_VARIANT[
                          instance.connectivityStatus
                        ] ?? 'secondary'
                      }
                    >
                      {CONNECTIVITY_STATUS_LABEL[
                        instance.connectivityStatus
                      ] ?? 'Unknown'}
                    </Badge>
                  </SpecRow>
                  <SpecRow label="Last Verify">
                    {formatTime(instance.lastVerifyTime)}
                  </SpecRow>
                  <SpecRow label="Last Heartbeat">
                    {formatTime(instance.lastHeartbeatTime)}
                  </SpecRow>
                </SpecGroup>
              </div>

              <div className="space-y-6">
                <SpecGroup title="Currency System" accent="bg-warning">
                  <SpecRow label="Type">
                    {CS_TYPE_LABEL[instance.currencySystemType ?? 0] ??
                      'Not specified'}
                  </SpecRow>
                  <SpecRow label="Blockchain">
                    {instance.blockchain || '--'}
                  </SpecRow>
                  <SpecRow label="Name">
                    {instance.currencySystemName || '--'}
                  </SpecRow>
                  <SpecRow label="URL" mono stacked>
                    {instance.currencySystemUrl || '--'}
                  </SpecRow>
                  <SpecRow label="Description" stacked>
                    {instance.currencySystemDesc || '--'}
                  </SpecRow>
                </SpecGroup>

                <SpecGroup title="Security" accent="bg-destructive">
                  <KeyFingerprintRow
                    label="Upstream Key Fingerprint"
                    value={instance.upKeyFingerprint}
                    fallback="Not pushed"
                  />
                  <KeyFingerprintRow
                    label="Downstream Key Fingerprint"
                    value={instance.downKeyFingerprint}
                    fallback="Not generated"
                  />
                </SpecGroup>
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="heartbeat" className="mt-0">
          <HeartbeatHistoryTab
            instanceId={instanceId}
            enabled={activeTab === 'heartbeat'}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
