/**
 * DeployHistoryModal — 部署历史 Modal。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的部署历史 CustomModal
 * （源 1350-1441）：smartHistory（取 data[0]）+ 明细表。
 *
 * ## 数据（源 smartHistory = getContractHistoryApi 取 data[0]）
 *
 * useContractDeployHistoryQuery(stablecoinCode) 内部已取 data[0]，返回单条历史
 * （tdName/packageName/packageVersion/deployTime/detailList）。
 *
 * ## 明细表（源 1374-1439 Table）
 *
 * 7 列：contractName（contractName_${n} 文案）/ contractVersion / contractAddress /
 * blockchainName / ownerAddress / txHash / state（smart_contract_status_${state}）。
 * 源全用 CustomCopy 展示（长地址可复制 + ellipsis），迁移用 TokenizedDepositCopy。
 *
 * ## 与源差异
 *
 * - antd Table + CustomCopy → shared/ui DataTable + TokenizedDepositCopy。
 * - smartHistory 由 props.history 透传（Shell useContractDeployHistoryQuery 已取 data[0]）。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import { EMPTY_DISPLAY } from '@myorg/modules/tokenized-deposit/util';
import type {
  ContractDetailItem,
  DeployHistoryItem,
} from '@myorg/modules/tokenized-deposit/data-access';
import { TokenizedDepositCopy } from '@myorg/modules/tokenized-deposit/ui';

/** 时间戳格式（源 formatTimestamp → 'YYYY-MM-DD HH:mm:ss'）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 部署历史明细行（源 detailList 元素）。
 *
 * model.ts ContractDetailItem 缺 blockchainName/ownerAddress/txHash（源部署历史表
 * 7 列用到），故本地补全字段。`id` 为 DataTable 契约（注入）。
 */
interface DeployHistoryDetailRow {
  id: string;
  contractName?: string | number;
  contractVersion?: string;
  contractAddress?: string;
  blockchainName?: string;
  ownerAddress?: string;
  txHash?: string;
  state?: number;
}

export interface DeployHistoryModalProps {
  /** Modal 开关。 */
  open: boolean;
  /** 部署历史单条（useContractDeployHistoryQuery 返回 data[0]）。 */
  history?: DeployHistoryItem;
  /** 取消回调。 */
  onCancel: () => void;
}

/**
 * 部署历史明细表列定义（源 1377-1438，7 列）。
 *
 * contractName 列源用 CustomCopy copyName={t(`contractName_${Number(contractName)}`)}
 * —— contractName 字段是数字编码，转文案。其余列纯 Copy。
 */
function useHistoryColumns(): ColumnDef<DeployHistoryDetailRow>[] {
  const t = useTranslations('modules.tokenized-deposit');

  return React.useMemo(
    () => [
      {
        // tokenized_deposit_0123：contractName → contractName_${n}（编码转文案）
        accessorKey: 'contractName',
        header: t('tokenized_deposit_0123'),
        cell: ({ getValue }) => {
          const raw = getValue<string | number | undefined>();
          const code = raw == null ? '' : Number(raw);
          return (
            <TokenizedDepositCopy
              text={Number.isNaN(code) ? '' : t(`contractName_${code}`)}
            />
          );
        },
      },
      {
        // tokenized_deposit_0023：contractVersion
        accessorKey: 'contractVersion',
        header: t('tokenized_deposit_0023'),
        cell: ({ getValue }) => (
          <TokenizedDepositCopy text={getValue<string>() ?? ''} />
        ),
      },
      {
        // tokenized_deposit_0024：contractAddress（长地址，ellipsis）
        accessorKey: 'contractAddress',
        header: t('tokenized_deposit_0024'),
        cell: ({ getValue }) => (
          <TokenizedDepositCopy text={getValue<string>() ?? ''} ellipsis />
        ),
      },
      {
        // tokenized_deposit_0007：blockchainName
        accessorKey: 'blockchainName',
        header: t('tokenized_deposit_0007'),
        cell: ({ getValue }) => (
          <TokenizedDepositCopy text={getValue<string>() ?? ''} />
        ),
      },
      {
        // tokenized_deposit_0060：ownerAddress（长地址，ellipsis）
        accessorKey: 'ownerAddress',
        header: t('tokenized_deposit_0060'),
        cell: ({ getValue }) => (
          <TokenizedDepositCopy text={getValue<string>() ?? ''} ellipsis />
        ),
      },
      {
        // tokenized_deposit_0060 alias txHash：用 tokenized_deposit_0060 不合适，
        // 源用 tokenized_deposit_0060 作 txHash 标题（源 1423）。保持与源一致。
        accessorKey: 'txHash',
        header: t('tokenized_deposit_0060'),
        cell: ({ getValue }) => (
          <TokenizedDepositCopy text={getValue<string>() ?? ''} ellipsis />
        ),
      },
      {
        // PUB_Status：state → smart_contract_status_${state}
        accessorKey: 'state',
        header: t('PUB_Status'),
        cell: ({ getValue }) => {
          const state = getValue<number>();
          return <span>{state == null ? '' : t(`smart_contract_status_${state}`)}</span>;
        },
      },
    ],
    [t],
  );
}

/** 明细表（DataTable 需要 data 注入 id 的行）。 */
function HistoryDetailTable({
  rows,
}: {
  rows: ContractDetailItem[] | undefined;
}): React.JSX.Element {
  const columns = useHistoryColumns();
  const data = React.useMemo<DeployHistoryDetailRow[]>(
    () =>
      (rows ?? [])
        .filter((r): r is ContractDetailItem => r != null)
        .map((r) => r as unknown as DeployHistoryDetailRow),
    [rows],
  );
  return <DataTable columns={columns} data={data} />;
}

/**
 * 部署历史 Modal。
 *
 * 用法：
 * ```tsx
 * <DeployHistoryModal
 *   open={isModalOpenHistory}
 *   history={deployHistory}
 *   onCancel={() => setIsModalOpenHistory(false)}
 * />
 * ```
 */
export function DeployHistoryModal({
  open,
  history,
  onCancel,
}: DeployHistoryModalProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
    >
      <DialogContent className="max-w-[900px]">
        <DialogHeader>
          <DialogTitle>{t('tokenized_deposit_0025')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('tokenized_deposit_0025')}
          </DialogDescription>
        </DialogHeader>

        {/* 标题行（源 1361-1372） */}
        <div className="mb-2 ml-2 mt-4 font-bold">
          {t('tokenized_deposit_0128')}
          {history?.tdName ?? ''}
        </div>
        <div className="mb-2 ml-2 font-bold">
          {/* 源 t('New Deployment: ') + packageName + ' ' + tokenized_deposit_0130 + packageVersion */}
          {t('tokenized_deposit_0177')}
          {history?.packageName ?? ''} {t('tokenized_deposit_0130')}
          {history?.packageVersion ?? ''}
        </div>
        <div className="mb-4 ml-2">
          {history?.deployTime
            ? formatDate(history.deployTime, DATETIME_FMT)
            : EMPTY_DISPLAY}
        </div>

        {/* 明细表（源 1374-1439） */}
        <HistoryDetailTable rows={history?.detailList} />

        <DialogFooter className="flex-row justify-center sm:justify-center">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('PUB_Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
