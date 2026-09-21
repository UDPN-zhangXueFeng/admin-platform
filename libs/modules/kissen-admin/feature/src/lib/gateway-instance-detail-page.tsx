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

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border/50 px-5 py-3 text-sm font-semibold">
        {title}
      </h2>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </dl>
    </section>
  );
}

function DetailField({
  label,
  children,
  mono = false,
  fullWidth = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`min-w-0 space-y-1 ${fullWidth ? 'sm:col-span-2 xl:col-span-3' : ''}`}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 break-words text-sm text-foreground ${mono ? 'font-mono' : ''}`}
      >
        {children}
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

  return (
    <div className="space-y-4">
      <Button
        variant="link"
        className="h-auto p-0 text-muted-foreground"
        onClick={() => router.push(INSTANCE_LIST_PATH)}
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        Back to list
      </Button>

      <section className="rounded-lg border border-border/60 bg-card px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-base font-semibold leading-6 text-foreground">
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
                <Badge
                  variant={
                    INSTANCE_STATUS_VARIANT[instance.status] ?? 'outline'
                  }
                >
                  {INSTANCE_STATUS_LABEL[instance.status] ?? instance.status}
                </Badge>
                <Badge
                  variant={
                    CONNECTIVITY_STATUS_VARIANT[instance.connectivityStatus] ??
                    'secondary'
                  }
                >
                  {CONNECTIVITY_STATUS_LABEL[instance.connectivityStatus] ??
                    'Unknown'}
                </Badge>
              </>
            ) : fallbackQuery.isLoading ? (
              <Skeleton className="h-5 w-28" />
            ) : null}
          </div>
        </div>
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
            <section className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="h-24 w-full" />
            </section>
          ) : null}
          {fallbackQuery.isError && !instance ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Failed to load gateway instance details.</AlertTitle>
            </Alert>
          ) : null}
          {!fallbackQuery.isLoading && !fallbackQuery.isError && !instance ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Gateway instance not found.
              </p>
            </section>
          ) : null}
          {instance ? (
            <>
              <DetailSection title="Bank & Instance">
                <DetailField label="Bank Name">
                  {instance.bankName || '--'}
                </DetailField>
                <DetailField label="Bank BIC" mono>
                  {instance.bankBic || '--'}
                </DetailField>
                <DetailField label="Instance ID" mono>
                  {instance.instanceId}
                </DetailField>
                <DetailField label="Instance Code">
                  {instance.instanceCode || '--'}
                </DetailField>
                <DetailField label="Instance Name">
                  {instance.instanceName || '--'}
                </DetailField>
                <DetailField label="Status">
                  <Badge
                    variant={
                      INSTANCE_STATUS_VARIANT[instance.status] ?? 'outline'
                    }
                  >
                    {INSTANCE_STATUS_LABEL[instance.status] ?? instance.status}
                  </Badge>
                </DetailField>
              </DetailSection>

              <DetailSection title="Connectivity">
                <DetailField label="Endpoint URL" mono fullWidth>
                  {instance.endpointUrl || '--'}
                </DetailField>
                <DetailField label="Connectivity">
                  <Badge
                    variant={
                      CONNECTIVITY_STATUS_VARIANT[
                        instance.connectivityStatus
                      ] ?? 'secondary'
                    }
                  >
                    {CONNECTIVITY_STATUS_LABEL[instance.connectivityStatus] ??
                      'Unknown'}
                  </Badge>
                </DetailField>
                <DetailField label="Last Verify">
                  {formatTime(instance.lastVerifyTime)}
                </DetailField>
                <DetailField label="Last Heartbeat">
                  {formatTime(instance.lastHeartbeatTime)}
                </DetailField>
                <DetailField label="Registered At">
                  {formatTime(instance.createTime)}
                </DetailField>
              </DetailSection>

              <DetailSection title="Currency System">
                <DetailField label="Type">
                  {CS_TYPE_LABEL[instance.currencySystemType ?? 0] ??
                    'Not specified'}
                </DetailField>
                <DetailField label="Blockchain">
                  {instance.blockchain || '--'}
                </DetailField>
                <DetailField label="Name">
                  {instance.currencySystemName || '--'}
                </DetailField>
                <DetailField label="URL" mono fullWidth>
                  {instance.currencySystemUrl || '--'}
                </DetailField>
                <DetailField label="Description" fullWidth>
                  {instance.currencySystemDesc || '--'}
                </DetailField>
              </DetailSection>

              <DetailSection title="Security">
                <DetailField label="Upstream Key Fingerprint" mono>
                  {instance.upKeyFingerprint || 'Not pushed'}
                </DetailField>
                <DetailField label="Downstream Key Fingerprint" mono>
                  {instance.downKeyFingerprint || 'Not generated'}
                </DetailField>
              </DetailSection>
            </>
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
