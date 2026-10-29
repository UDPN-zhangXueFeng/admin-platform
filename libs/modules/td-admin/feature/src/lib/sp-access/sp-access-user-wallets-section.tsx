'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorg/shared/ui';
import {
  useSpAccessUserWalletsQuery,
  useUserWalletTxListPreflightMutation,
} from '@myorg/modules/td-admin/data-access';
import type {
  SpAccessDetail,
  SpAccessUserWallet,
} from '@myorg/modules/td-admin/data-access';
import { EMPTY_FIELD_VALUE, formatAmount, formatTimestamp } from './formatters';
import { SpAccessStatusBadge } from './sp-access-status-badge';

/**
 * 详情页「用户钱包」Tab（上游 UserWalletsSection）：筛选 + 列表 +
 * Txn Details 跳转（先预检 wallet tx 列表可达，再路由）。
 */

const ALL_VALUE = '';
const TOKEN_TYPE_FILTER_OPTIONS = [1, 5] as const;
const CUSTODY_MODEL_FILTER_OPTIONS = ['1', '2', '3'] as const;

interface DraftFilters {
  walletAddress: string;
  custodyModel: string;
  tokenName: string;
  tokenType: string;
  createDateFrom: string;
  createDateTo: string;
  kycRequired: string;
  status: string;
}

const EMPTY_DRAFT: DraftFilters = {
  walletAddress: '',
  custodyModel: ALL_VALUE,
  tokenName: ALL_VALUE,
  tokenType: ALL_VALUE,
  createDateFrom: '',
  createDateTo: '',
  kycRequired: ALL_VALUE,
  status: ALL_VALUE,
};

function dateToRangeMs(from: string, to: string): {
  createStartTime?: number;
  creatEndTime?: number;
} {
  if (!from && !to) return {};
  return {
    ...(from ? { createStartTime: startOfDay(parseISO(from)).getTime() } : {}),
    ...(to ? { creatEndTime: endOfDay(parseISO(to)).getTime() } : {}),
  };
}

export function SpAccessUserWalletsSection({ detail }: { detail: SpAccessDetail }) {
  const t = useTranslations('modules.sp-access');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [draft, setDraft] = React.useState<DraftFilters>(EMPTY_DRAFT);
  const [applied, setApplied] = React.useState<DraftFilters>(EMPTY_DRAFT);
  const [viewingWalletId, setViewingWalletId] = React.useState<number | null>(null);

  const tokenNameOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [];
    (detail.tdList ?? []).forEach((token) => {
      const name = String(token.tdName ?? '').trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      const blockchain = String(token.blockchainName ?? '').trim();
      options.push({
        label: blockchain ? `${name} (${blockchain})` : name,
        value: name,
      });
    });
    return options;
  }, [detail.tdList]);

  const { data, isLoading } = useSpAccessUserWalletsQuery({
    spCode: detail.spCode,
    pageNum: page,
    pageSize,
    walletAddress: applied.walletAddress,
    custodyModel: applied.custodyModel === ALL_VALUE ? '' : applied.custodyModel,
    tokenName: applied.tokenName === ALL_VALUE ? '' : applied.tokenName,
    tokenType: applied.tokenType === ALL_VALUE ? '' : applied.tokenType,
    ...dateToRangeMs(applied.createDateFrom, applied.createDateTo),
    kycRequired: applied.kycRequired === ALL_VALUE ? '' : applied.kycRequired,
    status: applied.status === ALL_VALUE ? '' : applied.status,
  });

  const preflight = useUserWalletTxListPreflightMutation();

  const handleTxnDetails = (record: SpAccessUserWallet) => {
    const walletId = Number(record.walletId);
    if (!Number.isFinite(walletId) || walletId <= 0) {
      toast.warning(t('sp_access_0145'));
      return;
    }
    setViewingWalletId(walletId);
    // 上游先调 userWalletTxList 预检（code!==0 报错不跳转），成功后路由
    preflight.mutate(
      { walletId },
      {
        onSuccess: () => {
          router.push(`/wallet/user-wallet/view?walletId=${walletId}&tab=transactions`);
        },
        onSettled: () => setViewingWalletId(null),
      },
    );
  };

  const rows = data?.rows ?? [];

  const columns = React.useMemo<ColumnDef<SpAccessUserWallet & { id: string }>[]>(
    () => [
      {
        accessorKey: 'walletAddress',
        header: t('user_wallet_001'),
        cell: ({ getValue }) => (
          <CopyableEllipsisText value={getValue() as string} truncate="middle" />
        ),
      },
      {
        accessorKey: 'walletType',
        header: t('user_wallet_004'),
        cell: ({ getValue }) => (getValue() as string) || EMPTY_FIELD_VALUE,
      },
      {
        accessorKey: 'privateKeyCustodyModel',
        header: t('sp_access_0108'),
        cell: ({ getValue }) => {
          const raw = Number(getValue());
          const labelKey = [1, 2, 3].includes(raw) ? `sp_access_011${raw}` : '';
          return labelKey ? t(labelKey) : EMPTY_FIELD_VALUE;
        },
      },
      {
        accessorKey: 'tdName',
        header: t('transaction_flow_0018'),
        cell: ({ getValue }) => (getValue() as string) || EMPTY_FIELD_VALUE,
      },
      {
        accessorKey: 'tokenType',
        header: t('tokenized_deposit_0062'),
        cell: ({ getValue }) => {
          const raw = getValue();
          return raw !== null && raw !== undefined && raw !== ''
            ? t(`token_type_${raw}`)
            : EMPTY_FIELD_VALUE;
        },
      },
      {
        accessorKey: 'stablecoinCount',
        header: t('sp_access_0138'),
        cell: ({ getValue }) => formatAmount(getValue() as string | number | undefined),
      },
      {
        accessorKey: 'createTime',
        header: t('user_wallet_002'),
        cell: ({ getValue }) => formatTimestamp(getValue() as number | undefined),
      },
      {
        accessorKey: 'kycRequired',
        header: t('sp_access_0110'),
        cell: ({ getValue }) => {
          const raw = getValue();
          if (raw === null || raw === undefined || raw === '') return EMPTY_FIELD_VALUE;
          return Number(raw) === 1 ? t('PUB_Yes') : t('PUB_No');
        },
      },
      {
        accessorKey: 'state',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <SpAccessStatusBadge kind="walletStatus" status={Number(getValue())} />
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        enableSorting: false,
        cell: ({ row }) => {
          const walletId = Number(row.original.walletId);
          const disabled = !Number.isFinite(walletId) || walletId <= 0;
          return (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={disabled || viewingWalletId === walletId}
              onClick={() => handleTxnDetails(row.original)}
            >
              {t('sp_access_0139')}
            </Button>
          );
        },
      },
    ],
    [t, viewingWalletId],
  );

  const setDraftField = (field: keyof DraftFilters, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6">
        <div className="text-base font-semibold">{t('sp_access_0051')}</div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('sp_access_0144').replace('****', detail.spName || EMPTY_FIELD_VALUE)}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('user_wallet_001')}</span>
            <Input
              value={draft.walletAddress}
              placeholder={t('user_wallet_001')}
              onChange={(event) => setDraftField('walletAddress', event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('sp_access_0108')}</span>
            <Select value={draft.custodyModel} onValueChange={(value) => setDraftField('custodyModel', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {CUSTODY_MODEL_FILTER_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`sp_access_011${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('transaction_flow_0018')}</span>
            <Select value={draft.tokenName} onValueChange={(value) => setDraftField('tokenName', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {tokenNameOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('tokenized_deposit_0062')}</span>
            <Select value={draft.tokenType} onValueChange={(value) => setDraftField('tokenType', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {TOKEN_TYPE_FILTER_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t(`token_type_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('user_wallet_002')}</span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                aria-label={t('sp_access_0140')}
                value={draft.createDateFrom}
                onChange={(event) => setDraftField('createDateFrom', event.target.value)}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                aria-label={t('sp_access_0141')}
                value={draft.createDateTo}
                onChange={(event) => setDraftField('createDateTo', event.target.value)}
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('sp_access_0110')}</span>
            <Select value={draft.kycRequired} onValueChange={(value) => setDraftField('kycRequired', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                <SelectItem value="1">{t('PUB_Yes')}</SelectItem>
                <SelectItem value="0">{t('PUB_No')}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('PUB_Status')}</span>
            <Select value={draft.status} onValueChange={(value) => setDraftField('status', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('PUB_All')}</SelectItem>
                {[1, 2, 3].map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t(`user_wallet_state_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setApplied(EMPTY_DRAFT);
              setPage(1);
              setPageSize(10);
            }}
          >
            {t('PUB_Reset')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setApplied(draft);
              setPage(1);
            }}
          >
            {t('PUB_Query')}
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-3 text-base font-semibold">{t('user_wallet_000')}</div>
        <DataTable
          columns={columns}
          data={rows.map((row, index) => ({ ...row, id: String(row.walletId ?? row.walletAddress ?? index) }))}
          isLoading={isLoading}
          emptyMessage={tCommon('noData')}
          pagination={{
            page,
            pageSize: data?.pageSize ?? pageSize,
            total: data?.total ?? 0,
            onPageChange: setPage,
          }}
        />
      </div>
    </div>
  );
}
