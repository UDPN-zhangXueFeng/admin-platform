'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { Button, DataTable } from '@myorg/shared/ui';
import {
  useSpAccessDetailQuery,
  useSpAccessOperationRecordsQuery,
  useSpAccessSubmittedTransactionsQuery,
  useSpAccessUserWalletsQuery,
  type SpAccessSubmittedTransactionRecord,
  type SpAccessUserWalletRecord,
} from '@myorg/modules/sp-access/data-access';
import {
  formatServiceProviderTypeLabel,
  formatPrivateKeyCustodyModelLabel,
  formatSpAccessStatusLabel,
  formatTokenKycRequiredLabel,
  formatTransactionPolicyLabel,
} from '@myorg/modules/sp-access/util';

interface DetailItemProps {
  label: string;
  value: React.ReactNode;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="text-sm font-medium break-all">{value}</div>
    </div>
  );
}

function isEditableStatus(status: number): boolean {
  return status === 1 || status === 2;
}

function formatTimestamp(value?: number): string {
  if (!value) return '--';
  return new Date(value).toLocaleString();
}

function formatOperationType(value?: number): string {
  if (value === 1) return 'Register';
  if (value === 2) return 'Edit';
  return '--';
}

function formatCustodyModel(value?: number): string {
  if (value === 1) return 'Issuer Custody';
  if (value === 2) return 'SP Custody';
  if (value === 3) return 'Self-Custody (End User)';
  return value != null ? String(value) : '--';
}

function formatTokenType(value?: number): string {
  if (value === 1) return 'Stablecoin';
  if (value === 5) return 'Tokenized Deposit';
  if (value === 20) return 'MMF';
  return value != null ? String(value) : '--';
}

function formatKycRequired(value?: number): string {
  if (value === 1) return 'Yes';
  if (value === 0) return 'No';
  return value != null ? String(value) : '--';
}

function formatUserWalletStatus(value?: number): string {
  if (value === 1) return 'Enabled';
  if (value === 2) return 'Disabled';
  if (value === 3) return 'Logged Out';
  return value != null ? String(value) : '--';
}

function formatTransactionType(value?: number): string {
  if (value === 1) return 'Transfer';
  if (value === 2) return 'Authorized Transfer';
  if (value === 3) return 'Cross-Chain Transfer';
  if (value === 4) return 'Top-up';
  if (value === 5) return 'Withdrawal';
  return value != null ? String(value) : '--';
}

function formatSubmissionMethod(value?: number): string {
  if (value === 1) return 'OpenAPI';
  if (value === 2) return 'Smart Contract Invocation';
  return value != null ? String(value) : '--';
}

function formatTaskStatus(value?: number): string {
  if (value === 1) return 'Saved';
  if (value === 3) return 'Withdrawn';
  if (value === 5) return 'Pending Review';
  if (value === 10) return 'Reviewing';
  if (value === 15) return 'Rejected';
  if (value === 20) return 'Approved / Pending On-chain';
  if (value === 30) return 'On-chain Processing';
  if (value === 35) return 'On-chain Success';
  if (value === 40) return 'On-chain Failed';
  if (value === 45) return 'Deleted';
  return value != null ? String(value) : '--';
}

function formatAmount(value?: number): string {
  return value != null ? new Intl.NumberFormat().format(value) : '--';
}

export function SpAccessDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const spRecordId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);
  const spId = React.useMemo(() => {
    const raw = searchParams.get('spId');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);

  const { data, isLoading } = useSpAccessDetailQuery(spId);
  const { data: operationRecords } = useSpAccessOperationRecordsQuery(searchParams.get('spCode') ?? undefined);
  const spCode = searchParams.get('spCode') ?? '';
  const [userWalletPage, setUserWalletPage] = React.useState(1);
  const [transactionPage, setTransactionPage] = React.useState(1);
  const { data: userWallets, isLoading: userWalletsLoading } = useSpAccessUserWalletsQuery({
    spCode,
    pageNum: userWalletPage,
    pageSize: 10,
  });
  const { data: submittedTransactions, isLoading: submittedTransactionsLoading } =
    useSpAccessSubmittedTransactionsQuery({
      spCode,
      pageNum: transactionPage,
      pageSize: 10,
    });
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const userWalletColumns = React.useMemo<ColumnDef<SpAccessUserWalletRecord>[]>(
    () => [
      {
        accessorKey: 'walletAddress',
        header: 'Wallet Address',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'walletType',
        header: 'Wallet Type',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'custodyModel',
        header: 'Custody Model',
        cell: ({ getValue }) => formatCustodyModel(getValue() as number | undefined),
      },
      {
        accessorKey: 'stablecoinName',
        header: 'Token Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'tokenType',
        header: 'Token Type',
        cell: ({ getValue }) => formatTokenType(getValue() as number | undefined),
      },
      {
        accessorKey: 'totalBalance',
        header: 'Total Balance',
        cell: ({ getValue }) => formatAmount(getValue() as number | undefined),
      },
      {
        accessorKey: 'kycRequired',
        header: 'KYC Required',
        cell: ({ getValue }) => formatKycRequired(getValue() as number | undefined),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => formatUserWalletStatus(getValue() as number | undefined),
      },
    ],
    [],
  );

  const submittedTransactionColumns = React.useMemo<
    ColumnDef<SpAccessSubmittedTransactionRecord>[]
  >(
    () => [
      {
        accessorKey: 'transactionType',
        header: 'Transaction Type',
        cell: ({ getValue }) => formatTransactionType(getValue() as number | undefined),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ getValue }) => formatAmount(getValue() as number | undefined),
      },
      {
        accessorKey: 'tokenName',
        header: 'Token Name',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'tokenType',
        header: 'Token Type',
        cell: ({ getValue }) => formatTokenType(getValue() as number | undefined),
      },
      {
        accessorKey: 'submissionMethod',
        header: 'Submission Method',
        cell: ({ getValue }) => formatSubmissionMethod(getValue() as number | undefined),
      },
      {
        accessorKey: 'transactionTime',
        header: 'Transaction Time',
        cell: ({ getValue }) => formatTimestamp(getValue() as number | undefined),
      },
      {
        accessorKey: 'transactionHash',
        header: 'Tx Hash',
        cell: ({ getValue }) => (getValue() as string) || '--',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => formatTaskStatus(getValue() as number | undefined),
      },
    ],
    [],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">Service provider not found.</p>
        <Button onClick={() => router.back()}>Back</Button>
      </div>
    );
  }

  const canEdit = isEditableStatus(data.status);
  const latestOperationRecord = operationRecords?.rows[0];
  const hasPendingOperation =
    latestOperationRecord?.state === 5 || latestOperationRecord?.state === 35;
  const notifyUnsupportedDownload = (resourceName: string) => {
    setDownloadError(
      `${resourceName} is not available because the current backend detail response does not include a downloadable resource.`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b p-6">
          <h1 className="text-2xl font-semibold">Service Provider Detail</h1>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Service Provider Name" value={data.serviceProviderName} />
          <DetailItem label="SP Code" value={data.spCode} />
          <DetailItem
            label="Access Type"
            value={formatServiceProviderTypeLabel(data.serviceProviderType)}
          />
          <DetailItem label="Contact Name" value={data.contactName || '--'} />
          <DetailItem label="Email" value={data.email || '--'} />
          <DetailItem label="Phone" value={data.phone || '--'} />
          <DetailItem label="Status" value={formatSpAccessStatusLabel(data.status)} />
          <DetailItem
            label="Transaction Policy"
            value={formatTransactionPolicyLabel(data.transactionPolicy)}
          />
          <DetailItem
            label="Private Key Custody Model"
            value={formatPrivateKeyCustodyModelLabel(data.privateKeyCustodyModel)}
          />
          <DetailItem
            label="Reconciliation Frequency"
            value={data.reconciliationFrequency ? String(data.reconciliationFrequency) : '--'}
          />
          <DetailItem label="Meta Transaction" value={data.metaType ? String(data.metaType) : '--'} />
          <DetailItem
            label="Business License"
            value={
              data.businessLicensePreviewUrl ? (
                <a
                  href={data.businessLicensePreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {data.businessLicenseFileName || 'Preview file'}
                </a>
              ) : (
                data.businessLicenseFileName || '--'
              )
            }
          />
          <DetailItem label="Description" value={data.description || '--'} />
        </div>
        <div className="flex flex-wrap gap-2 border-t p-6">
          <Button variant="outline" onClick={() => notifyUnsupportedDownload('API documentation')}>
            Download API Documentation
          </Button>
          <Button variant="outline" onClick={() => notifyUnsupportedDownload('Secret key')}>
            Download Secret Key
          </Button>
          {downloadError ? (
            <p className="basis-full text-sm text-destructive" role="alert">
              {downloadError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-xl font-semibold">Token Permissions</h2>
        </div>
        <div className="space-y-4 p-6">
          {data.tdAccessList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No token permission configured.</p>
          ) : (
            data.tdAccessList.map((item) => (
              <div key={item.stablecoinCode} className="rounded-md border p-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Stablecoin Name" value={item.stablecoinName || '--'} />
                  <DetailItem label="Stablecoin Code" value={item.stablecoinCode} />
                  <DetailItem label="Blockchain" value={item.blockchainName || '--'} />
                  <DetailItem
                    label="Permission Enabled"
                    value={item.tokenPermissionEnabled ? 'Yes' : 'No'}
                  />
                  <DetailItem label="Wallet Address" value={item.walletAddress || '--'} />
                  <DetailItem label="KYC Required" value={formatTokenKycRequiredLabel(item.kycRequired)} />
                  <DetailItem label="Contract Address" value={item.contractAddress || '--'} />
                  <DetailItem label="Webhook URL" value={item.webhookUrl || '--'} />
                  <DetailItem label="API Access" value={item.apiEnabled ? 'Enabled' : 'Disabled'} />
                  <DetailItem
                    label="Contract Access"
                    value={item.contractEnabled ? 'Enabled' : 'Disabled'}
                  />
                  <DetailItem
                    label="API Permission Groups"
                    value={
                      item.apiPermissions?.length
                        ? item.apiPermissions
                            .map(
                              (permission) =>
                                `${permission.accessConfId}: [${permission.walletTypeIdList.join(', ')}]`,
                            )
                            .join('; ')
                        : '--'
                    }
                  />
                  <DetailItem
                    label="Contract Permission Groups"
                    value={
                      item.contractPermissions?.length
                        ? item.contractPermissions
                            .map(
                              (permission) =>
                                `${permission.accessConfId}: [${permission.walletTypeIdList.join(', ')}]`,
                            )
                            .join('; ')
                        : '--'
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
        <Button
          disabled={!canEdit || hasPendingOperation}
          onClick={() =>
            router.push(`/sp-access/edit?id=${spRecordId ?? ''}&spId=${data.spId ?? ''}&spCode=${data.spCode}`)
          }
        >
          Edit
        </Button>
      </div>
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          This service provider is not editable in the current status.
        </p>
      ) : null}
      {canEdit && hasPendingOperation ? (
        <p className="text-sm text-muted-foreground">
          Editing is currently blocked because the latest operation is still being processed.
        </p>
      ) : null}

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-xl font-semibold">User Wallets</h2>
        </div>
        <div className="p-6">
          <DataTable
            columns={userWalletColumns}
            data={userWallets?.rows ?? []}
            isLoading={userWalletsLoading}
            emptyMessage="No user wallets found."
            pagination={{
              page: userWalletPage,
              pageSize: userWallets?.pageSize ?? 10,
              total: userWallets?.total ?? 0,
              onPageChange: setUserWalletPage,
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-xl font-semibold">Submitted Transactions</h2>
        </div>
        <div className="p-6">
          <DataTable
            columns={submittedTransactionColumns}
            data={submittedTransactions?.rows ?? []}
            isLoading={submittedTransactionsLoading}
            emptyMessage="No submitted transactions found."
            pagination={{
              page: transactionPage,
              pageSize: submittedTransactions?.pageSize ?? 10,
              total: submittedTransactions?.total ?? 0,
              onPageChange: setTransactionPage,
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b p-6">
          <h2 className="text-xl font-semibold">Recent Operation Records</h2>
        </div>
        <div className="space-y-3 p-6">
          {operationRecords?.rows?.length ? (
            operationRecords.rows.map((record) => (
              <div
                key={`${record.spRecordId}-${record.taskId ?? record.createTime ?? record.operationType ?? 0}`}
                className="grid gap-3 rounded-md border p-4 md:grid-cols-2 lg:grid-cols-5"
              >
                <DetailItem label="Operation Type" value={formatOperationType(record.operationType)} />
                <DetailItem label="Status" value={record.state != null ? String(record.state) : '--'} />
                <DetailItem label="Created By" value={record.createUserName || '--'} />
                <DetailItem label="Created At" value={formatTimestamp(record.createTime)} />
                <DetailItem label="Task ID" value={record.taskId != null ? String(record.taskId) : '--'} />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No operation records found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
