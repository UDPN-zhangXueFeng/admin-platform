'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  Checkbox,
  DataTable,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import {
  downloadSpAccessBusinessLicense,
  downloadSpAccessSecretKey,
} from '@myorg/modules/td-admin/data-access';
import type {
  SpAccessDetail,
  SpAccessDetailAccessItem,
  SpAccessDetailTd,
} from '@myorg/modules/td-admin/data-access';
import { SP_ACCESS_API_DOC_URL } from './constants';
import {
  EMPTY_FIELD_VALUE,
  formatTimestamp,
  formatTokenKycRequiredLabel,
} from './formatters';
import { SpAccessStatusBadge } from './sp-access-status-badge';

/**
 * 详情页「基本信息」区（上游 BaseInfoSection）：服务商详情 + 私钥托管模型 +
 * 交易提交策略 + 代币权限表（Download 密钥 / API 文档动作）。
 */

const PRIVATE_KEY_MODEL_OPTIONS = [
  { key: '1', labelKey: 'sp_access_0111' },
  { key: '2', labelKey: 'sp_access_0112' },
  { key: '3', labelKey: 'sp_access_0113' },
] as const;

const TRANSACTION_POLICY_OPTIONS = [
  { key: '1', labelKey: 'sp_access_0132' },
  { key: '2', labelKey: 'sp_access_0133' },
] as const;

const RECONCILIATION_LABEL_KEYS: Record<number, string> = {
  1: 'sp_access_0114',
  2: 'sp_access_0115',
  3: 'sp_access_0116',
};

const RECONCILIATION_TOOLTIP_KEYS: Record<number, string> = {
  1: 'sp_access_0117',
  2: 'sp_access_0118',
  3: 'sp_access_0119',
};

function parseSelection(value: string | undefined | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}


function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const elink = document.createElement('a');
  elink.download = fileName;
  elink.style.display = 'none';
  elink.href = URL.createObjectURL(blob);
  document.body.appendChild(elink);
  elink.click();
  URL.revokeObjectURL(elink.href);
  document.body.removeChild(elink);
}

interface TokenPermissionRow {
  id: string;
  tokenName: string;
  tokenType: string;
  blockchain: string;
  walletAddress: string;
  openApiPermission: React.ReactNode;
  webhookUrl: string;
  contractAddress: string;
  tokenContractPermission: React.ReactNode;
  kycRequired: string;
  state: number;
}

function DetailField({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'md:col-span-2 xl:col-span-4' : ''}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

export function SpAccessBaseInfoSection({ detail }: { detail: SpAccessDetail }) {
  const t = useTranslations('modules.sp-access');
  const spInfoState = Number(detail.state ?? NaN);
  const isActive = spInfoState === 1;

  const [downloadingLicense, setDownloadingLicense] = React.useState(false);
  const [downloadingSecretKey, setDownloadingSecretKey] = React.useState(false);

  const handleDownloadBusinessLicense = async () => {
    if (!detail.spId || !detail.busType || downloadingLicense) {
      return;
    }
    setDownloadingLicense(true);
    try {
      const { blob, fileName } = await downloadSpAccessBusinessLicense(
        { busId: detail.spId, busType: detail.busType },
        detail.fileName || 'business-license',
      );
      triggerBrowserDownload(blob, fileName);
      toast.success(t('PUB_Success').replace('****', t('PUB_Download')));
    } finally {
      setDownloadingLicense(false);
    }
  };

  const handleDownloadSecretKey = async () => {
    if (!isActive || downloadingSecretKey) {
      return;
    }
    setDownloadingSecretKey(true);
    try {
      const { blob, fileName } = await downloadSpAccessSecretKey(detail.spCode);
      triggerBrowserDownload(blob, fileName);
      toast.success(t('PUB_Success').replace('****', t('PUB_Download')));
    } finally {
      setDownloadingSecretKey(false);
    }
  };

  const custodySelection = parseSelection(detail.privateKeyCustodyModel);
  const policySelection = parseSelection(detail.transactionPolicy);

  const renderPermissionContent = (access?: SpAccessDetailAccessItem) => {
    if (!access) {
      return EMPTY_FIELD_VALUE;
    }
    const walletNames = (access.typeAndPermissionList ?? [])
      .flatMap((entry) => entry.walletTypeList?.map((wallet) => wallet.name) ?? [])
      .filter((name): name is string => !!name);
    const enableTransactions = access.transactionToggle === 2 ? t('PUB_No') : t('PUB_Yes');
    return (
      <div className="text-sm leading-6">
        <span>
          {t('sp_access_0135')}: {walletNames.slice(0, 4).join(', ') || '--'}
        </span>
        {walletNames.length > 4 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="link" size="sm" className="h-auto p-0">
                  , +{walletNames.length - 4} more
                </Button>
              </TooltipTrigger>
              <TooltipContent>{walletNames.slice(4).join(', ')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        <br />
        <span>
          {t('sp_access_0134')}: {enableTransactions}
        </span>
      </div>
    );
  };

  const tokenRows: TokenPermissionRow[] = (detail.tdList ?? []).map(
    (token: SpAccessDetailTd, index) => {
      const openApiAccess = token.accessList?.find((access) => access.accessType === 1);
      const contractAccess = token.accessList?.find((access) => access.accessType === 5);
      const hasContract = !!token.contractAddress;
      return {
        id: String(token.tdId ?? index),
        tokenName: token.tdName || EMPTY_FIELD_VALUE,
        tokenType: token.tokenType ? t(`token_type_${token.tokenType}`) : EMPTY_FIELD_VALUE,
        blockchain: token.blockchainName || EMPTY_FIELD_VALUE,
        walletAddress: token.walletAddress || EMPTY_FIELD_VALUE,
        openApiPermission: renderPermissionContent(openApiAccess),
        webhookUrl: token.webhookUrl || EMPTY_FIELD_VALUE,
        contractAddress: token.contractAddress || EMPTY_FIELD_VALUE,
        tokenContractPermission: hasContract
          ? renderPermissionContent(contractAccess)
          : EMPTY_FIELD_VALUE,
        kycRequired: (() => {
          const kyc = formatTokenKycRequiredLabel(token.kycRequired);
          return kyc === 'yes' ? t('PUB_Yes') : kyc === 'no' ? t('PUB_No') : EMPTY_FIELD_VALUE;
        })(),
        state: Number(token.state ?? 0),
      };
    },
  );

  const tokenColumns = React.useMemo<ColumnDef<TokenPermissionRow>[]>(
    () => [
      { accessorKey: 'tokenName', header: t('sp_access_0044') },
      { accessorKey: 'tokenType', header: t('sp_access_0136') },
      { accessorKey: 'blockchain', header: t('sp_access_0059') },
      { accessorKey: 'walletAddress', header: t('sp_access_0045') },
      { accessorKey: 'openApiPermission', header: t('sp_access_0064'), enableSorting: false },
      { accessorKey: 'webhookUrl', header: t('sp_access_0122') },
      { accessorKey: 'contractAddress', header: t('sp_access_0048') },
      {
        accessorKey: 'tokenContractPermission',
        header: t('sp_access_0047'),
        enableSorting: false,
      },
      { accessorKey: 'kycRequired', header: t('sp_access_0110') },
      {
        accessorKey: 'state',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <SpAccessStatusBadge kind="taskStatus" status={Number(getValue())} />
        ),
      },
    ],
    [],
  );

  const reconciliationKey = Number(detail.reconciliationFrequency);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border bg-card">
        <div className="border-b p-4 text-base font-semibold">{t('sp_access_0107')}</div>
        <dl className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label={t('sp_access_0000')}>
            {detail.spName || EMPTY_FIELD_VALUE}
          </DetailField>
          <DetailField label={t('PUB_Status')}>
            <SpAccessStatusBadge kind="spStatus" status={spInfoState} />
          </DetailField>
          <DetailField label={t('sp_access_0065')}>
            {detail.spType ? t(`service_provider_type_${detail.spType}`) : EMPTY_FIELD_VALUE}
          </DetailField>
          <DetailField label={t('sp_access_0039')}>
            {detail.contactName || EMPTY_FIELD_VALUE}
          </DetailField>
          <DetailField label={t('PUB_Email')}>{detail.email || EMPTY_FIELD_VALUE}</DetailField>
          <DetailField label={t('PUB_Phone')}>{detail.phone || EMPTY_FIELD_VALUE}</DetailField>
          <DetailField label={t('sp_access_0041')}>
            {detail.fileName ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                disabled={downloadingLicense}
                onClick={handleDownloadBusinessLicense}
              >
                {detail.fileName}
              </Button>
            ) : (
              EMPTY_FIELD_VALUE
            )}
          </DetailField>
          <DetailField label={t('sp_access_0100')}>
            {Number(detail.metaType) === 5 ? t('PUB_Yes') : t('PUB_No')}
          </DetailField>
          <DetailField label={t('sp_access_0101')}>
            <span className="inline-flex items-center gap-1">
              {RECONCILIATION_LABEL_KEYS[reconciliationKey]
                ? t(RECONCILIATION_LABEL_KEYS[reconciliationKey])
                : EMPTY_FIELD_VALUE}
              {RECONCILIATION_TOOLTIP_KEYS[reconciliationKey] ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72">
                      {t(RECONCILIATION_TOOLTIP_KEYS[reconciliationKey])}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </span>
          </DetailField>
          <DetailField label={t('sp_access_0040')} wide>
            {detail.spDesc || EMPTY_FIELD_VALUE}
          </DetailField>
          <DetailField label={t('PUB_Creater')}>{detail.createUser || EMPTY_FIELD_VALUE}</DetailField>
          <DetailField label={t('sp_access_0104')}>
            {detail.createTime && detail.createTime !== 0
              ? formatTimestamp(detail.createTime)
              : EMPTY_FIELD_VALUE}
          </DetailField>
        </dl>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b p-4 text-base font-semibold">{t('sp_access_0108')}</div>
        <div className="p-4">
          <div className="text-sm text-muted-foreground">{t('sp_access_0105')}</div>
          <div className="mt-2 flex flex-wrap gap-6">
            {PRIVATE_KEY_MODEL_OPTIONS.map((model) => (
              <label key={model.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={custodySelection.includes(model.key)} disabled />
                {t(model.labelKey)}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b p-4 text-base font-semibold">{t('sp_access_0106')}</div>
        <div className="p-4">
          <div className="text-sm text-muted-foreground">{t('sp_access_0105')}</div>
          <div className="mt-2 flex flex-wrap gap-6">
            {TRANSACTION_POLICY_OPTIONS.map((policy) => (
              <label key={policy.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={policySelection.includes(policy.key)} disabled />
                {t(policy.labelKey)}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{t('sp_access_0063')}</h3>
          <div className="flex items-center gap-6">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-72">{t('sp_access_0054')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm text-muted-foreground"
              disabled={!isActive}
              onClick={handleDownloadSecretKey}
            >
              {t('PUB_Download')}
            </Button>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() => window.open(SP_ACCESS_API_DOC_URL)}
            >
              {t('sp_access_0055')}
            </Button>
          </div>
        </div>
        <DataTable
          columns={tokenColumns}
          data={tokenRows}
          pagination={{
            page: 1,
            pageSize: Math.max(tokenRows.length, 1),
            total: tokenRows.length,
            onPageChange: () => undefined,
          }}
        />
      </section>
    </div>
  );
}
