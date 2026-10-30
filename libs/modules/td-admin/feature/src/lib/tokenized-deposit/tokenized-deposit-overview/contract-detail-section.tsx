/**
 * ContractDetailSection — 合约部署 Tab 合约明细表区块。
 *
 * 源: tab-contracts.tsx 431-551（useContractDetailQuery 明细表）。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { Button, DataTable } from '@myorg/shared/ui';
import { EMPTY_DISPLAY } from '@myorg/modules/td-admin/data-access';
import {
  useContractDetailQuery,
  type ApplyListItem,
  type ContractDetailItem,
} from '@myorg/modules/td-admin/data-access';
import {
  TokenizedDepositCopy,
  TokenizedDepositStatusBadge,
} from '..';
import { formatAdminTimestamp } from '../../format-admin-time';

// ═══════════════════════════════════════════════════════════════════
// 合约明细表（useContractDetailQuery）
// ═══════════════════════════════════════════════════════════════════

/**
 * 合约明细表区块。
 *
 * endpoint: POST /api/manage/v1/td/contract/detail（getContractInfoApi）。
 * body: stablecoinCode。源 Table pagination={false}。
 */
export function ContractDetailSection({
  td,
}: {
  td: ApplyListItem;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const params = React.useMemo(
    () => ({ stablecoinCode: td?.code ?? '' }),
    [td?.code],
  );

  const query = useContractDetailQuery(params);
  const rows = query.data ?? [];
  const isLoading = query.isLoading || query.isFetching;

  const columns = React.useMemo<ColumnDef<ContractDetailItem>[]>(
    () => [
      {
        // tokenized_deposit_0016：contractName
        accessorKey: 'contractName',
        header: t('tokenized_deposit_0016'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.contractName} />
        ),
      },
      {
        // tokenized_deposit_0023：contractVersion
        accessorKey: 'contractVersion',
        header: t('tokenized_deposit_0023'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.contractVersion} />
        ),
      },
      {
        // tokenized_deposit_0024：contractAddress
        accessorKey: 'contractAddress',
        header: t('tokenized_deposit_0024'),
        cell: ({ row }) => (
          <TokenizedDepositCopy text={row.original.contractAddress} />
        ),
      },
      {
        // tokenized_deposit_0172：contractHash（空串 → '--'）
        accessorKey: 'contractHash',
        header: t('tokenized_deposit_0172'),
        cell: ({ row }) => {
          const hash = row.original.contractHash;
          if (hash === '' || hash == null) {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          return <TokenizedDepositCopy text={hash} />;
        },
      },
      {
        // tokenized_deposit_0126：deployTime
        accessorKey: 'deployTime',
        header: t('tokenized_deposit_0126'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatAdminTimestamp(val) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        // PUB_Status：smart_contract_status_{state}
        accessorKey: 'state',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <TokenizedDepositStatusBadge
            dimension="smartContract"
            status={getValue<number>()}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <section>
      {/* 源：标题 tokenized_deposit_0127「Smart Contract Information」 */}
      <h3 className="mb-3 ml-1 text-base font-semibold">
        {t('tokenized_deposit_0127')}
      </h3>
      {query.isError && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-3 text-sm text-destructive"
        >
          <span>{t('td_query_load_failed')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
          >
            {t('td_retry')}
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={t('empty')}
      />
    </section>
  );
}
